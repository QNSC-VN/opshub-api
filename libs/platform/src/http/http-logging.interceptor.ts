import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RequestContextService } from '../context/request-context';

/**
 * Emits one structured access-log line per request (replaces pino-http autoLogging).
 * Includes correlation-id and, once the JWT has been validated, the actor userId —
 * critical for post-incident forensics (OWASP Audit logs guidance).
 */
@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: Logger,
    private readonly ctx: RequestContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<FastifyRequest>();
    const res = http.getResponse<FastifyReply>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.log(req, res, start),
        error: () => this.log(req, res, start),
      }),
    );
  }

  private log(req: FastifyRequest, res: FastifyReply, start: number): void {
    const userId = this.ctx.getUserId();
    this.logger.log({
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      ...(userId ? { userId } : {}),
    });
  }
}
