# Feature: Scheduled Workflows

## Overview

Cron-based recurring agent execution with email/Slack delivery. Users configure periodic agent runs that execute automatically and deliver results to a specified channel.

## Key Files

| File | Purpose |
|------|---------|
| `server/src/features/scheduled-workflows/scheduled-workflows.controller.ts` | REST CRUD |
| `server/src/features/scheduled-workflows/scheduled-workflows.service.ts` | Business logic + run history |
| `server/src/features/scheduled-workflows/workflow-scheduler.service.ts` | Registers repeatable BullMQ job |
| `server/src/features/scheduled-workflows/workflow-scheduler.processor.ts` | BullMQ processor (check-due-workflows) |
| `server/src/features/scheduled-workflows/delivery.service.ts` | Email/Slack delivery |
| `server/src/features/scheduled-workflows/retention.service.ts` | Weekly data cleanup cron |
| `frontend/src/app/(dashboard)/.../scheduled-workflows/page.tsx` | Scheduled workflows page |
| `frontend/src/app/(dashboard)/.../agents/scheduled/page.tsx` | Alt route via agents section |

## API Endpoints

Base: `/projects/:projectId/scheduled-workflows`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/` | Create scheduled workflow |
| `GET` | `/` | List scheduled workflows for project |
| `GET` | `/:workflowId` | Get single scheduled workflow |
| `PATCH` | `/:workflowId` | Update scheduled workflow |
| `DELETE` | `/:workflowId` | Delete scheduled workflow |
| `GET` | `/:workflowId/history` | Get run history (`?limit=20`) |

## Data Model

### scheduled_workflows

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| project_id | uuid | FK → projects |
| name | text | Display name |
| agent_type | text | Agent to execute |
| prompt | text | Natural-language instruction |
| schedule_cron | text | Cron expression |
| delivery_channel | enum | `email`, `slack` |
| delivery_target | text | Email address or Slack webhook URL |
| is_active | boolean | Enable/disable schedule |
| next_run_at | timestamp | Next scheduled execution time |
| created_at | timestamp | |
| updated_at | timestamp | |

### workflow_run_history

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| scheduled_workflow_id | uuid | FK → scheduled_workflows |
| status | enum | `completed`, `failed` |
| response | text | Agent response (nullable, cleared after 30 days) |
| delivered | boolean | Whether delivery succeeded |
| error | text | Error message if failed |
| created_at | timestamp | |

## Execution Flow

1. `WorkflowSchedulerService` registers a repeatable BullMQ job on module init
2. Processor runs every minute, queries for workflows where `next_run_at <= now()` and `is_active = true`
3. For each due workflow: executes the on-demand agent with configured prompt
4. Delivery service sends results to configured channel (email or Slack webhook)
5. Run result stored in `workflow_run_history`
6. `next_run_at` updated based on cron expression

## Data Retention

- `RetentionService` runs weekly cron
- Agent run responses older than 30 days: `UPDATE SET response=null, recommendations=null` (preserves audit row)
- LLM traffic sessions older than 90 days: deleted
