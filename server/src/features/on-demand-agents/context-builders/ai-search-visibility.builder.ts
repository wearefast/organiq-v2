import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DatabaseService } from '../../../shared/database/database.service';
import { ContextBuilder, ContextBuilderResult } from './context-builder.registry';

@Injectable()
export class AiSearchVisibilityBuilder implements ContextBuilder {
  constructor(private readonly db: DatabaseService) {}

  async build(projectId: string, userPrompt: string): Promise<ContextBuilderResult> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Prompt visibility results
    const visibilityResults = await this.db.db.execute(sql`
      SELECT tp.prompt_text, tp.intent_stage, pvr.is_cited, pvr.citation_rank,
             pvr.llm_engine, pvr.brand_mentioned, pvr.checked_at
      FROM prompt_visibility_results pvr
      JOIN tracked_prompts tp ON pvr.prompt_id = tp.id
      WHERE pvr.project_id = ${projectId} AND pvr.checked_at >= ${thirtyDaysAgo}
      ORDER BY pvr.checked_at DESC
      LIMIT 50
    `);

    // LLM traffic stats
    const trafficStats = await this.db.db.execute(sql`
      SELECT engine, date, sessions, top_pages
      FROM llm_traffic_stats
      WHERE project_id = ${projectId} AND date >= ${thirtyDaysAgo}
      ORDER BY date DESC
      LIMIT 30
    `);

    // Total sessions by engine
    const sessionsByEngine = await this.db.db.execute(sql`
      SELECT engine, COUNT(*) as session_count
      FROM llm_traffic_sessions
      WHERE project_id = ${projectId} AND created_at >= ${thirtyDaysAgo}
      GROUP BY engine
    `);

    const dataContext = JSON.stringify({
      visibilityResults: visibilityResults.rows,
      trafficStats: trafficStats.rows,
      sessionsByEngine: sessionsByEngine.rows,
    }, null, 2);

    return {
      systemPrompt: `You are an AI search visibility expert who analyzes how brands appear in LLM-powered search engines (ChatGPT, Perplexity, Google AI Overviews, etc.).

Rules:
- Calculate a visibility score (% of tracked prompts where the brand is cited).
- Identify prompts where the brand appears vs where it's missing.
- Compare performance across different AI engines.
- Provide actionable recommendations to improve AI search visibility.
- Reference specific prompts and metrics from the data.`,
      dataContext: `## User Question
${userPrompt}

## AI Search Visibility Data (last 30 days)
${dataContext}

Provide:
1. Overall AI visibility score and trend
2. Top prompts where brand appears (with citation ranks)
3. Missed opportunities (prompts where brand should appear but doesn't)
4. Engine-by-engine breakdown
5. Recommendations to improve visibility`,
      summary: `Analyzed ${visibilityResults.rows?.length ?? 0} visibility checks and ${sessionsByEngine.rows?.length ?? 0} AI traffic sources`,
    };
  }
}
