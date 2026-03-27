import { WalletService } from './wallet.service';
import { CustomException } from '../common/exceptions/custom.exception';

describe('WalletService', () => {
  let walletService: WalletService;
  let mockKnex: any;

  /**
   * Creates a fully chainable Knex mock.
   * ALL methods (where, first, forUpdate, insert, etc.) return the SAME mock
   * object so any chain depth works. When awaited, it resolves to `finalValue`.
   */
  const createMockChain = (finalValue: any) => {
    const mock: any = jest.fn(() => mock);
    const methods = [
      'where', 'orWhere', 'first', 'forUpdate', 'increment',
      'decrement', 'insert', 'orderBy', 'limit', 'offset',
      'update', 'count', 'clone', 'delete', 'andWhere', 'returning', 'select',
    ];
    methods.forEach(m => (mock[m] = jest.fn(() => mock)));
    mock.then = jest.fn((resolve: any) => Promise.resolve(finalValue).then(resolve));
    mock.catch = jest.fn((reject: any) => Promise.resolve(finalValue).catch(reject));
    return mock;
  };

  /**
   * Creates a Knex transaction mock (trx) that returns the same chainable mock
   * for every table call. Pass in overrides per table if you need specific
   * resolved values for individual queries.
   */
  const createTrx = (defaultFinalValue: any = null) => {
    // A single shared chain that resolves to defaultFinalValue
    const baseChain = createMockChain(defaultFinalValue);
    // trx itself is callable (e.g. trx('wallets')) and returns the baseChain
    const trx: any = jest.fn(() => baseChain);
    // Expose the chain methods directly on trx for tests that call trx.insert etc.
    Object.assign(trx, baseChain);
    trx.fn = { now: jest.fn(() => 'now') };
    return { trx, baseChain };
  };

  beforeEach(() => {
    mockKnex = jest.fn(() => createMockChain(null));
    mockKnex.transaction = jest.fn();
    mockKnex.fn = { now: jest.fn(() => 'now') };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── getBalance ─────────────────────────────────────────────────────────────

  describe('getBalance', () => {
    it('should return wallet balance for a valid user', async () => {
      mockKnex.mockReturnValue(createMockChain({ user_id: 'u1', balance: '500.00' }));
      const result = await walletService.getBalance('u1');
      expect(result).toEqual({ balance: 500 });
    });

    it('should throw if wallet is not found', async () => {
      mockKnex.mockReturnValue(createMockChain(null));
      await expect(walletService.getBalance('999')).rejects.toThrow(CustomException);
      await expect(walletService.getBalance('999')).rejects.toThrow('Wallet not found');
    });

    beforeEach(() => {
      walletService = new WalletService(mockKnex);
    });
  });

  // ─── fund ───────────────────────────────────────────────────────────────────

  describe('fund', () => {
    beforeEach(() => {
      walletService = new WalletService(mockKnex);
    });

    it('should fund wallet successfully', async () => {
      mockKnex.transaction.mockImplementation(async (callback: any) => {
        // Every chain resolves: wallet lookup → { balance: '100.00' }, insert → [1]
        const { trx, baseChain } = createTrx({ user_id: 'u1', balance: '100.00' });
        // insert needs to resolve to [1] so destructuring works
        baseChain.insert = jest.fn(() => createMockChain([1]));
        return callback(trx);
      });

      const result = await walletService.fund('u1', 200, 'ref_123');
      expect(result).toEqual({ message: 'Funded successfully' });
    });

    it('should throw if amount is zero or negative', async () => {
      await expect(walletService.fund('u1', 0)).rejects.toThrow('Amount must be positive');
      await expect(walletService.fund('u1', -50)).rejects.toThrow('Amount must be positive');
    });

    it('should throw if wallet is not found during funding', async () => {
      mockKnex.transaction.mockImplementation(async (callback: any) => {
        const { trx } = createTrx(null); // wallet lookup resolves to null
        return callback(trx);
      });

      await expect(walletService.fund('999', 100)).rejects.toThrow('Wallet not found');
    });
  });

  // ─── transfer ───────────────────────────────────────────────────────────────

  describe('transfer', () => {
    beforeEach(() => {
      walletService = new WalletService(mockKnex);
    });

    it('should transfer funds successfully', async () => {
      mockKnex.transaction.mockImplementation(async (callback: any) => {
        // We need sequential resolves per table call
        const recipientChain = createMockChain({ id: 'u2', email: 'recipient@example.com' });
        const senderWalletChain = createMockChain({ user_id: 'u1', balance: '500.00' });
        const recipientWalletChain = createMockChain({ user_id: 'u2', balance: '100.00' });
        const insertChain = createMockChain([1]);
        const mutationChain = createMockChain(1); // for decrement/increment

        let callCount = 0;
        const trx: any = jest.fn(() => {
          callCount++;
          // 1: users (recipient lookup), 2: wallets (sender), 3: wallets (recipient)
          // 4+: transactions/outbox inserts
          if (callCount === 1) return recipientChain;
          if (callCount === 2) return senderWalletChain;
          if (callCount === 3) return recipientWalletChain;
          if (callCount === 4 || callCount === 5) return mutationChain; // decrement/increment
          return insertChain;
        });
        return callback(trx);
      });

      const result = await walletService.transfer('u1', 'recipient@example.com', 100);
      expect(result.message).toBe('Transfer successful');
      expect(result.reference).toBeDefined();
    });

    it('should throw if amount is zero or negative', async () => {
      await expect(walletService.transfer('u1', 'r@example.com', 0)).rejects.toThrow('Amount must be positive');
      await expect(walletService.transfer('u1', 'r@example.com', -10)).rejects.toThrow('Amount must be positive');
    });

    it('should throw if recipient does not exist', async () => {
      mockKnex.transaction.mockImplementation(async (callback: any) => {
        const { trx } = createTrx(null); // all lookups return null → recipient not found
        return callback(trx);
      });

      await expect(walletService.transfer('u1', 'nobody@example.com', 100)).rejects.toThrow('Recipient not found');
    });

    it('should throw if sender tries to transfer to themselves', async () => {
      mockKnex.transaction.mockImplementation(async (callback: any) => {
        const recipientChain = createMockChain({ id: 'u1', email: 'sender@example.com' }); // same id as sender
        const trx: any = jest.fn(() => recipientChain);
        return callback(trx);
      });

      await expect(walletService.transfer('u1', 'sender@example.com', 100)).rejects.toThrow('Cannot transfer to yourself');
    });

    it('should throw if sender has insufficient balance', async () => {
      mockKnex.transaction.mockImplementation(async (callback: any) => {
        const recipientChain = createMockChain({ id: 'u2', email: 'recipient@example.com' });
        const senderWalletChain = createMockChain({ user_id: 'u1', balance: '50.00' }); // low balance

        let callCount = 0;
        const trx: any = jest.fn(() => {
          callCount++;
          if (callCount === 1) return recipientChain;
          return senderWalletChain;
        });
        return callback(trx);
      });

      await expect(walletService.transfer('u1', 'recipient@example.com', 100)).rejects.toThrow('Insufficient balance');
    });

    it('should throw if sender wallet is not found', async () => {
      mockKnex.transaction.mockImplementation(async (callback: any) => {
        const recipientChain = createMockChain({ id: 'u2', email: 'recipient@example.com' });
        const noWalletChain = createMockChain(null); // sender wallet not found

        let callCount = 0;
        const trx: any = jest.fn(() => {
          callCount++;
          if (callCount === 1) return recipientChain;
          return noWalletChain;
        });
        return callback(trx);
      });

      await expect(walletService.transfer('u1', 'recipient@example.com', 100)).rejects.toThrow('Sender wallet not found');
    });
  });

  // ─── withdraw ───────────────────────────────────────────────────────────────

  describe('withdraw', () => {
    beforeEach(() => {
      walletService = new WalletService(mockKnex);
    });

    it('should withdraw funds successfully', async () => {
      mockKnex.transaction.mockImplementation(async (callback: any) => {
        const { trx, baseChain } = createTrx({ user_id: 'u1', balance: '500.00' });
        baseChain.insert = jest.fn(() => createMockChain([1]));
        return callback(trx);
      });

      const result = await walletService.withdraw('u1', 100);
      expect(result).toEqual({ message: 'Withdrawal successful' });
    });

    it('should throw if amount is zero or negative', async () => {
      await expect(walletService.withdraw('u1', 0)).rejects.toThrow('Amount must be positive');
      await expect(walletService.withdraw('u1', -20)).rejects.toThrow('Amount must be positive');
    });

    it('should throw if wallet is not found', async () => {
      mockKnex.transaction.mockImplementation(async (callback: any) => {
        const { trx } = createTrx(null);
        return callback(trx);
      });

      await expect(walletService.withdraw('999', 100)).rejects.toThrow('Wallet not found');
    });

    it('should throw if insufficient balance for withdrawal', async () => {
      mockKnex.transaction.mockImplementation(async (callback: any) => {
        const { trx } = createTrx({ user_id: 'u1', balance: '30.00' }); // low balance
        return callback(trx);
      });

      await expect(walletService.withdraw('u1', 100)).rejects.toThrow('Insufficient balance');
    });
  });

  // ─── transaction fetching ───────────────────────────────────────────────────

  describe('transaction fetching', () => {
    let mockQueryBuilder: any;

    beforeEach(() => {
      mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ total: 0 }),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockResolvedValue([]),
      };
      mockKnex.mockReturnValue(mockQueryBuilder);
      walletService = new WalletService(mockKnex);
    });

    it('should fetch transactions for a specific user with pagination', async () => {
      const mockTransactions = [{ id: 1, amount: 100, type: 'credit' }];
      mockQueryBuilder.first.mockResolvedValue({ total: 1 });
      mockQueryBuilder.offset.mockResolvedValue(mockTransactions);

      const result = await walletService.getTransactions('user1', { page: 1, limit: 10 });

      expect(result.transactions).toEqual(mockTransactions);
      expect(result.meta.total).toBe(1);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith({ user_id: 'user1' });
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(0);
    });

    it('should fetch all transactions for admin without user filter', async () => {
      mockQueryBuilder.first.mockResolvedValue({ total: 0 });
      mockQueryBuilder.offset.mockResolvedValue([]);

      const result = await walletService.getAllTransactions({ page: 1, limit: 10 });
      expect(result.transactions).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('should apply filters (type, date, reference)', async () => {
      mockQueryBuilder.first.mockResolvedValue({ total: 0 });
      mockQueryBuilder.offset.mockResolvedValue([]);

      const startDate = '2023-01-01';
      const endDate = '2023-12-31';
      await walletService.getAllTransactions({
        type: 'debit' as any,
        startDate,
        endDate,
        reference: 'tx_123',
      });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith({ type: 'debit' });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('created_at', '>=', startDate);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('created_at', '<=', endDate);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('reference', 'like', '%tx_123%');
    });
  });
});
