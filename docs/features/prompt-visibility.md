# Feature: Prompt Visibility

## Overview

Tracks how a project's brand appears in AI search engine responses. Users define prompts (questions a customer might ask an LLM), and the system periodically checks whether the brand is mentioned, cited, or ranked in the AI-generated answers.

## Key Files

| File | Purpose |
|------|---------|
| `server/src/features/prompt-visibility/prompt-visibility.controller.ts` | REST API |
| `server/src/features/prompt-visibility/prompt-visibility.service.ts` | Business logic, check orchestration |
| `server/src/features/prompt-visibility/prompt-visibility.processor.ts` | BullMQ processor for scheduled checks |
| `server/src/features/prompt-visibility/engine-query.service.ts` | Queries LLM engines for prompt responses |
| `server/src/features/prompt-visibility/visibility-parser.service.ts` | Parses engine responses for brand mentions |
| `frontend/src/app/(dashboard)/.../ai-search/visibility/page.tsx` | Visibility dashboard |
| `frontend/src/features/analytics/services/prompt-visibility.service.ts` | Frontend API client |

## API Endpoints

Base: `/projects/:projectId/prompts`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List tracked prompts |
| `POST` | `/` | Create a new prompt to track |
| `DELETE` | `/:promptId` | Delete a tracked prompt |
| `PATCH` | `/:promptId/toggle` | Toggle prompt active/inactive |
| `POST` | `/:promptId/run` | Manually trigger visibility check |
| `GET` | `/:promptId/history` | Get check history for a prompt |
| `GET` | `/overview` | Project-level visibility summary |
| `GET` | `/suggestions` | AI-generated prompt suggestions |
| `GET` | `/engines` | List supported LLM engines |
| `GET` | `/schedule` | Get check schedule config |
| `PATCH` | `/schedule` | Update schedule hour (0–23) |

## How It Works

1. User creates prompts (natural-language questions related to their niche)
2. System queries 5 LLM engines with each prompt — **each engine is called 3 times**, and the longest successful response wins (majority vote)
3. Parser service analyzes responses for brand mentions, citations, and ranking position
4. Results stored with timestamp for historical tracking
5. BullMQ processor runs checks on configured schedule (configurable hour)
6. Dashboard shows visibility trends, engine breakdown, and prompt-level detail

## LLM Engines

All engines use web-search-capable models to ensure real-time information.

| Engine | Model | API |
|--------|-------|-----|
| Perplexity | `sonar` | `api.perplexity.ai` |
| OpenAI | `gpt-4o-mini-search-preview` | `api.openai.com` |
| Gemini | `gemini-1.5-flash` with `google_search_retrieval` tool | `generativelanguage.googleapis.com` |
| Claude | `claude-sonnet-4-6` with `web_search_20250305` beta header | `api.anthropic.com` |
| Copilot | Bing Web Search v7 + Claude synthesis | `api.bing.microsoft.com` |

## Required Environment Variables

```
OPENAI_API_KEY          # Existing — used for OpenAI engine
ANTHROPIC_API_KEY       # Existing — used for Claude engine
PERPLEXITY_API_KEY      # New — Perplexity sonar model
GEMINI_API_KEY          # New — Gemini 1.5 Flash
BING_SEARCH_API_KEY     # New — Bing Web Search v7 (Copilot engine)
```

