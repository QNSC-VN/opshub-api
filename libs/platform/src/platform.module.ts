import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { TerminusModule } from '@nestjs/terminus';
import { AppConfigModule } from './config/config.module';
import { AppConfigService } from './config/app-config.service';
import { DatabaseModule } from './database/database.module';
import { RequestContextService } from './context/request-context';
import { JwtStrategy } from './auth/jwt.strategy';
import { JwtAuthGuard } from './auth/jwt.guard';
import { RoleGuard } from './auth/role.guard';
import { OutboxService } from './outbox/outbox.service';
import { HealthController } from './observability/health.controller';
import { HttpLoggingInterceptor } from './http/http-logging.interceptor';
import { CacheService } from './cache/cache.service';
import { ResilienceService } from './resilience/resilience.service';

/**
 * Platform module — cross-cutting infrastructure shared by every bounded context:
 * config, database, auth, outbox, health, logging, cache, resilience.
 * Imported once by AppModule.
 */
@Global()
@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        privateKey: config.get('JWT_PRIVATE_KEY'),
        publicKey: config.get('JWT_PUBLIC_KEY'),
        signOptions: {
          algorithm: 'ES256',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          expiresIn: config.get('JWT_ACCESS_EXPIRY') as any,
          issuer: config.get('JWT_ISSUER'),
          audience: config.get('JWT_AUDIENCE'),
        },
        verifyOptions: {
          algorithms: ['ES256'],
          issuer: config.get('JWT_ISSUER'),
          audience: config.get('JWT_AUDIENCE'),
        },
      }),
    }),
    TerminusModule,
  ],
  controllers: [HealthController],
  providers: [
    RequestContextService,
    JwtStrategy,
    JwtAuthGuard,
    RoleGuard,
    OutboxService,
    HttpLoggingInterceptor,
    CacheService,
    ResilienceService,
  ],
  exports: [
    AppConfigModule,
    DatabaseModule,
    JwtModule,
    RequestContextService,
    JwtAuthGuard,
    RoleGuard,
    OutboxService,
    HttpLoggingInterceptor,
    CacheService,
    ResilienceService,
  ],
})
export class PlatformModule {}
