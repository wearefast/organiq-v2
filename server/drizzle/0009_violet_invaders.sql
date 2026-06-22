CREATE TABLE IF NOT EXISTS "llm_audit_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"audit_run_id" uuid NOT NULL,
	"page_url" text NOT NULL,
	"ai_indexability_score" integer,
	"bot_permissions" jsonb,
	"content_checks" jsonb,
	"trust_signals" jsonb,
	"content_chunking" jsonb,
	"issues" jsonb,
	"audited_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "llm_audit_results" ADD CONSTRAINT "llm_audit_results_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "llm_audit_results_project_idx" ON "llm_audit_results" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "llm_audit_results_run_idx" ON "llm_audit_results" USING btree ("audit_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "llm_audit_results_project_run_idx" ON "llm_audit_results" USING btree ("project_id","audit_run_id");