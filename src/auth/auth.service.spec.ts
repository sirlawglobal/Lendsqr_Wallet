import { AuthService } from './auth.service';
import { CustomException } from '../common/exceptions/custom.exception';

jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn(() => 'mock-id'),
}));

describe('AuthService', () => {
  let authService: AuthService;
  let mockKnex: any;
  let mockConfigService: any;
  let mockJwtService: any;

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

    mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          JWT_SECRET: 'test-secret',
        };
        return config[key];
      }),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    authService = new AuthService(
      mockKnex,
      mockConfigService,
      mockJwtService,
    );
  });

  describe('register', () => {
    const registerDto = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '08012345678',
      password: 'password123',
    };

    it('should register a new user successfully', async () => {
      // Mock: no existing user
      const mockChain = jest.fn().mockReturnThis() as any;
      mockChain.where = jest.fn().mockReturnThis();
      mockChain.orWhere = jest.fn().mockReturnThis();
      mockChain.first = jest.fn().mockResolvedValue(null);
      mockKnex.mockReturnValue(mockChain);

      // Mock: transaction
      mockKnex.transaction.mockImplementation(async (callback: any) => {
        const trx = createMockChain([1]);
        return callback(trx);
      });

      const result = await authService.register(registerDto);
      expect(result.message).toContain('Registration received');
    });

    // REMOVED Karma check from register, so this test is no longer applicable here
    // It should be moved to outbox worker tests

    it('should reject registration if email already exists', async () => {
      // Mock: existing user found
      const mockChain = jest.fn().mockReturnThis() as any;
      mockChain.where = jest.fn().mockReturnThis();
      mockChain.orWhere = jest.fn().mockReturnThis();
      mockChain.first = jest.fn().mockResolvedValue({ id: 1, email: 'john@example.com' });
      mockKnex.mockReturnValue(mockChain);

      await expect(authService.register(registerDto)).rejects.toThrow(CustomException);
      await expect(authService.register(registerDto)).rejects.toThrow('Email already registered');
    });
  });

  describe('login', () => {
    const loginDto = { email: 'john@example.com', password: 'password123' };

    it('should login successfully with valid credentials', async () => {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('password123', 10);

      const mockChain = jest.fn().mockReturnThis() as any;
      mockChain.where = jest.fn().mockReturnThis();
      mockChain.first = jest.fn().mockResolvedValue({
        id: 1,
        email: 'john@example.com',
        password_hash: hashedPassword,
        status: 'active',
      });
      mockKnex.mockReturnValue(mockChain);

      const result = await authService.login(loginDto);
      expect(result).toEqual({ token: 'mock-jwt-token' });
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { userId: 1 },
        { secret: 'test-secret', expiresIn: '1d' },
      );
    });

    it('should reject login with non-existent email', async () => {
      const mockChain = jest.fn().mockReturnThis() as any;
      mockChain.where = jest.fn().mockReturnThis();
      mockChain.first = jest.fn().mockResolvedValue(null);
      mockKnex.mockReturnValue(mockChain);

      await expect(authService.login(loginDto)).rejects.toThrow(CustomException);
      await expect(authService.login(loginDto)).rejects.toThrow('Invalid credentials');
    });

    it('should reject login with wrong password', async () => {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('differentpassword', 10);

      const mockChain = jest.fn().mockReturnThis() as any;
      mockChain.where = jest.fn().mockReturnThis();
      mockChain.first = jest.fn().mockResolvedValue({
        id: 1,
        email: 'john@example.com',
        password_hash: hashedPassword,
      });
      mockKnex.mockReturnValue(mockChain);

      await expect(authService.login(loginDto)).rejects.toThrow(CustomException);
      await expect(authService.login(loginDto)).rejects.toThrow('Invalid credentials');
    });
  });
});
