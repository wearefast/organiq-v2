-- Add missing indexes on frequently queried FK and status columns
-- These are additive-only changes — no schema modification, no data loss.

CREATE INDEX IF NOT EXISTS "credit_ledger_workflow_run_idx" ON "credit_ledger" ("workflow_run_id");
CREATE INDEX IF NOT EXISTS "workflow_runs_status_idx" ON "workflow_runs" ("status");
CREATE INDEX IF NOT EXISTS "workflow_steps_status_idx" ON "workflow_steps" ("status");
CREATE INDEX IF NOT EXISTS "content_pieces_keyword_idx" ON "content_pieces" ("keyword_id");
CREATE INDEX IF NOT EXISTS "content_pieces_workflow_run_idx" ON "content_pieces" ("workflow_run_id");
CREATE INDEX IF NOT EXISTS "topical_maps_workflow_run_idx" ON "topical_maps" ("workflow_run_id");
CREATE INDEX IF NOT EXISTS "reports_workflow_run_idx" ON "reports" ("workflow_run_id");
