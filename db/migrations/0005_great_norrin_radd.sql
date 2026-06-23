CREATE SCHEMA IF NOT EXISTS "authz";
--> statement-breakpoint
CREATE TYPE "public"."scope_type" AS ENUM('global', 'self', 'team', 'dept', 'region');--> statement-breakpoint
CREATE TABLE "authz"."approval_delegations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authz"."permissions" (
	"key" varchar(120) PRIMARY KEY NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authz"."role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_key" varchar(120) NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_key_pk" PRIMARY KEY("role_id","permission_key")
);
--> statement-breakpoint
CREATE TABLE "authz"."roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(64) NOT NULL,
	"name" varchar(120) NOT NULL,
	"system" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authz"."user_role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"scope_type" "scope_type" DEFAULT 'global' NOT NULL,
	"scope_id" varchar(120),
	"granted_by" uuid NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "authz"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "authz"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authz"."role_permissions" ADD CONSTRAINT "role_permissions_permission_key_permissions_key_fk" FOREIGN KEY ("permission_key") REFERENCES "authz"."permissions"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authz"."user_role_assignments" ADD CONSTRAINT "user_role_assignments_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "authz"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_deleg_from_active" ON "authz"."approval_delegations" USING btree ("from_user_id","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_role_key" ON "authz"."roles" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ura_user_role_scope" ON "authz"."user_role_assignments" USING btree ("user_id","role_id","scope_type","scope_id");--> statement-breakpoint
CREATE INDEX "ix_ura_user" ON "authz"."user_role_assignments" USING btree ("user_id");