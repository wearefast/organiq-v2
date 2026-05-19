import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DatabaseService } from '../../../shared/database/database.service';
import { ContextBuilder, ContextBuilderResult } from './context-builder.registry';

@Injectable()
export class KeywordDecayBuilder implements ContextBuilder {
  constructor(private readonly db: DatabaseService) {}

  async build(projectId: string, userPrompt: string): Promise<ContextBuilderResult> {
    // Active decay alerts
    const alerts = await this.db.db.execute(sql`
      SELECT keyword, page, severity, previous_position, current_position,
             position_delta, previous_clicks, current_clicks, detected_at
      FROM keyword_decay_alerts
      WHERE project_id = ${projectId} AND resolved_at IS NULL
      ORDER BY
        CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        CAST(position_delta AS numeric) DESC
      LIMIT 25
    `);

    // Summary stats
    const stats = await this.db.db.execute(sql`
      SELECT severity, COUNT(*) as count
      FROM keyword_decay_alerts
      WHERE project_id = ${projectId} AND resolved_at IS NULL
      GROUP BY severity
    `);

    const dataContext = JSON.stringify({ alerts: alerts.rows, stats: stats.rows }, null, 2);

    return {
      systemPrompt: `You are an SEO monitoring expert who analyzes keyword ranking declines to identify urgent issues and recovery strategies.

Rules:
- Group decay alerts by severity and root cause pattern.
- Identify if declines are isolated or part of a broader trend.
- Suggest specific recovery actions for each declining keyword.
- Distinguish between algorithm-related drops and content/technical issues.
- Prioritize by traffic impact (clicks lost) not just position change.`,
      dataContext: `## User Question
${userPrompt}

## Active Keyword Decay Alerts
${dataContext}

Provide:
1. Summary: how many keywords are declining and severity breakdown
2. Pattern analysis: are drops clustered by page, topic, or timeframe?
3. Top 5 most urgent keywords to address (by traffic impact)
4. For each: likely cause and specific recovery strategy
5. Overall health assessment and recommended next steps`,
      summary: `Analyzed ${alerts.rows?.length ?? 0} active decay alerts across ${stats.rows?.length ?? 0} severity levels`,
    };
  }
}
