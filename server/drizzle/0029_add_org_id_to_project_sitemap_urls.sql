-- Add organization_id to project_sitemap_urls.
-- Every org-owned table in the schema carries organization_id NOT NULL for org-level guards.
-- The project_sitemap_urls table was missing this column.
--
-- The table is empty at migration time (created in 0028, data not yet migrated),
-- so adding NOT NULL with no default is valid — no backfill required.

ALTER TABLE "project_sitemap_urls"
  ADD COLUMN "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_psu_organization_id" ON "project_sitemap_urls" ("organization_id");
