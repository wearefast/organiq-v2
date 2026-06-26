-- Add organization_id to project_sitemap_urls for org-scoped reads and writes.
-- Every org-owned table in the schema carries organization_id NOT NULL as an org-level guard.
-- project_sitemap_urls was missing this column.
--
-- The table has existing rows (from the data migration workflow run), so we:
--   1. Add the column as nullable
--   2. Backfill from projects.organization_id via the FK
--   3. Set NOT NULL once every row is populated

ALTER TABLE "project_sitemap_urls"
  ADD COLUMN IF NOT EXISTS "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE;
--> statement-breakpoint
UPDATE "project_sitemap_urls" psu
SET "organization_id" = p."organization_id"
FROM "projects" p
WHERE psu."project_id" = p."id"
  AND psu."organization_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "project_sitemap_urls"
  ALTER COLUMN "organization_id" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_psu_organization_id" ON "project_sitemap_urls" ("organization_id");
