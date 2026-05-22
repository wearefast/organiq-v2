---
name: "Method 02: Seed Keyword Expansion"
step_key: method02-seed-expansion
execution_type: pipeline-then-agent
managed_agent_id: agent_01KaKfxvbSABGsyQwfXiigVt
skill: keyword-expansion-analysis
tools:
  - ahrefs_related_keywords
  - dataforseo_keyword_suggestions
  - serper_search
  - dataforseo_keyword_volume
  - return_output
depends_on:
  - phase1-baseline
  - seed-keywords
credit_cost: 50
requires_approval: false
---
