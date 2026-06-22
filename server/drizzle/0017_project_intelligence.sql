-- Project Intelligence Store (latest-only, upsert on project+target+data_type)
CREATE TABLE IF NOT EXISTS "project_intelligence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "target_key" text NOT NULL DEFAULT '__foundation__',
  "data_type" text NOT NULL,
  "data" jsonb NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "produced_by" text NOT NULL,
  "workflow_run_id" uuid REFERENCES "workflow_runs"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "pi_project_target_datatype_unique" UNIQUE("project_id", "target_key", "data_type")
);

CREATE INDEX "pi_org_project_idx" ON "project_intelligence"("organization_id", "project_id");
CREATE INDEX "pi_project_target_idx" ON "project_intelligence"("project_id", "target_key");

-- Refresh Suggestions (populated by flag_stale_data tool, consumed by UI)
CREATE TABLE IF NOT EXISTS "refresh_suggestions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "target_key" text,
  "data_type" text NOT NULL,
  "last_updated" timestamptz NOT NULL,
  "reason" text NOT NULL,
  "suggested_by" text NOT NULL,
  "suggested_at" timestamptz NOT NULL DEFAULT now(),
  "dismissed" boolean NOT NULL DEFAULT false,
  "refreshed_at" timestamptz
);

CREATE INDEX "rs_project_active_idx" ON "refresh_suggestions"("project_id") WHERE NOT "dismissed";

-- Add targets to projects
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "targets" jsonb DEFAULT '[]';

-- Add target_key to workflow_runs
ALTER TABLE "workflow_runs" ADD COLUMN IF NOT EXISTS "target_key" text;

-- Add thinking_content to step_artifacts
ALTER TABLE "step_artifacts" ADD COLUMN IF NOT EXISTS "thinking_content" text;
