# Content Length Adequacy Rubric

## Score: 0-100

Based on SERP analysis of top-10 results for the target keyword.

### Formula
```
target_length = median(top_10_word_counts) × 1.1
adequacy = min(100, (actual_length / target_length) × 100)
```

### Minimum Thresholds by Content Type
| Content Type | Minimum Words | Target Range |
|-------------|--------------|--------------|
| Pillar page | 2,500 | 3,000-5,000 |
| Cluster page | 1,500 | 1,800-3,000 |
| Supporting article | 800 | 1,000-2,000 |
| Product page | 300 | 500-1,000 |
| FAQ page | 500 | 800-1,500 |
| How-to guide | 1,200 | 1,500-3,000 |
| Comparison page | 1,000 | 1,500-2,500 |
| Glossary entry | 200 | 300-600 |

### Scoring Adjustment
- +10 bonus if content includes unique data/research
- +5 bonus if content includes custom visuals/diagrams
- -10 penalty if content is mostly filler/fluff
- -20 penalty if content is significantly shorter than SERP median
