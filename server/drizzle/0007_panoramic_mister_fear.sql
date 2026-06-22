CREATE TYPE "public"."decay_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('decay_alert', 'workflow_complete', 'approval_needed', 'system');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "keyword_decay_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"keyword" text NOT NULL,
	"page" text DEFAULT '' NOT NULL,
	"previous_position" numeric(8, 2) NOT NULL,
	"current_position" numeric(8, 2) NOT NULL,
	"position_delta" numeric(8, 2) NOT NULL,
	"previous_clicks" integer DEFAULT 0 NOT NULL,
	"current_clicks" integer DEFAULT 0 NOT NULL,
	"severity" "decay_severity" NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"snapshot_start_date" timestamp NOT NULL,
	"snapshot_end_date" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "keyword_decay_alerts" ADD CONSTRAINT "keyword_decay_alerts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "keyword_decay_alerts" ADD CONSTRAINT "keyword_decay_alerts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "keyword_decay_alerts_project_idx" ON "keyword_decay_alerts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "keyword_decay_alerts_org_idx" ON "keyword_decay_alerts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "keyword_decay_alerts_severity_idx" ON "keyword_decay_alerts" USING btree ("severity","resolved_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_org_unread_idx" ON "notifications" USING btree ("organization_id","read_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_project_idx" ON "notifications" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_type_idx" ON "notifications" USING btree ("type");