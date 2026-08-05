import { Controller, Post, Body, Res, Logger, HttpCode, HttpStatus, Inject, forwardRef } from '@nestjs/common';
import type { Response } from 'express';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SupabaseService } from '../database/supabase.service';
import { AgentService } from '../agent/agent.service';
import { GmailService } from './gmail.service';

interface PubSubMessage {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

@Controller('webhooks')
export class GmailWebhookController {
  private readonly logger = new Logger(GmailWebhookController.name);

  constructor(
    @InjectQueue('email-processing') private readonly emailQueue: Queue,
    private readonly supabase: SupabaseService,
    @Inject(forwardRef(() => AgentService)) private readonly agentService: AgentService,
    private readonly gmailService: GmailService,
  ) {}

  @Post('gmail')
  @HttpCode(HttpStatus.OK)
  async handleGmailNotification(
    @Body() body: PubSubMessage,
    @Res() res: Response,
  ): Promise<void> {
    // Acknowledge immediately to prevent retries
    res.status(200).send();

    try {
      if (!body.message?.data) {
        this.logger.warn('Received empty Pub/Sub notification');
        return;
      }

      const decoded = JSON.parse(
        Buffer.from(body.message.data, 'base64').toString('utf-8'),
      );

      const { emailAddress, historyId } = decoded;

      if (!emailAddress || !historyId) {
        this.logger.warn('Missing emailAddress or historyId in notification');
        return;
      }

      this.logger.log(
        `Gmail notification for ${emailAddress}, historyId: ${historyId}`,
      );

      // Find the user by email
      const { data: user, error } = await this.supabase
        .getServiceClient()
        .from('users')
        .select('id, gmail_history_id')
        .eq('email', emailAddress)
        .eq('gmail_connected', true)
        .single();

      if (error || !user) {
        this.logger.warn(`No connected user found for email: ${emailAddress}`);
        return;
      }

      const previousHistoryId = user.gmail_history_id;

      // Avoid processing older or duplicate history events
      if (previousHistoryId && Number(historyId) <= Number(previousHistoryId)) {
        this.logger.debug(`Skipping duplicate/older historyId ${historyId} for user ${user.id}`);
        return;
      }

      // 1. Immediately update the stored history ID first so concurrent webhooks do not duplicate work
      await this.supabase
        .getServiceClient()
        .from('users')
        .update({ gmail_history_id: historyId })
        .eq('id', user.id);

      // 2. Process new messages in real-time
      if (previousHistoryId) {
        this.logger.log(`Fetching email changes for user ${user.id} since historyId ${previousHistoryId}...`);
        const rawMessageIds = await this.gmailService.getHistoryChanges(user.id, previousHistoryId);
        const messageIds = Array.from(new Set(rawMessageIds));
        this.logger.log(`Found ${messageIds.length} unique new message(s) to process with AI agent.`);

        for (const messageId of messageIds) {
          try {
            this.logger.log(`🤖 Starting AI agent processing for email ${messageId}...`);
            await this.agentService.processEmail(user.id, messageId);
            this.logger.log(`✅ Completed AI agent analysis for email ${messageId}!`);
          } catch (err: any) {
            this.logger.error(`Error processing email ${messageId}: ${err?.message}`);
          }
        }
      } else {
        this.logger.warn(`No previous historyId found for user ${user.id}, initialized historyId to ${historyId}.`);
      }
    } catch (error) {
      this.logger.error(
        `Error processing Gmail webhook: ${(error as Error).message}`,
      );
    }
  }
}
