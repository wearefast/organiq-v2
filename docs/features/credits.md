# Feature: Credits

## Overview

Credits are the billing currency of Pulse. Each workflow step has a fixed credit cost. Credits are debited atomically when a step executes and tracked via a double-entry ledger pattern. Workspace-level monthly credit caps can optionally be set by admins to limit per-workspace spend.

## Key Files

| File | Purpose |
|------|---------|
| `server/src/features/credits/credits.controller.ts` | REST API under `credits/:organizationId/` |
| `server/src/features/credits/credits.service.ts` | Balance queries, debit/purchase operations, workspace cap enforcement |
| `server/src/features/credits/credits.module.ts` | NestJS module |
| `server/src/features/user-management/workspace-credit-limit.service.ts` | Upserts workspace limits, monthly reset cron |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/credits/:organizationId/balance` | Get current credit balance |
| `GET` | `/credits/:organizationId/transactions` | List credit ledger entries |
| `POST` | `/credits/:organizationId/purchase` | Add credits (purchase) |

See also: [User Management](./user-management.md) for `workspace-credit-limit` endpoints (`GET/PUT/DELETE orgs/:orgId/workspaces/:workspaceId/credit-limit`).

## Data Model

### organizations.creditsBalance
Running balance stored directly on the organization record for fast reads.

### credit_ledger table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| organizationId | UUID | FK → organizations |
| workspaceId | UUID | FK → workspaces (nullable — populated for workspace-scoped debits) |
| amount | integer | Positive (purchase/bonus/refund) or negative (usage) |
| balanceAfter | integer | Balance after this transaction |
| type | enum | purchase, usage, refund, bonus |
| description | text | Human-readable description |
| workflowRunId | UUID | FK → workflow_runs (nullable, for usage entries) |
| stepKey | text | Which step consumed credits (nullable) |

### workspace_credit_limits table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| workspaceId | UUID | FK → workspaces (unique) |
| organizationId | UUID | FK → organizations |
| monthlyLimit | integer | Max credits this workspace may consume per month |
| currentMonthUsage | integer | Credits used so far this month (resets on 1st via cron) |
| lastResetAt | timestamp | When usage was last reset |

### Index
- `credit_ledger_org_created_idx` — For paginated transaction history

## Credit Types

| Type | Description | Amount Sign |
|------|-------------|-------------|
| `purchase` | Credits bought by organization | Positive |
| `usage` | Credits consumed by workflow step | Negative |
| `refund` | Credits returned (failed step, etc.) | Positive |
| `bonus` | Promotional credits | Positive |

## Debit Flow

Credits are debited atomically inside a database transaction:

1. Check `organizations.creditsBalance >= step.creditCost`
2. If `workspaceId` is provided and the workspace has a `workspace_credit_limits` record:
   - `SELECT FOR UPDATE` on the limit row (prevents race conditions)
   - Check `currentMonthUsage + step.creditCost <= monthlyLimit`
   - Increment `currentMonthUsage`
3. Decrement `organizations.creditsBalance`
4. Insert `credit_ledger` entry with `balanceAfter` and `workspaceId` (if applicable)
5. All operations in a single transaction — no partial state

## Workspace Monthly Reset

`WorkspaceCreditLimitService` runs a `@Cron('0 0 1 * *')` job on the 1st of each month to reset `currentMonthUsage = 0` for all `workspace_credit_limits` rows.

## Credit Costs by Step

See [Product Overview](../product/overview.md) for the full table of credit costs per workflow step. Total cost for a full 18-step run: ~740 credits.
