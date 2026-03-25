import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import * as nodemailer from 'nodemailer';
import { getEmailTemplate } from './email-template';

@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorker.name);
  private interval: NodeJS.Timeout;
  private isProcessing = false;
  private transporter: nodemailer.Transporter;

  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    private readonly configService: ConfigService,
  ) { }

  async onModuleInit() {
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!user || !pass) {
      this.logger.error('SMTP_USER or SMTP_PASS is not defined in environment variables. Email notifications will fail.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });

    // Verify connection on startup
    this.transporter.verify((error) => {
      if (error) {
        this.logger.error(`SMTP connection error: ${error.message}`);
      } else {
        this.logger.log('SMTP server is ready to take our messages');
      }
    });

    this.logger.log('Outbox Worker started. Polling every 5 seconds.');
    this.interval = setInterval(() => this.processOutbox(), 5000);
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  async processOutbox() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Find pending messages
      const messages = await this.knex('outbox')
        .where('status', 'pending')
        .orderBy('created_at', 'asc')
        .limit(10);

      for (const msg of messages) {
        try {
          // Mark as processing
          await this.knex('outbox').where({ id: msg.id }).update({ status: 'processing' });

          this.logger.log(`Processing event: ${msg.event_type} for transaction ${msg.transaction_id}`);
          const payload = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;

          let toEmail = null;
          let subject = '';
          let html = '';
          let name = '';

          if (msg.event_type === 'WALLET_FUNDED') {
            const user = await this.knex('users').where({ id: payload.userId }).first();
            if (user) {
              toEmail = user.email;
              name = user.name;
              subject = '💰 Fund Successful - Lendsqr Wallet';
              html = getEmailTemplate(
                subject,
                name,
                `Your wallet has been credited with <span class="highlight">${payload.amount}</span>.<br>Reference: <small>${payload.reference}</small>`,
              );
            }
          } else if (msg.event_type === 'TRANSFER_SENT') {
            const sender = await this.knex('users').where({ id: payload.senderId }).first();
            if (sender) {
              toEmail = sender.email;
              name = sender.name;
              subject = '💸 Transfer Sent - Lendsqr Wallet';
              html = getEmailTemplate(
                subject,
                name,
                `You successfully sent <span class="highlight">${payload.amount}</span> to <strong>${payload.recipientEmail}</strong>.<br>Reference: <small>${payload.reference}</small>`,
              );
            }
          } else if (msg.event_type === 'TRANSFER_RECEIVED') {
            const recipient = await this.knex('users').where({ id: payload.recipientId }).first();
            if (recipient) {
              toEmail = recipient.email;
              name = recipient.name;
              subject = '📩 Funds Received - Lendsqr Wallet';
              html = getEmailTemplate(
                subject,
                name,
                `You have received <span class="highlight">${payload.amount}</span> from your recent transaction.<br>Reference: <small>${payload.reference}</small>`,
              );
            }
          } else if (msg.event_type === 'WALLET_WITHDRAWN') {
            const user = await this.knex('users').where({ id: payload.userId }).first();
            if (user) {
              toEmail = user.email;
              name = user.name;
              subject = '🏧 Withdrawal Successful - Lendsqr Wallet';
              html = getEmailTemplate(
                subject,
                name,
                `You have successfully withdrawn <span class="highlight">${payload.amount}</span> from your wallet.<br>Reference: <small>${payload.reference}</small>`,
              );
            }
          } else if (msg.event_type === 'ACCOUNT_CREATED') {
            toEmail = payload.email;
            name = payload.name;
            subject = '👋 Welcome to Lendsqr Wallet!';
            html = getEmailTemplate(
              subject,
              name,
              `Welcome to Lendsqr Wallet! Your account has been created successfully.<br><br>You can now fund your wallet and start making secure transfers immediately.`,
              'Get Started',
              'https://lendsqr.com'
            );
          }

          if (toEmail) {
            await this.transporter.sendMail({
              from: `"Lendsqr Wallet" <${this.configService.get<string>('SMTP_USER')}>`,
              to: toEmail,
              subject,
              html,
            });
            this.logger.log(`✅ Styled Email Sent to ${toEmail} for event ${msg.event_type}`);
          } else {
            this.logger.warn(`Could not determine recipient email for event ${msg.event_type}`);
          }

          // Mark as sent
          await this.knex('outbox').where({ id: msg.id }).update({
            status: 'sent',
            updated_at: this.knex.fn.now()
          });
        } catch (error: any) {
          this.logger.error(`Failed to process message ${msg.id}: ${error.message}`);
          await this.knex('outbox')
            .where({ id: msg.id })
            .update({
              status: 'failed',
              retry_count: msg.retry_count + 1,
              updated_at: this.knex.fn.now()
            });
        }
      }
    } catch (error: any) {
      this.logger.error(`Outbox polling error: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }
}
