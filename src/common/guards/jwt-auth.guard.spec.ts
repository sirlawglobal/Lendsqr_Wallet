import { JwtAuthGuard } from './jwt-auth.guard';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let mockJwtService: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockJwtService = {
      verify: jest.fn(),
    };
    mockConfigService = {
      get: jest.fn().mockReturnValue('test-secret'),
    };

    const mockKnex: any = jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({ status: 'active' }),
    }));

    guard = new JwtAuthGuard(mockJwtService, mockConfigService, mockKnex);
  });

  const createMockExecutionContext = (authHeader?: string): ExecutionContext => {
    const mockRequest = {
      headers: {
        authorization: authHeader,
      },
    } as any;

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;
  };

  it('should allow request with a valid token', async () => {
    mockJwtService.verify.mockReturnValue({ userId: 1 });
    const context = createMockExecutionContext('Bearer valid-token');

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockJwtService.verify).toHaveBeenCalledWith('valid-token', { secret: 'test-secret' });
  });

  it('should set userId on request from token payload', async () => {
    mockJwtService.verify.mockReturnValue({ userId: 42 });
    const context = createMockExecutionContext('Bearer valid-token');
    const request = context.switchToHttp().getRequest();

    await guard.canActivate(context);
    expect(request.userId).toBe(42);
  });

  it('should throw UnauthorizedException when no token is provided', async () => {
    const context = createMockExecutionContext(undefined);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow('No token provided');
  });

  it('should throw UnauthorizedException when token is invalid', async () => {
    mockJwtService.verify.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    const context = createMockExecutionContext('Bearer invalid-token');

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow('Invalid token');
  });

  it('should throw UnauthorizedException when authorization header has no Bearer prefix', async () => {
    const context = createMockExecutionContext('just-a-token');
    // 'just-a-token'.split(' ')[1] is undefined
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
