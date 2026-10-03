CREATE TYPE "public"."friend_request_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
ALTER TYPE "public"."contact_source" ADD VALUE 'accepted_request';--> statement-breakpoint
CREATE TABLE "friend_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"addressee_id" uuid NOT NULL,
	"status" "friend_request_status" DEFAULT 'pending' NOT NULL,
	"invite_code_id" uuid,
	"message" varchar(280),
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "nickname" varchar(64);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "notify_email" varchar(320);--> statement-breakpoint
ALTER TABLE "invite_codes" ADD COLUMN "requires_approval" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" varchar(280);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "emergency_note" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "share_profile_with_friends" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_addressee_id_users_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_invite_code_id_invite_codes_id_fk" FOREIGN KEY ("invite_code_id") REFERENCES "public"."invite_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "friend_requests_addressee_idx" ON "friend_requests" USING btree ("addressee_id","status");--> statement-breakpoint
CREATE INDEX "friend_requests_requester_idx" ON "friend_requests" USING btree ("requester_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "friend_requests_pending_idx" ON "friend_requests" USING btree ("requester_id","addressee_id","status");