---
name: Content Image Generator
step_key: content-images
execution_type: agent-with-tools
skill: content-image-generation
tools:
  - generate_image
depends_on:
  - content-article
credit_cost: 25
requires_approval: true
---
