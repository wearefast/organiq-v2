# Keyword Opportunity Scoring Formula

## Score: 0-100

### Formula
```
opportunity = (volume_score × 0.30) + (difficulty_score × 0.25) + (relevance_score × 0.25) + (intent_value × 0.20)
```

### Volume Score (0-100)
| Monthly Volume | Score |
|----------------|-------|
| 10,000+ | 100 |
| 5,000-9,999 | 85 |
| 1,000-4,999 | 70 |
| 500-999 | 55 |
| 100-499 | 40 |
| 50-99 | 25 |
| 0-49 | 10 |

### Difficulty Score (inverted, 0-100)
```
difficulty_score = 100 - keyword_difficulty
```

### Relevance Score (0-100)
| Relevance | Score | Criteria |
|-----------|-------|----------|
| Core | 100 | Directly describes primary product/service |
| High | 80 | Closely related to business offering |
| Medium | 60 | Tangentially related, informational |
| Low | 40 | Loosely related, top-of-funnel |
| Minimal | 20 | Barely related but high volume |

### Intent Value (0-100)
| Intent | Score |
|--------|-------|
| Transactional | 100 |
| Commercial | 80 |
| Navigational | 50 |
| Informational | 30 |
