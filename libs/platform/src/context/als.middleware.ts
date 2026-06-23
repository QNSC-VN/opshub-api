import { Injectable, NestMiddleware } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { requestContextStorage } from './request-context';

/**
 * Establishes an AsyncLocalStorage context for every request and stamps a
 * correlation id (incoming X-Correlation-Id header or a fresh uuid).
 */
@Injectable()
export class AsyncLocalStorageMiddleware implements NestMiddleware {
  use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void): void {
    const headerId = req.headers['x-correlation-id'];
    const correlationId =
      (Array.isArray(headerId) ? headerId[0] : headerId) ?? randomUUID();

    res.setHeader('X-Correlation-Id', correlationId);
    requestContextStorage.run({ correlationId }, () => next());
  }
}
