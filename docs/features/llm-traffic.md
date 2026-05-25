# Feature: LLM Traffic Analysis

## Overview

Tracks traffic sessions arriving from LLM/AI engines (ChatGPT, Perplexity, Claude, Gemini, etc.) and aggregates daily statistics per project.

## Key Files

| File | Purpose |
|------|---------|
| `server/src/features/llm-traffic/llm-traffic.controller.ts` | REST API endpoints |
| `server/src/features/llm-traffic/llm-traffic.service.ts` | Session tracking + aggregation |
| `server/src/features/llm-traffic/llm-traffic.processor.ts` | BullMQ processor for async aggregation |
| `server/src/features/llm-traffic/llm-traffic.module.ts` | Module registration |
| `frontend/src/app/(dashboard)/workspaces/[wId]/projects/[pId]/analytics/traffic/page.tsx` | Traffic dashboard |

## Data Model

### llm_traffic_sessions

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| project_id | uuid | FK → projects |
| engine | text | AI platform (chatgpt, perplexity, claude, gemini, copilot) |
| referrer | text | Full referrer URL |
| landing_page | text | Page that received traffic |
| session_id | text | Unique session identifier |
| country | text | Nullable |
| device | text | Nullable |
| created_at | timestamp | |

### llm_traffic_stats

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| project_id | uuid | FK → projects |
| engine | text | AI platform |
| date | date | Aggregation date |
| sessions | integer | Session count |
| top_pages | jsonb | Most visited pages |
| created_at | timestamp | |

## How It Works

1. Traffic detection via referrer pattern matching (known LLM referrer domains)
2. Sessions logged individually to `llm_traffic_sessions`
3. BullMQ processor aggregates daily into `llm_traffic_stats`
4. Frontend dashboard shows trends, top engines, and top landing pages
