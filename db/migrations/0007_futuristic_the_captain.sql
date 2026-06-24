ALTER TABLE "requests"."request_approvals" ADD COLUMN "delegated_from_id" uuid;--> statement-breakpoint
ALTER TABLE "requests"."request_items" ADD COLUMN "sla_hours" integer;--> statement-breakpoint
ALTER TABLE "requests"."request_items" ADD COLUMN "sla_deadline" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "requests"."request_items" ADD COLUMN "sla_breached_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "ix_ri_sla" ON "requests"."request_items" USING btree ("sla_deadline","status");