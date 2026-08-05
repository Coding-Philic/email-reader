import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { google } from 'googleapis';
import { AuthService } from './auth.service';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { GmailWatchService } from '../gmail/gmail-watch.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly gmailWatchService: GmailWatchService,
  ) {}

  @Post('gmail/connect')
  @UseGuards(SupabaseAuthGuard)
  async connectGmail(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      access_token: string;
      refresh_token?: string;
      expiry_date?: string;
      scopes?: string[];
    },
  ) {
    if (!body.access_token) {
      throw new Error('Missing access_token');
    }

    let refreshToken = body.refresh_token;
    if (!refreshToken) {
      const existing = await this.authService.getGmailTokens(user.id);
      refreshToken = existing?.refresh_token || 'NONE_PROVIDED_BY_OAUTH';
    }

    const expiry = body.expiry_date
      ? new Date(body.expiry_date)
      : new Date(Date.now() + 3600000);

    await this.authService.storeGmailTokens(
      user.id,
      body.access_token,
      refreshToken,
      expiry,
      body.scopes || [],
    );

    // Register Gmail watch for push notifications
    await this.gmailWatchService.registerWatch(user.id);

    return { message: 'Gmail connected successfully' };
  }

  @Post('gmail/watch')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.OK)
  async startGmailWatch(@CurrentUser() user: AuthUser) {
    await this.gmailWatchService.registerWatch(user.id);
    return { message: 'Gmail watch registered successfully' };
  }

  @Get('profile')
  @UseGuards(SupabaseAuthGuard)
  async getProfile(@CurrentUser() user: AuthUser) {
    const profile = await this.authService.getUserProfile(user.id);
    return { data: profile };
  }

  @Post('disconnect')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disconnectGmail(@CurrentUser() user: AuthUser) {
    await this.authService.disconnectGmail(user.id);
    return { message: 'Gmail disconnected successfully' };
  }
}
