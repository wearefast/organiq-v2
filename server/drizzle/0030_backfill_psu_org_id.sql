-- Idempotent, single-statement migration to ensure organization_id exists,
-- is backfilled, and is NOT NULL on project_sitemap_urls.
--
-- Handles all possible starting states left by the 0029 migration attempts:
--   A) Column does not exist at all
--   B) Column exists as nullable (backfill may or may not have run)
--   C) Column already exists as NOT NULL (no-op)
--
-- Runs as a single DO block — no statement-breakpoint splitting needed,
-- no partial-apply risk.

DO $$
BEGIN
  -- Step 1: Add column if it does not exist yet
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_sitemap_urls'
      AND column_name = 'organization_id'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE project_sitemap_urls
      ADD COLUMN organization_id uuid;

    RAISE NOTICE '0030: organization_id column added';
  ELSE
    RAISE NOTICE '0030: organization_id column already present, skipping ADD COLUMN';
  END IF;

  -- Step 2: Backfill from projects.organization_id where still NULL
  UPDATE project_sitemap_urls psu
  SET organization_id = p.organization_id
  FROM projects p
  WHERE psu.project_id = p.id
    AND psu.organization_id IS NULL;

  RAISE NOTICE '0030: backfill complete (% rows updated)', FOUND::text;

  -- Step 3: Add FK constraint if not yet present
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name        = 'project_sitemap_urls'
      AND constraint_type   = 'FOREIGN KEY'
      AND constraint_name   LIKE '%organization_id%'
      AND table_schema      = 'public'
  ) THEN
    ALTER TABLE project_sitemap_urls
      ADD CONSTRAINT psu_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

    RAISE NOTICE '0030: FK constraint added';
  ELSE
    RAISE NOTICE '0030: FK constraint already present, skipping';
  END IF;

  -- Step 4: Set NOT NULL if the column is still nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name    = 'project_sitemap_urls'
      AND column_name   = 'organization_id'
      AND is_nullable   = 'YES'
      AND table_schema  = 'public'
  ) THEN
    ALTER TABLE project_sitemap_urls
      ALTER COLUMN organization_id SET NOT NULL;

    RAISE NOTICE '0030: NOT NULL constraint set';
  ELSE
    RAISE NOTICE '0030: column already NOT NULL, skipping';
  END IF;

  -- Step 5: Add index if not yet present
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'project_sitemap_urls'
      AND indexname = 'idx_psu_organization_id'
  ) THEN
    CREATE INDEX idx_psu_organization_id ON project_sitemap_urls (organization_id);

    RAISE NOTICE '0030: index created';
  ELSE
    RAISE NOTICE '0030: index already present, skipping';
  END IF;
END $$;
