CREATE TABLE IF NOT EXISTS "dlq_failed_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_step_id" uuid,
	"workflow_run_id" uuid,
	"step_key" text NOT NULL,
	"error" text NOT NULL,
	"attempt_count" integer NOT NULL,
	"job_data" jsonb NOT NULL,
	"failed_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dlq_failed_steps" ADD CONSTRAINT "dlq_failed_steps_workflow_step_id_workflow_steps_id_fk" FOREIGN KEY ("workflow_step_id") REFERENCES "public"."workflow_steps"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dlq_failed_steps" ADD CONSTRAINT "dlq_failed_steps_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dlq_unresolved_idx" ON "dlq_failed_steps" USING btree ("resolved_at");