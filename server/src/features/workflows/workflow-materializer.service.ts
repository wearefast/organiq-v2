import { Injectable, Logger } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { KeywordsService, BulkKeywordInput } from '../keywords/keywords.service';
import { TopicalMapsService } from '../topical-maps/topical-maps.service';
import { ContentService } from '../content/content.service';
import {
  workflowRuns,
  workflowSteps,
  stepArtifacts,
  keywords,
  topicalMaps,
  contentPieces,
  contentImages,
} from '../../db/schema';

/**
 * Promotes approved workflow step artifacts into project-level feature tables.
 *
 * Design:
 * - Called AFTER the approval transaction commits (never inside it).
 * - Each per-step materializer is idempotent via upsert conflict keys.
 * - If materialization fails, the step remains approved; retry via backfill.
 * - Dependency direction: workflows → feature services (never reverse).
 */
@Injectable()
export class WorkflowMaterializerService {
  private readonly logger = new Logger(WorkflowMaterializerService.name);

  /** Steps that have materialization logic */
  private static readonly MATERIALIZABLE_STEPS = new Set([
    'consolidated-keywords',
    'topical-map',
    'content-brief',
    'content-article',
    'content-images',
  ]);

  constructor(
    private readonly db: DatabaseService,
    private readonly keywordsService: KeywordsService,
    private readonly topicalMapsService: TopicalMapsService,
    private readonly contentService: ContentService,
  ) {}

  /**
   * Materialize a single approved step's artifact into project feature tables.
   * Safe to call multiple times for the same step (idempotent).
   */
  async materialize(workflowRunId: string, stepKey: string): Promise<void> {
    if (!WorkflowMaterializerService.MATERIALIZABLE_STEPS.has(stepKey)) return;

    try {
      // Load the run to get projectId
      const run = await this.db.db.query.workflowRuns.findFirst({
        where: eq(workflowRuns.id, workflowRunId),
        columns: { id: true, projectId: true },
      });
      if (!run) {
        this.logger.warn(`Materialize: run ${workflowRunId} not found`);
        return;
      }

      // Load the latest artifact for this step
      const artifact = await this.db.db.query.stepArtifacts.findFirst({
        where: and(
          eq(stepArtifacts.workflowRunId, workflowRunId),
          eq(stepArtifacts.stepKey, stepKey),
        ),
        orderBy: (a, { desc }) => [desc(a.version)],
      });
      if (!artifact?.data) {
        this.logger.warn(`Materialize: no artifact for step ${stepKey} in run ${workflowRunId}`);
        return;
      }

      const data = artifact.data as Record<string, unknown>;
      const projectId = run.projectId;

      switch (stepKey) {
        case 'consolidated-keywords':
          await this.materializeKeywords(projectId, workflowRunId, data);
          break;
        case 'topical-map':
          await this.materializeTopicalMap(projectId, workflowRunId, data);
          break;
        case 'content-brief':
          await this.materializeContentBrief(projectId, workflowRunId, data);
          break;
        case 'content-article':
          await this.materializeContentArticle(projectId, workflowRunId, data);
          break;
        case 'content-images':
          await this.materializeContentImages(projectId, workflowRunId, data);
          break;
      }

      this.logger.log(`Materialized step ${stepKey} for run ${workflowRunId}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Materialization failed for step ${stepKey} (run: ${workflowRunId}): ${msg}`);
      // Do NOT rethrow — approval should never be blocked by materialization failure
    }
  }

  /**
   * Backfill materialization for all approved steps in a project.
   * Processes steps in dependency order so links resolve correctly.
   */
  async backfillProject(projectId: string): Promise<{ runsProcessed: number; stepsProcessed: number }> {
    const runs = await this.db.db.query.workflowRuns.findMany({
      where: eq(workflowRuns.projectId, projectId),
      columns: { id: true },
    });

    const STEP_ORDER = [
      'consolidated-keywords',
      'topical-map',
      'content-brief',
      'content-article',
      'content-images',
    ];

    let stepsProcessed = 0;

    for (const run of runs) {
      // Get approved steps for this run
      const steps = await this.db.db.query.workflowSteps.findMany({
        where: and(
          eq(workflowSteps.workflowRunId, run.id),
          eq(workflowSteps.status, 'approved'),
        ),
      });
      const approvedKeys = new Set(steps.map((s) => s.stepKey));

      // Process in dependency order
      for (const stepKey of STEP_ORDER) {
        if (approvedKeys.has(stepKey)) {
          await this.materialize(run.id, stepKey);
          stepsProcessed++;
        }
      }
    }

    this.logger.log(`Backfill complete for project ${projectId}: ${runs.length} runs, ${stepsProcessed} steps`);
    return { runsProcessed: runs.length, stepsProcessed };
  }

  // ─── Per-Step Materializers ──────────────────────────────────

  /**
   * Step 13: consolidated-keywords → keywords table
   * Artifact shape: { keywords: [{ keyword, volume, difficulty, intent, funnel_stage, ... }] }
   */
  private async materializeKeywords(
    projectId: string,
    workflowRunId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const rawKeywords = data.keywords as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(rawKeywords) || rawKeywords.length === 0) {
      this.logger.warn('materializeKeywords: no keywords array in artifact');
      return;
    }

    const items: BulkKeywordInput[] = rawKeywords.map((kw) => ({
      keyword: String(kw.keyword ?? ''),
      volume: typeof kw.volume === 'number' ? kw.volume : undefined,
      difficulty: typeof kw.difficulty === 'number' ? kw.difficulty : undefined,
      cpc: kw.cpc != null ? String(kw.cpc) : undefined,
      intent: this.normalizeIntent(kw.intent),
      funnelStage: this.normalizeFunnel(kw.funnel_stage ?? kw.funnelStage),
      status: 'discovered',
      sourceStep: 'consolidated-keywords',
      parentTopic: kw.parent_topic != null ? String(kw.parent_topic) : (kw.parentTopic != null ? String(kw.parentTopic) : undefined),
    }));

    // Filter out empty keywords
    const validItems = items.filter((i) => i.keyword.trim().length > 0);
    if (validItems.length === 0) return;

    await this.keywordsService.bulkUpsert(projectId, workflowRunId, validItems);
    this.logger.log(`Materialized ${validItems.length} keywords for project ${projectId}`);
  }

  /**
   * Step 15: topical-map → topical_maps table
   * Artifact shape: { contentPillars: [...], contentCalendar: [...] }
   * or: { pillars: [...], calendar: [...] }
   */
  private async materializeTopicalMap(
    projectId: string,
    workflowRunId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    // Handle both naming conventions from agent output
    const pillars = data.contentPillars ?? data.pillars;
    const calendar = data.contentCalendar ?? data.calendar;

    if (!pillars) {
      this.logger.warn('materializeTopicalMap: no pillars data in artifact');
      return;
    }

    // Check if a map already exists for this run (idempotent)
    const existing = await this.topicalMapsService.findByWorkflowRun(workflowRunId);
    if (existing) {
      // Update existing map
      await this.topicalMapsService.update(existing.id, projectId, {
        pillars,
        calendar: calendar ?? undefined,
      });
      this.logger.log(`Updated existing topical map ${existing.id}`);
    } else {
      await this.topicalMapsService.create({
        projectId,
        workflowRunId,
        name: 'Topical Map',
        pillars,
        calendar: calendar ?? undefined,
      });
      this.logger.log(`Created topical map for project ${projectId}`);
    }
  }

  /**
   * Step 16: content-brief → content_pieces (type=brief)
   * Artifact shape: { targetKeyword, serpAnalysis, contentStructure, wordCountTarget, ... }
   */
  private async materializeContentBrief(
    projectId: string,
    workflowRunId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const targetKeyword = String(data.targetKeyword ?? '');
    const title = String(data.metaTitle ?? data.targetKeyword ?? 'Untitled Brief');

    // Resolve keyword ID from persisted keywords table
    const keywordId = await this.resolveKeywordId(projectId, targetKeyword);

    // Resolve topical map ID
    const topicalMapId = await this.resolveTopicalMapId(workflowRunId);

    // Persist the brief — upsert on (workflowRunId, sourceStepKey)
    await this.db.db
      .insert(contentPieces)
      .values({
        projectId,
        workflowRunId,
        sourceStepKey: 'content-brief',
        keywordId,
        topicalMapId,
        type: 'brief',
        status: 'draft',
        title,
        briefData: { ...data, topicalMapPageKeyword: targetKeyword },
      })
      .onConflictDoUpdate({
        target: [contentPieces.workflowRunId, contentPieces.sourceStepKey],
        set: {
          title,
          keywordId,
          topicalMapId,
          briefData: { ...data, topicalMapPageKeyword: targetKeyword },
          updatedAt: new Date(),
        },
      });

    // Advance keyword status to brief_ready (only if currently lower)
    if (keywordId) {
      await this.advanceKeywordStatus(projectId, keywordId, 'brief_ready');
    }

    this.logger.log(`Materialized content brief for keyword "${targetKeyword}"`);
  }

  /**
   * Step 17: content-article → content_pieces (type=article)
   * Artifact shape: { title, slug, content, wordCount, scores, ... }
   */
  private async materializeContentArticle(
    projectId: string,
    workflowRunId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const title = String(data.title ?? 'Untitled Article');
    const wordCount = typeof data.wordCount === 'number' ? data.wordCount : null;

    // Look up the brief to inherit keywordId and topicalMapId
    const brief = await this.db.db.query.contentPieces.findFirst({
      where: and(
        eq(contentPieces.workflowRunId, workflowRunId),
        eq(contentPieces.sourceStepKey, 'content-brief'),
      ),
    });

    const keywordId = brief?.keywordId ?? null;
    const topicalMapId = brief?.topicalMapId ?? null;

    // Build scores from article data if present
    const scores = data.scores ?? (
      data.estimatedReadability != null ? {
        readability: data.estimatedReadability,
        seo_quality: data.estimatedSeoQuality,
        citability: data.estimatedCitability,
        content_length: data.estimatedContentLength,
      } : null
    );

    // Upsert the article
    await this.db.db
      .insert(contentPieces)
      .values({
        projectId,
        workflowRunId,
        sourceStepKey: 'content-article',
        keywordId,
        topicalMapId,
        type: 'article',
        status: 'draft',
        title,
        articleData: data,
        scores,
        wordCount,
      })
      .onConflictDoUpdate({
        target: [contentPieces.workflowRunId, contentPieces.sourceStepKey],
        set: {
          title,
          keywordId,
          topicalMapId,
          articleData: data,
          scores,
          wordCount,
          updatedAt: new Date(),
        },
      });

    // Advance keyword status to written
    if (keywordId) {
      await this.advanceKeywordStatus(projectId, keywordId, 'written');
    }

    this.logger.log(`Materialized content article "${title}"`);
  }

  /**
   * Step 18: content-images → content_images table
   * Artifact shape: { images: [{ index, base64, altText, prompt, revisedPrompt, size }] }
   */
  private async materializeContentImages(
    projectId: string,
    workflowRunId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const images = data.images as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(images) || images.length === 0) {
      this.logger.warn('materializeContentImages: no images array in artifact');
      return;
    }

    // Find the article content piece to link images to
    const article = await this.db.db.query.contentPieces.findFirst({
      where: and(
        eq(contentPieces.workflowRunId, workflowRunId),
        eq(contentPieces.sourceStepKey, 'content-article'),
      ),
    });

    if (!article) {
      this.logger.warn('materializeContentImages: no article found to link images to');
      return;
    }

    // Upsert each image (conflict on contentPieceId + index)
    for (const img of images) {
      const idx = typeof img.index === 'number' ? img.index : 0;
      const base64 = String(img.base64 ?? '');
      if (!base64) continue;

      await this.db.db
        .insert(contentImages)
        .values({
          contentPieceId: article.id,
          index: idx,
          altText: img.altText != null ? String(img.altText) : (img.alt_text != null ? String(img.alt_text) : null),
          prompt: img.prompt != null ? String(img.prompt) : null,
          base64,
          revisedPrompt: img.revisedPrompt != null ? String(img.revisedPrompt) : (img.revised_prompt != null ? String(img.revised_prompt) : null),
          size: img.size != null ? String(img.size) : null,
        })
        .onConflictDoUpdate({
          target: [contentImages.contentPieceId, contentImages.index],
          set: {
            altText: img.altText != null ? String(img.altText) : (img.alt_text != null ? String(img.alt_text) : null),
            prompt: img.prompt != null ? String(img.prompt) : null,
            base64,
            revisedPrompt: img.revisedPrompt != null ? String(img.revisedPrompt) : (img.revised_prompt != null ? String(img.revised_prompt) : null),
            size: img.size != null ? String(img.size) : null,
          },
        });
    }

    this.logger.log(`Materialized ${images.length} images for article ${article.id}`);
  }

  // ─── Helpers ─────────────────────────────────────────────────

  /**
   * Resolve a keyword ID from the persisted keywords table.
   * Case-insensitive, whitespace-normalized match.
   */
  private async resolveKeywordId(projectId: string, targetKeyword: string): Promise<string | null> {
    if (!targetKeyword.trim()) return null;

    const normalized = targetKeyword.trim().toLowerCase();
    const row = await this.db.db.query.keywords.findFirst({
      where: and(
        eq(keywords.projectId, projectId),
        sql`lower(trim(${keywords.keyword})) = ${normalized}`,
      ),
      columns: { id: true },
    });

    if (!row) {
      this.logger.warn(`resolveKeywordId: no match for "${targetKeyword}" in project ${projectId}`);
    }
    return row?.id ?? null;
  }

  /**
   * Resolve the topical map ID for a workflow run.
   */
  private async resolveTopicalMapId(workflowRunId: string): Promise<string | null> {
    const map = await this.db.db.query.topicalMaps.findFirst({
      where: eq(topicalMaps.workflowRunId, workflowRunId),
      columns: { id: true },
    });
    return map?.id ?? null;
  }

  /**
   * Advance keyword status forward only (never regress).
   * Status order: discovered < approved < brief_ready < written < published
   */
  private async advanceKeywordStatus(
    projectId: string,
    keywordId: string,
    targetStatus: 'brief_ready' | 'written' | 'published',
  ): Promise<void> {
    const STATUS_ORDER: Record<string, number> = {
      discovered: 0,
      approved: 1,
      brief_ready: 2,
      written: 3,
      published: 4,
    };

    const kw = await this.db.db.query.keywords.findFirst({
      where: and(eq(keywords.id, keywordId), eq(keywords.projectId, projectId)),
      columns: { id: true, status: true },
    });
    if (!kw) return;

    const currentOrder = STATUS_ORDER[kw.status] ?? 0;
    const targetOrder = STATUS_ORDER[targetStatus] ?? 0;

    if (targetOrder > currentOrder) {
      await this.db.db
        .update(keywords)
        .set({ status: targetStatus, updatedAt: new Date() })
        .where(eq(keywords.id, keywordId));
    }
  }

  /**
   * Normalize agent intent values (agents may use title-case or mixed case).
   */
  private normalizeIntent(raw: unknown): BulkKeywordInput['intent'] | undefined {
    if (raw == null) return undefined;
    const s = String(raw).toLowerCase().trim();
    const valid = ['transactional', 'commercial', 'informational', 'navigational'] as const;
    return valid.includes(s as any) ? (s as BulkKeywordInput['intent']) : undefined;
  }

  /**
   * Normalize funnel stage values.
   */
  private normalizeFunnel(raw: unknown): BulkKeywordInput['funnelStage'] | undefined {
    if (raw == null) return undefined;
    const s = String(raw).toLowerCase().trim();
    const valid = ['tofu', 'mofu', 'bofu'] as const;
    return valid.includes(s as any) ? (s as BulkKeywordInput['funnelStage']) : undefined;
  }
}
