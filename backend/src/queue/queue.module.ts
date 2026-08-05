import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailProcessor } from './processors/email.processor';
import { AgentModule } from '../agent/agent.module';
import { GmailModule } from '../gmail/gmail.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST', 'localhost');
        const isUpstashOrTls = host.includes('upstash.io') || configService.get<string>('REDIS_TLS') === 'true';

        return {
          connection: {
            host: host,
            port: configService.get<number>('REDIS_PORT', 6379),
            password: configService.get<string>('REDIS_PASSWORD') || undefined,
            tls: isUpstashOrTls ? { rejectUnauthorized: false } : undefined,
          },
          defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      };
    },
    inject: [ConfigService],
  }),
    BullModule.registerQueue(
      { name: 'email-processing' },
    ),
    AgentModule,
    GmailModule,
  ],
  providers: [EmailProcessor],
  exports: [BullModule],
})
export class QueueModule {}
