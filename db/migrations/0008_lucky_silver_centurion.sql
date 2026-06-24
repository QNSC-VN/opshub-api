CREATE TABLE "requests"."request_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "requests"."request_items" ADD COLUMN "current_step" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "requests"."request_items" ADD COLUMN "total_steps" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "requests"."request_comments" ADD CONSTRAINT "request_comments_request_id_request_items_id_fk" FOREIGN KEY ("request_id") REFERENCES "requests"."request_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_rcomm_request" ON "requests"."request_comments" USING btree ("request_id","created_at");