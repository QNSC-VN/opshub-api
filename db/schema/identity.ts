/**
 * identity schema — employees (single-tenant directory, synced from Entra ID).
 */
import { pgSchema, uuid, varchar, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { employeeStatusEnum } from './enums';

export const identitySchema = pgSchema('identity');

export const employees = identitySchema.table(
  'employees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Entra ID object id (oid claim) — null for locally-created records. */
    entraOid: varchar('entra_oid', { length: 64 }),
    email: varchar('email', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 200 }).notNull(),
    department: varchar('department', { length: 120 }),
    jobTitle: varchar('job_title', { length: 120 }),
    managerId: uuid('manager_id'),
    /** Application roles, e.g. ['it-admin','security']. Drives RBAC. */
    roles: jsonb('roles').notNull().$type<string[]>().default([]),
    status: employeeStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex('uq_employee_email').on(t.email),
    entraIdx: uniqueIndex('uq_employee_entra_oid').on(t.entraOid),
    statusIdx: index('ix_employee_status').on(t.status),
  }),
);
