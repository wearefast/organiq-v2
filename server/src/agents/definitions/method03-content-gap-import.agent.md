---
name: "Method 03: Content Gap Import"
step_key: method03-content-gap-import
execution_type: pipeline-then-agent
managed_agent_id: agent_01Rhf6ozEN9wWD5J89Bt9Su1
skill: content-gap-analysis
tools:
  - dataforseo_keyword_volume
  - ahrefs_keyword_difficulty
  - return_output
depends_on:
  - phase1-baseline
  - method01-competitor-pages
  - method02-seed-expansion
credit_cost: 30
requires_approval: true
---
