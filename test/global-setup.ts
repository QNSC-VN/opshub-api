/**
 * Vitest global setup — runs once in the main Node process before any workers.
 * Sets the minimal env vars required by AppConfigModule's Zod validation so
 * the NestJS module tree can be evaluated during test file imports.
 */
export function setup() {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/opshub_test',
    JWT_SECRET: 'test-jwt-secret-minimum-32-characters-long-ok',
    JWT_ACCESS_EXPIRY: '8h',
    JWT_ISSUER: 'opshub-test',
    JWT_AUDIENCE: 'opshub-test-app',
    CORS_ORIGINS: 'http://localhost:5173',
    LOG_LEVEL: 'fatal',
    LOG_PRETTY: 'false',
    LOG_SQL: 'false',
    OTEL_ENABLED: 'false',
    OTEL_SERVICE_NAME: 'opshub-api-test',
  });
}
