ALTER TABLE "identity"."refresh_tokens" ADD COLUMN "family_id" uuid NOT NULL;--> statement-breakpoint
CREATE INDEX "ix_refresh_token_family" ON "identity"."refresh_tokens" USING btree ("family_id");