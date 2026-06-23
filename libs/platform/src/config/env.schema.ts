import { z } from 'zod';

const booleanish = (defaultValue: boolean) =>
  z
    .string()
    .default(String(defaultValue))
    .transform((v) => v === 'true');

/**
 * Validated environment schema.
 * The process refuses to start if any required variable is missing or malformed.
 */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  // ── Database ───────────────────────────────────────────────────────────────
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MIN: z.coerce.number().int().positive().default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(20),

  // ── Auth ───────────────────────────────────────────────────────────────────
  // Scaffold uses HS256 + a dev-login endpoint. Production target: Entra ID OIDC.
  JWT_SECRET: z.string().min(32),
  // Used to sign fastify-cookie (required for CSRF signed cookies).
  COOKIE_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('8h'),
  JWT_ISSUER: z.string().default('opshub-api'),
  JWT_AUDIENCE: z.string().default('opshub-web'),

  // ── AWS (optional in dev) ──────────────────────────────────────────────────
  AWS_REGION: z.string().default('ap-southeast-1'),
  SQS_OUTBOX_URL: z.string().optional(),

  // ── Observability ──────────────────────────────────────────────────────────
  SERVICE_VERSION: z.string().default('dev'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_PRETTY: booleanish(false),
  LOG_SQL: booleanish(false),
  OTEL_ENABLED: booleanish(false),
  OTEL_SERVICE_NAME: z.string().default('opshub-api'),
  OTEL_WORKER_SERVICE_NAME: z.string().default('opshub-worker'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),

  // ── Cache (Valkey / Redis — optional in dev) ───────────────────────────────
  REDIS_URL: z.string().optional(),
  REDIS_KEY_PREFIX: z.string().default('opshub:'),
});

export type Env = z.infer<typeof EnvSchema>;
