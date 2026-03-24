import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { VerificationService } from '../verification/verification.service';
import { CustomException } from '../common/exceptions/custom.exception';
import { createKnexInstance } from '../database/knex.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private knex: any;

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
    private verificationService: VerificationService,
  ) {
    this.knex = createKnexInstance(configService);
  }

  async register(registerDto: RegisterDto) {
    const { name, email, phone, password } = registerDto;

    // Blacklist check
    const karmaResult = await this.verificationService.checkKarma(phone.trim());
    if (karmaResult.status === 'success' && karmaResult.message === 'Successful') {
      throw new CustomException('User is blacklisted in Adjutor Karma. Onboarding denied.', 403);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    return this.knex.transaction(async (trx: any) => {
      const [userId] = await trx('users').insert({
        name,
        email: email.toLowerCase(),
        phone: phone.trim(),
        password_hash: hashedPassword,
      }).returning('id');

      await trx('wallets').insert({ user_id: userId[0] || userId, balance: 0 });

      return { message: 'Account created successfully' };
    });
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.knex('users').where({ email: email.toLowerCase() }).first();

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new CustomException('Invalid credentials', 401);
    }

    const token = this.jwtService.sign({ userId: user.id }, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '1d',
    });

    return { token };
  }
}
