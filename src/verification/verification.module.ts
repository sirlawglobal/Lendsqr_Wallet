import { Module } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
