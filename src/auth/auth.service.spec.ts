import { AuthService } from './auth.service';
import { CustomException } from '../common/exceptions/custom.exception';

// Mock the ESM-only cuid2 module so Jest can handle it in CommonJS mode
jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn(() => 'mock-cuid-id'),
}));

describe('AuthService', () => {
  let authService: AuthService;
  let mockKnex: any;
  let mockConfigService: any;
  let mockJwtService: any;
  let mockVerificationService: any;

  /**
   * Creates a full Knex query builder mock that supports arbitrary chaining.
   * Every method returns the same mock object so chains like
   * .where().orWhere().first() all work and resolve to `finalValue`.
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

    // VerificationService is required by AuthService (4th constructor argument)
    mockVerificationService = {
      isBlacklistedLocal: jest.fn().mockResolvedValue(false),
    };

    authService = new AuthService(
      mockKnex,
      mockConfigService,
      mockJwtService,
      mockVerificationService,
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
      // isBlacklistedLocal returns false (not blacklisted)
      mockVerificationService.isBlacklistedLocal.mockResolvedValue(false);

      // Mock: no existing user found in users table
      const mockChain = createMockChain(null);
      mockKnex.mockReturnValue(mockChain);

      // Mock: transaction callback with a full chain trx
      mockKnex.transaction.mockImplementation(async (callback: any) => {
        const trx = createMockChain([1]);
        trx.insert.mockResolvedValue([1]);
        return callback(trx);
      });

      const result = await authService.register(registerDto);
      expect(result.message).toContain('Registration received');
    });

    it('should reject registration for locally blacklisted email/phone', async () => {
      // isBlacklistedLocal returns true for the email
      mockVerificationService.isBlacklistedLocal.mockResolvedValue(true);

      await expect(authService.register(registerDto)).rejects.toThrow(CustomException);
      await expect(authService.register(registerDto)).rejects.toThrow(
        'Registration rejected',
      );
    });

    it('should reject registration if email already exists', async () => {
      // Not blacklisted
      mockVerificationService.isBlacklistedLocal.mockResolvedValue(false);

      // Existing user found with the same email
      const mockChain = createMockChain({
        id: 1,
        email: 'john@example.com',
        phone: '08099999999',
      });
      mockKnex.mockReturnValue(mockChain);

      await expect(authService.register(registerDto)).rejects.toThrow(CustomException);
      await expect(authService.register(registerDto)).rejects.toThrow(
        'Email already registered',
      );
    });

    it('should reject registration if phone already exists', async () => {
      // Not blacklisted
      mockVerificationService.isBlacklistedLocal.mockResolvedValue(false);

      // Existing user found with a different email but same phone
      const mockChain = createMockChain({
        id: 2,
        email: 'other@example.com',
        phone: '08012345678',
      });
      mockKnex.mockReturnValue(mockChain);

      await expect(authService.register(registerDto)).rejects.toThrow(CustomException);
      await expect(authService.register(registerDto)).rejects.toThrow(
        'Phone number already registered',
      );
    });
  });

  describe('login', () => {
    const loginDto = { email: 'john@example.com', password: 'password123' };

    it('should login successfully with valid credentials', async () => {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('password123', 10);

      const mockChain = createMockChain({
        id: 1,
        email: 'john@example.com',
        password_hash: hashedPassword,
        status: 'active',
        role: 'user',
      });
      mockKnex.mockReturnValue(mockChain);

      const result = await authService.login(loginDto);
      expect(result).toEqual({ token: 'mock-jwt-token' });
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { userId: 1, role: 'user' },
        { secret: 'test-secret', expiresIn: '1d' },
      );
    });

    it('should reject login with non-existent email', async () => {
      const mockChain = createMockChain(null);
      mockKnex.mockReturnValue(mockChain);

      await expect(authService.login(loginDto)).rejects.toThrow(CustomException);
      await expect(authService.login(loginDto)).rejects.toThrow('Account not found');
    });

    it('should reject login with wrong password', async () => {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('different-password', 10);

      const mockChain = createMockChain({
        id: 1,
        email: 'john@example.com',
        password_hash: hashedPassword,
        status: 'active',
        role: 'user',
      });
      mockKnex.mockReturnValue(mockChain);

      await expect(authService.login(loginDto)).rejects.toThrow(CustomException);
      await expect(authService.login(loginDto)).rejects.toThrow('Invalid password');
    });

    it('should reject login if account is still pending verification', async () => {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('password123', 10);

      const mockChain = createMockChain({
        id: 1,
        email: 'john@example.com',
        password_hash: hashedPassword,
        status: 'pending',
        role: 'user',
      });
      mockKnex.mockReturnValue(mockChain);

      await expect(authService.login(loginDto)).rejects.toThrow(CustomException);
      await expect(authService.login(loginDto)).rejects.toThrow('still being verified');
    });
  });
});
