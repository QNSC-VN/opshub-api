CREATE TABLE "identity"."refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_refresh_token_hash" ON "identity"."refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "ix_refresh_token_employee" ON "identity"."refresh_tokens" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "ix_refresh_token_expiry" ON "identity"."refresh_tokens" USING btree ("expires_at");