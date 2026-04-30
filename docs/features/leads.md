# Leads Feature

## Overview

Lead capture from the public audit form. Each lead submission creates a Lead record and triggers an Audit.

## Flow

1. Visitor submits form (`POST /leads`) with website URL, name, email, business description
2. Server creates Lead (status: `new`) + Audit (status: `pending`)
3. Enqueues audit job on `audit-queue`
4. Returns `{ auditId, leadId }` to frontend

## Lead Statuses

| Status | Description |
|--------|-------------|
| `new` | Just submitted |
| `contacted` | Follow-up initiated |
| `qualified` | Marked as qualified lead |
| `converted` | Became a customer |
| `lost` | Did not convert |

## Server Files

- `server/src/features/leads/leads.module.ts`
- `server/src/features/leads/leads.controller.ts`
- `server/src/features/leads/leads.service.ts`
- `server/src/features/leads/dto/create-lead.dto.ts`
