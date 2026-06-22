-- ─── Phase 1a: Add enum values ──────────────────────────────────────────────
-- IMPORTANT: ALTER TYPE ... ADD VALUE cannot run inside a transaction block
-- on PostgreSQL 11 and earlier. This file must be executed standalone (no
-- wrapping BEGIN/COMMIT) or via a migration runner that disables transactions.
-- PostgreSQL 12+ handles this inside a transaction, but splitting is safer.

ALTER TYPE "org_role" ADD VALUE IF NOT EXISTS 'user';

DO $$ BEGIN
  CREATE TYPE "invitation_status" AS ENUM ('pending', 'accepted', 'expired', 'revoked');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "access_grant_type" AS ENUM ('org', 'workspace', 'project');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
