import { WalletService } from './wallet.service';
import { CustomException } from '../common/exceptions/custom.exception';

describe('WalletService', () => {
  let walletService: WalletService;
  let mockKnex: any;

  const createMockChain = (finalValue: any) => {
    const mock: any = jest.fn(() => mock);
    const methods = [
      'where', 'orWhere', 'first', 'forUpdate', 'increment', 
      'decrement', 'insert', 'orderBy', 'limit', 'offset', 
      'update', 'count', 'clone', 'delete', 'andWhere', 'returning'
    ];
    methods.forEach(m => mock[m] = jest.fn(() => mock));
    
    // Promise behavior
    mock.then = jest.fn((resolve) => Promise.resolve(finalValue).then(resolve));
    mock.catch = jest.fn((reject) => Promise.resolve(finalValue).catch(reject));
    
    return mock;
  };

  beforeEach(() => {
    mockKnex = jest.fn(() => createMockChain(null));
    mockKnex.transaction = jest.fn();

    walletService = new WalletService(mockKnex);
  });

  describe('getBalance', () => {
    it('should return wallet balance for a valid user', async () => {
      const walletData = { user_id: 1, balance: '500.00' };
      const chain = createMockChain(walletData);
      mockKnex.mockReturnValue(chain);

      const result = await walletService.getBalance('1');
      expect(result).toEqual({ balance: 500 });
    });

    it('should throw if wallet is not found', async () => {
      const chain = createMockChain(null);
      mockKnex.mockReturnValue(chain);

      await expect(walletService.getBalance('999')).rejects.toThrow(CustomException);
    });
  });

  describe('fund', () => {
    it('should fund wallet successfully', async () => {
      mockKnex.transaction.mockImplementation(async (callback: any) => {
        const trx = createMockChain([1]); // default for insert/returning
        trx.first.mockResolvedValue({ user_id: 1, balance: '100.00' });
        return callback(trx);
      });

      const result = await walletService.fund('1', 200, 'ref_123');
      expect(result).toEqual({ message: 'Funded successfully' });
    });

    it('should throw if amount is zero or negative', async () => {
      await expect(walletService.fund('1', 0)).rejects.toThrow('Amount must be positive');
      await expect(walletService.fund('1', -50)).rejects.toThrow('Amount must be positive');
    });

    it('should throw if wallet is not found during funding', async () => {
      mockKnex.transaction.mockImplementation(async (callback: any) => {
        const trx: any = jest.fn();
        trx.mockReturnValueOnce({
          where: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue(null),
          }),
        });
        return callback(trx);
      });

      await expect(walletService.fund('999', 100)).rejects.toThrow('Wallet not found');
    });
  });

  describe('transfer', () => {
    it('should transfer funds successfully', async () => {
      mockKnex.transaction.mockImplementation(async (callback: any) => {
        const trx: any = jest.fn(() => trx);
        const methods = ['where', 'first', 'forUpdate', 'increment', 'decrement', 'insert'];
        methods.forEach(m => trx[m] = jest.fn(() => trx));

        // 1: recipient lookup
        trx.first.mockResolvedValueOnce({ id: 2, email: 'recipient@example.com' });
        // 2: sender wallet lookup
        trx.forUpdate.mockResolvedValueOnce({ user_id: 1, balance: '500.00' });
        // 3: recipient wallet lookup
        trx.forUpdate.mockResolvedValueOnce({ user_id: 2, balance: '100.00' });
        
        trx.insert.mockResolvedValue([1]);
        
        return callback(trx);
      });

      const result = await walletService.transfer('1', 'recipient@example.com', 100);
      expect(result.message).toBe('Transfer successful');
      expect(result.reference).toBeDefined();
    });

    it('should throw if amount is zero or negative', async () => {
      await expect(walletService.transfer('1', 'r@example.com', 0)).rejects.toThrow('Amount must be positive');
      await expect(walletService.transfer('1', 'r@example.com', -10)).rejects.toThrow('Amount must be positive');
    });

    it('should throw if recipient does not exist', async () => {
      mockKnex.transaction.mockImplementation(async (callback: any) => {
        const trx: any = jest.fn();
        trx.mockReturnValueOnce({
          where: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue(null),
          }),
        });
        return callback(trx);
      });

      await expect(walletService.transfer('1', 'nobody@example.com', 100)).rejects.toThrow('Recipient not found');
    });

    it('should throw if sender tries to transfer to themselves', async () => {
      mockKnex.transaction.mockImplementation(async (callback: any) => {
        const trx: any = jest.fn().mockReturnThis();
        trx.where = jest.fn().mockReturnThis();
        trx.first = jest.fn().mockResolvedValue({ id: '1', email: 'sender@example.com' });
        return callback(trx);
      });

      await expect(walletService.transfer('1', 'sender@example.com', 100)).rejects.toThrow('Cannot transfer to yourself');
    });

    it('should throw if sender has insufficient balance', async () => {
      mockKnex.transaction.mockImplementation(async (callback: any) => {
        const trx: any = jest.fn().mockReturnThis();
        trx.where = jest.fn().mockReturnThis();
        trx.first = jest.fn();
        trx.forUpdate = jest.fn();

        // recipient found
        trx.first.mockResolvedValueOnce({ id: '2', email: 'recipient@example.com' });
        // sender wallet with low balance
        trx.forUpdate.mockResolvedValueOnce({ user_id: '1', balance: '50.00' });

        return callback(trx);
      });

      await expect(walletService.transfer('1', 'recipient@example.com', 100)).rejects.toThrow('Insufficient balance');
    });

    it('should throw if sender wallet is not found', async () => {
      mockKnex.transaction.mockImplementation(async (callback: any) => {
        const trx: any = jest.fn().mockReturnThis();
        trx.where = jest.fn().mockReturnThis();
        trx.first = jest.fn();
        trx.forUpdate = jest.fn();

        // recipient found
        trx.first.mockResolvedValueOnce({ id: '2', email: 'recipient@example.com' });
        // sender wallet not found
        trx.forUpdate.mockResolvedValueOnce(null);

        return callback(trx);
      });

      await expect(walletService.transfer('1', 'recipient@example.com', 100)).rejects.toThrow('Sender wallet not found');
    });
  });

  describe('withdraw', () => {
    it('should withdraw funds successfully', async () => {
      mockKnex.transaction.mockImplementation(async (callback: any) => {
        const trx: any = jest.fn(() => trx);
        const methods = ['where', 'first', 'forUpdate', 'decrement', 'insert'];
        methods.forEach(m => trx[m] = jest.fn(() => trx));
        
        trx.forUpdate.mockResolvedValue({ user_id: 1, balance: '500.00' });
        trx.insert.mockResolvedValue([1]);
        return callback(trx);
      });

      const result = await walletService.withdraw('1', 100);
      expect(result).toEqual({ message: 'Withdrawal successful' });
    });

    it('should throw if amount is zero or negative', async () => {
      await expect(walletService.withdraw('1', 0)).rejects.toThrow('Amount must be positive');
      await expect(walletService.withdraw('1', -20)).rejects.toThrow('Amount must be positive');
    });

    it('should throw if wallet is not found', async () => {
      mockKnex.transaction.mockImplementation(async (callback: any) => {
        const trx: any = jest.fn();
        trx.mockReturnValueOnce({
          where: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue(null),
          }),
        });
        return callback(trx);
      });

      await expect(walletService.withdraw('999', 100)).rejects.toThrow('Wallet not found');
    });

    it('should throw if insufficient balance for withdrawal', async () => {
      mockKnex.transaction.mockImplementation(async (callback: any) => {
        const trx: any = jest.fn().mockReturnThis();
        trx.where = jest.fn().mockReturnThis();
        trx.first = jest.fn().mockReturnThis();
        trx.forUpdate = jest.fn().mockResolvedValue({ user_id: '1', balance: '30.00' });
        return callback(trx);
      });

      await expect(walletService.withdraw('1', 100)).rejects.toThrow('Insufficient balance');
    });
  });

  describe('transaction fetching', () => {
    let mockQueryBuilder: any;

    beforeEach(() => {
      mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        first: jest.fn(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn(),
      };
      mockKnex.mockReturnValue(mockQueryBuilder);
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
