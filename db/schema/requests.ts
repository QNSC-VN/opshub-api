/**
 * requests schema — universal request/approval state machine. All request-like
 * workflows (access requests, leave, overtime, onboarding, offboarding …)
 * create a `request_items` row as their canonical state record. Domain tables
 * store extended payload and link back via `request_id`.
 */
import {
  pgSchema,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { requestPriorityEnum, requestStatusEnum } from './enums';

export const requestsSchema = pgSchema('requests');

/**
 * Canonical state-machine row for every request lifecycle.
 * `payload` holds a searchable snapshot of domain-specific fields so the
 * unified inbox can display useful context without additional joins.
 */
export const requestItems = requestsSchema.table(
  'request_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Discriminator matching the registered RequestTypeDef key. */
    type: varchar('type', { length: 80 }).notNull(),
    requesterId: uuid('requester_id').notNull(),
    /** Current assignee (approver). Set on submit or after delegation. */
    assigneeId: uuid('assignee_id'),
    status: requestStatusEnum('status').notNull().default('pending'),
    priority: requestPriorityEnum('priority').notNull().default('normal'),
    /** Searchable domain snapshot (subject, target, dates, etc). Read-only after submit. */
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    resolutionNote: text('resolution_note'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    /** Absolute deadline; expiry relay transitions status → expired after this time. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    requesterIdx: index('ix_ri_requester').on(t.requesterId, t.createdAt),
    statusTypeIdx: index('ix_ri_status_type').on(t.status, t.type, t.createdAt),
    assigneeIdx: index('ix_ri_assignee').on(t.assigneeId, t.status),
    expiryIdx: index('ix_ri_expiry').on(t.expiresAt, t.status),
  }),
);

/**
 * Immutable append-only log of each approval step. Supports multi-step
 * (parallel or sequential) workflows by incrementing `step`. First-step
 * decisions from a single approver are the common case (step=1).
 */
export const requestApprovals = requestsSchema.table(
  'request_approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => requestItems.id, { onDelete: 'cascade' }),
    step: integer('step').notNull().default(1),
    approverId: uuid('approver_id').notNull(),
    /** 'approved' | 'rejected' | 'delegated' */
    decision: varchar('decision', { length: 20 }).notNull(),
    note: text('note'),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    requestIdx: index('ix_ra_request').on(t.requestId, t.step),
  }),
);
