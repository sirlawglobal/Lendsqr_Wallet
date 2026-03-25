import { Injectable, Inject } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import { CustomException } from '../common/exceptions/custom.exception';
import { IUser, IWallet } from '../common/interfaces';

@Injectable()
export class WalletService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async getBalance(userId: number) {
    const wallet = await this.knex<IWallet>('wallets')
      .where({ user_id: userId })
      .first();

    if (!wallet) {
      throw new CustomException('Wallet not found', 404);
    }

    return { balance: Number(wallet.balance) };
  }

  async fund(userId: number, amount: number, reference?: string) {
    if (amount <= 0) {
      throw new CustomException('Amount must be positive');
    }

    return this.knex.transaction(async (trx: Knex.Transaction) => {
      const wallet = await trx<IWallet>('wallets')
        .where({ user_id: userId })
        .first();

      if (!wallet) {
        throw new CustomException('Wallet not found', 404);
      }

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
    if (amount <= 0) {
      throw new CustomException('Amount must be positive');
    }

    return this.knex.transaction(async (trx: Knex.Transaction) => {
      // Look up recipient
      const recipient = await trx<IUser>('users')
        .where({ email: recipientEmail.toLowerCase() })
        .first();

      if (!recipient) {
        throw new CustomException('Recipient not found', 404);
      }

      // Prevent self-transfer
      if (recipient.id === senderId) {
        throw new CustomException('Cannot transfer to yourself', 400);
      }

      // Verify sender wallet
      const senderWallet = await trx<IWallet>('wallets')
        .where({ user_id: senderId })
        .first();

      if (!senderWallet) {
        throw new CustomException('Sender wallet not found', 404);
      }

      if (Number(senderWallet.balance) < amount) {
        throw new CustomException('Insufficient balance', 400);
      }

      // Verify recipient wallet exists
      const recipientWallet = await trx<IWallet>('wallets')
        .where({ user_id: recipient.id })
        .first();

      if (!recipientWallet) {
        throw new CustomException('Recipient wallet not found', 404);
      }

      // Execute transfer
      await trx('wallets').where({ user_id: senderId }).decrement('balance', amount);
      await trx('wallets').where({ user_id: recipient.id }).increment('balance', amount);

      const ref = `tx_${Date.now()}`;
      await trx('transactions').insert([
        {
          user_id: senderId,
          type: 'debit',
          amount,
          reference: `${ref}_debit`,
          description: `Transfer to ${recipientEmail}`,
        },
        {
          user_id: recipient.id,
          type: 'credit',
          amount,
          reference: `${ref}_credit`,
          description: `Received from user #${senderId}`,
        },
      ]);

      return { message: 'Transfer successful', reference: ref };
    });
  }

  async withdraw(userId: number, amount: number) {
    if (amount <= 0) {
      throw new CustomException('Amount must be positive');
    }

    return this.knex.transaction(async (trx: Knex.Transaction) => {
      const wallet = await trx<IWallet>('wallets')
        .where({ user_id: userId })
        .first();

      if (!wallet) {
        throw new CustomException('Wallet not found', 404);
      }

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

      return { message: 'Withdrawal successful' };
    });
  }
}
