-- Phase 1.1: Normalized sitemap storage
-- Creates project_sitemap_urls as a proper relational table, replacing the
-- projects.sitemap_urls text[] column.
--
-- TRANSITION STRATEGY (dual-write):
--   projects.sitemap_urls and projects.sitemap_discovered_at are kept as-is.
--   All writes now go to BOTH this table AND the legacy columns simultaneously.
--   The legacy columns will be dropped in a later migration (0029_drop_legacy_sitemap.sql)
--   only after the 7-day verification gate passes.

CREATE TABLE IF NOT EXISTS "project_sitemap_urls" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  -- Populated when the source is a parsed sitemap.xml; NULL when discovered via firecrawl mapSite
  "priority" numeric(2,1),
  "change_frequency" text,
  "last_modified" timestamp,
  -- Discovery tracking
  "discovered_at" timestamp NOT NULL DEFAULT now(),
  "discovery_batch_id" uuid,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_psu_project_id" ON "project_sitemap_urls" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_psu_discovered_at" ON "project_sitemap_urls" ("project_id", "discovered_at");
-- Unique index matches Drizzle uniqueIndex() definition in schema.ts (not a table CONSTRAINT)
CREATE UNIQUE INDEX IF NOT EXISTS "project_sitemap_url_unique" ON "project_sitemap_urls" ("project_id", "url");

-- Cache column: total number of URLs for quick count without a JOIN
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "sitemap_url_count" integer;
