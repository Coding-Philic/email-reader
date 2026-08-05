import { Module, forwardRef } from '@nestjs/common';
import { AgentService } from './agent.service';
import { GmailModule } from '../gmail/gmail.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [forwardRef(() => GmailModule), TelegramModule],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
