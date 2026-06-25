import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { topicalMaps, topicalMapPages, contentPieces, contentImages } from '../../db/schema';

@Injectable()
export class TopicalMapPagesService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Materialises pages from topicalMaps.pillars JSONB into the topical_map_pages table.
   * Idempotent: uses INSERT … ON CONFLICT DO UPDATE so re-running is safe.
   * Called automatically when a topical-map artifact is approved via the workflow,
   * and also available as an on-demand endpoint.
   */
  async syncFromMap(topicalMapId: string, projectId: string) {
    const map = await this.db.db.query.topicalMaps.findFirst({
      where: and(eq(topicalMaps.id, topicalMapId), eq(topicalMaps.projectId, projectId)),
    });
    if (!map) throw new NotFoundException('Topical map not found');

    const pillars = (map.pillars as Record<string, unknown>[]) ?? [];
    const rows: typeof topicalMapPages.$inferInsert[] = [];
    let sortOrder = 0;

    for (const pillar of pillars) {
      const clusters = (pillar.clusters as Record<string, unknown>[] | undefined) ?? [];
      for (const cluster of clusters) {
        const pages = (cluster.pages as Record<string, unknown>[] | undefined) ?? [];
        for (const page of pages) {
          rows.push({
            topicalMapId,
            projectId,
            pillarTitle: (pillar.name as string) ?? '',
            clusterTitle: (cluster.name as string) ?? '',
            title: (page.title ?? page.keyword ?? 'Untitled') as string,
            keyword: (page.keyword as string | undefined) ?? null,
            suggestedUrl: (page.suggestedUrl as string | undefined) ?? null,
            contentType: (page.contentType as string | undefined) ?? null,
            intent: (page.intent as string | undefined) ?? null,
            funnelStage: (page.funnelStage as string | undefined) ?? null,
            volume: (page.volume as number | undefined) ?? null,
            difficulty: (page.difficulty as number | undefined) ?? null,
            estimatedWordCount: (page.estimatedWordCount as number | undefined) ?? null,
            priority: (page.priority ?? page.effort) as string | null ?? null,
            linksTo: (page.linksTo as string[] | undefined) ?? null,
            linksFrom: (page.linksFrom as string[] | undefined) ?? null,
            sortOrder: sortOrder++,
          });
        }
      }
    }

    if (rows.length === 0) return [];

    const inserted = await this.db.db
      .insert(topicalMapPages)
      .values(rows)
      .onConflictDoUpdate({
        target: [topicalMapPages.topicalMapId, topicalMapPages.title],
        set: {
          keyword: sql`excluded.keyword`,
          suggestedUrl: sql`excluded.suggested_url`,
          contentType: sql`excluded.content_type`,
          intent: sql`excluded.intent`,
          funnelStage: sql`excluded.funnel_stage`,
          volume: sql`excluded.volume`,
          difficulty: sql`excluded.difficulty`,
          estimatedWordCount: sql`excluded.estimated_word_count`,
          priority: sql`excluded.priority`,
          sortOrder: sql`excluded.sort_order`,
        },
      })
      .returning();

    return inserted;
  }

  /**
   * Returns all pages for a topical map with their associated content piece status.
   * Used by the frontend to show per-page pipeline status in the topical map renderer.
   */
  async findAllByMap(topicalMapId: string, projectId: string) {
    const pages = await this.db.db.query.topicalMapPages.findMany({
      where: and(
        eq(topicalMapPages.topicalMapId, topicalMapId),
        eq(topicalMapPages.projectId, projectId),
      ),
      orderBy: (p, { asc }) => [asc(p.sortOrder)],
    });

    // Fetch content pieces for all pages in one query
    const pageIds = pages.map((p) => p.id);
    if (pageIds.length === 0) return pages.map((p) => ({ ...p, contentPieces: [] }));

    const pieces = await this.db.db.query.contentPieces.findMany({
      where: (cp, { inArray }) => inArray(cp.topicalMapPageId, pageIds),
      columns: {
        id: true,
        topicalMapPageId: true,
        type: true,
        status: true,
        wordCount: true,
        scheduledPublishAt: true,
      },
    });

    // Count images per brief/article piece
    const briefIds = pieces.map((p) => p.id);
    const images =
      briefIds.length > 0
        ? await this.db.db.query.contentImages.findMany({
            where: (img, { inArray }) => inArray(img.contentPieceId, briefIds),
            columns: { id: true, contentPieceId: true },
          })
        : [];

    const imageCountByPiece = images.reduce<Record<string, number>>((acc, img) => {
      acc[img.contentPieceId] = (acc[img.contentPieceId] ?? 0) + 1;
      return acc;
    }, {});

    const piecesByPage = pieces.reduce<Record<string, typeof pieces>>((acc, p) => {
      const key = p.topicalMapPageId!;
      (acc[key] ??= []).push(p);
      return acc;
    }, {});

    return pages.map((page) => ({
      ...page,
      contentPieces: (piecesByPage[page.id] ?? []).map((p) => ({
        ...p,
        imageCount: imageCountByPiece[p.id] ?? 0,
      })),
    }));
  }

  async findById(pageId: string, projectId: string) {
    const page = await this.db.db.query.topicalMapPages.findFirst({
      where: and(eq(topicalMapPages.id, pageId), eq(topicalMapPages.projectId, projectId)),
    });
    if (!page) throw new NotFoundException('Topical map page not found');

    // Load all content pieces for this page with their images
    const pieces = await this.db.db.query.contentPieces.findMany({
      where: and(eq(contentPieces.topicalMapPageId, pageId)),
    });

    const allImages =
      pieces.length > 0
        ? await this.db.db.query.contentImages.findMany({
            where: (img, { inArray }) => inArray(img.contentPieceId, pieces.map((p) => p.id)),
            orderBy: (img, { asc }) => [asc(img.index)],
          })
        : [];

    const imagesByPiece = allImages.reduce<Record<string, typeof allImages>>((acc, img) => {
      (acc[img.contentPieceId] ??= []).push(img);
      return acc;
    }, {});

    return {
      ...page,
      contentPieces: pieces.map((p) => ({
        ...p,
        images: imagesByPiece[p.id] ?? [],
      })),
    };
  }
}
