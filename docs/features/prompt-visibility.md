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
2. System queries multiple LLM engines (ChatGPT, Perplexity, Claude, Gemini, Copilot) with each prompt
3. Parser service analyzes responses for brand mentions, citations, and ranking position
4. Results stored with timestamp for historical tracking
5. BullMQ processor runs checks on configured schedule (configurable hour)
6. Dashboard shows visibility trends, engine breakdown, and prompt-level detail
