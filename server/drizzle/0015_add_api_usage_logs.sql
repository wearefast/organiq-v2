CREATE TABLE IF NOT EXISTS "api_usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"workflow_run_id" uuid,
	"step_key" text,
	"provider" text NOT NULL,
	"endpoint" text NOT NULL,
	"tokens_in" integer,
	"tokens_out" integer,
	"request_count" integer DEFAULT 1 NOT NULL,
	"cost_usd" numeric(10, 6) NOT NULL,
	"duration_ms" integer,
	"success" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_usage_logs" ADD CONSTRAINT "api_usage_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_usage_logs" ADD CONSTRAINT "api_usage_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_usage_logs" ADD CONSTRAINT "api_usage_logs_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_usage_logs_org_created_at_idx" ON "api_usage_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_usage_logs_project_created_at_idx" ON "api_usage_logs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_usage_logs_run_step_idx" ON "api_usage_logs" USING btree ("workflow_run_id","step_key");