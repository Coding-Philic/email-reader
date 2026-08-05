import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AgentService } from '../../agent/agent.service';
import { GmailService } from '../../gmail/gmail.service';

interface EmailProcessingJob {
  userId: string;
  emailAddress: string;
  historyId: string;
  previousHistoryId: string;
}

@Processor('email-processing', {
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 1000, // 10 jobs per second max
  },
})
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly agentService: AgentService,
    private readonly gmailService: GmailService,
  ) {
    super();
  }

  async process(job: Job<EmailProcessingJob>): Promise<void> {
    const { userId, previousHistoryId } = job.data;

    this.logger.log(`Processing email job for user ${userId}`);

    try {
      if (!previousHistoryId) {
        this.logger.warn(`No previous history ID for user ${userId}, skipping`);
        return;
      }

      // Get new messages since last history ID
      const messageIds = await this.gmailService.getHistoryChanges(
        userId,
        previousHistoryId,
      );

      if (messageIds.length === 0) {
        this.logger.log(`No new messages for user ${userId}`);
        return;
      }

      this.logger.log(
        `Found ${messageIds.length} new messages for user ${userId}`,
      );

      // Process each new message through the AI agent
      for (const messageId of messageIds) {
        try {
          await this.agentService.processEmail(userId, messageId);
        } catch (error) {
          this.logger.error(
            `Failed to process message ${messageId}: ${(error as Error).message}`,
          );
          // Continue processing other messages
        }
      }
    } catch (error) {
      this.logger.error(
        `Email processing job failed: ${(error as Error).message}`,
      );
      throw error; // BullMQ will retry based on backoff settings
    }
  }
}
