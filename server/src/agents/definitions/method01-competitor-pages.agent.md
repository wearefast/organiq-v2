---
name: "Method 01: Competitor Page Analysis"
step_key: method01-competitor-pages
execution_type: pipeline-then-agent
managed_agent_id: agent_01ETXt112yghvEPojFrm9FbH
skill: competitor-page-analysis
tools:
  - ahrefs_organic_pages
  - ahrefs_organic_keywords
  - ahrefs_competing_domains
  - dataforseo_serp
  - serper_search
  - return_output
depends_on:
  - phase1-baseline
  - competitor-metrics
credit_cost: 55
requires_approval: false
---
