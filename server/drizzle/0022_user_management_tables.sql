-- ─── Phase 1b: User Management Tables ───────────────────────────────────────
-- Depends on 0021_user_management.sql (enum additions) having run first.
-- Includes: role data migration, table creation, CHECK constraints,
--           backfill of org-level access grants, workspaceId on credit_ledger.

-- 1. Migrate existing role data
--    'owner' → 'admin'  (owner is a legacy Clerk concept; our canonical role is 'admin')
--    'member' → 'user'  (member is the legacy default; renamed to 'user')
UPDATE "org_members" SET "role" = 'admin' WHERE "role" = 'owner';
UPDATE "org_members" SET "role" = 'user'  WHERE "role" = 'member';

-- 2. Add workspace_id to credit_ledger (nullable, backward-compatible)
ALTER TABLE "credit_ledger"
  ADD COLUMN IF NOT EXISTS "workspace_id" UUID REFERENCES "workspaces"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "credit_ledger_workspace_idx"
  ON "credit_ledger"("workspace_id")
  WHERE "workspace_id" IS NOT NULL;

-- 3. Create invitations table
CREATE TABLE IF NOT EXISTS "invitations" (
  "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id"       UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  -- nullable: SET NULL so pending invites survive the sending admin's departure
  "invited_by_member_id"  UUID REFERENCES "org_members"("id") ON DELETE SET NULL,
  "email"                 TEXT NOT NULL,
  "role"                  "org_role" NOT NULL DEFAULT 'user',
  "status"                "invitation_status" NOT NULL DEFAULT 'pending',
  "token"                 TEXT NOT NULL,
  "access_grants"         JSONB NOT NULL DEFAULT '[]',
  "expires_at"            TIMESTAMPTZ NOT NULL,
  "accepted_at"           TIMESTAMPTZ,
  -- audit: who revoked (SET NULL so record survives admin departure)
  "revoked_at"            TIMESTAMPTZ,
  "revoked_by_member_id"  UUID REFERENCES "org_members"("id") ON DELETE SET NULL,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "invitations_token_idx"
  ON "invitations"("token");

CREATE INDEX IF NOT EXISTS "invitations_org_status_idx"
  ON "invitations"("organization_id", "status");

CREATE INDEX IF NOT EXISTS "invitations_org_email_idx"
  ON "invitations"("organization_id", "email");

-- 4. Create access_grants table
CREATE TABLE IF NOT EXISTS "access_grants" (
  "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id"       UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "member_id"             UUID NOT NULL REFERENCES "org_members"("id") ON DELETE CASCADE,
  "grant_type"            "access_grant_type" NOT NULL,
  "workspace_id"          UUID REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "project_id"            UUID REFERENCES "projects"("id") ON DELETE CASCADE,
  -- nullable: SET NULL so grants survive the granting admin's departure (audit trail)
  "granted_by_member_id"  UUID REFERENCES "org_members"("id") ON DELETE SET NULL,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Enforce scope field requirements at DB level
  CONSTRAINT "access_grants_workspace_scope_chk"
    CHECK (grant_type != 'workspace' OR workspace_id IS NOT NULL),
  CONSTRAINT "access_grants_project_scope_chk"
    CHECK (grant_type != 'project' OR (workspace_id IS NOT NULL AND project_id IS NOT NULL))
);

-- Partial unique indexes: one grant per scope per member
CREATE UNIQUE INDEX IF NOT EXISTS "access_grants_member_org_unique"
  ON "access_grants"("member_id")
  WHERE grant_type = 'org';

CREATE UNIQUE INDEX IF NOT EXISTS "access_grants_member_workspace_unique"
  ON "access_grants"("member_id", "workspace_id")
  WHERE grant_type = 'workspace';

CREATE UNIQUE INDEX IF NOT EXISTS "access_grants_member_project_unique"
  ON "access_grants"("member_id", "project_id")
  WHERE grant_type = 'project';

CREATE INDEX IF NOT EXISTS "access_grants_org_member_idx"
  ON "access_grants"("organization_id", "member_id");

CREATE INDEX IF NOT EXISTS "access_grants_member_type_idx"
  ON "access_grants"("member_id", "grant_type");

CREATE INDEX IF NOT EXISTS "access_grants_workspace_idx"
  ON "access_grants"("workspace_id");

CREATE INDEX IF NOT EXISTS "access_grants_project_idx"
  ON "access_grants"("project_id");

-- 5. Create workspace_credit_limits table
CREATE TABLE IF NOT EXISTS "workspace_credit_limits" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id"      UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "workspace_id"         UUID NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "monthly_limit"        INTEGER NOT NULL CHECK ("monthly_limit" >= 0),
  "current_month_usage"  INTEGER NOT NULL DEFAULT 0 CHECK ("current_month_usage" >= 0),
  "period_start"         TIMESTAMPTZ NOT NULL,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_credit_limits_workspace_idx"
  ON "workspace_credit_limits"("workspace_id");

CREATE INDEX IF NOT EXISTS "workspace_credit_limits_org_idx"
  ON "workspace_credit_limits"("organization_id");

-- 6. Backfill: grant every existing member org-level access so current behaviour
--    is preserved (zero breaking change). grantedByMemberId self-references the
--    first admin of the org; falls back to self if no other admin exists yet.
--    This runs AFTER the role migration above, so 'admin' values are correct.
INSERT INTO "access_grants" ("organization_id", "member_id", "grant_type", "granted_by_member_id")
SELECT
  m."organization_id",
  m."id"   AS member_id,
  'org'    AS grant_type,
  COALESCE(
    (
      SELECT a."id"
      FROM   "org_members" a
      WHERE  a."organization_id" = m."organization_id"
        AND  a."role" = 'admin'
        AND  a."id" != m."id"
      ORDER  BY a."created_at"
      LIMIT  1
    ),
    m."id"  -- self-grant when no other admin is found
  ) AS granted_by_member_id
FROM "org_members" m
ON CONFLICT DO NOTHING;
