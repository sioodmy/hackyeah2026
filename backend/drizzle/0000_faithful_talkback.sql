CREATE TYPE "public"."alert_status" AS ENUM('active', 'acknowledged', 'resolved', 'cancelled', 'escalated');--> statement-breakpoint
CREATE TYPE "public"."device_platform" AS ENUM('ios', 'android');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"level" smallint NOT NULL,
	"message" text,
	"lat" real,
	"lng" real,
	"address" varchar(500),
	"status" "alert_status" DEFAULT 'active' NOT NULL,
	"acknowledged_by_contact_id" uuid,
	"acknowledged_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"escalated_from_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"contact_user_id" uuid,
	"name" varchar(255) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"email" varchar(320),
	"relationship" varchar(64),
	"is_primary" boolean DEFAULT false NOT NULL,
	"min_level" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" "device_platform" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" varchar(255) NOT NULL,
	"email" varchar(320),
	"name" varchar(255) DEFAULT '' NOT NULL,
	"phone" varchar(32),
	"avatar_url" text,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledged_by_contact_id_contacts_id_fk" FOREIGN KEY ("acknowledged_by_contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_contact_user_id_users_id_fk" FOREIGN KEY ("contact_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_user_id_created_at_idx" ON "alerts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "alerts_status_idx" ON "alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "alerts_contact_user_idx" ON "alerts" USING btree ("user_id","level");--> statement-breakpoint
CREATE INDEX "contacts_user_id_idx" ON "contacts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_token_idx" ON "devices" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_id_idx" ON "users" USING btree ("clerk_id");