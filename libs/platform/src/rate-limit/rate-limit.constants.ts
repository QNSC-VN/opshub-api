export const RATE_LIMIT_TIER = Symbol('RATE_LIMIT_TIER');
export const SKIP_RATE_LIMIT = Symbol('SKIP_RATE_LIMIT');

export interface RateLimitTier {
  /** Display name used in logs and RFC 6585 headers */
  name: string;
  /** Sliding-window size in milliseconds */
  windowMs: number;
  /** Max allowed requests within the window */
  limit: number;
}

/**
 * Named tiers for intent-based rate limiting.
 * Append-only — never remove or change semantics of an existing tier name.
 */
export const RATE_LIMIT_TIERS = {
  /** Default: most read/write endpoints — 200 req/min per identity */
  DEFAULT: { name: 'DEFAULT', windowMs: 60_000, limit: 200 },
  /** Strict: expensive list/search endpoints — 60 req/min */
  STRICT: { name: 'STRICT', windowMs: 60_000, limit: 60 },
  /** Auth login: brute-force protection — 5 attempts / 15 min */
  AUTH_LOGIN: { name: 'AUTH_LOGIN', windowMs: 15 * 60_000, limit: 5 },
  /** Token refresh — 30 req/min */
  AUTH_REFRESH: { name: 'AUTH_REFRESH', windowMs: 60_000, limit: 30 },
} as const satisfies Record<string, RateLimitTier>;

export type RateLimitTierName = keyof typeof RATE_LIMIT_TIERS;
