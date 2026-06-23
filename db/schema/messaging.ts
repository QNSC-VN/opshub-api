/**
 * messaging schema — transactional outbox tables.
 *
 * outbox_events        — generic domain-event relay to SQS (existing)
 * notification_outbox  — in-app notification queue, relayed every 5s by cron
 * email_outbox         — email send queue, relayed every 5s by cron
 *
 * All three follow the same pattern: written in the caller's DB transaction,
 * relayed by a cron service using SELECT … FOR UPDATE SKIP LOCKED.
 */
import {
  pgSchema, uuid, varchar, text, jsonb, timestamp, boolean, integer,
  index, uniqueIndex,
} from 'drizzle-orm/pg-core';

export const messagingSchema = pgSchema('messaging');

// ── Generic domain-event outbox ──────────────────────────────────────────────

export const outboxEvents = messagingSchema.table(
  'outbox_events',
  {
    id:            uuid('id').primaryKey().defaultRandom(),
    aggregateType: varchar('aggregate_type', { length: 60 }).notNull(),
    aggregateId:   varchar('aggregate_id', { length: 64 }).notNull(),
    eventType:     varchar('event_type', { length: 100 }).notNull(),
    payload:       jsonb('payload').notNull().$type<Record<string, unknown>>(),
    published:     boolean('published').notNull().default(false),
    createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt:   timestamp('published_at', { withTimezone: true }),
  },
  (t) => ({
    unpublishedIdx: index('ix_outbox_unpublished').on(t.published, t.createdAt),
  }),
);

// ── Notification outbox ──────────────────────────────────────────────────────

export const notificationOutbox = messagingSchema.table(
  'notification_outbox',
  {
    id:             uuid('id').primaryKey().defaultRandom(),
    recipientId:    uuid('recipient_id').notNull(),
    actorId:        uuid('actor_id'),
    type:           varchar('type', { length: 100 }).notNull(),
    vars:           jsonb('vars').notNull().$type<Record<string, unknown>>(),
    resourceId:     uuid('resource_id'),
    status:         varchar('status', { length: 20 }).notNull().default('pending'),
    attempts:       integer('attempts').notNull().default(0),
    lastError:      text('last_error'),
    idempotencyKey: varchar('idempotency_key', { length: 255 }),
    scheduledAt:    timestamp('scheduled_at', { withTimezone: true }).notNull().defaultNow(),
    dispatchedAt:   timestamp('dispatched_at', { withTimezone: true }),
  },
  (t) => ({
    pendingIdx:       index('ix_notif_outbox_pending').on(t.status, t.scheduledAt),
    idempotencyIdx:   uniqueIndex('uq_notif_outbox_idempotency').on(t.idempotencyKey),
  }),
);

// ── Email outbox ─────────────────────────────────────────────────────────────

export const emailOutbox = messagingSchema.table(
  'email_outbox',
  {
    id:             uuid('id').primaryKey().defaultRandom(),
    to:             varchar('to', { length: 320 }).notNull(),
    template:       varchar('template', { length: 100 }).notNull(),
    vars:           jsonb('vars').notNull().$type<Record<string, unknown>>(),
    status:         varchar('status', { length: 20 }).notNull().default('pending'),
    attempts:       integer('attempts').notNull().default(0),
    lastError:      text('last_error'),
    idempotencyKey: varchar('idempotency_key', { length: 255 }),
    scheduledAt:    timestamp('scheduled_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt:         timestamp('sent_at', { withTimezone: true }),
  },
  (t) => ({
    pendingIdx:     index('ix_email_outbox_pending').on(t.status, t.scheduledAt),
    idempotencyIdx: uniqueIndex('uq_email_outbox_idempotency').on(t.idempotencyKey),
  }),
);
