---
name: Competitor Bucket Classifier
step_key: competitor-buckets
execution_type: pipeline-then-agent
managed_agent_id: agent_016q4DrPJUmNf3yK3RGEzaFP
skill: competitor-classification
tools:
  - ahrefs_competing_domains
  - serper_search
  - firecrawl_scrape
  - return_output
depends_on:
  - serp-niche-map
credit_cost: 35
requires_approval: false
---
