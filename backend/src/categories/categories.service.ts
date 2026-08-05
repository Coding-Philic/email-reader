import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async getUserCategories(userId: string) {
    const { data, error } = await this.supabase
      .getServiceClient()
      .from('email_categories')
      .select(
        `*, category_rules(action, notify_telegram, auto_reply_template, priority)`,
      )
      .eq('user_id', userId)
      .order('sort_order', { ascending: true });

    if (error) {
      this.logger.error(`Failed to get categories: ${error.message}`);
      throw error;
    }

    return data;
  }

  async updateCategoryRule(
    userId: string,
    categoryId: string,
    action: string,
    notifyTelegram: boolean,
    autoReplyTemplate?: string,
  ) {
    const { error } = await this.supabase
      .getServiceClient()
      .from('category_rules')
      .upsert(
        {
          user_id: userId,
          category_id: categoryId,
          action,
          notify_telegram: notifyTelegram,
          auto_reply_template: autoReplyTemplate || null,
        },
        { onConflict: 'user_id,category_id' },
      );

    if (error) {
      this.logger.error(`Failed to update category rule: ${error.message}`);
      throw error;
    }
  }

  async updateCategoryOrder(
    userId: string,
    orderedIds: string[],
  ) {
    for (let i = 0; i < orderedIds.length; i++) {
      await this.supabase
        .getServiceClient()
        .from('email_categories')
        .update({ sort_order: i })
        .eq('id', orderedIds[i])
        .eq('user_id', userId);
    }
  }

  async deleteCategory(userId: string, categoryId: string) {
    // Only allow deleting non-system categories
    const { data } = await this.supabase
      .getServiceClient()
      .from('email_categories')
      .select('is_system')
      .eq('id', categoryId)
      .eq('user_id', userId)
      .single();

    if (data?.is_system) {
      throw new Error('Cannot delete system categories');
    }

    await this.supabase
      .getServiceClient()
      .from('email_categories')
      .delete()
      .eq('id', categoryId)
      .eq('user_id', userId);
  }
}
