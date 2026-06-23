import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { PlatformModule, AppConfigService } from '@platform';
import { OutboxRelayService } from './outbox/outbox-relay.service';
import { ComplianceSyncCron } from './cron/compliance-sync.cron';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL'),
          transport: config.get('LOG_PRETTY')
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        },
      }),
    }),
    ScheduleModule.forRoot(),
    PlatformModule,
  ],
  providers: [OutboxRelayService, ComplianceSyncCron],
})
export class WorkerModule {}
