/**
 * Dev seed — inserts representative employees for local testing.
 * Run with:  tsx --env-file=.env db/seed.ts
 *
 * Safe to run multiple times (ON CONFLICT DO NOTHING).
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { employees } from './schema/identity';

async function main(): Promise<void> {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL is required');

  const pool = new Pool({ connectionString, max: 1 });
  const db = drizzle(pool);

  const seeds = [
    {
      email: 'admin@opshub.local',
      displayName: 'Admin User',
      department: 'IT',
      jobTitle: 'IT Admin',
      roles: ['it-admin', 'security'],
      status: 'active' as const,
    },
    {
      email: 'nghia@opshub.local',
      displayName: 'Nghia Van',
      department: 'Engineering',
      jobTitle: 'Senior Engineer',
      roles: ['it-admin'],
      status: 'active' as const,
    },
    {
      email: 'viewer@opshub.local',
      displayName: 'Viewer User',
      department: 'Operations',
      jobTitle: 'Ops Analyst',
      roles: [],
      status: 'active' as const,
    },
  ];

  await db
    .insert(employees)
    .values(seeds)
    .onConflictDoNothing({ target: employees.email });

  // eslint-disable-next-line no-console
  console.log(`✅ Seeded ${seeds.length} employees`);
  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('❌ Seed failed', err);
  process.exit(1);
});
