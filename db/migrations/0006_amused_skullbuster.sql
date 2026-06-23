CREATE SCHEMA "requests";
--> statement-breakpoint
CREATE TYPE "public"."request_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('pending', 'in_review', 'approved', 'rejected', 'cancelled', 'expired');--> statement-breakpoint
CREATE TABLE "requests"."request_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"step" integer DEFAULT 1 NOT NULL,
	"approver_id" uuid NOT NULL,
	"decision" varchar(20) NOT NULL,
	"note" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests"."request_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(80) NOT NULL,
	"requester_id" uuid NOT NULL,
	"assignee_id" uuid,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"priority" "request_priority" DEFAULT 'normal' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resolution_note" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access"."access_requests" ADD COLUMN "request_id" uuid;--> statement-breakpoint
ALTER TABLE "workforce"."leave_requests" ADD COLUMN "request_id" uuid;--> statement-breakpoint
ALTER TABLE "workforce"."overtime_entries" ADD COLUMN "request_id" uuid;--> statement-breakpoint
ALTER TABLE "requests"."request_approvals" ADD CONSTRAINT "request_approvals_request_id_request_items_id_fk" FOREIGN KEY ("request_id") REFERENCES "requests"."request_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_ra_request" ON "requests"."request_approvals" USING btree ("request_id","step");--> statement-breakpoint
CREATE INDEX "ix_ri_requester" ON "requests"."request_items" USING btree ("requester_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_ri_status_type" ON "requests"."request_items" USING btree ("status","type","created_at");--> statement-breakpoint
CREATE INDEX "ix_ri_assignee" ON "requests"."request_items" USING btree ("assignee_id","status");--> statement-breakpoint
CREATE INDEX "ix_ri_expiry" ON "requests"."request_items" USING btree ("expires_at","status");--> statement-breakpoint
ALTER TABLE "access"."access_requests" ADD CONSTRAINT "access_requests_request_id_request_items_id_fk" FOREIGN KEY ("request_id") REFERENCES "requests"."request_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce"."leave_requests" ADD CONSTRAINT "leave_requests_request_id_request_items_id_fk" FOREIGN KEY ("request_id") REFERENCES "requests"."request_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce"."overtime_entries" ADD CONSTRAINT "overtime_entries_request_id_request_items_id_fk" FOREIGN KEY ("request_id") REFERENCES "requests"."request_items"("id") ON DELETE set null ON UPDATE no action;