import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { OutboxWorker } from './outbox.worker';

@Module({
  imports: [DatabaseModule],
  providers: [OutboxWorker],
})
export class NotificationModule {}
