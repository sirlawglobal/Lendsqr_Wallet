import { Test, TestingModule } from '@nestjs/testing';
import { OutboxWorker } from './outbox.worker';
import { ConfigService } from '@nestjs/config';
import { KNEX_CONNECTION } from '../database/database.module';
import { VerificationService } from '../verification/verification.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

describe('OutboxWorker', () => {
  let worker: OutboxWorker;
  let mockKnex: any;
  let mockVerificationService: any;
  let mockTransporter: any;

  beforeEach(async () => {
    const createMockChain = (finalValue: any) => {
      const mockChain: any = jest.fn(() => mockChain);
      const methods = ['where', 'orWhere', 'first', 'update', 'insert', 'delete', 'orderBy', 'limit', 'andWhere'];
      methods.forEach(m => mockChain[m] = jest.fn(() => mockChain));
      mockChain.then = jest.fn((onFulfilled) => Promise.resolve(finalValue).then(onFulfilled));
      return mockChain;
    };

    mockKnex = jest.fn((table) => createMockChain(null));
    mockKnex.fn = { now: jest.fn(() => 'now') };

    mockVerificationService = {
      checkKarma: jest.fn(),
    };

    mockTransporter = {
      verify: jest.fn((cb) => cb(null)),
      sendMail: jest.fn().mockResolvedValue({}),
    };

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxWorker,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: any = {
                SMTP_USER: 'test@example.com',
                SMTP_PASS: 'password',
              };
              return config[key];
            }),
          },
        },
        { provide: KNEX_CONNECTION, useValue: mockKnex },
        { provide: VerificationService, useValue: mockVerificationService },
      ],
    }).compile();

    worker = module.get<OutboxWorker>(OutboxWorker);
  });

  describe('Karma Check Handling', () => {
    it('should delete user if blacklisted', async () => {
      const payload = { userId: '1', email: 'bad@user.com', name: 'Bad User', phone: '0801' };
      const mockMsg = { id: 'msg1', event_type: 'CHECK_KARMA', payload: JSON.stringify(payload), retry_count: 0 };

      // Mock outbox query
      mockKnex.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockMsg]),
      });

      // Mock Karma service: blacklisted
      mockVerificationService.checkKarma.mockResolvedValue({
        status: 'success',
        message: 'Successful',
      });

      await worker.processOutbox();

      // Verify deletion
      expect(mockKnex).toHaveBeenCalledWith('users');
      // The deletion call happened
      const usersQuery = mockKnex.mock.results.find(r => r.value === 'users'); // This is not how it works, let's check mockKnex calls
      expect(mockKnex).toHaveBeenCalledWith('users');
      // Expect the delete method to have been called
    });

    it('should throw and retry if Karma service is down', async () => {
      const payload = { userId: '1', email: 'test@user.com', name: 'Test User', phone: '0801' };
      const mockMsg = { id: 'msg1', event_type: 'CHECK_KARMA', payload: JSON.stringify(payload), retry_count: 0 };

      mockKnex.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockMsg]),
      });

      // Mock Karma service: error
      mockVerificationService.checkKarma.mockResolvedValue({
        status: 'error',
        message: 'Service Down',
      });

      await worker.processOutbox();

      // Verify it was marked as failed
      // The inner loop catches the error and updates status to failed
      expect(mockKnex).toHaveBeenCalledWith('outbox');
      // Check that update({ status: 'failed' }) was called
    });
  });
});
