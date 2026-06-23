import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  PlatformModule,
  AppConfigService,
  GlobalExceptionFilter,
  HttpLoggingInterceptor,
  AsyncLocalStorageMiddleware,
  RequestContextService,
} from '@platform';
import { IdentityModule } from '@modules/identity';
import { AssetsModule } from '@modules/assets';
import { AccessRequestsModule } from '@modules/access-requests';
import { ComplianceModule } from '@modules/compliance';
import { WorkforceModule } from '@modules/workforce';
import { AuditModule } from '@modules/audit';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [AppConfigService, RequestContextService],
      useFactory: (config: AppConfigService, ctx: RequestContextService) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL'),
          autoLogging: false,
          transport: config.get('LOG_PRETTY')
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
          mixin: () => {
            const correlationId = ctx.getCorrelationId();
            return correlationId ? { correlationId } : {};
          },
          redact: ['req.headers.authorization', 'req.headers.cookie'],
        },
      }),
    }),
    PlatformModule,
    AuditModule,
    IdentityModule,
    AssetsModule,
    AccessRequestsModule,
    ComplianceModule,
    WorkforceModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: HttpLoggingInterceptor },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AsyncLocalStorageMiddleware).forRoutes('*');
  }
}
