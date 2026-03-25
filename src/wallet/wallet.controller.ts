import { Controller, Get, Post, Body, UseGuards, Req, Query } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { IAuthenticatedRequest } from '../common/interfaces';
import { FundDto } from './dto/fund.dto';
import { TransferDto } from './dto/transfer.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TransactionQueryDto } from './dto/transaction-query.dto';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  async getBalance(@Req() req: IAuthenticatedRequest) {
    return { success: true, data: await this.walletService.getBalance(req.userId) };
  }

  @Post('fund')
  async fund(@Req() req: IAuthenticatedRequest, @Body() body: FundDto) {
    return { success: true, data: await this.walletService.fund(req.userId, body.amount, body.reference) };
  }

  @Post('transfer')
  async transfer(@Req() req: IAuthenticatedRequest, @Body() body: TransferDto) {
    return { success: true, data: await this.walletService.transfer(req.userId, body.recipientEmail, body.amount) };
  }

  @Post('withdraw')
  async withdraw(@Req() req: IAuthenticatedRequest, @Body() body: WithdrawDto) {
    return { success: true, data: await this.walletService.withdraw(req.userId, body.amount) };
  }

  @Get('transactions')
  async getTransactions(@Req() req: IAuthenticatedRequest, @Query() query: TransactionQueryDto) {
    return { success: true, data: await this.walletService.getTransactions(req.userId, query) };
  }

  @Get('admin/transactions')
  @Roles('admin')
  @UseGuards(RolesGuard)
  async getAllTransactions(@Query() query: TransactionQueryDto) {
    return { success: true, data: await this.walletService.getAllTransactions(query) };
  }
}
