---
name: Search Demand Analyst
step_key: search-demand
execution_type: pipeline-only
tools:
  - ahrefs_keyword_volume
  - ahrefs_keyword_difficulty
  - dataforseo_keyword_volume
  - dataforseo_keyword_difficulty
depends_on:
  - seed-keywords
credit_cost: 50
requires_approval: false
---
