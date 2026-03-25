import { AuthService } from './auth.service';
import { CustomException } from '../common/exceptions/custom.exception';

describe('AuthService', () => {
  let authService: AuthService;
  let mockKnex: any;
  let mockConfigService: any;
  let mockJwtService: any;
  let mockVerificationService: any;

  beforeEach(() => {
    mockKnex = jest.fn();
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

    mockVerificationService = {
      checkKarma: jest.fn(),
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
      // Mock: no existing user
      const mockFirst = jest.fn().mockResolvedValue(null);
      const mockWhere = jest.fn().mockReturnValue({ first: mockFirst });
      mockKnex.mockReturnValue({ where: mockWhere });

      // Mock: karma check passes (user not blacklisted)
      mockVerificationService.checkKarma.mockResolvedValue({
        status: 'error',
        message: 'Identity not found in karma',
      });

      // Mock: transaction
      mockKnex.transaction.mockImplementation(async (callback: any) => {
        const trx = jest.fn();
        const mockInsert = jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([1]),
        });
        trx.mockReturnValueOnce({ insert: mockInsert }); // users insert
        trx.mockReturnValueOnce({ insert: jest.fn().mockResolvedValue([1]) }); // wallets insert
        return callback(trx);
      });

      const result = await authService.register(registerDto);
      expect(result).toEqual({ message: 'Account created successfully' });
      expect(mockVerificationService.checkKarma).toHaveBeenCalledWith('08012345678');
    });

    it('should reject registration if user is blacklisted in Karma', async () => {
      // Mock: no existing user
      const mockFirst = jest.fn().mockResolvedValue(null);
      const mockWhere = jest.fn().mockReturnValue({ first: mockFirst });
      mockKnex.mockReturnValue({ where: mockWhere });

      // Mock: blacklisted
      mockVerificationService.checkKarma.mockResolvedValue({
        status: 'success',
        message: 'Successful',
        data: { karma_identity: '08012345678' },
      });

      await expect(authService.register(registerDto)).rejects.toThrow(CustomException);
      await expect(authService.register(registerDto)).rejects.toThrow(
        'User is blacklisted in Adjutor Karma. Onboarding denied.',
      );
    });

    it('should reject registration if email already exists', async () => {
      // Mock: existing user found
      const mockFirst = jest.fn().mockResolvedValue({ id: 1, email: 'john@example.com' });
      const mockWhere = jest.fn().mockReturnValue({ first: mockFirst });
      mockKnex.mockReturnValue({ where: mockWhere });

      await expect(authService.register(registerDto)).rejects.toThrow(CustomException);
      await expect(authService.register(registerDto)).rejects.toThrow('Email already registered');
    });
  });

  describe('login', () => {
    const loginDto = { email: 'john@example.com', password: 'password123' };

    it('should login successfully with valid credentials', async () => {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('password123', 10);

      const mockFirst = jest.fn().mockResolvedValue({
        id: 1,
        email: 'john@example.com',
        password_hash: hashedPassword,
      });
      const mockWhere = jest.fn().mockReturnValue({ first: mockFirst });
      mockKnex.mockReturnValue({ where: mockWhere });

      const result = await authService.login(loginDto);
      expect(result).toEqual({ token: 'mock-jwt-token' });
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { userId: 1 },
        { secret: 'test-secret', expiresIn: '1d' },
      );
    });

    it('should reject login with non-existent email', async () => {
      const mockFirst = jest.fn().mockResolvedValue(null);
      const mockWhere = jest.fn().mockReturnValue({ first: mockFirst });
      mockKnex.mockReturnValue({ where: mockWhere });

      await expect(authService.login(loginDto)).rejects.toThrow(CustomException);
      await expect(authService.login(loginDto)).rejects.toThrow('Invalid credentials');
    });

    it('should reject login with wrong password', async () => {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('differentpassword', 10);

      const mockFirst = jest.fn().mockResolvedValue({
        id: 1,
        email: 'john@example.com',
        password_hash: hashedPassword,
      });
      const mockWhere = jest.fn().mockReturnValue({ first: mockFirst });
      mockKnex.mockReturnValue({ where: mockWhere });

      await expect(authService.login(loginDto)).rejects.toThrow(CustomException);
      await expect(authService.login(loginDto)).rejects.toThrow('Invalid credentials');
    });
  });
});
