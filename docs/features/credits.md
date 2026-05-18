# Feature: Credits

## Overview

Credits are the billing currency of Pulse. Each workflow step has a fixed credit cost. Credits are debited atomically when a step executes and tracked via a double-entry ledger pattern.

## Key Files

| File | Purpose |
|------|---------|
| `server/src/features/credits/credits.controller.ts` | REST API under `credits/:organizationId/` |
| `server/src/features/credits/credits.service.ts` | Balance queries, debit/purchase operations |
| `server/src/features/credits/credits.module.ts` | NestJS module |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/credits/:organizationId/balance` | Get current credit balance |
| `GET` | `/credits/:organizationId/transactions` | List credit ledger entries |
| `POST` | `/credits/:organizationId/purchase` | Add credits (purchase) |

## Data Model

### organizations.creditsBalance
Running balance stored directly on the organization record for fast reads.

### credit_ledger table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| organizationId | UUID | FK → organizations |
| amount | integer | Positive (purchase/bonus/refund) or negative (usage) |
| balanceAfter | integer | Balance after this transaction |
| type | enum | purchase, usage, refund, bonus |
| description | text | Human-readable description |
| workflowRunId | UUID | FK → workflow_runs (nullable, for usage entries) |
| stepKey | text | Which step consumed credits (nullable) |

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
2. Decrement `organizations.creditsBalance`
3. Insert `credit_ledger` entry with `balanceAfter`
4. Both operations in a single transaction — no partial state

## Credit Costs by Step

See [Product Overview](../product/overview.md) for the full table of credit costs per workflow step. Total cost for a full 18-step run: ~740 credits.
