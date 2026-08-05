import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

export interface DashboardStats {
  totalToday: number;
  totalReplied: number;
  totalIgnored: number;
  totalNotified: number;
  totalCategorized: number;
  categoryBreakdown: { name: string; slug: string; count: number; color: string }[];
  recentActions: {
    id: string;
    action_type: string;
    status: string;
    details: any;
    executed_at: string;
    email: { subject: string; sender_name: string } | null;
  }[];
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async getDashboardStats(
    userId: string,
    period: 'today' | 'week' | 'month' | 'year' = 'today',
  ): Promise<DashboardStats> {
    const startDate = this.getStartDate(period);

    // Get email counts by action
    const { data: records } = await this.supabase
      .getServiceClient()
      .from('email_records')
      .select('action_taken')
      .eq('user_id', userId)
      .gte('received_at', startDate.toISOString());

    const counts = {
      totalToday: records?.length || 0,
      totalReplied: records?.filter((r) => r.action_taken === 'replied').length || 0,
      totalIgnored: records?.filter((r) => r.action_taken === 'ignored').length || 0,
      totalNotified: records?.filter((r) => r.action_taken === 'notified').length || 0,
      totalCategorized: records?.filter((r) => r.action_taken === 'categorized').length || 0,
    };

    // Get category breakdown
    const { data: categories } = await this.supabase
      .getServiceClient()
      .from('email_categories')
      .select('id, name, slug, color')
      .eq('user_id', userId);

    const categoryBreakdown = [];
    if (categories) {
      for (const cat of categories) {
        const { count } = await this.supabase
          .getServiceClient()
          .from('email_records')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('category_id', cat.id)
          .gte('received_at', startDate.toISOString());

        categoryBreakdown.push({
          name: cat.name,
          slug: cat.slug,
          count: count || 0,
          color: cat.color,
        });
      }
    }

    // Sort by count descending
    categoryBreakdown.sort((a, b) => b.count - a.count);

    // Get recent actions
    const { data: actions } = await this.supabase
      .getServiceClient()
      .from('agent_actions')
      .select(
        `id, action_type, status, details, executed_at,
        email_records(subject, sender_name)`,
      )
      .eq('user_id', userId)
      .order('executed_at', { ascending: false })
      .limit(20);

    const recentActions = (actions || []).map((a) => ({
      id: a.id,
      action_type: a.action_type,
      status: a.status,
      details: a.details,
      executed_at: a.executed_at,
      email: a.email_records as any,
    }));

    return {
      ...counts,
      categoryBreakdown,
      recentActions,
    };
  }

  async getEmailVolume(
    userId: string,
    period: 'today' | 'week' | 'month' | 'year',
  ): Promise<{ date: string; count: number }[]> {
    const startDate = this.getStartDate(period);

    const { data: records } = await this.supabase
      .getServiceClient()
      .from('email_records')
      .select('received_at')
      .eq('user_id', userId)
      .gte('received_at', startDate.toISOString())
      .order('received_at', { ascending: true });

    if (!records) return [];

    // Group by date
    const grouped: Record<string, number> = {};
    for (const record of records) {
      const date = new Date(record.received_at).toISOString().split('T')[0];
      grouped[date] = (grouped[date] || 0) + 1;
    }

    return Object.entries(grouped).map(([date, count]) => ({ date, count }));
  }

  async getTopSenders(
    userId: string,
    limit: number = 10,
  ): Promise<{ email: string; name: string; count: number }[]> {
    const { data } = await this.supabase
      .getServiceClient()
      .from('email_records')
      .select('sender_email, sender_name')
      .eq('user_id', userId);

    if (!data) return [];

    const senderCounts: Record<string, { name: string; count: number }> = {};
    for (const record of data) {
      const key = record.sender_email;
      if (!senderCounts[key]) {
        senderCounts[key] = { name: record.sender_name || key, count: 0 };
      }
      senderCounts[key].count++;
    }

    return Object.entries(senderCounts)
      .map(([email, { name, count }]) => ({ email, name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private getStartDate(period: string): Date {
    const now = new Date();
    switch (period) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'week':
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return weekAgo;
      case 'month':
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return monthAgo;
      case 'year':
        const yearAgo = new Date(now);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        return yearAgo;
      default:
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
  }
}
