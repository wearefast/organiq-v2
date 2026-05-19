import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DatabaseService } from '../../../shared/database/database.service';
import { ContextBuilder, ContextBuilderResult } from './context-builder.registry';

@Injectable()
export class GoogleVsAiBuilder implements ContextBuilder {
  constructor(private readonly db: DatabaseService) {}

  async build(projectId: string, userPrompt: string): Promise<ContextBuilderResult> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    // GSC traffic (Google organic)
    const gscTraffic = await this.db.db.execute(sql`
      SELECT date::text, SUM(clicks) as total_clicks, SUM(impressions) as total_impressions
      FROM gsc_keyword_data
      WHERE project_id = ${projectId} AND date >= ${sixtyDaysAgo}
      GROUP BY date
      ORDER BY date DESC
    `);

    // AI traffic by engine
    const aiTraffic = await this.db.db.execute(sql`
      SELECT engine, date::text, sessions
      FROM llm_traffic_stats
      WHERE project_id = ${projectId} AND date >= ${sixtyDaysAgo}
      ORDER BY date DESC
    `);

    // AI sessions recent vs prior period
    const aiRecent = await this.db.db.execute(sql`
      SELECT engine, COUNT(*) as sessions
      FROM llm_traffic_sessions
      WHERE project_id = ${projectId} AND created_at >= ${thirtyDaysAgo}
      GROUP BY engine
    `);

    const aiPrior = await this.db.db.execute(sql`
      SELECT engine, COUNT(*) as sessions
      FROM llm_traffic_sessions
      WHERE project_id = ${projectId} AND created_at >= ${sixtyDaysAgo} AND created_at < ${thirtyDaysAgo}
      GROUP BY engine
    `);

    const dataContext = JSON.stringify({
      gscTraffic: gscTraffic.rows,
      aiTraffic: aiTraffic.rows,
      aiRecent: aiRecent.rows,
      aiPrior: aiPrior.rows,
    }, null, 2);

    return {
      systemPrompt: `You are a traffic analytics expert who compares traditional Google search performance against AI-driven search traffic.

Rules:
- Provide clear, data-backed comparison between the two channels.
- Show trends (is AI traffic growing while Google is flat/declining?).
- Identify which pages/topics get AI traffic vs Google traffic.
- Make strategic recommendations about where to invest content effort.
- Use percentages and growth rates, not just absolute numbers.`,
      dataContext: `## User Question
${userPrompt}

## Google vs AI Search Traffic Data (last 60 days)
${dataContext}

Provide:
1. Side-by-side traffic comparison (Google organic vs AI search engines)
2. Growth trends for each channel (30d vs prior 30d)
3. Which content types perform better in which channel
4. Top pages by AI traffic vs top pages by Google traffic
5. Strategic recommendation: where to focus content investment`,
      summary: `Compared ${gscTraffic.rows?.length ?? 0} days of Google data vs ${aiTraffic.rows?.length ?? 0} AI traffic data points`,
    };
  }
}
