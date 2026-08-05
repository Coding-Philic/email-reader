import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { google } from 'googleapis';
import { AuthService } from '../auth/auth.service';
import { SupabaseService } from '../database/supabase.service';

@Injectable()
export class GmailWatchService {
  private readonly logger = new Logger(GmailWatchService.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly supabase: SupabaseService,
  ) {}

  async registerWatch(userId: string): Promise<void> {
    try {
      const tokens = await this.authService.getGmailTokens(userId);
      if (!tokens) {
        this.logger.warn(`No tokens found for user ${userId}, skipping watch`);
        return;
      }

      const oauth2Client = new google.auth.OAuth2(
        this.configService.get('GOOGLE_CLIENT_ID'),
        this.configService.get('GOOGLE_CLIENT_SECRET'),
        this.configService.get('GOOGLE_REDIRECT_URI'),
      );

      oauth2Client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      const { data } = await gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: this.configService.get('GOOGLE_PUBSUB_TOPIC'),
          labelIds: ['INBOX'],
        },
      });

      // Store the watch expiry and history ID
      await this.supabase
        .getServiceClient()
        .from('users')
        .update({
          gmail_watch_expiry: new Date(
            parseInt(data.expiration || '0', 10),
          ).toISOString(),
          gmail_history_id: data.historyId,
        })
        .eq('id', userId);

      this.logger.log(
        `Gmail watch registered for user ${userId}, expires: ${data.expiration}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to register watch for user ${userId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  // Renew watches every 6 days (they expire after 7 days)
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async renewExpiringWatches(): Promise<void> {
    this.logger.log('Checking for expiring Gmail watches...');

    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

    const { data: users, error } = await this.supabase
      .getServiceClient()
      .from('users')
      .select('id')
      .eq('gmail_connected', true)
      .eq('is_active', true)
      .lt('gmail_watch_expiry', twoDaysFromNow.toISOString());

    if (error) {
      this.logger.error(`Failed to query users for watch renewal: ${error.message}`);
      return;
    }

    if (!users || users.length === 0) {
      this.logger.log('No watches need renewal');
      return;
    }

    this.logger.log(`Renewing watches for ${users.length} users`);

    for (const user of users) {
      try {
        await this.registerWatch(user.id);
      } catch (error) {
        this.logger.error(
          `Failed to renew watch for user ${user.id}: ${(error as Error).message}`,
        );
      }
    }
  }
}
