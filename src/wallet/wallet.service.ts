import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CustomException } from '../common/exceptions/custom.exception';
import { createKnexInstance } from '../database/knex.service';

@Injectable()
export class WalletService {
  private knex: any;

  constructor(private configService: ConfigService) {
    this.knex = createKnexInstance(configService);
  }

  async getBalance(userId: number) {
    const wallet = await this.knex('wallets').where({ user_id: userId }).first();
    return { balance: wallet ? Number(wallet.balance) : 0 };
  }

  async fund(userId: number, amount: number, reference?: string) {
    if (amount <= 0) throw new CustomException('Amount must be positive');

    return this.knex.transaction(async (trx: any) => {
      await trx('wallets').where({ user_id: userId }).increment('balance', amount);
      await trx('transactions').insert({
        user_id: userId,
        type: 'credit',
        amount,
        reference: reference || `fund_${Date.now()}`,
        description: 'Wallet funding',
      });
      return { message: 'Funded successfully' };
    });
  }

  async transfer(senderId: number, recipientEmail: string, amount: number) {
    if (amount <= 0) throw new CustomException('Amount must be positive');

    return this.knex.transaction(async (trx: any) => {
      const recipient = await trx('users').where({ email: recipientEmail.toLowerCase() }).first();
      if (!recipient) throw new CustomException('Recipient not found', 404);

      const senderWallet = await trx('wallets').where({ user_id: senderId }).first();
      if (Number(senderWallet.balance) < amount) {
        throw new CustomException('Insufficient balance', 400);
      }

      await trx('wallets').where({ user_id: senderId }).decrement('balance', amount);
      await trx('wallets').where({ user_id: recipient.id }).increment('balance', amount);

      const ref = `tx_${Date.now()}`;
      await trx('transactions').insert([
        { user_id: senderId, type: 'debit', amount, reference: ref, description: `Transfer to ${recipientEmail}` },
        { user_id: recipient.id, type: 'credit', amount, reference: ref, description: `Received from user` },
      ]);

      return { message: 'Transfer successful', reference: ref };
    });
  }

  async withdraw(userId: number, amount: number) {
    if (amount <= 0) throw new CustomException('Amount must be positive');

    return this.knex.transaction(async (trx: any) => {
      const wallet = await trx('wallets').where({ user_id: userId }).first();
      if (Number(wallet.balance) < amount) {
        throw new CustomException('Insufficient balance', 400);
      }

      await trx('wallets').where({ user_id: userId }).decrement('balance', amount);
      await trx('transactions').insert({
        user_id: userId,
        type: 'debit',
        amount,
        reference: `wd_${Date.now()}`,
        description: 'Withdrawal',
      });

      return { message: 'Withdrawal successful (simulated)' };
    });
  }
}
