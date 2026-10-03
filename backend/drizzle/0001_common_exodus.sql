CREATE TYPE "public"."contact_source" AS ENUM('manual', 'invite_code');--> statement-breakpoint
CREATE TABLE "invite_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"code" varchar(16) NOT NULL,
	"max_uses" smallint DEFAULT 1 NOT NULL,
	"used_count" smallint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "source" "contact_source" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invite_codes_code_idx" ON "invite_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "invite_codes_owner_idx" ON "invite_codes" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_pair_idx" ON "contacts" USING btree ("user_id","contact_user_id");