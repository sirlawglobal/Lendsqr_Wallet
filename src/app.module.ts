import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { WalletModule } from './wallet/wallet.module';
import { NotificationModule } from './notification/notification.module';
import { OutboxModule } from './outbox/outbox.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 5,
    }]),
    DatabaseModule,
    AuthModule,
    WalletModule,
    NotificationModule,
    OutboxModule,
  ],
})
export class AppModule { }
