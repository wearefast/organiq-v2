# Technical Debt

> Discoveries during development that need revisiting later.
> Add items here instead of scope-creeping the current task.

---

| # | Category | Description | Discovered During | Priority |
|---|----------|-------------|-------------------|----------|
| 1 | Storage | `reports.filePath` stores base64 PDF data directly instead of an S3/file path — unbounded row size | Reports feature implementation | High |
| 2 | Testing | No automated tests for agent runtime execution loop, tool sandbox, or output validator | Phase B implementation | High |
| 3 | Integration stubs | Serper, Ahrefs, DataForSEO, Firecrawl, PageSpeed, GSC integration services have method signatures but most are stubs (only OpenAI is fully implemented) | CTO audit | High |
| 4 | Audit feature | `server/src/features/audit/` directory is empty — standalone audit feature removed in v2 rewrite, not replaced | OS-version1 rewrite | Medium |
| 5 | Frontend features | Content and Reports features have services layer but no UI components built yet | Phase D–E implementation | Medium |
| 6 | Agent branching | Agent definitions don't support conditional branching logic (if/else); all steps are linear with dependency gates | Agent system design | Low |
| 7 | Artifact size | `step_artifacts.data` is unbounded JSONB — no compression or size limits on large payloads | Schema design | Medium |
| 8 | Rate limiting | No API rate limiting on any endpoints | Security review | Medium |
| 9 | JSONB schemas | `workflow_context.value` and `step_artifacts.data` have no documented/enforced JSONB shape per step key | Schema design | Low |
| 10 | Archival | No archival or retention strategy for old workflow runs, step artifacts, or tool call logs | Schema design | Low |
| 11 | Cascade deletes | Deletion cascade rules not documented — what happens when a project or workspace is deleted? | Data model review | Medium |
| 12 | Credit purchase | No Stripe/payment integration for credit purchases — `POST /credits/purchase` exists but no payment gateway | Phase A implementation | High |
| 13 | LLM traffic CORS | `POST /llm-traffic/ingest` is called via `navigator.sendBeacon` from customer sites (cross-origin). Current CORS policy only allows `FRONTEND_URL`. Needs either: (a) a dedicated `/ingest` endpoint registered with permissive CORS and no auth requirement, or (b) a per-project `allowedOrigins[]` allowlist stored in the projects table. Without this, cross-origin ingest events from customer domains are blocked in production. | CTO audit / CORS lockdown | High |
