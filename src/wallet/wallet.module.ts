import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [WalletController],
  providers: [WalletService],
})
export class WalletModule {}
