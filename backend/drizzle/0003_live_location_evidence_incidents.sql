CREATE TABLE IF NOT EXISTS "location_pings" (
	"id" bigserial PRIMARY KEY,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"alert_id" uuid REFERENCES "alerts"("id") ON DELETE SET NULL,
	"lat" real NOT NULL,
	"lng" real NOT NULL,
	"accuracy" real,
	"bearing" real,
	"seq" integer,
	"client_ts" real,
	"created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "location_pings_user_id_idx" ON "location_pings" ("user_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "location_pings_alert_idx" ON "location_pings" ("alert_id");--> statement-breakpoint
CREATE TYPE "evidence_session_status" AS ENUM('open', 'finalized');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "evidence_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_id" uuid REFERENCES "alerts"("id") ON DELETE SET NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"status" "evidence_session_status" DEFAULT 'open' NOT NULL,
	"chunk_seconds" integer,
	"started_at" timestamptz NOT NULL DEFAULT now(),
	"ended_at" timestamptz,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"total_bytes" integer DEFAULT 0 NOT NULL,
	"duration_s" real,
	"start_lat" real,
	"start_lng" real,
	"end_lat" real,
	"end_lng" real,
	"manifest_sha256" varchar(64),
	"manifest" jsonb
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evidence_sessions_user_idx" ON "evidence_sessions" ("user_id","started_at");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "evidence_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL REFERENCES "evidence_sessions"("id") ON DELETE CASCADE,
	"seq" integer NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"size_bytes" integer NOT NULL,
	"mime" varchar(80) DEFAULT 'audio/mp4' NOT NULL,
	"storage_path" text NOT NULL,
	"offset_s" real,
	"client_ts" real,
	"received_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "evidence_chunks_session_seq_idx" ON "evidence_chunks" ("session_id","seq");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evidence_chunks_session_idx" ON "evidence_chunks" ("session_id","seq");--> statement-breakpoint
CREATE TYPE "incident_category" AS ENUM('harassment', 'sexual_assault', 'assault', 'robbery', 'stalking', 'suspicious', 'other');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "incident_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
	"category" "incident_category" NOT NULL,
	"severity" smallint DEFAULT 2 NOT NULL,
	"weight" real DEFAULT 0.6 NOT NULL,
	"lat" real NOT NULL,
	"lng" real NOT NULL,
	"title" varchar(200),
	"description" text,
	"reported_at" timestamptz,
	"created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incident_reports_category_idx" ON "incident_reports" ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incident_reports_user_idx" ON "incident_reports" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incident_reports_coords_idx" ON "incident_reports" ("lat","lng");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incident_reports_created_idx" ON "incident_reports" ("created_at");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dispatch_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_id" uuid REFERENCES "alerts"("id") ON DELETE SET NULL,
	"user_id" uuid NOT NULL,
	"case_id" varchar(64) NOT NULL,
	"eta_min" integer NOT NULL,
	"lat" real,
	"lng" real,
	"evidence_session_id" uuid,
	"mocked" boolean DEFAULT true NOT NULL,
	"created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dispatch_logs_alert_idx" ON "dispatch_logs" ("alert_id");