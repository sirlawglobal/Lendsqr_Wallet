import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import * as nodemailer from 'nodemailer';
import { getEmailTemplate } from './email-template';
import { VerificationService } from '../verification/verification.service';

@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorker.name);
  private interval!: NodeJS.Timeout;
  private isProcessing = false;
  private transporter!: nodemailer.Transporter;

  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    private readonly configService: ConfigService,
    private readonly verificationService: VerificationService,
  ) { }

  async onModuleInit() {
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const host = this.configService.get<string>('SMTP_HOST') || 'smtp.gmail.com';
    const port = Number(this.configService.get<string>('SMTP_PORT')) || 465;
    const secure = this.configService.get<string>('SMTP_SECURE') !== 'false';

    if (!user || !pass) {
      this.logger.error('SMTP_USER or SMTP_PASS is not defined. Email notifications will fail.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
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
    this.interval = setInterval(() => {
      this.processOutbox();
      this.recoverStuckJobs();
    }, 5000);
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
      // Find messages that are pending OR failed but due for retry
      const messages = await this.knex('outbox')
        .where('status', 'pending')
        .orWhere(function () {
          this.where('status', 'failed')
            .andWhere('retry_count', '<', 5)
            // Exponential backoff: retry after (retry_count * 2) minutes
            .andWhere('updated_at', '<=', new Date(Date.now() - 1000 * 60 * 2)); 
        })
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
          } else if (msg.event_type === 'CHECK_KARMA') {
            const { userId, name: userName, phone, email } = payload;
            this.logger.log(`🔍 Running background Karma check for user: ${email}`);

            const results = await Promise.all([
              this.verificationService.checkKarma(phone),
              this.verificationService.checkKarma(email.trim().toLowerCase()),
            ]);

            // If either check resulted in an error (e.g. service down), throw to retry later
            const serviceError = results.find(res => res.status === 'error');
            if (serviceError) {
              throw new Error(`Karma service error: ${serviceError.message}`);
            }

            const isBlacklisted = results.some(res => res.status === 'success' && res.message === 'Successful');

            if (isBlacklisted) {
              this.logger.warn(`🚫 User ${email} is blacklisted! Notifying and deleting account data.`);
              
              toEmail = email;
              name = userName;
              subject = '⚠️ Registration Update - Lendsqr Wallet';
              html = getEmailTemplate(
                subject,
                name,
                `Thank you for your interest in Lendsqr Wallet. Unfortunately, we are unable to process your registration at this time as your identity has been flagged in our security verification process (Karma Blacklist).<br><br>As a result, your pending account and all associated data have been permanently deleted from our system.`,
                'Contact Support',
                'https://lendsqr.com/support'
              );

              // Transactions and Wallets are deleted via CASCADE on user_id
              await this.knex('users').where({ id: userId }).delete();
              
              this.logger.log(`🗑️ Data deleted for blacklisted user ${email}`);
            } else {
              this.logger.log(`✅ Karma check passed for ${email}. Activating account.`);
              await this.knex('users').where({ id: userId }).update({
                status: 'active',
                updated_at: this.knex.fn.now()
              });

              toEmail = email;
              name = userName;
              subject = '👋 Welcome to Lendsqr Wallet!';
              html = getEmailTemplate(
                subject,
                name,
                `Welcome to Lendsqr Wallet! Your account has been verified and created successfully.<br><br>You can now fund your wallet and start making secure transfers immediately.`,
                'Get Started',
                'https://lendsqr.com'
              );
            }
            this.logger.log(`✅ Karma check completed for ${email}${isBlacklisted ? ' (DELETED)' : ''}`);
          } else if (msg.event_type === 'REGISTRATION_REJECTED') {
            toEmail = payload.email;
            name = payload.name;
            subject = '⚠️ Registration Update - Lendsqr Wallet';
            html = getEmailTemplate(
              subject,
              name,
              `Thank you for your interest in Lendsqr Wallet. Unfortunately, we are unable to process your registration at this time as your identity has been flagged in our security verification process (Karma Blacklist).<br><br>As a result, your registration attempt has been rejected.`,
              'Contact Support',
              'https://lendsqr.com/support'
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
      this.logger.error(`Outbox polling error: ${error.message || error}`);
      if (error.stack) {
        this.logger.error(error.stack);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async recoverStuckJobs() {
    // Reset messages stuck in 'processing' for more than 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 1000 * 60 * 10);
    const affected = await this.knex('outbox')
      .where('status', 'processing')
      .andWhere('updated_at', '<', tenMinutesAgo)
      .update({
        status: 'pending',
        updated_at: this.knex.fn.now()
      });

    if (affected > 0) {
      this.logger.warn(`♻️ Recovered ${affected} stuck outbox jobs.`);
    }
  }
}
