import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { SupabaseService } from '../database/supabase.service';
import * as crypto from 'crypto';

@Injectable()
export class TelegramBotService implements OnModuleInit {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Bot;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    this.bot = new Bot(this.configService.get<string>('TELEGRAM_BOT_TOKEN')!);
  }

  async onModuleInit(): Promise<void> {
    this.setupHandlers();
    this.bot.start().catch((err) => {
      this.logger.error(`Bot failed to start: ${err.message}`);
    });
    this.logger.log('Telegram bot started');
  }

  getBot(): Bot {
    return this.bot;
  }

  private setupHandlers(): void {
    this.bot.command('start', async (ctx) => {
      await ctx.reply(
        'Welcome to Email Reader AI Bot.\n\n' +
          'To connect your account, use the verification code from your dashboard.\n\n' +
          'Send your code here to link this chat to your account.',
      );
    });

    this.bot.command('status', async (ctx) => {
      const chatId = ctx.chat.id.toString();

      const { data } = await this.supabase
        .getServiceClient()
        .from('telegram_connections')
        .select('is_verified, users!inner(email)')
        .eq('telegram_chat_id', chatId)
        .eq('is_active', true)
        .single();

      if (data?.is_verified) {
        const user = data.users as any;
        await ctx.reply(
          `Connected to: ${user.email}\nStatus: Active\n\nYou will receive email notifications here.`,
        );
      } else {
        await ctx.reply('Your account is not connected. Send a verification code to link your account.');
      }
    });

    this.bot.command('stop', async (ctx) => {
      const chatId = ctx.chat.id.toString();

      await this.supabase
        .getServiceClient()
        .from('telegram_connections')
        .update({ is_active: false })
        .eq('telegram_chat_id', chatId);

      await ctx.reply('Notifications disabled. You can re-enable them from your dashboard.');
    });

    // Handle verification codes
    this.bot.on('message:text', async (ctx) => {
      const text = ctx.message.text.trim();
      const chatId = ctx.chat.id.toString();

      // Check if the text is a verification code (6 alphanumeric chars)
      if (/^[A-Z0-9]{6}$/.test(text)) {
        await this.handleVerification(ctx, text, chatId);
      }
    });
  }

  private async handleVerification(
    ctx: any,
    code: string,
    chatId: string,
  ): Promise<void> {
    const { data, error } = await this.supabase
      .getServiceClient()
      .from('telegram_connections')
      .select('id, user_id, verification_expires_at')
      .eq('verification_code', code)
      .eq('is_verified', false)
      .single();

    if (error || !data) {
      await ctx.reply('Invalid verification code. Please check your dashboard and try again.');
      return;
    }

    // Check expiry
    if (new Date(data.verification_expires_at) < new Date()) {
      await ctx.reply('This verification code has expired. Please generate a new one from your dashboard.');
      return;
    }

    // Link the chat
    await this.supabase
      .getServiceClient()
      .from('telegram_connections')
      .update({
        telegram_chat_id: chatId,
        telegram_username: ctx.from?.username || null,
        is_verified: true,
        verification_code: null,
        verification_expires_at: null,
      })
      .eq('id', data.id);

    // Enable Telegram in preferences
    await this.supabase
      .getServiceClient()
      .from('user_preferences')
      .update({ telegram_enabled: true })
      .eq('user_id', data.user_id);

    await ctx.reply('Account connected successfully. You will now receive email notifications here.');
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    try {
      await this.bot.api.sendMessage(chatId, text, { parse_mode: 'HTML' });
    } catch (error) {
      this.logger.error(`Failed to send Telegram message: ${(error as Error).message}`);
    }
  }

  static generateVerificationCode(): string {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
  }
}
