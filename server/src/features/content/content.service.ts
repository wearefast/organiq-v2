import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, sql, desc } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { contentPieces, contentImages } from '../../db/schema';
import { TopicalMapsService } from '../topical-maps/topical-maps.service';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly topicalMapsService: TopicalMapsService,
  ) {}

  async findAllByProject(projectId: string) {
    return this.db.db.query.contentPieces.findMany({
      where: eq(contentPieces.projectId, projectId),
      orderBy: (c, { desc: d }) => [d(c.createdAt)],
    });
  }

  async findById(id: string, projectId: string) {
    const piece = await this.db.db.query.contentPieces.findFirst({
      where: and(eq(contentPieces.id, id), eq(contentPieces.projectId, projectId)),
    });
    if (!piece) throw new NotFoundException('Content piece not found');
    return piece;
  }

  async findByWorkflowRun(workflowRunId: string) {
    return this.db.db.query.contentPieces.findMany({
      where: eq(contentPieces.workflowRunId, workflowRunId),
      orderBy: (c, { desc: d }) => [d(c.createdAt)],
    });
  }

  async create(input: {
    projectId: string;
    workflowRunId?: string;
    keywordId?: string;
    type: 'brief' | 'article';
    title: string;
    briefData?: unknown;
    articleData?: unknown;
    scores?: unknown;
    wordCount?: number;
  }) {
    const [piece] = await this.db.db
      .insert(contentPieces)
      .values({
        projectId: input.projectId,
        workflowRunId: input.workflowRunId ?? null,
        keywordId: input.keywordId ?? null,
        type: input.type,
        title: input.title,
        briefData: input.briefData ?? null,
        articleData: input.articleData ?? null,
        scores: input.scores ?? null,
        wordCount: input.wordCount ?? null,
      })
      .returning();
    return piece;
  }

  async update(
    id: string,
    projectId: string,
    input: {
      title?: string;
      status?: 'draft' | 'review' | 'approved' | 'published';
      briefData?: unknown;
      articleData?: unknown;
      scores?: unknown;
      wordCount?: number;
    },
  ) {
    await this.findById(id, projectId);

    const [updated] = await this.db.db
      .update(contentPieces)
      .set({
        ...(input.title !== undefined && { title: input.title }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.briefData !== undefined && { briefData: input.briefData }),
        ...(input.articleData !== undefined && { articleData: input.articleData }),
        ...(input.scores !== undefined && { scores: input.scores }),
        ...(input.wordCount !== undefined && { wordCount: input.wordCount }),
        updatedAt: new Date(),
      })
      .where(and(eq(contentPieces.id, id), eq(contentPieces.projectId, projectId)))
      .returning();
    return updated;
  }

  async remove(id: string, projectId: string) {
    await this.findById(id, projectId);
    await this.db.db
      .delete(contentPieces)
      .where(and(eq(contentPieces.id, id), eq(contentPieces.projectId, projectId)));
    return { deleted: true };
  }

  async bulkCreate(
    projectId: string,
    items: Array<{
      workflowRunId?: string;
      keywordId?: string;
      type: 'brief' | 'article';
      title: string;
      briefData?: unknown;
    }>,
  ) {
    if (items.length === 0) return [];

    const values = items.map((item) => ({
      projectId,
      workflowRunId: item.workflowRunId ?? null,
      keywordId: item.keywordId ?? null,
      type: item.type as 'brief' | 'article',
      title: item.title,
      briefData: item.briefData ?? null,
    }));

    return this.db.db.insert(contentPieces).values(values).returning();
  }

  async updateStatus(id: string, projectId: string, status: 'draft' | 'review' | 'approved' | 'published') {
    await this.findById(id, projectId);

    const [updated] = await this.db.db
      .update(contentPieces)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(contentPieces.id, id), eq(contentPieces.projectId, projectId)))
      .returning();
    return updated;
  }

  async getStats(projectId: string) {
    const pieces = await this.findAllByProject(projectId);

    const byType = { brief: 0, article: 0 };
    const byStatus = { draft: 0, review: 0, approved: 0, published: 0 };
    let totalWordCount = 0;

    for (const p of pieces) {
      byType[p.type]++;
      byStatus[p.status]++;
      totalWordCount += p.wordCount ?? 0;
    }

    return {
      total: pieces.length,
      byType,
      byStatus,
      totalWordCount,
    };
  }

  /**
   * Generate content pieces (briefs) from a topical map.
   * Extracts every page from every pillar/cluster and creates a draft content piece for each.
   */
  async generateFromTopicalMap(
    projectId: string,
    topicalMapId: string,
    workflowRunId?: string,
  ) {
    const map = await this.topicalMapsService.findById(topicalMapId, projectId);
    const pillars = (map.pillars as any[]) ?? [];
    const MAX_CONTENT_PIECES = 5000;

    const items: Array<{
      projectId: string;
      workflowRunId: string | null;
      type: 'brief' | 'article';
      title: string;
      briefData: unknown;
    }> = [];

    for (const pillar of pillars) {
      const clusters = pillar.clusters ?? [];
      for (const cluster of clusters) {
        const pages = cluster.pages ?? [];
        for (const page of pages) {
          items.push({
            projectId,
            workflowRunId: workflowRunId ?? null,
            type: 'brief',
            title: page.title ?? page.keyword ?? 'Untitled',
            briefData: {
              pillarName: pillar.name,
              clusterName: cluster.name,
              keyword: page.keyword,
              volume: page.volume,
              difficulty: page.difficulty,
              intent: page.intent,
              funnelStage: page.funnelStage,
              contentType: page.contentType,
              estimatedWordCount: page.estimatedWordCount,
              suggestedUrl: page.suggestedUrl,
              linksTo: page.linksTo,
              linksFrom: page.linksFrom,
            },
          });

          if (items.length > MAX_CONTENT_PIECES) {
            throw new BadRequestException(`Topical map exceeds maximum of ${MAX_CONTENT_PIECES} content pieces`);
          }
        }
      }
    }

    if (items.length === 0) {
      this.logger.warn(`No pages found in topical map ${topicalMapId}`);
      return [];
    }

    const created = await this.db.db.insert(contentPieces).values(items).returning();
    this.logger.log(`Generated ${created.length} content pieces from topical map ${topicalMapId}`);
    return created;
  }

  /**
   * Find images for a content piece (loaded separately to keep list queries fast).
   */
  async findImagesByContentPiece(contentPieceId: string, projectId: string) {
    // Verify the content piece exists and belongs to the project
    await this.findById(contentPieceId, projectId);

    return this.db.db.query.contentImages.findMany({
      where: eq(contentImages.contentPieceId, contentPieceId),
      orderBy: (img, { asc }) => [asc(img.index)],
    });
  }
}
