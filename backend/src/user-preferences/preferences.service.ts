import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class PreferencesService {
  private readonly logger = new Logger(PreferencesService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly telegramService: TelegramService,
  ) {}

  async getPreferences(userId: string) {
    let { data, error } = await this.supabase
      .getServiceClient()
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to get preferences: ${error.message}`);
      throw error;
    }

    // If no row exists (account was created before database migration), self-heal by creating profile and preferences
    if (!data) {
      this.logger.log(`Self-healing preferences and profile for missing user ${userId}`);
      const { data: authUser } = await this.supabase.getServiceClient().auth.admin.getUserById(userId);
      if (authUser?.user) {
        await this.supabase.getServiceClient().from('users').upsert({
          id: userId,
          email: authUser.user.email || `${userId}@placeholder.local`,
          display_name: authUser.user.user_metadata?.full_name || authUser.user.user_metadata?.name || 'User',
          avatar_url: authUser.user.user_metadata?.avatar_url || null,
        }, { onConflict: 'id', ignoreDuplicates: true });
      }

      const { data: newPrefs, error: insertErr } = await this.supabase
        .getServiceClient()
        .from('user_preferences')
        .insert({ user_id: userId })
        .select('*')
        .single();

      if (insertErr) {
        this.logger.error(`Failed to self-heal preferences: ${insertErr.message}`);
        throw insertErr;
      }
      data = newPrefs;
    }

    // Also get Telegram connection status
    const telegramStatus = await this.telegramService.getTelegramStatus(userId);

    return {
      ...data,
      telegram_connected: telegramStatus.connected,
      telegram_username: telegramStatus.username,
    };
  }

  async updatePreferences(
    userId: string,
    updates: {
      auto_reply_enabled?: boolean;
      telegram_enabled?: boolean;
      quiet_hours_start?: string;
      quiet_hours_end?: string;
      quiet_hours_timezone?: string;
      notification_frequency?: string;
      default_action?: string;
      custom_ai_instructions?: string;
    },
  ) {
    const { error } = await this.supabase
      .getServiceClient()
      .from('user_preferences')
      .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' });

    if (error) {
      this.logger.error(`Failed to update preferences: ${error.message}`);
      throw error;
    }
  }

  async generateTelegramCode(userId: string): Promise<string> {
    return this.telegramService.generateVerificationCode(userId);
  }

  async disconnectTelegram(userId: string): Promise<void> {
    await this.telegramService.disconnectTelegram(userId);
  }
}
