# Feature: Notifications

## Overview

In-app notification system for decay alerts, workflow completions, approval requests, and system messages.

## Key Files

| File | Purpose |
|------|---------|
| `server/src/features/notifications/notifications.controller.ts` | REST API |
| `server/src/features/notifications/notifications.service.ts` | CRUD + trigger logic |
| `server/src/features/notifications/notifications.module.ts` | Module registration |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/notifications` | List notifications (paginated, filtered by org) |
| `PATCH` | `/notifications/:id/read` | Mark notification as read |
| `DELETE` | `/notifications/:id` | Delete notification |

## Data Model

### notifications

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| organization_id | uuid | FK → organizations |
| project_id | uuid | FK → projects (nullable) |
| type | text | `decay_alert`, `workflow_complete`, `approval_needed`, `system` |
| title | text | Notification headline |
| message | text | Notification body |
| metadata | jsonb | Additional context (links, IDs) |
| read_at | timestamp | Nullable (null = unread) |
| created_at | timestamp | |

## Notification Types

| Type | Trigger | Contains |
|------|---------|----------|
| `decay_alert` | Keyword position/click drop detected | keyword, position change, severity |
| `workflow_complete` | Workflow run finishes all steps | run ID, project name |
| `approval_needed` | Step enters `awaiting_approval` state | step key, run ID |
| `system` | Platform announcements, maintenance | Custom message |
