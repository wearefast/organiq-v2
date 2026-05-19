import { Injectable, Logger } from '@nestjs/common';
import { eq, desc, and, gte } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { trackedPrompts, promptVisibilityResults, projects } from '../../db/schema';
import { EngineQueryService, SupportedEngine, SUPPORTED_ENGINES } from './engine-query.service';
import { VisibilityParserService } from './visibility-parser.service';

// ─── Types ───────────────────────────────────────────────────

export interface CreatePromptInput {
  promptText: string;
  intentStage?: 'awareness' | 'consideration' | 'decision';
  engines?: string[];
  competitors?: string[];
}

export interface PromptWithStats {
  id: string;
  promptText: string;
  intentStage: string | null;
  engines: string[];
  isActive: boolean;
  createdAt: string;
  latestVisibilityPct: number | null;
  latestMentionPosition: number | null;
  lastCheckedAt: string | null;
}

export interface VisibilityOverview {
  overallScore: number;
  totalPrompts: number;
  activePrompts: number;
  avgVisibilityPct: number;
  avgPosition: number | null;
  byEngine: Array<{ engine: string; visibilityPct: number; checks: number }>;
}

// ─── Service ─────────────────────────────────────────────────

@Injectable()
export class PromptVisibilityService {
  private readonly logger = new Logger(PromptVisibilityService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly engineQuery: EngineQueryService,
    private readonly parser: VisibilityParserService,
  ) {}

  // ─── CRUD: Tracked Prompts ───────────────────────────────

  async createPrompt(projectId: string, input: CreatePromptInput) {
    const engines = (input.engines ?? ['perplexity', 'openai']).filter((e) =>
      (SUPPORTED_ENGINES as readonly string[]).includes(e),
    );

    const [row] = await this.db.db
      .insert(trackedPrompts)
      .values({
        projectId,
        promptText: input.promptText,
        intentStage: input.intentStage ?? 'awareness',
        engines,
        competitors: input.competitors ?? [],
        isActive: true,
      })
      .returning();

    return row;
  }

  async getPrompts(projectId: string): Promise<PromptWithStats[]> {
    const prompts = await this.db.db
      .select()
      .from(trackedPrompts)
      .where(eq(trackedPrompts.projectId, projectId))
      .orderBy(desc(trackedPrompts.createdAt));

    // Get latest result for each prompt
    const result: PromptWithStats[] = [];
    for (const p of prompts) {
      const latestResult = await this.db.db
        .select()
        .from(promptVisibilityResults)
        .where(eq(promptVisibilityResults.promptId, p.id))
        .orderBy(desc(promptVisibilityResults.checkedAt))
        .limit(1);

      const latest = latestResult[0] ?? null;
      result.push({
        id: p.id,
        promptText: p.promptText,
        intentStage: p.intentStage,
        engines: (p.engines as string[]) ?? [],
        isActive: p.isActive,
        createdAt: p.createdAt.toISOString(),
        latestVisibilityPct: latest?.visibilityPct ? parseFloat(String(latest.visibilityPct)) : null,
        latestMentionPosition: latest?.mentionPosition ?? null,
        lastCheckedAt: latest?.checkedAt?.toISOString() ?? null,
      });
    }

    return result;
  }

  async deletePrompt(promptId: string) {
    await this.db.db.delete(trackedPrompts).where(eq(trackedPrompts.id, promptId));
  }

  async togglePrompt(promptId: string, isActive: boolean) {
    await this.db.db
      .update(trackedPrompts)
      .set({ isActive })
      .where(eq(trackedPrompts.id, promptId));
  }

  // ─── Prompt History ──────────────────────────────────────

  async getPromptHistory(promptId: string, limit = 50) {
    return this.db.db
      .select()
      .from(promptVisibilityResults)
      .where(eq(promptVisibilityResults.promptId, promptId))
      .orderBy(desc(promptVisibilityResults.checkedAt))
      .limit(limit);
  }

  // ─── Visibility Overview (Brand Score) ───────────────────

  async getOverview(projectId: string): Promise<VisibilityOverview> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const allPrompts = await this.db.db
      .select()
      .from(trackedPrompts)
      .where(eq(trackedPrompts.projectId, projectId));

    const recentResults = await this.db.db
      .select()
      .from(promptVisibilityResults)
      .where(
        and(
          eq(promptVisibilityResults.projectId, projectId),
          gte(promptVisibilityResults.checkedAt, thirtyDaysAgo),
        ),
      );

    const totalPrompts = allPrompts.length;
    const activePrompts = allPrompts.filter((p) => p.isActive).length;

    if (recentResults.length === 0) {
      return { overallScore: 0, totalPrompts, activePrompts, avgVisibilityPct: 0, avgPosition: null, byEngine: [] };
    }

    // Calculate overall metrics
    const mentioned = recentResults.filter((r) => r.brandMentioned);
    const avgVisibilityPct = Math.round((mentioned.length / recentResults.length) * 10000) / 100;

    const positions = mentioned.filter((r) => r.mentionPosition != null).map((r) => r.mentionPosition!);
    const avgPosition = positions.length > 0 ? Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10 : null;

    // By engine breakdown
    const engineGroups = new Map<string, typeof recentResults>();
    for (const r of recentResults) {
      const group = engineGroups.get(r.aiEngine) ?? [];
      group.push(r);
      engineGroups.set(r.aiEngine, group);
    }

    const byEngine = Array.from(engineGroups.entries()).map(([engine, results]) => ({
      engine,
      visibilityPct: Math.round((results.filter((r) => r.brandMentioned).length / results.length) * 10000) / 100,
      checks: results.length,
    }));

    // Overall score: weighted average (visibility 60%, position 40%)
    const positionScore = avgPosition ? Math.max(0, 100 - (avgPosition - 1) * 20) : 0;
    const overallScore = Math.round(avgVisibilityPct * 0.6 + positionScore * 0.4);

    return { overallScore: Math.min(100, overallScore), totalPrompts, activePrompts, avgVisibilityPct, avgPosition, byEngine };
  }

  // ─── Check Prompt (called by processor) ──────────────────

  async checkPrompt(promptId: string) {
    const prompt = await this.db.db.query.trackedPrompts.findFirst({
      where: eq(trackedPrompts.id, promptId),
    });
    if (!prompt || !prompt.isActive) return;

    const project = await this.db.db.query.projects.findFirst({
      where: eq(projects.id, prompt.projectId),
    });
    if (!project) return;

    const engines = ((prompt.engines as string[]) ?? []).filter((e) =>
      (SUPPORTED_ENGINES as readonly string[]).includes(e),
    ) as SupportedEngine[];

    for (const engine of engines) {
      try {
        const response = await this.engineQuery.queryWithMajorityVote(engine, prompt.promptText);
        if (response.error) {
          this.logger.warn(`Engine ${engine} failed for prompt ${promptId}: ${response.error}`);
          continue;
        }

        const parseResult = this.parser.parse(
          response.text,
          project.name,
          project.domain,
          (prompt.competitors as string[]) ?? [],
        );

        // Get recent results for rolling visibility
        const recentResults = await this.db.db
          .select()
          .from(promptVisibilityResults)
          .where(
            and(
              eq(promptVisibilityResults.promptId, promptId),
              eq(promptVisibilityResults.aiEngine, engine),
            ),
          )
          .orderBy(desc(promptVisibilityResults.checkedAt))
          .limit(20);

        const allResults = [{ brandMentioned: parseResult.brandMentioned }, ...recentResults];
        const visibilityPct = this.parser.calculateVisibilityPct(allResults);

        await this.db.db.insert(promptVisibilityResults).values({
          promptId,
          projectId: prompt.projectId,
          aiEngine: engine,
          brandMentioned: parseResult.brandMentioned,
          mentionPosition: parseResult.mentionPosition,
          responseExcerpt: parseResult.responseExcerpt,
          competitorMentions: parseResult.competitorMentions,
          visibilityPct: String(visibilityPct),
          sentiment: parseResult.sentiment,
        });
      } catch (e) {
        this.logger.error(`Error checking prompt ${promptId} on ${engine}: ${e}`);
      }
    }
  }

  // ─── Check all active prompts (batch) ────────────────────

  async checkAllActivePrompts() {
    const active = await this.db.db
      .select()
      .from(trackedPrompts)
      .where(eq(trackedPrompts.isActive, true));

    this.logger.log(`Checking ${active.length} active prompts`);

    for (const prompt of active) {
      await this.checkPrompt(prompt.id);
    }
  }
}
