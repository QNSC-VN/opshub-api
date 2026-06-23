CREATE SCHEMA "notifications";
--> statement-breakpoint
CREATE TABLE "messaging"."email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to" varchar(320) NOT NULL,
	"template" varchar(100) NOT NULL,
	"vars" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"idempotency_key" varchar(255),
	"scheduled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messaging"."notification_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"actor_id" uuid,
	"type" varchar(100) NOT NULL,
	"vars" jsonb NOT NULL,
	"resource_id" uuid,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"idempotency_key" varchar(255),
	"scheduled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dispatched_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notifications"."in_app_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"actor_id" uuid,
	"type" varchar(100) NOT NULL,
	"title" varchar(500) NOT NULL,
	"body" text,
	"resource_type" varchar(50),
	"resource_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_event_id" uuid
);
--> statement-breakpoint
CREATE INDEX "ix_email_outbox_pending" ON "messaging"."email_outbox" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_email_outbox_idempotency" ON "messaging"."email_outbox" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "ix_notif_outbox_pending" ON "messaging"."notification_outbox" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_notif_outbox_idempotency" ON "messaging"."notification_outbox" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "ix_ian_recipient" ON "notifications"."in_app_notifications" USING btree ("recipient_id","is_read");--> statement-breakpoint
CREATE INDEX "ix_ian_created" ON "notifications"."in_app_notifications" USING btree ("recipient_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_ian_resource" ON "notifications"."in_app_notifications" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ian_source_event_id" ON "notifications"."in_app_notifications" USING btree ("source_event_id");