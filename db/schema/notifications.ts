/**
 * notifications schema — in_app_notifications
 * Stores all in-app notification records per employee.
 * Written by the notification relay after reading notification_outbox.
 */
import {
  pgSchema, uuid, varchar, text, boolean, jsonb, timestamp, index, uniqueIndex,
} from 'drizzle-orm/pg-core';

export const notificationsSchema = pgSchema('notifications');

export const inAppNotifications = notificationsSchema.table(
  'in_app_notifications',
  {
    id:           uuid('id').primaryKey().defaultRandom(),
    recipientId:  uuid('recipient_id').notNull(),
    actorId:      uuid('actor_id'),
    /** Dot-namespaced event type, e.g. 'access_request.approved'. */
    type:         varchar('type', { length: 100 }).notNull(),
    title:        varchar('title', { length: 500 }).notNull(),
    body:         text('body'),
    resourceType: varchar('resource_type', { length: 50 }),
    resourceId:   uuid('resource_id'),
    metadata:     jsonb('metadata').notNull().$type<Record<string, unknown>>().default({}),
    isRead:       boolean('is_read').notNull().default(false),
    readAt:       timestamp('read_at', { withTimezone: true }),
    createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Populated by the relay with the outbox row id — prevents duplicate delivery. */
    sourceEventId: uuid('source_event_id'),
  },
  (t) => ({
    recipientIdx:   index('ix_ian_recipient').on(t.recipientId, t.isRead),
    createdIdx:     index('ix_ian_created').on(t.recipientId, t.createdAt),
    resourceIdx:    index('ix_ian_resource').on(t.resourceType, t.resourceId),
    sourceEventIdx: uniqueIndex('uq_ian_source_event_id').on(t.sourceEventId),
  }),
);
