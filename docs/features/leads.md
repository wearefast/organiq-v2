# Feature: Leads

## Overview

Captures leads from public audit reports. When a prospect views their audit report and fills in contact details, a lead is created and linked to the originating project.

## Key Files

| File | Purpose |
|------|---------|
| `server/src/features/leads/leads.controller.ts` | REST API |
| `server/src/features/leads/leads.service.ts` | Lead CRUD + aggregation |
| `server/src/features/leads/leads.module.ts` | Module registration |
| `frontend/src/features/leads/` | Dashboard components + services |
| `frontend/src/app/(dashboard)/leads/page.tsx` | Leads list view |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/leads` | List leads (org-scoped, paginated) |
| `POST` | `/leads` | Create lead (from public audit form) |
| `PATCH` | `/leads/:id` | Update lead status |
| `DELETE` | `/leads/:id` | Delete lead |

## Data Model

### leads

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| organization_id | uuid | FK → organizations |
| project_id | uuid | FK → projects (nullable) |
| name | text | Contact name |
| email | text | Contact email |
| company | text | Nullable |
| website | text | Audited URL |
| source | text | `audit_report`, `manual` |
| status | enum | `new`, `contacted`, `qualified`, `converted`, `lost` |
| notes | text | Nullable |
| metadata | jsonb | Audit score, report link, etc. |
| created_at | timestamp | |
| updated_at | timestamp | |
