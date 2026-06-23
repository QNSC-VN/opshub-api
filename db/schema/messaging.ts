/**
 * messaging schema — transactional outbox.
 * Domain events are written here in the same tx as the state change; the worker
 * relays unpublished rows to SQS and marks them published (at-least-once).
 */
import { pgSchema, uuid, varchar, jsonb, timestamp, boolean, index } from 'drizzle-orm/pg-core';

export const messagingSchema = pgSchema('messaging');

export const outboxEvents = messagingSchema.table(
  'outbox_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    aggregateType: varchar('aggregate_type', { length: 60 }).notNull(),
    aggregateId: varchar('aggregate_id', { length: 64 }).notNull(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
    published: boolean('published').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (t) => ({
    unpublishedIdx: index('ix_outbox_unpublished').on(t.published, t.createdAt),
  }),
);
