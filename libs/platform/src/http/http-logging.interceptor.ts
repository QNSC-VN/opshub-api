import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RequestContextService } from '../context/request-context';

/** Access-log lines suppressed for these prefixes (health/readiness probes). */
const SILENT_PREFIXES = new Set(['/v1/healthz', '/v1/readyz', '/favicon.ico']);

/**
 * Emits ONE structured access-log line per request.
 * Severity mirrors HTTP status: WARN for 4xx, ERROR for 5xx, LOG for 2xx/3xx.
 * Includes `userId` (from ALS after JWT validation) and client `ip` for forensics.
 * Skips noisy health-probe endpoints.
 */
@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(
    private readonly pinoLogger: PinoLogger,
    private readonly ctx: RequestContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const res = context.switchToHttp().getResponse<FastifyReply>();

    if (SILENT_PREFIXES.has(req.url)) return next.handle();

    const start = Date.now();
    const ip =
      (req.headers['x-real-ip'] as string) ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';

    return next.handle().pipe(
      tap({
        next: () => this.log(req, res.statusCode, start, ip),
        error: () => this.log(req, res.statusCode || 500, start, ip),
      }),
    );
  }

  private log(req: FastifyRequest, statusCode: number, start: number, ip: string): void {
    const userId = this.ctx.getUserId();
    const fields = {
      method: req.method,
      url: req.url,
      statusCode,
      durationMs: Date.now() - start,
      ip,
      ...(userId ? { userId } : {}),
    };
    if (statusCode >= 500) {
      this.logger.error(fields);
    } else if (statusCode >= 400) {
      this.logger.warn(fields);
    } else {
      this.logger.log(fields);
    }
  }
}
