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

## Frontend Slice

| Area | Implemented |
|------|-------------|
| Dashboard lead drawer | The dashboard leads table now opens a right-side drawer with lead profile context, linked audit status, editable local status selection, business description, internal notes, and a save action |
| Lead persistence route | The server now exposes `PATCH /leads/:id` so the dashboard drawer can persist strategist status changes and internal notes back into the lead record |
| Save-state feedback | The drawer disables the save button while the mutation is in flight and shows an inline error message if the update fails |

## Dashboard Lead Update Contract

**PATCH /leads/:id** body:
```json
{
	"status": "qualified",
	"notes": "Prioritized for strategist follow-up after audit review."
}
```

Server behavior:

- normalizes the incoming status to the allowed lead-status enum
- rejects unknown lead IDs and invalid status values
- merges the new notes into `businessDetails.internalNotes` so dashboard edits stay on the lead record
