# Architecture Decisions — Pulse OS v3

## Summary

These decisions were locked during the v3 planning phase and guide all implementation.

## Decisions

| # | Decision | Rationale | Status |
|---|----------|-----------|--------|
| AD-1 | Extend existing `PromptService` with Console fetcher method. No separate service. | Single source of truth. Existing cache + fallback logic reused. | Locked |
| AD-2 | GSC moves fully into NestJS. Retire Python sidecar GSC proxy. | Eliminates split-brain auth. NestJS handles OAuth natively. | Locked |
| AD-3 | MCP is cut entirely. Tools stay in `ToolRegistry` as direct service calls. | Avoids double-migration churn. Current tool system works. | Locked |
| AD-4 | Provider adapter pattern in `AgentRuntime`. `LlmProvider` interface with `OpenAiProvider` + `AnthropicProvider`. | Keeps OpenAI path working during migration. No big-bang swap. | **Implemented** |
| AD-5 | Feature flags via env vars for provider routing. `AGENT_PROVIDER_OVERRIDE`. | Safe rollback: flip env var. | **Implemented** |
| AD-6 | Reuse existing Docker containers (postgres:5433, redis:6379). Fresh schema via `db:push`. | Dev mode = no data to preserve. | Locked |
| AD-7 | Thinking traces + execution provenance in `step_artifacts.metadata` JSONB. | Collocated with output. Single query for full step result. | Locked |
| AD-8 | Credit model: variable cost per agent type. Retries free. Only verified success debits. | Consistent with existing atomic debit pattern. | Locked |
| AD-9 | Data retention: traffic 90d, thinking 30d, visibility 1y. Weekly purge cron. | Prevents unbounded growth. | Locked |
| AD-10 | Prompt governance: Repo = source of truth. Console = deployment target. CI syncs. | Version control. Diffable. Rollback via git revert. | Locked |
| AD-11 | Tier 4 Orchestrator deferred indefinitely. On-demand agents suffice. | Simpler. No speculative architecture. | Locked |
| AD-12 | Python sidecar: kill across R1 (analysis), R3 (GSC), R10 (PDF + container). | Eliminates deployment unit, Python runtime, CORS hop, port. | Locked |
| AD-13 | Synthetic test data only. No real client data in repo. | Privacy-safe, reproducible, controllable. | Locked |

## Implementation Details

### AD-4: Provider Adapter Pattern

```
LlmProvider (interface)
├── complete(options): Promise<LlmCompletionResult>
└── completeTier2(options): Promise<LlmCompletionResult>

OpenAiProvider implements LlmProvider
  └── Wraps existing OpenAiService.chatCompletion()

AnthropicProvider implements LlmProvider
  └── Wraps AnthropicService.chat()
  └── Enables extended thinking for Tier 2 calls
```

Files:
- `server/src/agents/llm-provider.interface.ts`
- `server/src/agents/openai.provider.ts`
- `server/src/agents/anthropic.provider.ts`

### AD-5: Provider Override

```bash
# Force all agents to use OpenAI (rollback)
AGENT_PROVIDER_OVERRIDE=openai

# Force all agents to use Anthropic (test migration)
AGENT_PROVIDER_OVERRIDE=anthropic

# Normal: respect each agent's frontmatter setting
# (unset or empty)
```

Resolution order: `AGENT_PROVIDER_OVERRIDE` > `agent.md frontmatter provider:` > default (`openai`)

### AD-7: Metadata Schema

```typescript
interface StepArtifactMetadata {
  thinkingTrace?: string;       // Extended thinking output (Anthropic)
  provider: 'openai' | 'anthropic';
  model: string;
  promptSource: string;         // File path of prompt used
  promptVersion?: string;       // Git SHA or version tag
  tokensUsed: { input: number; output: number; total: number };
  shadowVerdictIfAny?: unknown; // Shadow mode comparison result
}
```

Column: `step_artifacts.metadata` (JSONB, nullable) — to be added in R1.1.3 migration.
