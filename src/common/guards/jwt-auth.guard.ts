import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.module';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(' ')[1];

    if (!token) throw new UnauthorizedException('No token provided');

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      request.userId = payload.userId;
      request.userRole = payload.role;

      // Check user status in DB
      const user = await this.knex('users').where({ id: payload.userId }).select('status').first();
      if (!user || user.status !== 'active') {
        throw new ForbiddenException(`Account is ${user?.status || 'inactive'}`);
      }

      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
