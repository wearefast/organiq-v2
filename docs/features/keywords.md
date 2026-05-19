# Feature: Keywords

## Overview

Keywords are the core data asset in Pulse. They are discovered, scored, and categorized by workflow agents, then stored per-project for use in topical mapping and content generation.

## Key Files

| File | Purpose |
|------|---------|
| `server/src/features/keywords/keywords.controller.ts` | REST API under `projects/:projectId/keywords` |
| `server/src/features/keywords/keywords.service.ts` | CRUD + bulk upsert + stats |
| `server/src/features/keywords/keywords.module.ts` | NestJS module |
| `frontend/src/app/(dashboard)/workspaces/[wId]/projects/[pId]/keywords/page.tsx` | Keywords management page |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/projects/:projectId/keywords` | List all keywords (optional `?status` filter) |
| `GET` | `/projects/:projectId/keywords/stats` | Aggregate stats (count by status, intent, funnel stage) |
| `GET` | `/projects/:projectId/keywords/:id` | Get single keyword |
| `POST` | `/projects/:projectId/keywords/bulk` | Bulk upsert keywords (used by agents) |
| `PATCH` | `/projects/:projectId/keywords/status` | Batch update keyword status |
| `DELETE` | `/projects/:projectId/keywords/:id` | Delete single keyword |

## Data Model

### keywords table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| projectId | UUID | FK → projects |
| workflowRunId | UUID | FK → workflow_runs (nullable, set null on delete) |
| keyword | text | The keyword phrase |
| volume | integer | Monthly search volume |
| difficulty | integer | Keyword difficulty score (0-100) |
| cpc | decimal(10,2) | Cost per click |
| intent | enum | transactional, commercial, informational, navigational |
| funnelStage | enum | tofu, mofu, bofu |
| status | enum | discovered, approved, brief_ready, written, published |
| sourceStep | text | Which workflow step discovered this keyword |
| parentTopic | text | Parent topic cluster |
| serpFeatures | jsonb | SERP feature data (featured snippets, PAA, etc.) |

### Indexes
- `keywords_project_status_idx` — Fast filtering by project + status
- `keywords_project_keyword_idx` — Unique constraint per project+keyword (prevents duplicates)

## Keyword Lifecycle

```
discovered → approved → brief_ready → written → published
     ↑          │
     └──────────┘ (can be re-discovered in subsequent runs)
```

1. **Discovered** — Agent finds keyword via research tools
2. **Approved** — Human approves keyword for content targeting
3. **Brief Ready** — Content brief has been generated
4. **Written** — Article has been drafted
5. **Published** — Content is live

## Intent Classification

| Intent | Description | Example |
|--------|-------------|---------|
| `transactional` | User wants to buy/act | "buy running shoes online" |
| `commercial` | User is comparing options | "best running shoes 2026" |
| `informational` | User seeks knowledge | "how to choose running shoes" |
| `navigational` | User seeks specific site | "nike running shoes" |

## Funnel Stages

| Stage | Acronym | Description |
|-------|---------|-------------|
| `tofu` | Top of Funnel | Awareness — broad informational queries |
| `mofu` | Middle of Funnel | Consideration — comparison & evaluation |
| `bofu` | Bottom of Funnel | Decision — purchase-intent queries |
