import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { contentPieces, contentImages, projectAssets } from '../../db/schema';
import { TopicalMapsService } from '../topical-maps/topical-maps.service';
import { DataForSeoService } from '../integrations/dataforseo/dataforseo.service';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly topicalMapsService: TopicalMapsService,
    private readonly dataForSeo: DataForSeoService,
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

  /**
   * Return all images for every content piece in a project (for the Assets tab).
   * Omits the base64 blob from the list to keep the response lightweight;
   * callers can load individual images on demand.
   */
  async findAllImagesByProject(projectId: string) {
    const pieces = await this.db.db
      .select({ id: contentPieces.id, title: contentPieces.title })
      .from(contentPieces)
      .where(eq(contentPieces.projectId, projectId));

    if (pieces.length === 0) return [];

    const pieceIds = pieces.map((p) => p.id);
    const images = await this.db.db
      .select({
        id: contentImages.id,
        contentPieceId: contentImages.contentPieceId,
        index: contentImages.index,
        altText: contentImages.altText,
        prompt: contentImages.prompt,
        base64: contentImages.base64,
        size: contentImages.size,
        createdAt: contentImages.createdAt,
      })
      .from(contentImages)
      .where(inArray(contentImages.contentPieceId, pieceIds))
      .orderBy(desc(contentImages.createdAt));

    const pieceMap = Object.fromEntries(pieces.map((p) => [p.id, p.title]));
    return images.map((img) => ({ ...img, contentPieceTitle: pieceMap[img.contentPieceId] ?? '' }));
  }

  /**
   * Set (or clear) the scheduled publish date for a content piece.
   */
  async scheduleContent(id: string, projectId: string, scheduledPublishAt: Date | null) {
    await this.findById(id, projectId);
    const [updated] = await this.db.db
      .update(contentPieces)
      .set({ scheduledPublishAt, updatedAt: new Date() })
      .where(and(eq(contentPieces.id, id), eq(contentPieces.projectId, projectId)))
      .returning();
    return updated;
  }

  // ─── Project Assets ────────────────────────────────────────────

  async findProjectAssets(projectId: string) {
    return this.db.db
      .select()
      .from(projectAssets)
      .where(eq(projectAssets.projectId, projectId))
      .orderBy(desc(projectAssets.createdAt));
  }

  async createProjectAsset(
    projectId: string,
    name: string,
    mimeType: string,
    size: number,
    base64: string,
  ) {
    const [asset] = await this.db.db
      .insert(projectAssets)
      .values({ projectId, name, mimeType, size, base64 })
      .returning();
    return asset;
  }

  async deleteProjectAsset(id: string, projectId: string) {
    const [deleted] = await this.db.db
      .delete(projectAssets)
      .where(and(eq(projectAssets.id, id), eq(projectAssets.projectId, projectId)))
      .returning({ id: projectAssets.id });
    if (!deleted) throw new NotFoundException('Asset not found');
    return { deleted: true };
  }

  /**
   * Search public Reddit threads relevant to the project via DataForSEO SERP.
   * Returns up to 20 organic results scoped to reddit.com.
   */
  async searchForumThreads(projectId: string, query: string, country = 'us') {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('query is required');
    }

    let items: Array<{ type?: string; title?: string; url?: string; description?: string; rank_absolute?: number; timestamp?: string }>;
    try {
      items = await this.dataForSeo.searchRedditThreads(query, country);
    } catch (error) {
      this.logger.error(`Forum search failed: ${error instanceof Error ? error.message : error}`);
      throw new BadRequestException(
        `Forum search unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }

    const mapped = items.map((r) => {
      const subreddit = r.url?.match(/reddit\.com\/r\/([^/]+)/)?.[1] ?? null;
      const isQuestion =
        (r.title ?? '').includes('?') ||
        /\b(how|what|why|where|when|can|should|does|is|are|will|help)\b/i.test(r.title ?? '');
      // timestamp from DataForSEO: "YYYY-MM-DD HH:MM:SS +00:00"
      const publishedDate = r.timestamp ? r.timestamp.split(' ')[0] : null;
      return {
        title: r.title ?? '',
        url: r.url ?? '',
        snippet: r.description ?? '',
        subreddit,
        position: r.rank_absolute ?? 0,
        isQuestion,
        publishedDate,
      };
    });

    // Sort newest first; items without a date go to the end
    mapped.sort((a, b) => {
      if (!a.publishedDate && !b.publishedDate) return 0;
      if (!a.publishedDate) return 1;
      if (!b.publishedDate) return -1;
      return b.publishedDate.localeCompare(a.publishedDate);
    });

    return mapped;
  }
}
