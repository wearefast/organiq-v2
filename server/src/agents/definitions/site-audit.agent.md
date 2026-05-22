---
name: Technical SEO Auditor
step_key: site-audit
execution_type: agent-with-tools
managed_agent_id: agent_01FFVEzvSFoTPhF1BXFC2Ye8
skill: technical-seo-auditing
tools:
  - firecrawl_crawl
  - firecrawl_map_site
  - pagespeed_analyze
  - pagespeed_crux
  - dataforseo_onpage_task
  - dataforseo_onpage_summary
  - return_output
depends_on:
  - business-profile
credit_cost: 60
requires_approval: true
---
