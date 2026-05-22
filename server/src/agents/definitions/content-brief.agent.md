---
name: Content Brief Strategist
step_key: content-brief
execution_type: pipeline-then-agent
managed_agent_id: agent_01EBKZVfY1LApsMUT3Dc948o
skill: content-brief-creation
tools:
  - serper_search
  - firecrawl_scrape
  - return_output
depends_on:
  - topical-map
credit_cost: 25
requires_approval: true
---
