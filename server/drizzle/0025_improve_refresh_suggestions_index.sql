DROP INDEX IF EXISTS "rs_project_active_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rs_project_active_idx" ON "refresh_suggestions" USING btree ("project_id","organization_id");