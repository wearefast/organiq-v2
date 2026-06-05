import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DatabaseService } from '../../../shared/database/database.service';
import { ContextBuilder, ContextBuilderResult } from './context-builder.types';

@Injectable()
export class TechnicalIssuesBuilder implements ContextBuilder {
  constructor(private readonly db: DatabaseService) {}

  async build(projectId: string, userPrompt: string): Promise<ContextBuilderResult> {
    // Latest LLM audit results
    const auditResults = await this.db.db.execute(sql`
      SELECT page_url, ai_indexability_score, bot_permissions, content_checks,
             trust_signals, issues, audited_at
      FROM llm_audit_results
      WHERE project_id = ${projectId}
      ORDER BY audited_at DESC
      LIMIT 20
    `);

    const dataContext = JSON.stringify({ auditResults: auditResults.rows }, null, 2);

    return {
      systemPrompt: `You are a technical SEO and AI-readiness expert who analyzes website audit results to identify critical technical issues.

Rules:
- Prioritize issues by severity and potential traffic impact.
- Group issues into categories (crawlability, AI indexability, performance, security).
- For each issue, provide: severity level, affected pages, specific fix instructions.
- Distinguish between quick fixes and structural problems.
- Focus on issues that affect both traditional and AI search engines.`,
      dataContext: `## User Question
${userPrompt}

## Technical Audit Results (latest run)
${dataContext}

Provide:
1. Critical issues (must fix immediately)
2. High-priority issues (fix within a week)
3. Medium-priority issues (plan for next sprint)
4. For each: affected pages, root cause, and step-by-step fix instructions
5. Overall site health score estimate`,
      summary: `Analyzed ${auditResults.rows?.length ?? 0} page audit results`,
    };
  }
}
