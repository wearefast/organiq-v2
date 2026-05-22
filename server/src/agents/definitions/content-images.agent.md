---
name: Content Image Generator
step_key: content-images
execution_type: agent-with-tools
managed_agent_id: agent_01TmVScXTpwFk4Y4yTHYQdDF
skill: content-image-generation
tools:
  - generate_image
  - return_output
depends_on:
  - content-article
credit_cost: 25
requires_approval: true
---
