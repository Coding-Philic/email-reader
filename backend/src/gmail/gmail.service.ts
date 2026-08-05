import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, gmail_v1 } from 'googleapis';
import { AuthService } from '../auth/auth.service';
import { OAuth2Client } from 'google-auth-library';

export interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  snippet: string;
  body: string;
  date: Date;
  labels: string[];
}

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private async getOAuth2Client(userId: string): Promise<OAuth2Client> {
    const tokens = await this.authService.getGmailTokens(userId);
    if (!tokens) {
      throw new Error(`No Gmail tokens found for user ${userId}`);
    }

    const oauth2Client = new google.auth.OAuth2(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
      this.configService.get('GOOGLE_REDIRECT_URI'),
    );

    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: new Date(tokens.token_expiry).getTime(),
    });

    // Handle token refresh
    oauth2Client.on('tokens', async (newTokens) => {
      if (newTokens.access_token) {
        await this.authService.updateAccessToken(
          userId,
          newTokens.access_token,
          new Date(newTokens.expiry_date || Date.now() + 3600000),
        );
      }
    });

    return oauth2Client as any;
  }

  private async getGmailClient(userId: string): Promise<gmail_v1.Gmail> {
    const auth = await this.getOAuth2Client(userId);
    return google.gmail({ version: 'v1', auth: auth as any });
  }

  async getMessage(userId: string, messageId: string): Promise<EmailMessage> {
    const gmail = await this.getGmailClient(userId);

    const { data } = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    return this.parseMessage(data);
  }

  async getHistoryChanges(
    userId: string,
    startHistoryId: string,
  ): Promise<string[]> {
    const gmail = await this.getGmailClient(userId);
    const messageIds: string[] = [];

    try {
      const { data } = await gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        historyTypes: ['messageAdded'],
        labelId: 'INBOX',
      });

      if (data.history) {
        for (const record of data.history) {
          if (record.messagesAdded) {
            for (const msg of record.messagesAdded) {
              if (msg.message?.id) {
                messageIds.push(msg.message.id);
              }
            }
          }
        }
      }
    } catch (error: any) {
      if (error.code === 404) {
        this.logger.warn(
          `History ID ${startHistoryId} not found for user ${userId}, need full sync`,
        );
      } else {
        throw error;
      }
    }

    return messageIds;
  }

  async sendReply(
    userId: string,
    threadId: string,
    to: string,
    subject: string,
    body: string,
  ): Promise<string> {
    const gmail = await this.getGmailClient(userId);

    const rawMessage = this.createRawMessage(to, subject, body, threadId);

    const { data } = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMessage,
        threadId,
      },
    });

    this.logger.log(`Reply sent for thread ${threadId}, message ID: ${data.id}`);
    return data.id!;
  }

  async markAsRead(userId: string, messageId: string): Promise<void> {
    const gmail = await this.getGmailClient(userId);

    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    });
  }

  async archiveMessage(userId: string, messageId: string): Promise<void> {
    const gmail = await this.getGmailClient(userId);

    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['INBOX'],
      },
    });
  }

  private parseMessage(data: gmail_v1.Schema$Message): EmailMessage {
    const headers = data.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    const fromFull = getHeader('From');
    const fromMatch = fromFull.match(/^(.+?)\s*<(.+?)>$/);

    let body = '';
    if (data.payload?.body?.data) {
      body = Buffer.from(data.payload.body.data, 'base64url').toString('utf-8');
    } else if (data.payload?.parts) {
      const textPart = data.payload.parts.find(
        (p) => p.mimeType === 'text/plain',
      );
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, 'base64url').toString('utf-8');
      }
    }

    return {
      id: data.id!,
      threadId: data.threadId!,
      from: fromMatch ? fromMatch[2] : fromFull,
      fromName: fromMatch ? fromMatch[1].replace(/"/g, '').trim() : fromFull,
      to: getHeader('To'),
      subject: getHeader('Subject'),
      snippet: data.snippet || '',
      body: body.substring(0, 5000), // Limit body size for LLM processing
      date: new Date(parseInt(data.internalDate || '0', 10)),
      labels: data.labelIds || [],
    };
  }

  private createRawMessage(
    to: string,
    subject: string,
    body: string,
    threadId: string,
  ): string {
    const message = [
      `To: ${to}`,
      `Subject: Re: ${subject}`,
      `In-Reply-To: ${threadId}`,
      `References: ${threadId}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\r\n');

    return Buffer.from(message).toString('base64url');
  }
}
