CREATE TABLE IF NOT EXISTS "llm_traffic_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"engine" text NOT NULL,
	"referrer" text,
	"landing_page" text NOT NULL,
	"session_id" text NOT NULL,
	"country" text,
	"device" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "llm_traffic_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"engine" text NOT NULL,
	"date" timestamp NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"top_pages" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "llm_traffic_sessions" ADD CONSTRAINT "llm_traffic_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "llm_traffic_stats" ADD CONSTRAINT "llm_traffic_stats_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "llm_traffic_sessions_project_engine_idx" ON "llm_traffic_sessions" USING btree ("project_id","engine");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "llm_traffic_sessions_created_at_idx" ON "llm_traffic_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "llm_traffic_sessions_session_idx" ON "llm_traffic_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "llm_traffic_stats_project_date_idx" ON "llm_traffic_stats" USING btree ("project_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "llm_traffic_stats_unique_day_idx" ON "llm_traffic_stats" USING btree ("project_id","engine","date");