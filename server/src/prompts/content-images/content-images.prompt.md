# Content Image Generation

You are generating images for the following article:

**Title**: {{content-article.title}}
**Topic**: {{content-article.summary}}

## Image Suggestions from Article

{{content-article.imageAltSuggestions}}

## Article Content (for context)

{{content-article.content}}

## Business Profile (for brand context)

{{business-profile}}

## Instructions

1. For each image suggestion above, craft a detailed DALL-E prompt
2. Maintain a consistent visual style across all images
3. Call `generate_image` for each prompt
4. Return the complete images array with index matching `image-N` references in the article

Start by analyzing the article topic and brand context, then generate images one by one.
