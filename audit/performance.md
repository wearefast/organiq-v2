# Performance Audit — Pulse OS

> **Last audited:** June 4, 2026 (Release 13 — CTO Deep Audit)
> **Auditor:** CTO / Principal Engineer

This document tracks API call counts, estimated credit costs, token costs, and latency bottlenecks per workflow run.

---

## Methodology

- API call counts are **per full workflow run** (17 steps, assuming N=5 competitors unless noted)
- "Before R12" = state before Release 12 optimisations
- "After R12/R13" = current state
- Ahrefs credits: 1 unit ≈ 1 row returned from Site/Keywords Explorer
- SERP credits: Ahrefs SERP overview is a separate credit pool

---

## R16 New Findings (Round 3)

| Finding | Type | Severity | Estimated Impact |
|---------|------|---------|----------------|
| `content-images` artifact stores 15-30 MB base64 PNG blobs in `step_artifacts.data` JSONB | Storage + latency | 🔴 Critical | `getRun()` returns 15-30 MB to frontend on every refresh; `workflow_context` also stores same blob (double storage) |
| `content-images` receives full 80-100K token workflowContext (not in STEP_CONTEXT_KEYS) | Token waste | 🟠 High | ~70-90K extra input tokens per content-images step (~$0.18-0.45 wasted) |
| Scheduled workflow processor runs N agents sequentially, not parallel | Latency risk | 🟡 Medium | 10 due workflows × 5-min timeout = 50-min BullMQ job, overlaps next scheduler tick |
| `SkillService` cache never invalidates — skill edits require server restart | Dev latency | 🟡 Medium | Same as pre-R14 PromptService bug |
| `workflow_context` and `step_artifacts` have no retention policy | Storage growth | 🟡 Medium | Unbounded table growth; 100 runs = 1,700 context rows + content-images blobs |

---

## R13 New Findings

| Finding | Type | Severity | Estimated Impact |
|---------|------|---------|----------------|
| `content-brief` pipeline BROKEN — always returns empty SERP data | Bug | 🔴 Critical | Every content brief is hallucinated; zero Serper/Firecrawl calls actually fire |
| `content-brief` + `content-article` receive full workflowContext (not sliced) | Token waste | 🟠 Medium | ~80–100K extra input tokens per step |
| `startRun` pre-flight includes `business-profile` agent (30 credits) in total cost check | Logic error | 🟡 Medium | Users told they need 30 credits more than the workflow actually costs |
| `getRun` loads ALL artifact versions for ALL 17 steps | Query weight | 🟡 Medium | Can be hundreds of KB; scales poorly as runs accumulate revisions |
| On-demand agents have no timeout/AbortController | Latency risk | 🟡 Medium | A hung on-demand call blocks the request indefinitely |

---

## API Call Inventory (Post-R12/R13)

### Phase 1 — Intelligence & Audit (Steps 1–7 + seeded business-profile)

| Step | Service | Calls | Credits (est.) | Notes |
|------|---------|-------|----------------|-------|
| (seeded) business-profile | — | 0 | 0 | ⚠️ Pre-seeded at run start from project record — stale data risk |
| seed-keywords | Ahrefs KE | 1 organic + 1 related + 1 suggestions | ~3 units | Per domain |
| site-audit | PageSpeed | 1 | Free | |
| site-audit | CrUX | 1 | Free | |
| site-audit | Ahrefs SE | 1–2 calls | ~2 units | Domain metrics |
| serp-niche-map | Ahrefs KE | ≤20 SERP calls | ≤20 SERP credits | **Capped at 20** (was 50, R12) |
| competitor-buckets | Serper | 1–2 queries | ~$0.002 | SERP analysis |
| competitor-metrics | Ahrefs SE | 3 calls × N competitors | ~3N units | DR + backlinks + keywords (parallel) |
| search-demand | DataForSEO + Ahrefs | batch | ~$0.05 × K keywords | Volume + difficulty enrichment |

**Phase 1 subtotal (N=5 competitors):** ~35–45 Ahrefs units + 20 SERP credits + ~$0.002 web

---

### Phase 2 — Keyword Research (Steps 8–12)

| Step | Service | Calls | Credits (est.) | Notes |
|------|---------|-------|----------------|-------|
| phase1-baseline | Ahrefs SE | **0–1 organic + 1 pages** | ~1–2 units | ✅ R12: skips organic keywords if seed-keywords available |
| method01-competitor-pages | Ahrefs SE | 1 pages × N competitors | ~N units | ✅ R12: no keyword calls (from context) |
| method02-seed-expansion | — | **0** | 0 | ✅ R12: reads from context |
| method03-content-gap-import | — | **0** | 0 | ✅ R12: skipped when no imports |

**Phase 2 subtotal (N=5 competitors):** ~6–7 units

---

### Phase 3 — Strategy (Steps 12–14)

| Step | Service | Calls | Credits (est.) | Notes |
|------|---------|-------|----------------|-------|
| consolidated-keywords | Anthropic | 1 LLM call | ~$0.10–0.30 | Extended thinking, context-sliced |
| verdict-strategy | Anthropic | 1 LLM call | ~$0.15–0.40 | Extended thinking, context-sliced |
| topical-map | Anthropic | 1 LLM call | ~$0.15–0.40 | Extended thinking, context-sliced + brand filter |

---

### Phase 4 — Content (Steps 15–17)

| Step | Service | Calls | Credits (est.) | Notes |
|------|---------|-------|----------------|-------|
| content-brief | Serper | ⚠️ **0** (broken) | ~$0 | Pipeline reads from wrong context path — always skips |
| content-brief | Firecrawl | ⚠️ **0** (broken) | ~$0 | Pipeline reads from wrong context path — always skips |
| content-brief | Anthropic | 1 LLM call | ~$0.05–0.15 | **Receives full ~80–100K token context (not sliced)** |
| content-article | Serper | 3 calls | ~$0.003 | Stats + news + PAA searches |
| content-article | Anthropic | 1+ LLM calls | ~$0.20–0.60 | **Receives full ~80–100K token context (not sliced)** |
| content-images | image API | 1–3 calls | varies | |

---

## Before vs After R12

| Step | Before R12 | After R12 | Saved |
|------|-----------|-----------|-------|
| serp-niche-map | 50 SERP calls | ≤20 SERP calls | **30 SERP credits/run** |
| method02-seed-expansion | ~40 API calls (Ahrefs + DataForSEO) | 0 calls | **~40 credits/run** |
| phase1-baseline | 2 Ahrefs calls | 1 Ahrefs call | **~1 unit/run** |
| method03-content-gap-import | ~9 API calls | 0 calls (when no imports) | **~9 credits when skipped** |
| method01-competitor-pages | 1 organic keywords call × N | 0 keyword calls | **~N credits/run** |
| **Total saving (N=5)** | — | — | **~95 Ahrefs/DataForSEO units + 30 SERP credits per run** |

---

## LLM Token Estimates (Full Run)

| Stage | Input Tokens (est.) | Output Tokens (est.) | Model | Sliced? |
|-------|--------------------|--------------------|-------|---------|
| pipeline-then-agent steps ×11 | 2K–8K per step | 500–2K per step | claude-sonnet-4 | No (early steps have small context) |
| consolidated-keywords | 10K–30K | 3K–8K | claude-sonnet-4 (extended thinking) | ✅ Yes (5 keys) |
| verdict-strategy | 15K–40K | 5K–10K | claude-sonnet-4 (extended thinking) | ✅ Yes (6 keys) — note: `search-demand` missing from XML block but interpolated in template |
| topical-map | 8K–20K | 5K–10K | claude-sonnet-4 (extended thinking) | ✅ Yes (3 keys) |
| content-brief | **~80–100K** | 3K–6K | claude-sonnet-4 | ❌ No — should be sliced to `topical-map` + `business-profile` |
| content-article | **~80–100K** | 8K–20K | claude-sonnet-4 | ❌ No — should be sliced to `content-brief` + `topical-map` |

**R13 token savings available:** Adding context slicing for `content-brief` and `content-article` would save ~60–80K input tokens per step, estimating ~$0.10–0.25 saved per full run (at `claude-sonnet-4` pricing).

---

## Bottlenecks

| Bottleneck | Type | Wall Time (est.) | Notes |
|-----------|------|-----------------|-------|
| competitor-metrics | API throughput | 10–20s (N=5 competitors × 3 calls, parallelised) | Uses `Promise.all` |
| serp-niche-map | Serial API loop | 20–30s (20 keywords × ~1.5s each) | Cannot parallelise (rate limit) |
| verdict-strategy | LLM extended thinking | 30–60s | Thinking budget configurable |
| topical-map | LLM extended thinking | 30–60s | Thinking budget configurable |
| content-article | LLM call | 30–90s | `pipeline-then-agent`, 3 Serper pre-fetch + agent |
| `getRun` query | DB | 10–200ms | Loads ALL artifact versions for all 17 steps — grows over time |

**Estimated total wall time for a full run:** 6–12 minutes (assuming no approval delays)

---

## Credit Cost per Full Workflow Run (Pulse Credits)

| Step | Pulse Credits | Notes |
|------|--------------|-------|
| seed-keywords | 40 | |
| site-audit | 60 | |
| ai-intelligence | 80 | |
| serp-niche-map | 30 | |
| competitor-buckets | 40 | |
| competitor-metrics | 20 | |
| search-demand | 50 | |
| phase1-baseline | 50 | |
| method01 | 55 | |
| method02 | 30 | |
| method03 | 20 | |
| consolidated-keywords | 40 | |
| verdict-strategy | 35 | |
| topical-map | 35 | |
| content-brief | 25 | |
| content-article | 30 | |
| content-images | 30 | |
| **Total actual** | **~670 credits/run** | |
| **`startRun` pre-flight reports** | **~700 credits required** | ⚠️ Inflated by 30 credits — `business-profile` agent (credit_cost: 30) is included in `getAllAgents()` but never runs as a step |

---

## Performance Action Items (R13)

| Priority | Action | Location | Impact |
|---------|--------|---------|--------|
| 🔴 Critical | Fix `content-brief` pipeline target keyword lookup | `content-brief.pipeline.ts:32` | SERP data now available; content quality drastically improved |
| 🟠 High | Add `content-brief` to `STEP_CONTEXT_KEYS` with `['topical-map', 'business-profile', 'domain', 'country', 'language']` | `workflow.processor.ts` | ~60–80K fewer input tokens per step |
| 🟠 High | Add `content-article` to `STEP_CONTEXT_KEYS` with `['content-brief', 'topical-map', 'business-profile', 'domain', 'country']` | `workflow.processor.ts` | ~60–80K fewer input tokens per step |
| 🟡 Medium | Fix `startRun` credit pre-flight to use `STEP_DEFINITIONS` cost instead of `getAllAgents()` | `workflow.service.ts:startRun` | Accurate credit requirement shown to users |
| 🟡 Medium | Add `AbortController` with timeout to `on-demand-agents.service.ts` | `on-demand-agents.service.ts` | Prevent indefinitely hanging on-demand calls |
| 🟡 Medium | Paginate/limit artifact versions in `getRun` | `workflow.service.ts:getRun` | Prevent heavy queries on runs with many revisions |

---

## Performance Audit Checklist Template

- [ ] Recount API calls after any pipeline change and update this document
- [ ] Confirm `Promise.allSettled` or `Promise.all` is used for parallel competitor API calls
- [ ] Verify no new serial loops added that could use parallel execution
- [ ] LLM call count per step matches expected (no runaway tool-calling loops)
- [ ] Context slicing map is up to date for all agent-only and late-stage pipeline-then-agent steps

This document tracks API call counts, estimated credit costs, and latency bottlenecks per workflow run.

---

## Methodology

- API call counts are **per full workflow run** (all 18 steps, assuming N=5 competitors unless noted)
- "Before R12" = state before Release 12 optimisations
- "After R12" = current state
- Ahrefs credits: 1 unit ≈ 1 row returned from Site/Keywords Explorer (billing varies by endpoint)
- SERP credits: Ahrefs SERP overview is separate credit pool

---

## API Call Inventory (Post-R12)

### Phase 1 — Intelligence & Audit (Steps 1–8)

| Step | Service | Calls | Credits (est.) | Notes |
|------|---------|-------|----------------|-------|
| business-profile | Firecrawl | 1 scrape | ~$0.001 | Target domain |
| business-profile | Serper | 1 query | ~$0.001 | Brand SERP |
| seed-keywords | Ahrefs KE | 1 organic + 1 related + 1 suggestions | ~3 units | Per domain |
| site-audit | PageSpeed | 1 | Free | |
| site-audit | CrUX | 1 | Free | |
| site-audit | Ahrefs SE | 1–2 calls | ~2 units | Domain metrics |
| serp-niche-map | Ahrefs KE | ≤20 SERP calls | ≤20 SERP credits | **Capped at 20** (was 50) |
| competitor-buckets | Serper | 1–2 queries | ~$0.002 | SERP analysis |
| competitor-metrics | Ahrefs SE | 3 calls × N competitors | ~3N units | DR + backlinks + keywords |
| search-demand | DataForSEO | batch | ~$0.05 × K keywords | Volume enrichment |

**Phase 1 subtotal (N=5 competitors):** ~35–45 Ahrefs units + 20 SERP credits + ~$0.003 web

---

### Phase 2 — Keyword Research (Steps 9–13)

| Step | Service | Calls | Credits (est.) | Notes |
|------|---------|-------|----------------|-------|
| phase1-baseline | Ahrefs SE | **0–1 organic + 1 pages** | ~1–2 units | ✅ R12: skips organic keywords if seed-keywords available |
| method01-competitor-pages | Ahrefs SE | 1 pages × N competitors | ~N units | ✅ R12: no keyword calls (from context) |
| method02-seed-expansion | — | **0** | 0 | ✅ R12: reads from context |
| method03-content-gap-import | — | **0** | 0 | ✅ R12: skipped when no imports |

**Phase 2 subtotal (N=5 competitors):** ~6–7 units

---

### Phase 3 — Strategy (Steps 14–15)

| Step | Service | Calls | Credits (est.) | Notes |
|------|---------|-------|----------------|-------|
| consolidated-keywords | Anthropic | 1 LLM call | ~$0.10–0.30 | Extended thinking |
| verdict-strategy | Anthropic | 1 LLM call | ~$0.15–0.40 | Extended thinking |
| topical-map | Anthropic | 1 LLM call | ~$0.15–0.40 | Extended thinking |

---

### Phase 4 — Content (Steps 16–18)

| Step | Service | Calls | Credits (est.) | Notes |
|------|---------|-------|----------------|-------|
| content-brief | Serper | 1 query | ~$0.001 | Target keyword SERP |
| content-brief | Firecrawl | 3 scrapes | ~$0.003 | Top 3 organic pages |
| content-brief | Anthropic | 1 LLM call | ~$0.05–0.15 | No extended thinking |
| content-article | Anthropic | 1+ LLM calls | ~$0.30–1.00 | Tool-calling loop |

---

## Before vs After R12

| Step | Before R12 | After R12 | Saved |
|------|-----------|-----------|-------|
| serp-niche-map | 50 SERP calls | ≤20 SERP calls | **30 SERP credits/run** |
| method02-seed-expansion | ~40 API calls (Ahrefs + DataForSEO) | 0 calls | **~40 credits/run** |
| phase1-baseline | 2 Ahrefs calls | 1 Ahrefs call | **~1 unit/run** |
| method03-content-gap-import | ~9 API calls | 0 calls (when no imports) | **~9 credits when skipped** |
| method01-competitor-pages | 1 organic keywords call × N | 0 keyword calls | **~N credits/run** |
| **Total saving (N=5)** | — | — | **~95 Ahrefs/DataForSEO units + 30 SERP credits per run** |

---

## LLM Token Estimates (Full Run)

| Stage | Input Tokens (est.) | Output Tokens (est.) | Model |
|-------|--------------------|--------------------|-------|
| pipeline-then-agent steps (×11) | 2K–8K per step | 500–2K per step | claude-sonnet-4 |
| consolidated-keywords | 10K–30K (context-sliced) | 3K–8K | claude-sonnet-4 (extended thinking) |
| verdict-strategy | 15K–40K (context-sliced) | 5K–10K | claude-sonnet-4 (extended thinking) |
| topical-map | 8K–20K (context-sliced) | 5K–10K | claude-sonnet-4 (extended thinking) |
| content-brief | 5K–15K | 3K–6K | claude-sonnet-4 |
| content-article | 10K–25K | 8K–20K | claude-sonnet-4 |

> Context slicing for consolidated-keywords/verdict-strategy/topical-map reduces input tokens by an estimated 40–60% compared to passing full workflowContext.

---

## Bottlenecks

| Bottleneck | Type | Wall Time (est.) | Notes |
|-----------|------|-----------------|-------|
| competitor-metrics | API throughput | 10–20s (N=5 competitors × 3 calls, parallelised) | Uses `Promise.allSettled` |
| serp-niche-map | Serial API loop | 20–30s (20 keywords × ~1.5s each) | Cannot parallelise (rate limit) |
| verdict-strategy | LLM extended thinking | 30–60s | Thinking budget configurable |
| topical-map | LLM extended thinking | 30–60s | Thinking budget configurable |
| content-article | LLM tool-calling loop | 60–120s | Multiple tool calls |

**Estimated total wall time for a full run:** 6–12 minutes (assuming no approval delays)

---

## Credit Cost per Full Workflow Run (Pulse Credits)

Pulse credits are charged at step completion based on the `credit_cost` field in `.agent.md`:

| Step | Pulse Credits |
|------|--------------|
| business-profile | 50 |
| seed-keywords | 40 |
| site-audit | 60 |
| ai-intelligence | 80 |
| serp-niche-map | 30 |
| competitor-buckets | 40 |
| competitor-metrics | 20 |
| search-demand | 20 |
| phase1-baseline | 50 |
| method01 | 55 |
| method02 | 30 |
| method03 | 20 |
| consolidated-keywords | 80 |
| verdict-strategy | 100 |
| topical-map | 100 |
| content-brief | 25 |
| content-article | 150 |
| content-images | 20 |
| **Total** | **~970 credits/run** |

---

## Performance Audit Checklist Template

- [ ] Recount API calls after any pipeline change and update this document
- [ ] Confirm `Promise.allSettled` is used for parallel competitor API calls (not sequential loop)
- [ ] Verify no new serial loops added that could use parallel execution
- [ ] LLM call count per step matches expected (no runaway tool-calling loops)
- [ ] `thinkingBudget` values for extended-thinking steps are calibrated (not default unlimited)
- [ ] `maxIterations` is set for all `agent-with-tools` steps to prevent infinite loops
