# Audit Feature

## Overview

The audit module has two distinct aspects:

1. **Workflow Step 3 (`site-audit`)** — A GEO+SEO technical audit run as part of the 18-step workflow pipeline
2. **LLM Audit (`llm-audit`)** — A standalone feature that audits pages for AI bot indexability, content checks, and trust signals

## Workflow Step: Site Audit (Step 3)

Site-audit capabilities run as **Step 3** of the workflow pipeline via the `site-audit` agent.

| Aspect | Details |
|--------|---------|
| Agent file | `server/src/agents/definitions/site-audit.agent.md` |
| Execution type | `agent-with-tools` |
| Managed agent ID | `agent_01FFVEzvSFoTPhF1BXFC2Ye8` |
| Tools | firecrawl_crawl, firecrawl_map_site, pagespeed_analyze, pagespeed_crux, dataforseo_onpage_task, dataforseo_onpage_summary, return_output |
| Depends on | `business-profile` (Step 1) |
| Credit cost | 60 |
| Requires approval | Yes |

## LLM Audit Feature

Standalone service that audits project pages for AI engine discoverability.

### Key Files

| File | Purpose |
|------|---------|
| `server/src/features/audit/llm-audit.controller.ts` | REST endpoints |
| `server/src/features/audit/llm-audit.service.ts` | Audit logic |
| `server/src/features/audit/llm-audit.module.ts` | Module registration |

### Data Model

**Table: `llm_audit_results`**

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | PK |
| project_id | uuid | FK → projects |
| audit_run_id | text | Groups pages in a single audit run |
| page_url | text | Audited page URL |
| ai_indexability_score | integer | 0-100 score |
| bot_permissions | jsonb | Robot.txt/meta robot analysis |
| content_checks | jsonb | Content structure analysis |
| trust_signals | jsonb | Authority/trust indicators |
| content_chunking | jsonb | How content is chunked for LLMs |
| issues | jsonb | Array of detected issues |
| audited_at | timestamp | When the audit was performed |

### What It Checks

- **AI Indexability**: Whether AI bots can access and understand the page
- **Bot Permissions**: robots.txt rules, meta robots tags, X-Robots headers
- **Content Checks**: Structure, readability, schema markup presence
- **Trust Signals**: Author attribution, citations, freshness signals
- **Content Chunking**: How well content segments for LLM retrieval
