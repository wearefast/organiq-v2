# Feature: Authentication & Organizations

## Overview

Pulse uses Clerk for authentication and organization management. Clerk handles SSO, JWT issuance, and organization lifecycle events. The backend verifies Clerk JWTs on every request and syncs organization/membership data via webhooks.

## Key Files

| File | Purpose |
|------|---------|
| `server/src/features/auth/clerk.guard.ts` | JWT verification guard (applied to all controllers) |
| `server/src/features/auth/org-membership.guard.ts` | Organization membership authorization guard |
| `server/src/features/auth/auth.controller.ts` | Clerk webhook receiver (`POST /webhooks/clerk`) |
| `server/src/features/auth/auth.service.ts` | Webhook payload processors (idempotent) |
| `server/src/features/auth/auth.module.ts` | NestJS module |
| `frontend/src/middleware.ts` | Next.js middleware for route protection |
| `server/src/features/organizations/organizations.controller.ts` | Org CRUD API |

## Auth Flow

```
1. User visits frontend
2. Clerk middleware intercepts unauthenticated dashboard requests → redirect to `/login`
3. User signs in via Clerk UI on the frontend `/login` route
4. Clerk issues JWT → stored in cookie/header
5. Frontend includes JWT in API requests (via apiFetch utility)
6. Backend ClerkGuard verifies JWT using jose + CLERK_SECRET_KEY
7. OrgMembershipGuard checks user belongs to the target organization
8. Request proceeds to controller
```

## Webhook Flow

```
1. Clerk emits event (org created, member added)
2. POST /webhooks/clerk
3. AuthController verifies Svix signature using CLERK_WEBHOOK_SECRET
4. In-memory dedup check (processedWebhooks Map)
5. Routes to handler:
   - organization.created → AuthService.handleOrgCreated()
   - organizationMembership.created → AuthService.handleMemberCreated()
6. Handler performs idempotent insert (onConflictDoNothing)
```

## Organization API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/organizations/:id` | Get organization details |
| `PATCH` | `/organizations/:id` | Update organization |
| `GET` | `/organizations/:id/members` | List organization members |

## Data Model

### organizations table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Internal primary key |
| clerkOrgId | text | Clerk's organization ID (unique index) |
| name | text | Organization name |
| slug | text | URL-friendly slug (unique index) |
| plan | enum | starter, pro, agency, enterprise |
| creditsBalance | integer | Current credit balance |

### org_members table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| organizationId | UUID | FK → organizations |
| clerkUserId | text | Clerk's user ID |
| role | enum | owner, admin, member |
| email | text | User email |
| name | text | Display name (nullable) |

### Unique Indexes
- `organizations_clerk_org_id_idx` — One org per Clerk org
- `organizations_slug_idx` — Unique slugs
- `org_members_org_user_idx` — One membership per org+user pair

## Frontend Auth

- `@clerk/nextjs` provides `useUser()`, `useOrganization()`, `useAuth()` hooks
- `middleware.ts` protects authenticated app routes, redirects unauthenticated requests to `/login`, and forwards the legacy `/audit` entry path to `/workspaces`
- API calls go through `apiFetch()` utility which includes auth headers

## Development Notes

- In local Clerk keyless development, backend JWT verification may not use `https://clerk.dev` as the issuer. When `CLERK_DOMAIN` is unset, the backend guard accepts the token's own `*.clerk.accounts.dev` issuer in non-production environments and verifies against that issuer's JWKS.
- Org-scoped API routes still require synced `organizations` and `org_members` rows in Postgres. A valid Clerk session alone is not sufficient: if the webhook sync has not created the internal org and membership records yet, the backend will reject workspace and project requests with an org-access error.

## Idempotency

Webhook handlers use `onConflictDoNothing()` on insert operations. This means:
- Replayed webhooks after process restart are silently ignored
- No 500 errors from duplicate key violations
- `handleOrgCreated` falls back to `findOrgByClerkId()` if insert returns empty (conflict)
- `handleMemberCreated` returns `null` on conflict
