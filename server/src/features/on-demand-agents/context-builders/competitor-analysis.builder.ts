import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DatabaseService } from '../../../shared/database/database.service';
import { ContextBuilder, ContextBuilderResult } from './context-builder.types';

@Injectable()
export class CompetitorAnalysisBuilder implements ContextBuilder {
  constructor(private readonly db: DatabaseService) {}

  async build(projectId: string, userPrompt: string): Promise<ContextBuilderResult> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Competitor mentions in prompt visibility (where competitors are cited, brand isn't)
    const competitorCitations = await this.db.db.execute(sql`
      SELECT tp.prompt_text, tp.intent_stage, tp.competitors,
             pvr.is_cited as brand_cited, pvr.citation_rank, pvr.llm_engine
      FROM tracked_prompts tp
      JOIN prompt_visibility_results pvr ON pvr.prompt_id = tp.id
      WHERE tp.project_id = ${projectId}
        AND tp.competitors IS NOT NULL
        AND pvr.checked_at >= ${thirtyDaysAgo}
      ORDER BY pvr.checked_at DESC
      LIMIT 30
    `);

    // Top keywords where brand ranks but competitors may outrank
    const sharedKeywords = await this.db.db.execute(sql`
      SELECT query, page, SUM(clicks) as clicks, SUM(impressions) as impressions,
             ROUND(AVG(CAST(position AS numeric)), 1) as avg_position
      FROM gsc_keyword_data
      WHERE project_id = ${projectId} AND date >= ${thirtyDaysAgo}
      GROUP BY query, page
      HAVING AVG(CAST(position AS numeric)) BETWEEN 2 AND 10
      ORDER BY SUM(impressions) DESC
      LIMIT 20
    `);

    const dataContext = JSON.stringify({
      competitorCitations: competitorCitations.rows,
      sharedKeywords: sharedKeywords.rows,
    }, null, 2);

    return {
      systemPrompt: `You are a competitive intelligence analyst who compares a brand's search performance (both traditional and AI) against competitors.

Rules:
- Identify where competitors outperform the brand in AI citations.
- Highlight prompts/keywords where competitive displacement is happening.
- Recommend content strategies to reclaim competitive positions.
- Focus on actionable intelligence, not just observations.
- Consider both Google rankings and AI search visibility.`,
      dataContext: `## User Question
${userPrompt}

## Competitive Intelligence Data
${dataContext}

Provide:
1. Competitive landscape overview (where do competitors appear that we don't)
2. AI search head-to-head: prompts where competitors are cited over our brand
3. Google SERP competition: keywords where we rank 2-10 (close to winning)
4. Content gaps: topics competitors cover that we don't
5. Priority actions to gain competitive advantage`,
      summary: `Analyzed ${competitorCitations.rows?.length ?? 0} competitor citation checks and ${sharedKeywords.rows?.length ?? 0} contested keywords`,
    };
  }
}
