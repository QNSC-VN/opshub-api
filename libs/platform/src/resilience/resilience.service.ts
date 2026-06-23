import { Injectable } from '@nestjs/common';
import {
  ExponentialBackoff,
  handleAll,
  IPolicy,
  retry,
  timeout,
  TimeoutStrategy,
  wrap,
} from 'cockatiel';

/**
 * Pre-configured resilience policies for external calls (Graph API, AWS,
 * third-party services). Import ResilienceService into any module that makes
 * outbound HTTP calls — don't build ad-hoc retry logic in services.
 *
 * Usage:
 *   const result = await this.resilience.external.execute(() => callApi());
 */
@Injectable()
export class ResilienceService {
  /**
   * Policy for calls to the Microsoft Graph API and similar external services.
   * Retries up to 3 times with exponential backoff, total timeout of 10s.
   */
  readonly external: IPolicy = wrap(
    retry(handleAll, {
      maxAttempts: 3,
      backoff: new ExponentialBackoff({ initialDelay: 200, maxDelay: 2_000 }),
    }),
    timeout(10_000, TimeoutStrategy.Cooperative),
  );

  /**
   * Policy for internal service calls (fast path, low tolerance for latency).
   * Single retry, 3s timeout.
   */
  readonly internal: IPolicy = wrap(
    retry(handleAll, { maxAttempts: 1 }),
    timeout(3_000, TimeoutStrategy.Cooperative),
  );

  /**
   * Policy for background/async work where latency is less critical.
   * Up to 5 retries, 30s timeout.
   */
  readonly background: IPolicy = wrap(
    retry(handleAll, {
      maxAttempts: 5,
      backoff: new ExponentialBackoff({ initialDelay: 500, maxDelay: 10_000 }),
    }),
    timeout(30_000, TimeoutStrategy.Cooperative),
  );

  /** One-off: timeout-only, no retries. */
  withTimeout(ms: number): IPolicy {
    return timeout(ms, TimeoutStrategy.Cooperative);
  }
}
