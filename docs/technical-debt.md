# Technical Debt

> Discoveries during development that need revisiting later.
> Add items here instead of scope-creeping the current task.
> Items marked ✅ have been resolved — kept for historical reference.

---

| # | Category | Description | Discovered During | Priority | Status |
|---|----------|-------------|-------------------|----------|--------|
| 1 | Storage | `reports.filePath` stores base64 PDF data directly instead of an S3/file path — unbounded row size | Reports feature implementation | High | Open |
| 2 | Testing | No automated tests for agent runtime execution loop, tool sandbox, or output validator | Phase B implementation | High | Open |
| 3 | ~~Integration stubs~~ | ~~Serper, Ahrefs, DataForSEO, Firecrawl, PageSpeed, GSC integration services are stubs~~ | CTO audit | ~~High~~ | ✅ Resolved |
| 4 | ~~Audit feature~~ | ~~`server/src/features/audit/` directory is empty~~ | OS-version1 rewrite | ~~Medium~~ | ✅ Resolved (LLM audit) |
| 5 | ~~Frontend features~~ | ~~Content and Reports features have services layer but no UI components~~ | Phase D–E implementation | ~~Medium~~ | ✅ Resolved |
| 6 | Agent branching | Agent definitions don't support conditional branching logic (if/else); all steps are linear with dependency gates | Agent system design | Low | Open |
| 7 | Artifact size | `step_artifacts.data` is unbounded JSONB — no compression or size limits on large payloads | Schema design | Medium | Open |
| 8 | Rate limiting | No API rate limiting on any endpoints | Security review | Medium | Open |
| 9 | JSONB schemas | `workflow_context.value` and `step_artifacts.data` have no documented/enforced JSONB shape per step key | Schema design | Low | Open |
| 10 | Archival | No archival or retention strategy for old workflow runs, step artifacts, or tool call logs | Schema design | Low | Open |
| 11 | Cascade deletes | Deletion cascade rules not documented — what happens when a project or workspace is deleted? | Data model review | Medium | Open |
| 12 | ~~Credit purchase~~ | ~~No Stripe/payment integration for credit purchases~~ | Phase A implementation | ~~High~~ | ✅ Resolved (Stripe billing) |
| 13 | LLM traffic CORS | `POST /llm-traffic/ingest` cross-origin ingest needs per-project `allowedOrigins[]` or permissive CORS on `/ingest` endpoint | CTO audit / CORS lockdown | High | Open |
| 14 | Auth/Authz | `POST /workflows` accepts `organizationId` from request body — should derive from authenticated claim (`req.org.id`) to prevent credit theft via spoofed org ID | Phase 3 CTO review | High | Open |
| 15 | Performance | Workflow processor fetches `workflowRuns` and `workflowSteps` in two separate queries — could be combined into a single join | Phase 3 CTO review | Low | Open |
| 16 | Deprecated fields | `tier` and `managedAgentId` fields in agent.registry.ts / prompt.service.ts are `@deprecated` — remove once all .agent.md files use `executionType` | Codebase audit May 2026 | Low | Open |
