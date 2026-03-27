import { VerificationService } from './verification.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('VerificationService', () => {
  let verificationService: VerificationService;
  let mockGet: jest.Mock;

  beforeEach(() => {
    mockGet = jest.fn();
    mockedAxios.create.mockReturnValue({
      get: mockGet,
    } as any);
    (mockedAxios.isAxiosError as any) = jest.fn();

    const mockConfigService = {
      get: jest.fn().mockReturnValue('test-adjutor-key'),
    } as any;

    const createMockChain = (finalValue: any) => {
      const mockChain: any = jest.fn(() => mockChain);
      mockChain.where = jest.fn(() => mockChain);
      mockChain.first = jest.fn(() => Promise.resolve(finalValue));
      mockChain.insert = jest.fn(() => Promise.resolve([1]));
      return mockChain;
    };

    const mockKnex = jest.fn((table) => createMockChain(null)) as any;

    verificationService = new VerificationService(mockConfigService, mockKnex);
  });

  describe('checkKarma', () => {
    it('should return success response if user is found in karma blacklist', async () => {
      const karmaResponse = {
        status: 'success',
        message: 'Successful',
        data: {
          karma_identity: '08012345678',
          amount_in_contention: '0',
          reason: 'loan default',
          default_date: '2025-01-01',
          karma_type: 'Others/Unknown',
          karma_identity_type: 'phone',
          reporting_entity: {},
        },
      };

      mockGet.mockResolvedValue({ data: karmaResponse });

      const result = await verificationService.checkKarma('08012345678');
      expect(result).toEqual(karmaResponse);
      expect(result.status).toBe('success');
      expect(result.message).toBe('Successful');
    });

    it('should return error response if user is not in karma blacklist', async () => {
      const notFoundResponse = {
        status: 'error',
        message: 'Identity not found in karma',
      };

      // API returns 404 for non-blacklisted users
      const axiosError = {
        response: { data: notFoundResponse },
        isAxiosError: true,
      };
      mockGet.mockRejectedValue(axiosError);
      (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);

      const result = await verificationService.checkKarma('08099999999');
      expect(result.status).toBe('error');
      expect(result.message).toBe('Identity not found in karma');
    });

    it('should return fallback error if API is unreachable', async () => {
      const networkError = new Error('Network Error');
      mockGet.mockRejectedValue(networkError);
      (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(false);

      const result = await verificationService.checkKarma('08012345678');
      expect(result.status).toBe('error');
      expect(result.message).toBe('Karma verification service unavailable');
    });
  });
});
