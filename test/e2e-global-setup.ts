/**
 * E2E global setup — bootstraps test infrastructure before any e2e specs run.
 * Uses the DATABASE_URL from env (set by CI or a local .env.test).
 */
export function setup() {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    // CI sets DATABASE_URL to the service container; locally override via .env.test
    DATABASE_URL:
      process.env['DATABASE_URL'] ??
      'postgresql://postgres:postgres@localhost:5432/opshub_test',
    JWT_SECRET: 'test-jwt-secret-minimum-32-characters-long-ok',
    JWT_ACCESS_EXPIRY: '8h',
    JWT_ISSUER: 'opshub-test',
    JWT_AUDIENCE: 'opshub-test-app',
    CORS_ORIGINS: 'http://localhost:5173',
    LOG_LEVEL: 'silent',
    LOG_PRETTY: 'false',
    LOG_SQL: 'false',
    OTEL_ENABLED: 'false',
    OTEL_SERVICE_NAME: 'opshub-api-e2e',
  });
}
