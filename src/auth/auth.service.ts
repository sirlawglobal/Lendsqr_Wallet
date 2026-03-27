import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Knex } from 'knex';
import * as bcrypt from 'bcryptjs';
import { KNEX_CONNECTION } from '../database/database.module';
import { CustomException } from '../common/exceptions/custom.exception';
import { IUser } from '../common/interfaces';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';


import { VerificationService } from '../verification/verification.service';


@Injectable()
export class AuthService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly verificationService: VerificationService,
  ) { }

  async register(registerDto: RegisterDto) {
    const { name, email, phone, password } = registerDto;

    // 1. Immediate local blacklist check
    const isBlacklisted = await Promise.all([
      this.verificationService.isBlacklistedLocal(email.toLowerCase()),
      this.verificationService.isBlacklistedLocal(phone.trim()),
    ]);

    if (isBlacklisted.some(b => b)) {
      // Record rejection in outbox for notification, then block
      await this.knex('outbox').insert({
        event_type: 'REGISTRATION_REJECTED',
        payload: JSON.stringify({ name, email, phone }),
      });
      throw new CustomException('Registration rejected. Your details have been flagged in our security system.', 403);
    }

    // 2. Check if email or phone already exists in users table
    const existingUser = await this.knex('users')
      .where({ email: email.toLowerCase() })
      .orWhere({ phone: phone.trim() })
      .first();

    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        throw new CustomException('Email already registered', 409);
      }
      if (existingUser.phone === phone.trim()) {
        throw new CustomException('Phone number already registered', 409);
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    return this.knex.transaction(async (trx: Knex.Transaction) => {
      const newUserId = require('@paralleldrive/cuid2').createId();

      await trx('users')
        .insert({
          id: newUserId,
          name,
          email: email.toLowerCase(),
          phone: phone.trim(),
          password_hash: hashedPassword,
          status: 'pending',
        });

      await trx('wallets').insert({ user_id: newUserId, balance: 0 });

      await trx('outbox').insert([
        {
          event_type: 'CHECK_KARMA',
          payload: JSON.stringify({ userId: newUserId, name, email, phone }),
        }
      ]);

      return { message: 'Registration received. Your account is pending verification.' };
    });
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.knex<IUser>('users')
      .where({ email: email.toLowerCase() })
      .first();

    if (!user) {
      throw new CustomException('Account not found', 404);
    }

    if (!(await bcrypt.compare(password, user.password_hash))) {
      throw new CustomException('Invalid password', 401);
    }

    if (user.status === 'pending') {
      throw new CustomException('Your account is still being verified. Please try again in a few moments.', 403);
    }

    if (user.status !== 'active') {
      throw new CustomException(`Account is ${user.status}. Please contact support.`, 403);
    }

    const token = this.jwtService.sign(
      { userId: user.id, role: user.role },
      {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: '1d',
      },
    );

    return { token };
  }
}
