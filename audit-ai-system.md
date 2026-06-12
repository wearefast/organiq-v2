# AI Multi-Agent System Deep Audit Prompt

You are acting as an elite **AI Systems Architect, Staff Engineer, Prompt Engineer, Agentic Systems Expert, Reliability Engineer, and Code Reviewer**.

Your task is to conduct an **extremely deep, production-grade audit** of this entire codebase.

This is an **AI-native system** that includes:

* Multiple AI agents
* Skills/tools
* Prompt chains
* Context orchestration
* Memory management
* API integrations
* Agent-to-agent communication
* Structured outputs
* Frontend/backend contracts
* LLM tool calling
* Workflow orchestration
* Async jobs
* State management

You must think like a:

* OpenAI / Anthropic AI systems engineer
* Principal distributed systems architect
* Production reliability engineer
* Agentic workflow specialist
* Prompt engineering expert
* Security auditor
* Performance engineer

Your goal is to identify:

1. Broken architecture
2. Hidden bugs
3. Context leakage
4. Prompt failures
5. Agent orchestration issues
6. Redundant API/tool calls
7. Token waste
8. Poor memory/context passing
9. Hallucination risks
10. Schema mismatches
11. Frontend/backend contract issues
12. Performance bottlenecks
13. Reliability failures
14. Maintainability problems
15. Scalability blockers

---

# Phase 1: Understand Entire Architecture

First, deeply understand the entire system before making recommendations.

Create an architecture map including:

## AI Layer

* All agents
* Agent responsibilities
* Agent hierarchy
* Supervisor patterns
* Routing logic
* Skills
* Prompt ownership
* Tool ownership
* Shared context
* Memory system

## Prompt Layer

Audit every prompt:

* System prompts
* Agent prompts
* Tool prompts
* Skill prompts
* Evaluation prompts
* Extraction prompts
* Routing prompts
* Planning prompts

For each prompt identify:

* Objective clarity
* Ambiguity
* Contradictions
* Missing instructions
* Prompt injection vulnerabilities
* Overly long prompts
* Repeated context
* Missing output formatting
* Hallucination risk
* Weak guardrails
* Poor deterministic behavior

Identify prompts likely to produce:

* inconsistent outputs
* invalid JSON
* frontend-breaking responses
* unexpected tool calls
* over-reasoning
* under-reasoning
* context loss

---

# Phase 2: Agentic Architecture Audit

Create a detailed map of:

## Agent Flows

For each agent answer:

1. What context does it receive?
2. Where does context come from?
3. Is context complete?
4. Is context duplicated?
5. Is unnecessary context passed?
6. What tools can it call?
7. Are tool permissions excessive?
8. Are tools called multiple times unnecessarily?
9. Can tool responses be cached?
10. Is there retry logic?
11. Is fallback logic implemented?
12. Does it return structured outputs?
13. Is schema validation enforced?
14. Does downstream code assume a response format that is not guaranteed?

Identify:

### Context Problems

* missing context
* stale context
* duplicated context
* bloated context windows
* conflicting context
* context drift
* agent forgetting critical instructions

### Tool Problems

* duplicate tool calls
* same API called repeatedly
* unnecessary sequential execution
* non-parallelized calls
* expensive operations repeated
* no caching
* redundant embeddings
* duplicate retrieval

### Orchestration Problems

* agent loops
* circular dependencies
* fragile routing logic
* hidden dead ends
* race conditions
* bad retries
* silent failures
* missing observability

---

# Phase 3: API & Tool Audit

Audit every API/tool integration.

For each tool/API evaluate:

## Input Validation

* invalid params possible?
* schema validation?
* missing sanitization?
* edge case handling?

## Output Contract

* guaranteed schema?
* nullable handling?
* malformed response handling?
* timeout handling?
* retry handling?

## Efficiency

Find:

* duplicate API calls
* unnecessary calls
* expensive repeated calls
* sequential calls that should be parallel
* missing memoization
* redundant fetches

Suggest exact optimizations.

Generate a table:

| Tool/API | Problem | Severity | Root Cause | Recommendation |

---

# Phase 4: Context Engineering Audit

Deeply audit how context moves across the system.

Investigate:

## Context Passing

* Is the right context passed to the right agent?
* Are agents missing critical state?
* Is context repeated excessively?
* Are irrelevant logs/history included?

## Token Efficiency

Estimate:

* wasted tokens
* duplicated prompt sections
* repeated system instructions
* unnecessary chain-of-thought exposure
* bloated retrieval

Suggest concrete token savings.

Target:

* lower cost
* faster latency
* higher determinism

---

# Phase 5: Prompt + Output Reliability

Check every LLM interaction for:

## Structured Output Risks

Find places where:

* frontend expects strict JSON
* model can break schema
* invalid enums possible
* missing keys possible
* inconsistent formatting possible

Recommend:

* Zod/Pydantic schemas
* JSON schema enforcement
* response validators
* repair strategies
* fallback prompts

Highlight all fragile prompt areas.

---

# Phase 6: Frontend Contract Audit

Trace data flow from:

LLM → agent → orchestration → API → backend → frontend

Find mismatches such as:

* frontend expects field not guaranteed
* nullable data not handled
* response shape mismatch
* inconsistent naming
* missing loading states
* missing error handling
* streaming issues

Generate:

| Endpoint/Agent | Frontend Expectation | Actual Output Risk | Severity |

---

# Phase 7: Performance & Cost Audit

Find:

## Latency Issues

* unnecessary sequential LLM calls
* blocking operations
* repeated retrieval
* over-agentization
* excessive orchestration

## Cost Problems

* wasted tokens
* redundant prompts
* duplicate embeddings
* duplicate API calls
* expensive model misuse

Recommend:

* model downgrades where safe
* caching
* batching
* context compression
* retrieval improvements
* orchestration simplification

Estimate cost savings.

---

# Phase 8: Security & Safety Audit

Check for:

## Prompt Injection Risks

* tool hijacking
* instruction overriding
* malicious retrieval poisoning
* user prompt contamination

## Secrets & Security

* hardcoded API keys
* leaked env vars
* insecure logging
* exposed PII
* auth weaknesses

---

# Phase 9: Code Quality Audit

Find:

* dead code
* stale prompts
* duplicate prompts
* abandoned agents
* temp scripts
* debug code
* unused APIs
* duplicated utilities
* anti-patterns
* technical debt

Highlight:

* files safe to delete
* suspicious logic
* overly complex abstractions

---

# Phase 10: Deliverables

Generate a production-grade audit report with:

## 1. Executive Summary

Top 20 problems ranked by severity.

## 2. Architecture Diagram

Text-based architecture map.

## 3. Agent-by-Agent Audit

For every agent include:

* role
* inputs
* outputs
* tools
* risks
* inefficiencies
* recommendations

## 4. Prompt Audit

List every weak prompt with fixes.

## 5. API/Tool Audit

Optimization opportunities.

## 6. Reliability Risks

What will fail in production.

## 7. Cost Optimization Report

Estimated savings.

## 8. Security Findings

## 9. Dead Code Report

## 10. Prioritized Action Plan

Categorize into:

### Critical (fix immediately)

### High Priority

### Medium Priority

### Nice to Have

For every recommendation include:

* Why this matters
* Exact code location
* Root cause
* Proposed fix
* Example implementation

---

Important instructions:

1. Do NOT give shallow feedback.
2. Do NOT assume architecture correctness.
3. Challenge all design decisions.
4. Trace data end-to-end.
5. Follow context through every layer.
6. Be skeptical.
7. Find hidden failure points.
8. Read the entire codebase before conclusions.
9. Show exact file names and code snippets.
10. If uncertain, investigate further instead of assuming.

Your standard should be: “Would this survive millions of production requests?”
