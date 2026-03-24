import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FundDto } from './dto/fund.dto';
import { TransferDto } from './dto/transfer.dto';
import { WithdrawDto } from './dto/withdraw.dto';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get('balance')
  async getBalance(@Req() req: any) {
    return { success: true, data: await this.walletService.getBalance(req.userId) };
  }

  @Post('fund')
  async fund(@Req() req: any, @Body() body: FundDto) {
    return { success: true, data: await this.walletService.fund(req.userId, body.amount, body.reference) };
  }

  @Post('transfer')
  async transfer(@Req() req: any, @Body() body: TransferDto) {
    return { success: true, data: await this.walletService.transfer(req.userId, body.recipientEmail, body.amount) };
  }

  @Post('withdraw')
  async withdraw(@Req() req: any, @Body() body: WithdrawDto) {
    return { success: true, data: await this.walletService.withdraw(req.userId, body.amount) };
  }
}
