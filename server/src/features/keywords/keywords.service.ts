import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { keywords } from '../../db/schema';

export interface BulkKeywordInput {
  keyword: string;
  volume?: number;
  difficulty?: number;
  cpc?: string;
  intent?: 'transactional' | 'commercial' | 'informational' | 'navigational';
  funnelStage?: 'tofu' | 'mofu' | 'bofu';
  status?: 'discovered' | 'approved' | 'brief_ready' | 'written' | 'published';
  sourceStep?: string;
  parentTopic?: string;
  serpFeatures?: unknown;
}

@Injectable()
export class KeywordsService {
  constructor(private readonly db: DatabaseService) {}

  async findAllByProject(projectId: string) {
    return this.db.db.query.keywords.findMany({
      where: eq(keywords.projectId, projectId),
      orderBy: (k, { desc }) => [desc(k.createdAt)],
    });
  }

  async findByProjectAndStatus(projectId: string, status: string) {
    return this.db.db.query.keywords.findMany({
      where: and(
        eq(keywords.projectId, projectId),
        eq(keywords.status, status as any),
      ),
      orderBy: (k, { desc }) => [desc(k.volume)],
    });
  }

  async findById(id: string, projectId: string) {
    const keyword = await this.db.db.query.keywords.findFirst({
      where: and(eq(keywords.id, id), eq(keywords.projectId, projectId)),
    });
    if (!keyword) throw new NotFoundException('Keyword not found');
    return keyword;
  }

  async bulkUpsert(
    projectId: string,
    workflowRunId: string | null,
    items: BulkKeywordInput[],
  ) {
    if (items.length === 0) return { inserted: 0, updated: 0 };

    const values = items.map((item) => ({
      projectId,
      workflowRunId,
      keyword: item.keyword,
      volume: item.volume ?? null,
      difficulty: item.difficulty ?? null,
      cpc: item.cpc ?? null,
      intent: item.intent ?? null,
      funnelStage: item.funnelStage ?? null,
      status: item.status ?? ('discovered' as const),
      sourceStep: item.sourceStep ?? null,
      parentTopic: item.parentTopic ?? null,
      serpFeatures: item.serpFeatures ?? null,
    }));

    // Upsert: on conflict (projectId, keyword), update metrics
    const result = await this.db.db
      .insert(keywords)
      .values(values)
      .onConflictDoUpdate({
        target: [keywords.projectId, keywords.keyword],
        set: {
          volume: sql`EXCLUDED.volume`,
          difficulty: sql`EXCLUDED.difficulty`,
          cpc: sql`EXCLUDED.cpc`,
          intent: sql`EXCLUDED.intent`,
          funnelStage: sql`EXCLUDED.funnel_stage`,
          sourceStep: sql`EXCLUDED.source_step`,
          parentTopic: sql`EXCLUDED.parent_topic`,
          serpFeatures: sql`EXCLUDED.serp_features`,
          workflowRunId: sql`EXCLUDED.workflow_run_id`,
          updatedAt: new Date(),
        },
      })
      .returning();

    return { inserted: result.length, updated: 0 };
  }

  async updateStatus(
    projectId: string,
    keywordIds: string[],
    status: 'discovered' | 'approved' | 'brief_ready' | 'written' | 'published',
  ) {
    if (keywordIds.length === 0) return [];

    return this.db.db
      .update(keywords)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(keywords.projectId, projectId),
          inArray(keywords.id, keywordIds),
        ),
      )
      .returning();
  }

  async remove(id: string, projectId: string) {
    const [deleted] = await this.db.db
      .delete(keywords)
      .where(and(eq(keywords.id, id), eq(keywords.projectId, projectId)))
      .returning();
    if (!deleted) throw new NotFoundException('Keyword not found');
    return deleted;
  }

  async getStats(projectId: string) {
    const all = await this.db.db.query.keywords.findMany({
      where: eq(keywords.projectId, projectId),
    });

    const byStatus: Record<string, number> = {};
    const byIntent: Record<string, number> = {};
    const byFunnel: Record<string, number> = {};
    let totalVolume = 0;

    for (const kw of all) {
      byStatus[kw.status] = (byStatus[kw.status] || 0) + 1;
      if (kw.intent) byIntent[kw.intent] = (byIntent[kw.intent] || 0) + 1;
      if (kw.funnelStage) byFunnel[kw.funnelStage] = (byFunnel[kw.funnelStage] || 0) + 1;
      totalVolume += kw.volume ?? 0;
    }

    return {
      total: all.length,
      totalVolume,
      byStatus,
      byIntent,
      byFunnel,
    };
  }
}
