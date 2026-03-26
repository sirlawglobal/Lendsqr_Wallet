import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { VerificationModule } from '../verification/verification.module';
import { OutboxWorker } from './outbox.worker';

@Module({
  imports: [DatabaseModule, VerificationModule],
  providers: [OutboxWorker],
})
export class OutboxModule {}
