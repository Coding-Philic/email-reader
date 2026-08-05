import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { TokenEncryptionService } from './token-encryption.service';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string;
  gmail_connected: boolean;
  gmail_watch_expiry: string | null;
  is_active: boolean;
}

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  scopes: string[];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.supabase
      .getServiceClient()
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      this.logger.error(`Failed to get user profile: ${error.message}`);
      return null;
    }

    return data;
  }

  async storeGmailTokens(
    userId: string,
    accessToken: string,
    refreshToken: string,
    expiryDate: Date,
    scopes: string[],
  ): Promise<void> {
    const encryptedAccess = this.tokenEncryption.encrypt(accessToken);
    const encryptedRefresh = this.tokenEncryption.encrypt(refreshToken);

    const { error } = await this.supabase
      .getServiceClient()
      .from('user_tokens')
      .upsert(
        {
          user_id: userId,
          access_token_encrypted: encryptedAccess,
          refresh_token_encrypted: encryptedRefresh,
          token_expiry: expiryDate.toISOString(),
          scopes,
        },
        { onConflict: 'user_id' },
      );

    if (error) {
      this.logger.error(`Failed to store tokens: ${error.message}`);
      throw new Error('Failed to store Gmail tokens');
    }

    // Mark Gmail as connected
    await this.supabase
      .getServiceClient()
      .from('users')
      .update({ gmail_connected: true })
      .eq('id', userId);
  }

  async getGmailTokens(userId: string): Promise<StoredTokens | null> {
    const { data, error } = await this.supabase
      .getServiceClient()
      .from('user_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      access_token: this.tokenEncryption.decrypt(data.access_token_encrypted),
      refresh_token: this.tokenEncryption.decrypt(data.refresh_token_encrypted),
      token_expiry: data.token_expiry,
      scopes: data.scopes,
    };
  }

  async updateAccessToken(
    userId: string,
    newAccessToken: string,
    newExpiry: Date,
  ): Promise<void> {
    const encrypted = this.tokenEncryption.encrypt(newAccessToken);

    const { error } = await this.supabase
      .getServiceClient()
      .from('user_tokens')
      .update({
        access_token_encrypted: encrypted,
        token_expiry: newExpiry.toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Failed to update access token: ${error.message}`);
      throw new Error('Failed to update access token');
    }
  }

  async disconnectGmail(userId: string): Promise<void> {
    await this.supabase
      .getServiceClient()
      .from('user_tokens')
      .delete()
      .eq('user_id', userId);

    await this.supabase
      .getServiceClient()
      .from('users')
      .update({
        gmail_connected: false,
        gmail_watch_expiry: null,
        gmail_history_id: null,
      })
      .eq('id', userId);
  }
}
