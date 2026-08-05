import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PreferencesService } from './preferences.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Controller('preferences')
@UseGuards(SupabaseAuthGuard)
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get()
  async getPreferences(@CurrentUser() user: AuthUser) {
    const preferences = await this.preferencesService.getPreferences(user.id);
    return { data: preferences };
  }

  @Put()
  async updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
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
    await this.preferencesService.updatePreferences(user.id, body);
    return { message: 'Preferences updated' };
  }

  @Post('telegram/code')
  async generateTelegramCode(@CurrentUser() user: AuthUser) {
    const code = await this.preferencesService.generateTelegramCode(user.id);
    return { data: { code } };
  }

  @Delete('telegram')
  @HttpCode(HttpStatus.OK)
  async disconnectTelegram(@CurrentUser() user: AuthUser) {
    await this.preferencesService.disconnectTelegram(user.id);
    return { message: 'Telegram disconnected' };
  }
}
