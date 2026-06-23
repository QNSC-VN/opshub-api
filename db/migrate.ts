/**
 * Standalone migration runner — applies pending Drizzle migrations then exits.
 * Used by the CI/CD run-db-migration step and locally via `pnpm db:migrate`.
 * Loads .env via Node's native --env-file flag (see package.json script).
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

async function main(): Promise<void> {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL is required');

  const pool = new Pool({ connectionString, max: 1 });
  const db = drizzle(pool);

  // Ensure schemas exist before applying table migrations.
  for (const schema of ['identity', 'authz', 'assets', 'access', 'compliance', 'workforce', 'audit', 'messaging']) {
    await db.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS ${schema}`));
  }

  await migrate(db, { migrationsFolder: './db/migrations' });
  // eslint-disable-next-line no-console
  console.log('✅ Migrations applied');
  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('❌ Migration failed', err);
  process.exit(1);
});
