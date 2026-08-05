import { Injectable, Logger } from '@nestjs/common';
import { buildEmailClassifierGraph } from './graph/email-classifier.graph';
import { EmailAgentStateType } from './graph/state';
import { GmailService, EmailMessage } from '../gmail/gmail.service';
import { SupabaseService } from '../database/supabase.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly graph: ReturnType<typeof buildEmailClassifierGraph>;

  constructor(
    private readonly gmailService: GmailService,
    private readonly supabase: SupabaseService,
    private readonly telegramService: TelegramService,
  ) {
    this.graph = buildEmailClassifierGraph();
  }

  async processEmail(userId: string, messageId: string): Promise<void> {
    try {
      // Fetch the email content
      const email = await this.gmailService.getMessage(userId, messageId);

      // Check if already processed
      const { data: existing } = await this.supabase
        .getServiceClient()
        .from('email_records')
        .select('id')
        .eq('user_id', userId)
        .eq('gmail_message_id', messageId)
        .single();

      if (existing) {
        this.logger.log(`Email ${messageId} already processed for user ${userId}`);
        return;
      }

      // Get user preferences and rules
      const userRules = await this.getUserRules(userId);
      const preferences = await this.getUserPreferences(userId);

      // Run the agent graph
      const result = await this.graph.invoke({
        userId,
        emailId: email.id,
        threadId: email.threadId,
        from: email.from,
        fromName: email.fromName,
        subject: email.subject,
        body: email.body,
        snippet: email.snippet,
        userRules,
        autoReplyEnabled: preferences.auto_reply_enabled,
        customAiInstructions: preferences.custom_ai_instructions || '',
        category: '',
        categorySlug: '',
        confidence: 0,
        isNewCategory: false,
        shouldReply: false,
        aiSuggestedNotify: false,
        action: '',
        shouldNotifyTelegram: false,
        replyDraft: '',
        status: '',
        error: '',
      } as EmailAgentStateType);

      // Execute the decided action
      await this.executeAction(userId, email, result);

      this.logger.log(
        `Processed email ${messageId}: category=${result.category}, action=${result.action}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process email ${messageId} for user ${userId}: ${(error as Error).message}`,
      );

      // Log the failed action
      await this.logAction(userId, null, 'classify', 'failed', {
        error: (error as Error).message,
        messageId,
      });
    }
  }

  private async executeAction(
    userId: string,
    email: EmailMessage,
    result: EmailAgentStateType,
  ): Promise<void> {
    // Ensure category exists (create if new)
    const categoryId = await this.ensureCategory(
      userId,
      result.categorySlug,
      result.category,
      result.isNewCategory,
    );

    // Store the email record
    const { data: record } = await this.supabase
      .getServiceClient()
      .from('email_records')
      .insert({
        user_id: userId,
        gmail_message_id: email.id,
        thread_id: email.threadId,
        category_id: categoryId,
        sender_email: email.from,
        sender_name: email.fromName,
        subject: email.subject,
        snippet: email.snippet,
        action_taken: result.action === 'reply' ? 'replied' : result.action === 'ignore' ? 'ignored' : result.action === 'notify' ? 'notified' : 'categorized',
        ai_confidence: result.confidence,
        received_at: email.date.toISOString(),
      })
      .select('id')
      .single();

    const recordId = record?.id;

    // Execute action
    switch (result.action) {
      case 'reply':
        if (result.replyDraft && result.autoReplyEnabled) {
          await this.gmailService.sendReply(
            userId,
            email.threadId,
            email.from,
            email.subject,
            result.replyDraft,
          );
          await this.logAction(userId, recordId, 'reply', 'success', {
            draft: result.replyDraft,
          });
        } else {
          // Store draft for user review
          await this.logAction(userId, recordId, 'reply', 'pending', {
            draft: result.replyDraft,
          });
        }
        break;

      case 'ignore':
        await this.gmailService.markAsRead(userId, email.id);
        await this.gmailService.archiveMessage(userId, email.id);
        await this.logAction(userId, recordId, 'ignore', 'success', {});
        break;

      case 'notify':
        await this.logAction(userId, recordId, 'notify', 'success', {
          category: result.category,
        });
        break;

      case 'categorize':
        await this.logAction(userId, recordId, 'categorize', 'success', {
          category: result.category,
        });
        break;
    }

    // Send Telegram notification if needed
    if (result.shouldNotifyTelegram) {
      await this.telegramService.notifyUser(userId, {
        category: result.category,
        from: `${email.fromName} <${email.from}>`,
        subject: email.subject,
        snippet: email.snippet,
        action: result.action,
        replyDraft: result.replyDraft || undefined,
      });
    }
  }

  private async ensureCategory(
    userId: string,
    slug: string,
    name: string,
    isNew: boolean,
  ): Promise<string> {
    // Check if category exists
    const { data: existing } = await this.supabase
      .getServiceClient()
      .from('email_categories')
      .select('id')
      .eq('user_id', userId)
      .eq('slug', slug)
      .single();

    if (existing) {
      return existing.id;
    }

    // Create new category
    const { data: newCategory, error } = await this.supabase
      .getServiceClient()
      .from('email_categories')
      .insert({
        user_id: userId,
        name,
        slug,
        description: `Auto-discovered category: ${name}`,
        is_system: false,
      })
      .select('id')
      .single();

    if (error) {
      this.logger.error(`Failed to create category: ${error.message}`);
      throw error;
    }

    // Create default rule for new category
    await this.supabase
      .getServiceClient()
      .from('category_rules')
      .insert({
        user_id: userId,
        category_id: newCategory.id,
        action: 'notify',
        notify_telegram: true,
      });

    if (isNew) {
      await this.logAction(userId, null, 'create_category', 'success', {
        categoryName: name,
        slug,
      });
    }

    return newCategory.id;
  }

  private async getUserRules(userId: string): Promise<Record<string, string>> {
    const { data } = await this.supabase
      .getServiceClient()
      .from('category_rules')
      .select('action, email_categories!inner(slug)')
      .eq('user_id', userId);

    const rules: Record<string, string> = {};
    if (data) {
      for (const rule of data) {
        const category = rule.email_categories as any;
        if (category?.slug) {
          rules[category.slug] = rule.action;
        }
      }
    }
    return rules;
  }

  private async getUserPreferences(userId: string) {
    const { data } = await this.supabase
      .getServiceClient()
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    return data || { auto_reply_enabled: false, telegram_enabled: false };
  }

  private async logAction(
    userId: string,
    emailRecordId: string | null,
    actionType: string,
    status: string,
    details: Record<string, any>,
  ): Promise<void> {
    await this.supabase
      .getServiceClient()
      .from('agent_actions')
      .insert({
        user_id: userId,
        email_record_id: emailRecordId,
        action_type: actionType,
        status,
        details,
      });
  }
}
