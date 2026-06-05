import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DatabaseService } from '../../../shared/database/database.service';
import { ContextBuilder, ContextBuilderResult } from './context-builder.types';

@Injectable()
export class KeywordOpportunityBuilder implements ContextBuilder {
  constructor(private readonly db: DatabaseService) {}

  async build(projectId: string, userPrompt: string): Promise<ContextBuilderResult> {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // High impressions, low CTR keywords (opportunity)
    const highImpressionLowCtr = await this.db.db.execute(sql`
      SELECT query, page, SUM(impressions) as total_impressions,
             SUM(clicks) as total_clicks,
             ROUND(AVG(CAST(ctr AS numeric)) * 100, 2) as avg_ctr_pct,
             ROUND(AVG(CAST(position AS numeric)), 1) as avg_position
      FROM gsc_keyword_data
      WHERE project_id = ${projectId} AND date >= ${ninetyDaysAgo}
      GROUP BY query, page
      HAVING SUM(impressions) > 100 AND AVG(CAST(ctr AS numeric)) < 0.03
      ORDER BY SUM(impressions) DESC
      LIMIT 20
    `);

    // Prompts where brand is not cited (content gaps)
    const missedPrompts = await this.db.db.execute(sql`
      SELECT tp.prompt_text, tp.intent_stage
      FROM tracked_prompts tp
      LEFT JOIN prompt_visibility_results pvr ON pvr.prompt_id = tp.id AND pvr.is_cited = true
      WHERE tp.project_id = ${projectId} AND pvr.id IS NULL
      LIMIT 15
    `);

    const dataContext = JSON.stringify({
      highImpressionLowCtr: highImpressionLowCtr.rows,
      missedPrompts: missedPrompts.rows,
    }, null, 2);

    return {
      systemPrompt: `You are a content strategist who identifies high-impact content opportunities based on search performance data and AI visibility gaps.

Rules:
- Focus on opportunities with highest potential ROI (high impressions = high demand).
- Consider both traditional and AI search opportunities.
- Recommend specific content topics, not vague suggestions.
- Estimate potential traffic gain for each recommendation.
- Prioritize by effort vs impact ratio.`,
      dataContext: `## User Question
${userPrompt}

## Keyword & Content Opportunities
${dataContext}

Provide:
1. Top 5 content pieces to create (ranked by estimated traffic impact)
2. For each: target keyword/topic, recommended content type, estimated monthly search volume opportunity
3. Quick-win optimizations for existing pages (improve CTR with title/meta changes)
4. AI search gaps that new content could fill
5. Suggested content calendar priority order`,
      summary: `Found ${highImpressionLowCtr.rows?.length ?? 0} high-impression low-CTR opportunities and ${missedPrompts.rows?.length ?? 0} AI visibility gaps`,
    };
  }
}
