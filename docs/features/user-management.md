# Feature: User Management

## Overview

The user management module handles team members, invitations, per-member access grants, and workspace-level monthly credit limits. It is distinct from Clerk's organization system — Pulse mirrors Clerk membership into the `org_members` table and extends it with its own authorization layer.

## Key Files

| File | Purpose |
|------|---------|
| `server/src/features/user-management/user-management.controller.ts` | Members, invitations, credit limit endpoints |
| `server/src/features/user-management/invitation-accept.controller.ts` | Public invitation preview + accept flow |
| `server/src/features/user-management/user-management.service.ts` | Member list, remove, access grant update |
| `server/src/features/user-management/invitation.service.ts` | Create/revoke invitations, email dispatch |
| `server/src/features/user-management/workspace-credit-limit.service.ts` | Upsert credit limits, monthly reset cron |
| `server/src/features/auth/access.service.ts` | Resolves and validates access grants |
| `frontend/src/app/(dashboard)/settings/members/page.tsx` | Team settings page (admin only) |
| `frontend/src/features/user-management/` | Members table, invite modal, access editor, limit UI |

## API Endpoints

### Members

Base: `orgs/:orgId/members`

| Method | Path | Guards | Description |
|--------|------|--------|-------------|
| `GET` | `/` | AdminOnly | List all members with their access grants |
| `DELETE` | `/:memberId` | AdminOnly | Remove a member from the org |
| `PUT` | `/:memberId/access` | AdminOnly | Replace a member's access grants (full replace, not patch) |
| `GET` | `/me/access` | ClerkGuard | Get the calling user's own access grants |

### Invitations

Base: `orgs/:orgId/invitations`

| Method | Path | Guards | Description |
|--------|------|--------|-------------|
| `GET` | `/` | AdminOnly | List all invitations (pending, accepted, revoked) |
| `POST` | `/` | AdminOnly + throttle (10/60s) | Create invitation, send email to invitee |
| `DELETE` | `/:invitationId` | AdminOnly | Revoke a pending invitation |

### Workspace Credit Limits

Base: `orgs/:orgId/workspaces/:workspaceId/credit-limit`

| Method | Path | Guards | Description |
|--------|------|--------|-------------|
| `GET` | `/` | AdminOnly | Get the monthly credit cap for this workspace |
| `PUT` | `/` | AdminOnly | Set or update the monthly credit cap |
| `DELETE` | `/` | AdminOnly | Remove the monthly cap (unlimited) |

### Invitation Acceptance (Public Flow)

Base: `invitations/:token`

| Method | Path | Guards | Description |
|--------|------|--------|-------------|
| `GET` | `/` | None (public) | Preview invitation details (org name, inviter, expiry) |
| `POST` | `/accept` | ClerkGuard | Accept invitation — creates `org_members` record + access grants |

## Access Grant System

Access grants control which workspaces and projects a `user`-role member can access. `admin` and `owner` roles bypass access checks entirely.

### Grant Types

| Type | resource_id | Meaning |
|------|-------------|---------|
| `org` | `organization_id` | Access to all resources in the org |
| `workspace` | `workspace_id` | Access to a specific workspace and all its projects |
| `project` | `project_id` | Access to a single project |

### How Grants Are Enforced

1. Request hits a resource route decorated with `@ResourceAccess('workspace'|'project')`
2. `AccessGuard` resolves the user's `org_members` record
3. If role is `admin` or `owner` → allowed
4. Otherwise, `AccessService.hasAccess()` queries `access_grants` for a matching grant
5. Uses `SELECT FOR UPDATE` on the limit row during concurrent debit to prevent race conditions

### Invitation Flow

```
1. Admin POST /orgs/:orgId/invitations → creates invitation row + sends email
2. Invitee clicks link → GET /invitations/:token (preview)
3. Invitee signs in via Clerk if needed
4. POST /invitations/:token/accept
5. Server validates token, expiry, status = 'pending'
6. Creates org_members record
7. Creates access_grants records based on role
8. Updates invitation status → 'accepted'
9. Invitee can now access the org
```

Tokens are `crypto.randomUUID()` (not guessable). Expire after 7 days.

## Workspace Credit Limits

Workspace credit limits allow org admins to set a monthly spending cap per workspace.

### Enforcement

The `credits.service.ts` `debit()` method accepts an optional `workspaceId`. When provided:

1. Looks up `workspace_credit_limits` for the workspace
2. If a limit exists: `SELECT FOR UPDATE` on the row (concurrent-safe)
3. Checks `currentMonthUsage + cost <= monthlyLimit`
4. If exceeded: throws `CreditLimitExceededException` (no credits are debited)
5. If within limit: increments `currentMonthUsage` alongside the normal org-level debit

### Monthly Reset

`WorkspaceCreditLimitService` runs `@Cron('0 0 1 * *')` on the 1st of each month to reset `currentMonthUsage = 0` for all workspaces.

## Data Model

### invitations

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| organization_id | uuid | FK → organizations |
| email | text | Invitee email |
| role | enum | `admin` or `user` |
| token | text | UUID token (unique, in invite URL) |
| status | invitation_status | `pending`, `accepted`, `revoked`, `expired` |
| expires_at | timestamp | 7 days from creation |
| accepted_at | timestamp | Nullable |
| clerk_invitation_id | text | Nullable — Clerk's invitation ID |
| invited_by_user_id | text | Clerk user ID of the admin who sent the invite |
| created_at | timestamp | |

### access_grants

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| org_member_id | uuid | FK → org_members |
| organization_id | uuid | FK → organizations |
| resource_type | access_grant_type | `org`, `workspace`, `project` |
| resource_id | uuid | FK to the relevant resource table |
| created_at | timestamp | |

Unique constraint: `(org_member_id, resource_type, resource_id)`.

### workspace_credit_limits

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | Unique FK → workspaces |
| organization_id | uuid | FK → organizations |
| monthly_limit | integer | Max credits per calendar month |
| current_month_usage | integer | Credits consumed this month |
| last_reset_at | timestamp | Last monthly reset time |
| created_at / updated_at | timestamp | |

## Frontend

The `/settings/members` page is admin-only. Non-admins visiting `/settings/members` are redirected to `/settings`.

**Components (`frontend/src/features/user-management/`):**

| Component | Purpose |
|-----------|---------|
| `MembersTable` | Lists current members, shows role and access |
| `InviteModal` | Form to send an email invitation |
| `AccessEditorModal` | Drag/check interface to set workspace/project grants |
| `InvitationsTable` | Shows pending and historical invitations |
| `WorkspaceLimitsSection` | Per-workspace credit cap controls |
