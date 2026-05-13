# Feature: Workflow Engine

## Overview

The workflow engine is the core of Pulse OS. It orchestrates a 17-step AI agent pipeline that takes a business domain from initial discovery through keyword research, competitor analysis, topical mapping, content generation, and strategic recommendations.

## Architecture

```
User triggers "Start Run" on a project
  → WorkflowController.startRun()
    → WorkflowService.startRun()
      → BullMQ enqueues step jobs based on dependency graph
        → WorkflowProcessor picks up jobs
          → AgentRuntime.execute() runs the agent
            → Agent calls tools (Ahrefs, DataForSEO, etc.)
            → Agent produces JSON output
          → OutputValidator validates the output
          → Step artifact is stored
          → If step requires approval → status = awaiting_approval
          → If no approval needed → next dependent steps are enqueued
            → WebSocket emits step progress to frontend
```

## Key Files

| File | Purpose |
|------|---------|
| `server/src/features/workflows/workflow.controller.ts` | REST API (create, start, approve, revise, reject) |
| `server/src/features/workflows/workflow.service.ts` | Business logic (run management, step orchestration) |
| `server/src/features/workflows/workflow.processor.ts` | BullMQ job processor (executes agent per step) |
| `server/src/features/workflows/workflow.gateway.ts` | WebSocket gateway for real-time step updates |
| `server/src/features/workflows/workflow.module.ts` | NestJS module registration |
| `server/src/agents/agent.runtime.ts` | Agent execution loop with timeout management |
| `server/src/agents/agent.registry.ts` | Loads agent definitions from `.agent.md` files |
| `server/src/agents/tool.registry.ts` | Available tools registry |
| `server/src/agents/tool.sandbox.ts` | Sandboxed tool execution |
| `server/src/agents/output.validator.ts` | JSON output schema validation |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/workflows` | Create a new workflow run for a project |
| `POST` | `/workflows/:id/start` | Start executing the workflow |
| `GET` | `/workflows/:id` | Get run detail with all steps |
| `GET` | `/workflows/project/:projectId` | List all runs for a project |
| `POST` | `/workflows/:id/steps/:stepKey/approve` | Approve a step's output |
| `POST` | `/workflows/:id/steps/:stepKey/revise` | Request revision on a step |
| `POST` | `/workflows/:id/steps/:stepKey/reject` | Reject a step's output |

## Frontend Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/workspaces/:wId/projects/:pId/workflows` | Workflow runs list | Shows all runs with status badges |
| `/workspaces/:wId/projects/:pId/workflows/:runId` | Run detail | Step-by-step view with artifacts, approval buttons, real-time progress |

## Step Dependency Graph

Steps only execute after their dependencies complete. The dependency graph is defined in each `.agent.md` file's YAML frontmatter via the `dependencies` field.

```
Phase 1 (parallel):
  business-profile ──────────────────────────────────────┐
  seed-keywords ─────┬── search-demand ──┐               │
  competitor-buckets ─┴── competitor-metrics ──┐          │
  serp-niche-map ─────────────────────────────┤          │
  ai-intelligence ─────────────────────────────┤          │
                                               ▼          │
Phase 2:                                  phase1-baseline ─┤
  site-audit ──────────────────────────────────┘          │
                                                          │
Phase 3:                                                  │
  method01-competitor-pages (← competitor-metrics) ─┐     │
  method02-seed-expansion (← seed-keywords) ────────┤     │
  method03-content-gap-import ──────────────────────┤     │
                              consolidated-keywords ─┤     │
                                       topical-map ──┘     │
                                                          │
Phase 4:                                                  │
  content-brief ── content-article                        │
  verdict-strategy (← all research) ◄────────────────────┘
```

## Agent Definition Format

Each agent is defined as a `.agent.md` file in `server/src/agents/definitions/`:

```yaml
---
name: seed-keywords
step_key: seed-keywords
model: gpt-4o
temperature: 0.3
credit_cost: 20
max_iterations: 5
dependencies: []
required_approval: true
tools:
  - ahrefs_keyword_volume
  - serper_search
---

# Seed Keywords Agent

You are an SEO keyword research specialist...
[agent instructions in markdown]
```

## Data Model

### workflow_runs
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| projectId | UUID | FK → projects |
| organizationId | UUID | FK → organizations |
| status | enum | draft, running, paused, completed, failed |
| currentStep | text | Currently executing step key |
| creditsUsed | integer | Total credits consumed |
| startedAt | timestamp | When execution began |
| completedAt | timestamp | When execution finished |

### workflow_steps
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| workflowRunId | UUID | FK → workflow_runs |
| stepKey | text | Agent step identifier |
| stepNumber | integer | Execution order |
| phase | integer | Phase grouping (1-4) |
| status | enum | pending, running, completed, awaiting_approval, etc. |
| creditsUsed | integer | Credits consumed by this step |
| iterations | integer | Agent loop iterations used |
| error | text | Error message if failed |

### step_artifacts
Stores the JSON output of each agent execution per step.

### step_approvals
Records human review decisions (approved, revision_requested, rejected) with reviewer ID and notes.

### step_tool_calls
Logs every tool invocation by the agent (tool name, input, output, duration, success/failure).

### workflow_context
Key-value store for passing data between steps within a run.
