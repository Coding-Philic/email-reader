import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { TelegramBotService } from './telegram-bot.service';

export interface EmailNotification {
  category: string;
  from: string;
  subject: string;
  snippet: string;
  action: string;
  replyDraft?: string;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly botService: TelegramBotService,
  ) {}

  async notifyUser(userId: string, notification: EmailNotification): Promise<void> {
    try {
      // Check if user has Telegram enabled
      const { data: prefs } = await this.supabase
        .getServiceClient()
        .from('user_preferences')
        .select('telegram_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_timezone')
        .eq('user_id', userId)
        .single();

      if (!prefs?.telegram_enabled) {
        return;
      }

      // Check quiet hours
      if (this.isQuietHours(prefs)) {
        this.logger.log(`Skipping notification for user ${userId}: quiet hours`);
        return;
      }

      // Get Telegram connection
      const { data: connection } = await this.supabase
        .getServiceClient()
        .from('telegram_connections')
        .select('telegram_chat_id')
        .eq('user_id', userId)
        .eq('is_verified', true)
        .eq('is_active', true)
        .single();

      if (!connection?.telegram_chat_id) {
        return;
      }

      const message = this.formatNotification(notification);
      await this.botService.sendMessage(connection.telegram_chat_id, message);

      this.logger.log(`Notification sent to user ${userId} via Telegram`);
    } catch (error) {
      this.logger.error(
        `Failed to send Telegram notification: ${(error as Error).message}`,
      );
    }
  }

  async generateVerificationCode(userId: string): Promise<string> {
    const code = TelegramBotService.generateVerificationCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    await this.supabase
      .getServiceClient()
      .from('telegram_connections')
      .upsert(
        {
          user_id: userId,
          verification_code: code,
          verification_expires_at: expiresAt.toISOString(),
          is_verified: false,
          telegram_chat_id: `pending_${userId}`,
        },
        { onConflict: 'user_id' },
      );

    return code;
  }

  async disconnectTelegram(userId: string): Promise<void> {
    await this.supabase
      .getServiceClient()
      .from('telegram_connections')
      .delete()
      .eq('user_id', userId);

    await this.supabase
      .getServiceClient()
      .from('user_preferences')
      .update({ telegram_enabled: false })
      .eq('user_id', userId);
  }

  async getTelegramStatus(userId: string): Promise<{
    connected: boolean;
    username: string | null;
  }> {
    const { data } = await this.supabase
      .getServiceClient()
      .from('telegram_connections')
      .select('telegram_username, is_verified, is_active')
      .eq('user_id', userId)
      .single();

    return {
      connected: data?.is_verified && data?.is_active || false,
      username: data?.telegram_username || null,
    };
  }

  private formatNotification(notification: EmailNotification): string {
    const actionLabel = {
      reply: 'Reply Drafted',
      ignore: 'Ignored',
      notify: 'Notification',
      categorize: 'Categorized',
    }[notification.action] || 'Processed';

    const replyBlock = notification.replyDraft
      ? `\n\n💬 <b>AI Generated Reply:</b>\n<code>${this.escapeHtml(notification.replyDraft)}</code>`
      : '';

    return (
      `📬 <b>New Email Alert</b>\n\n` +
      `<b>Category:</b> ${this.escapeHtml(notification.category)}\n` +
      `<b>From:</b> ${this.escapeHtml(notification.from)}\n` +
      `<b>Subject:</b> ${this.escapeHtml(notification.subject)}\n` +
      `<b>AI Decision:</b> ${actionLabel}\n\n` +
      `📄 <b>Snippet:</b>\n<i>${this.escapeHtml(notification.snippet.substring(0, 300))}</i>` +
      replyBlock
    );
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private isQuietHours(prefs: any): boolean {
    if (!prefs.quiet_hours_start || !prefs.quiet_hours_end) {
      return false;
    }

    const now = new Date();
    const tz = prefs.quiet_hours_timezone || 'UTC';

    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: tz,
    });

    const currentTime = formatter.format(now);
    const start = prefs.quiet_hours_start.substring(0, 5);
    const end = prefs.quiet_hours_end.substring(0, 5);

    if (start <= end) {
      return currentTime >= start && currentTime <= end;
    } else {
      // Overnight quiet hours (e.g., 22:00 to 07:00)
      return currentTime >= start || currentTime <= end;
    }
  }
}
