---
name: Phase 1 Keyword Baseline
step_key: phase1-baseline
execution_type: pipeline-then-agent
managed_agent_id: agent_011feQK3Y7U7B9agm3qJYsHJ
skill: baseline-assessment
tools:
  - ahrefs_organic_keywords
  - ahrefs_keyword_difficulty
  - dataforseo_serp
  - return_output
depends_on:
  - seed-keywords
  - site-audit
  - competitor-metrics
  - search-demand
credit_cost: 45
requires_approval: true
---
