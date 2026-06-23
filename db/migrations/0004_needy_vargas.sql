CREATE TABLE "notifications"."notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(100) NOT NULL,
	"in_app" boolean DEFAULT true NOT NULL,
	"email" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messaging"."email_outbox" ADD COLUMN "recipient_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_notif_pref_user_type" ON "notifications"."notification_preferences" USING btree ("user_id","type");