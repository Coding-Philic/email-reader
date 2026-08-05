import { Controller, Get, Query, UseGuards, Sse } from '@nestjs/common';
import { Observable, interval, map } from 'rxjs';
import { AnalyticsService } from './analytics.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Controller('analytics')
@UseGuards(SupabaseAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  async getDashboardStats(
    @CurrentUser() user: AuthUser,
    @Query('period') period: 'today' | 'week' | 'month' | 'year' = 'today',
  ) {
    const stats = await this.analyticsService.getDashboardStats(user.id, period);
    return { data: stats };
  }

  @Get('volume')
  async getEmailVolume(
    @CurrentUser() user: AuthUser,
    @Query('period') period: 'today' | 'week' | 'month' | 'year' = 'week',
  ) {
    const volume = await this.analyticsService.getEmailVolume(user.id, period);
    return { data: volume };
  }

  @Get('top-senders')
  async getTopSenders(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit: number = 10,
  ) {
    const senders = await this.analyticsService.getTopSenders(user.id, limit);
    return { data: senders };
  }

  @Sse('stream')
  streamUpdates(@CurrentUser() user: AuthUser): Observable<MessageEvent> {
    // Push updates every 30 seconds
    return interval(30000).pipe(
      map(async () => {
        const stats = await this.analyticsService.getDashboardStats(user.id, 'today');
        return { data: JSON.stringify(stats) } as MessageEvent;
      }),
    ) as any;
  }
}
