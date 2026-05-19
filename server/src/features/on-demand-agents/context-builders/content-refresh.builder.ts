import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DatabaseService } from '../../../shared/database/database.service';
import { ContextBuilder, ContextBuilderResult } from './context-builder.registry';

@Injectable()
export class ContentRefreshBuilder implements ContextBuilder {
  constructor(private readonly db: DatabaseService) {}

  async build(projectId: string, userPrompt: string): Promise<ContextBuilderResult> {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const oneEightyDaysAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    // Pages with declining performance (recent 90d vs prior 90d)
    const decliningPages = await this.db.db.execute(sql`
      WITH recent AS (
        SELECT page, SUM(clicks) as clicks, AVG(CAST(position AS numeric)) as avg_position
        FROM gsc_keyword_data
        WHERE project_id = ${projectId} AND date >= ${ninetyDaysAgo}
        GROUP BY page
      ),
      historical AS (
        SELECT page, SUM(clicks) as clicks, AVG(CAST(position AS numeric)) as avg_position
        FROM gsc_keyword_data
        WHERE project_id = ${projectId} AND date >= ${oneEightyDaysAgo} AND date < ${ninetyDaysAgo}
        GROUP BY page
      )
      SELECT r.page,
             r.clicks as recent_clicks,
             h.clicks as historical_clicks,
             ROUND(r.avg_position::numeric, 1) as recent_position,
             ROUND(h.avg_position::numeric, 1) as historical_position,
             (h.clicks - r.clicks) as click_loss
      FROM recent r
      JOIN historical h ON r.page = h.page
      WHERE r.clicks < h.clicks
      ORDER BY (h.clicks - r.clicks) DESC
      LIMIT 20
    `);

    // Active decay alerts for this project
    const decayAlerts = await this.db.db.execute(sql`
      SELECT keyword, page, position_delta, severity, current_position, previous_position
      FROM keyword_decay_alerts
      WHERE project_id = ${projectId} AND resolved_at IS NULL
      ORDER BY CAST(position_delta AS numeric) DESC
      LIMIT 15
    `);

    const dataContext = JSON.stringify({ decliningPages: decliningPages.rows, decayAlerts: decayAlerts.rows }, null, 2);

    return {
      systemPrompt: `You are an expert SEO strategist analyzing real performance data for a website. Your job is to identify pages that urgently need a content refresh based on actual traffic and ranking declines.

Rules:
- Be specific: cite page URLs, exact metrics, and percentage changes.
- Prioritize by traffic loss severity.
- Provide actionable refresh recommendations for each page.
- Distinguish between quick wins (title/meta updates, freshness signals) and deep rewrites.
- Never make generic recommendations. Everything must be data-backed.`,
      dataContext: `## User Question
${userPrompt}

## Declining Pages (last 90 days vs previous 90 days)
${dataContext}

Based on this data, provide:
1. Top 5 pages that most urgently need a content refresh (ranked by traffic loss severity)
2. For each page: likely reason for decline and specific refresh recommendations
3. Quick wins vs long-term fixes`,
      summary: `Analyzed ${decliningPages.rows?.length ?? 0} declining pages and ${decayAlerts.rows?.length ?? 0} active decay alerts`,
    };
  }
}
