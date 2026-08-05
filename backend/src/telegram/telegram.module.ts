import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramBotService } from './telegram-bot.service';

@Module({
  providers: [TelegramService, TelegramBotService],
  exports: [TelegramService, TelegramBotService],
})
export class TelegramModule {}
