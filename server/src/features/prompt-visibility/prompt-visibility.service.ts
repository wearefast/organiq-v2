import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, desc, and, gte } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { trackedPrompts, promptVisibilityResults, projects, workflowRuns, stepArtifacts } from '../../db/schema';
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
    private readonly config: ConfigService,
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

  // ─── Prompt Suggestions ──────────────────────────────────

  async generateSuggestions(projectId: string): Promise<Array<{ text: string; intent: string; category: string }>> {
    const project = await this.db.db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    if (!project) throw new NotFoundException('Project not found');

    // Try to get richer business profile from the most recent workflow run
    let businessProfile: Record<string, unknown> | null = null;
    const latestRun = await this.db.db
      .select({ id: workflowRuns.id })
      .from(workflowRuns)
      .where(eq(workflowRuns.projectId, projectId))
      .orderBy(desc(workflowRuns.createdAt))
      .limit(1);

    if (latestRun.length > 0) {
      const artifact = await this.db.db
        .select({ data: stepArtifacts.data })
        .from(stepArtifacts)
        .where(
          and(
            eq(stepArtifacts.workflowRunId, latestRun[0].id),
            eq(stepArtifacts.stepKey, 'business-profile'),
          ),
        )
        .orderBy(desc(stepArtifacts.version))
        .limit(1);
      if (artifact.length > 0) {
        businessProfile = artifact[0].data as Record<string, unknown>;
      }
    }

    // Build context string
    const bp = businessProfile;
    const context = bp
      ? [
          `Brand: ${project.name}`,
          `Domain: ${project.domain}`,
          `Industry: ${project.industry ?? 'unknown'}`,
          `Country: ${project.country ?? 'global'}`,
          `Brand Identity: ${bp['brandIdentity'] ?? ''}`,
          `Target Market: ${bp['targetMarket'] ?? ''}`,
          `Services: ${Array.isArray(bp['services']) ? (bp['services'] as string[]).join(', ') : ''}`,
          `Geography: ${bp['geography'] ?? ''}`,
          `Seed Keywords: ${Array.isArray(bp['seedKeywords']) ? (bp['seedKeywords'] as string[]).join(', ') : ''}`,
        ].join('\n')
      : [
          `Brand: ${project.name}`,
          `Domain: ${project.domain}`,
          `Industry: ${project.industry ?? 'unknown'}`,
          `Country: ${project.country ?? 'global'}`,
        ].join('\n');

    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) return this.templateSuggestions(project);

    const systemPrompt = `You are an AI visibility strategist. Generate exactly 6 realistic search queries a potential customer might type into an AI search engine (Perplexity, ChatGPT, Gemini) when researching products or services like this brand. Queries must be conversational, specific to the brand's industry and geography, and NOT generic.

Return ONLY a JSON object with this structure: { "suggestions": [ { "text": "the query", "intent": "awareness|consideration|decision", "category": "2-3 word label" } ] }

Intent:
- awareness: learning about the space (top of funnel)
- consideration: comparing options (mid funnel)
- decision: ready to buy or sign up (bottom funnel)

Mix intents across the 6 results. Categories: e.g. "Brand Discovery", "Competitive", "Use Case", "Regional", "Feature Research", "Purchase Intent".`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Generate 6 AI visibility prompts for this brand:\n\n${context}` },
          ],
          temperature: 0.7,
          max_tokens: 800,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
        const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as { suggestions?: unknown[] };
        const suggestions = parsed.suggestions;
        if (Array.isArray(suggestions) && suggestions.length > 0) {
          return suggestions.slice(0, 6) as Array<{ text: string; intent: string; category: string }>;
        }
      }
    } catch (e) {
      this.logger.warn(`Suggestion generation failed: ${e}`);
    }

    return this.templateSuggestions(project);
  }

  private templateSuggestions(
    project: { name: string; industry?: string | null; country?: string | null },
  ): Array<{ text: string; intent: string; category: string }> {
    const industry = project.industry ?? 'software';
    const brand = project.name;
    const geo = project.country ? ` in ${project.country}` : '';
    return [
      { text: `best ${industry} tools${geo}`, intent: 'awareness', category: 'Brand Discovery' },
      { text: `${brand} alternatives`, intent: 'consideration', category: 'Competitive' },
      { text: `how to choose a ${industry} platform${geo}`, intent: 'consideration', category: 'Buying Guide' },
      { text: `top ${industry} software for teams${geo}`, intent: 'awareness', category: 'Category' },
      { text: `${brand} review and pricing`, intent: 'decision', category: 'Purchase Intent' },
      { text: `best ${industry} solution for small business${geo}`, intent: 'decision', category: 'Use Case' },
    ];
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
