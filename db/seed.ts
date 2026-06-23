/**
 * Dev seed — inserts representative employees plus the RBAC catalog (permissions,
 * system roles) and baseline role assignments for local testing.
 * Run with:  tsx --env-file=.env db/seed.ts
 *
 * Safe to run multiple times (idempotent — ON CONFLICT DO NOTHING / existence checks).
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { Pool } from 'pg';
import { employees } from './schema/identity';
import { permissions, roles, rolePermissions, userRoleAssignments } from './schema/authz';

// ── Permission catalog ─────────────────────────────────────────────────────────
const PERMISSIONS: Array<{ key: string; description: string }> = [
  { key: '*', description: 'Wildcard — grants every permission' },
  { key: 'rbac.read', description: 'View roles, permissions and assignments' },
  { key: 'rbac.manage', description: 'Create/edit/delete roles and permissions' },
  { key: 'role.assign', description: 'Grant and revoke role assignments' },
  { key: 'employee.read', description: 'View employee records' },
  { key: 'employee.write', description: 'Create and update employee records' },
  { key: 'employee.offboard', description: 'Offboard employees and revoke access' },
  { key: 'asset.read', description: 'View assets' },
  { key: 'asset.write', description: 'Create and update assets' },
  { key: 'asset.reassign', description: 'Reassign assets between holders' },
  { key: 'access_request.read', description: 'View privileged-access requests' },
  { key: 'access_request.approve', description: 'Approve/reject privileged-access requests' },
  { key: 'compliance.read', description: 'View compliance findings and software' },
  { key: 'compliance.manage', description: 'Resolve findings and manage compliance data' },
  { key: 'workforce.read', description: 'View timesheets and leave' },
  { key: 'workforce.approve', description: 'Approve timesheets and leave' },
  { key: 'audit.read', description: 'Read the audit log' },
];

// ── System roles → permission bundles ───────────────────────────────────────────
const ROLES: Array<{ key: string; name: string; permissions: string[] }> = [
  { key: 'admin', name: 'Platform Administrator', permissions: ['*'] },
  {
    key: 'it-admin',
    name: 'IT Administrator',
    permissions: [
      'employee.read',
      'employee.write',
      'asset.read',
      'asset.write',
      'asset.reassign',
      'access_request.read',
      'access_request.approve',
      'compliance.read',
      'audit.read',
    ],
  },
  {
    key: 'security',
    name: 'Security Officer',
    permissions: [
      'compliance.read',
      'compliance.manage',
      'access_request.read',
      'access_request.approve',
      'audit.read',
    ],
  },
  {
    key: 'hr',
    name: 'HR Manager',
    permissions: [
      'employee.read',
      'employee.write',
      'employee.offboard',
      'workforce.read',
      'workforce.approve',
    ],
  },
  {
    key: 'manager',
    name: 'People Manager',
    permissions: [
      'employee.read',
      'workforce.read',
      'workforce.approve',
      'access_request.read',
      'access_request.approve',
    ],
  },
  {
    key: 'helpdesk',
    name: 'Help Desk',
    permissions: ['asset.read', 'asset.write', 'access_request.read'],
  },
  {
    key: 'auditor',
    name: 'Auditor (read-only)',
    permissions: ['rbac.read', 'audit.read', 'compliance.read', 'employee.read', 'asset.read'],
  },
  { key: 'employee', name: 'Employee', permissions: [] },
];

// ── Baseline assignments (employee email → role key, global scope) ───────────────
const ASSIGNMENTS: Array<{ email: string; roleKey: string }> = [
  { email: 'admin@opshub.local', roleKey: 'admin' },
  { email: 'nghia@opshub.local', roleKey: 'it-admin' },
  { email: 'viewer@opshub.local', roleKey: 'employee' },
];

async function main(): Promise<void> {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL is required');

  const pool = new Pool({ connectionString, max: 1 });
  const db = drizzle(pool);

  // 1. Employees
  const employeeSeeds = [
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
  await db.insert(employees).values(employeeSeeds).onConflictDoNothing({ target: employees.email });

  // 2. Permissions
  await db.insert(permissions).values(PERMISSIONS).onConflictDoNothing({ target: permissions.key });

  // 3. Roles (all seed roles are system-managed)
  await db
    .insert(roles)
    .values(ROLES.map((r) => ({ key: r.key, name: r.name, system: true })))
    .onConflictDoNothing({ target: roles.key });

  const roleRows = await db
    .select({ id: roles.id, key: roles.key })
    .from(roles)
    .where(
      inArray(
        roles.key,
        ROLES.map((r) => r.key),
      ),
    );
  const roleIdByKey = new Map(roleRows.map((r) => [r.key, r.id]));

  // 4. Role → permission membership
  const rolePermValues = ROLES.flatMap((r) => {
    const roleId = roleIdByKey.get(r.key);
    if (!roleId) return [];
    return r.permissions.map((permissionKey) => ({ roleId, permissionKey }));
  });
  if (rolePermValues.length > 0) {
    await db
      .insert(rolePermissions)
      .values(rolePermValues)
      .onConflictDoNothing({ target: [rolePermissions.roleId, rolePermissions.permissionKey] });
  }

  // 5. Baseline assignments (global scope), idempotent via existence check
  const empRows = await db
    .select({ id: employees.id, email: employees.email })
    .from(employees)
    .where(
      inArray(
        employees.email,
        ASSIGNMENTS.map((a) => a.email),
      ),
    );
  const empIdByEmail = new Map(empRows.map((e) => [e.email, e.id]));
  const adminId = empIdByEmail.get('admin@opshub.local');

  for (const a of ASSIGNMENTS) {
    const userId = empIdByEmail.get(a.email);
    const roleId = roleIdByKey.get(a.roleKey);
    if (!userId || !roleId) continue;

    const [existing] = await db
      .select({ id: userRoleAssignments.id })
      .from(userRoleAssignments)
      .where(
        and(
          eq(userRoleAssignments.userId, userId),
          eq(userRoleAssignments.roleId, roleId),
          eq(userRoleAssignments.scopeType, 'global'),
          isNull(userRoleAssignments.scopeId),
        ),
      )
      .limit(1);
    if (existing) continue;

    await db.insert(userRoleAssignments).values({
      userId,
      roleId,
      scopeType: 'global',
      scopeId: null,
      grantedBy: adminId ?? userId,
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    `✅ Seeded ${employeeSeeds.length} employees, ${PERMISSIONS.length} permissions, ${ROLES.length} roles, ${ASSIGNMENTS.length} assignments`,
  );
  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('❌ Seed failed', err);
  process.exit(1);
});
