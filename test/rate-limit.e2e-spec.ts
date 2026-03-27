import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Auth Rate Limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 429 after 5 requests to /auth/login', async () => {
    const server = app.getHttpServer();
    
    // Send 5 requests (limit is 5)
    for (let i = 0; i < 5; i++) {
        await request(server)
            .post('/auth/login')
            .send({ email: 'test@example.com', password: 'password' })
            .expect((res) => {
                // We expect either 401 (invalid credentials) or 429
                // But not 429 yet
                if (res.status === 429) throw new Error('Received 429 too early');
            });
    }

    // 6th request should fail with 429
    await request(server)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password' })
      .expect(429);
  }, 30000); // 30s timeout for the loop

  it('should return 429 after 5 requests to /auth/register', async () => {
    const server = app.getHttpServer();
    
    for (let i = 0; i < 5; i++) {
        await request(server)
            .post('/auth/register')
            .send({ name: 'Test', email: 'test@example.com', phone: '08011111111', password: 'password' })
            .expect((res) => {
                if (res.status === 429) throw new Error('Received 429 too early');
            });
    }

    await request(server)
      .post('/auth/register')
      .send({ name: 'Test', email: 'test@example.com', phone: '08011111111', password: 'password' })
      .expect(429);
  }, 30000);
});
