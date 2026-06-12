# Feature: On-Demand Agents

## Overview

Execute AI agents on-the-fly with custom prompts outside of the structured 18-step workflow. Supports dynamic context building from project data and returns structured recommendations.

## Key Files

| File | Purpose |
|------|---------|
| `server/src/features/on-demand-agents/on-demand-agents.controller.ts` | REST API |
| `server/src/features/on-demand-agents/on-demand-agents.service.ts` | Execution logic |
| `server/src/features/on-demand-agents/on-demand-agents.module.ts` | Module registration |
| `server/src/features/on-demand-agents/agent-router.service.ts` | Routes to appropriate agent type |
| `server/src/features/on-demand-agents/context-builders/` | Dynamic context assembly per agent type |
| `frontend/src/app/(dashboard)/workspaces/[wId]/projects/[pId]/agents/page.tsx` | Agent execution UI |
| `frontend/src/features/agents/` | Components + services |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/on-demand-agents/run` | Execute an on-demand agent |
| `GET` | `/on-demand-agents/runs` | List past agent runs |
| `GET` | `/on-demand-agents/runs/:id` | Get single run detail |

## Data Model

### agent_runs

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| project_id | uuid | FK → projects |
| organization_id | uuid | FK → organizations |
| agent_type | text | Agent identifier (e.g., 'ai-intelligence', 'content-ideas') |
| user_prompt | text | User's natural language prompt |
| response | text | Agent response (nullable, TTL 30 days) |
| recommendations | jsonb | Structured recommendations array |
| cited_data | jsonb | Data citations from project context |
| credit_cost | integer | Credits consumed |
| status | enum | `running`, `completed`, `failed` |
| error | text | Nullable |
| duration_ms | integer | Execution time |
| created_at | timestamp | |

## How It Works

1. User enters a natural language prompt + selects agent type
2. `AgentRouterService` determines the best agent type and context builder
3. Context builders assemble relevant project data (keywords, competitors, content, etc.)
4. Local AgentRuntime executes with project context + user prompt
5. Response stored in `agent_runs`; credits debited
6. Results displayed with structured recommendations + data citations
