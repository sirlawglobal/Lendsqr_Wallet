import { Injectable, Inject } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import { CustomException } from '../common/exceptions/custom.exception';
import { IWallet } from '../common/interfaces/wallet.interface';
import { IUser } from '../common/interfaces/user.interface';
import { TransactionQueryDto } from './dto/transaction-query.dto';

@Injectable()
export class WalletService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) { }

  async getBalance(userId: string) {
    const wallet = await this.knex<IWallet>('wallets')
      .where({ user_id: userId })
      .first();

    if (!wallet) {
      throw new CustomException('Wallet not found', 404);
    }

    return { balance: Number(wallet.balance) };
  }

  async fund(userId: string, amount: number, reference?: string) {
    if (amount <= 0) {
      throw new CustomException('Amount must be positive', 400);
    }

    return this.knex.transaction(async (trx: Knex.Transaction) => {
      const wallet = await trx<IWallet>('wallets')
        .where({ user_id: userId })
        .first()
        .forUpdate();

      if (!wallet) {
        throw new CustomException('Wallet not found', 404);
      }

      await trx('wallets').where({ user_id: userId }).increment('balance', amount);
      const referenceToUse = reference || `fund_${Date.now()}`;
      const [transactionId] = await trx('transactions').insert({
        user_id: userId,
        type: 'credit',
        amount,
        reference: referenceToUse,
        description: 'Wallet funding',
      });

      await trx('outbox').insert({
        event_type: 'WALLET_FUNDED',
        payload: JSON.stringify({ userId, amount, reference: referenceToUse }),
        transaction_id: transactionId,
      });

      return { message: 'Funded successfully' };
    });
  }

  async transfer(senderId: string, recipientEmail: string, amount: number) {
    if (amount <= 0) {
      throw new CustomException('Amount must be positive', 400);
    }

    return this.knex.transaction(async (trx: Knex.Transaction) => {
      // 1. Find recipient
      const recipient = await trx<IUser>('users')
        .where({ email: recipientEmail.toLowerCase() })
        .first();

      if (!recipient) {
        throw new CustomException('Recipient not found', 404);
      }

      if (senderId === recipient.id) {
        throw new CustomException('Cannot transfer to yourself', 400);
      }

      // 2. Lock sender wallet
      const senderWallet = await trx<IWallet>('wallets')
        .where({ user_id: senderId })
        .first()
        .forUpdate();

      if (!senderWallet) {
        throw new CustomException('Sender wallet not found', 404);
      }

      if (Number(senderWallet.balance) < amount) {
        throw new CustomException('Insufficient balance', 400);
      }

      // 3. Lock recipient wallet
      await trx<IWallet>('wallets')
        .where({ user_id: recipient.id })
        .first()
        .forUpdate();

      // 4. Perform transfer
      await trx('wallets').where({ user_id: senderId }).decrement('balance', amount);
      await trx('wallets').where({ user_id: recipient.id }).increment('balance', amount);

      const ref = `tx_${Date.now()}`;
      const [debitTxId] = await trx('transactions').insert({
        user_id: senderId,
        type: 'debit',
        amount,
        reference: `${ref}_debit`,
        description: `Transfer to ${recipientEmail}`,
      });

      const [creditTxId] = await trx('transactions').insert({
        user_id: recipient.id,
        type: 'credit',
        amount,
        reference: `${ref}_credit`,
        description: `Received from user #${senderId}`,
      });

      await trx('outbox').insert([
        {
          event_type: 'TRANSFER_SENT',
          payload: JSON.stringify({ senderId, recipientEmail, amount, reference: ref }),
          transaction_id: debitTxId
        },
        {
          event_type: 'TRANSFER_RECEIVED',
          payload: JSON.stringify({ recipientId: recipient.id, senderId, amount, reference: ref }),
          transaction_id: creditTxId
        }
      ]);

      return { message: 'Transfer successful', reference: ref };
    });
  }

  async withdraw(userId: string, amount: number) {
    if (amount <= 0) {
      throw new CustomException('Amount must be positive', 400);
    }

    return this.knex.transaction(async (trx: Knex.Transaction) => {
      const wallet = await trx<IWallet>('wallets')
        .where({ user_id: userId })
        .first()
        .forUpdate();

      if (!wallet) {
        throw new CustomException('Wallet not found', 404);
      }

      if (Number(wallet.balance) < amount) {
        throw new CustomException('Insufficient balance', 400);
      }

      await trx('wallets').where({ user_id: userId }).decrement('balance', amount);
      const ref = `wd_${Date.now()}`;
      const [transactionId] = await trx('transactions').insert({
        user_id: userId,
        type: 'debit',
        amount,
        reference: ref,
        description: 'Withdrawal',
      });

      await trx('outbox').insert({
        event_type: 'WALLET_WITHDRAWN',
        payload: JSON.stringify({ userId, amount, reference: ref }),
        transaction_id: transactionId,
      });

      return { message: 'Withdrawal successful' };
    });
  }

  async getTransactions(userId: string, query: TransactionQueryDto) {
    return this.applyTransactionFilters(this.knex('transactions').where({ user_id: userId }), query);
  }

  async getAllTransactions(query: TransactionQueryDto) {
    return this.applyTransactionFilters(this.knex('transactions'), query);
  }

  private async applyTransactionFilters(queryBuilder: Knex.QueryBuilder, query: TransactionQueryDto) {
    const { type, page = 1, limit = 10, startDate, endDate, reference } = query;
    const offset = (page - 1) * limit;

    if (type) {
      queryBuilder.where({ type });
    }

    if (startDate) {
      queryBuilder.where('created_at', '>=', startDate);
    }

    if (endDate) {
      queryBuilder.where('created_at', '<=', endDate);
    }

    if (reference) {
      queryBuilder.where('reference', 'like', `%${reference}%`);
    }

    const [countResult, transactions] = await Promise.all([
      queryBuilder.clone().count('* as total').first(),
      queryBuilder
        .clone()
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset),
    ]);

    const total = Number(countResult?.total || 0);

    return {
      transactions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
