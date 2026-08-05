import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GmailService } from './gmail.service';
import { GmailWatchService } from './gmail-watch.service';
import { GmailWebhookController } from './gmail-webhook.controller';
import { AuthModule } from '../auth/auth.module';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => AgentModule),
    BullModule.registerQueue({ name: 'email-processing' }),
  ],
  controllers: [GmailWebhookController],
  providers: [GmailService, GmailWatchService],
  exports: [GmailService, GmailWatchService],
})
export class GmailModule {}
