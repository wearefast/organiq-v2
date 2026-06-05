import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
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

export interface EngineStats {
  engine: string;
  visibilityPct: number;
  avgPosition: number | null;
  latestSentiment: 'positive' | 'neutral' | 'negative' | null;
  shareOfVoice: number;
  lastCheckedAt: string | null;
  checks: number;
  latestResponseText: string | null;
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
  engineStats: EngineStats[];
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
    @InjectQueue('prompt-visibility') private readonly queue: Queue,
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

    // Run the first check immediately so "Last Checked" is not stuck on "Never"
    await this.queue.add('check-single', { promptId: row.id }, { delay: 0 });
    this.logger.log(`Queued initial visibility check for prompt ${row.id}`);

    return row;
  }

  async runCheck(promptId: string): Promise<{ queued: boolean }> {
    const prompt = await this.db.db.query.trackedPrompts.findFirst({
      where: eq(trackedPrompts.id, promptId),
    });
    if (!prompt) return { queued: false };
    // force=true so manual checks always run regardless of isActive state
    await this.queue.add('check-single', { promptId, force: true }, { delay: 0 });
    return { queued: true };
  }

  async getPrompts(projectId: string): Promise<PromptWithStats[]> {
    const [prompts, allResults] = await Promise.all([
      this.db.db
        .select()
        .from(trackedPrompts)
        .where(eq(trackedPrompts.projectId, projectId))
        .orderBy(desc(trackedPrompts.createdAt)),
      this.db.db
        .select()
        .from(promptVisibilityResults)
        .where(eq(promptVisibilityResults.projectId, projectId))
        .orderBy(desc(promptVisibilityResults.checkedAt)),
    ]);

    // Group all results by promptId
    const resultsByPrompt = new Map<string, typeof allResults>();
    for (const r of allResults) {
      const group = resultsByPrompt.get(r.promptId) ?? [];
      group.push(r);
      resultsByPrompt.set(r.promptId, group);
    }

    return prompts.map((p) => {
      const promptResults = resultsByPrompt.get(p.id) ?? [];
      const configuredEngines = (p.engines as string[]) ?? [];

      // Overall aggregate (across all engines)
      const lastCheckedAt = promptResults[0]?.checkedAt?.toISOString() ?? null;
      const mentioned = promptResults.filter((r) => r.brandMentioned);
      const latestVisibilityPct =
        promptResults.length > 0
          ? Math.round((mentioned.length / promptResults.length) * 10000) / 100
          : null;
      const latestMentionPosition =
        promptResults.find((r) => r.mentionPosition != null)?.mentionPosition ?? null;

      // Group results by engine
      const engineGroups = new Map<string, typeof allResults>();
      for (const r of promptResults) {
        const group = engineGroups.get(r.aiEngine) ?? [];
        group.push(r);
        engineGroups.set(r.aiEngine, group);
      }

      // Compute per-engine stats
      const engineStats: EngineStats[] = configuredEngines.map((eng) => {
        const results = engineGroups.get(eng) ?? [];
        if (results.length === 0) {
          return { engine: eng, visibilityPct: 0, avgPosition: null, latestSentiment: null, shareOfVoice: 0, lastCheckedAt: null, checks: 0, latestResponseText: null };
        }

        const engMentioned = results.filter((r) => r.brandMentioned);
        const visibilityPct = Math.round((engMentioned.length / results.length) * 10000) / 100;

        const positions = engMentioned
          .filter((r) => r.mentionPosition != null)
          .map((r) => r.mentionPosition!);
        const avgPosition =
          positions.length > 0
            ? Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10
            : null;

        // Share of Voice: avg fraction of brand vs all brands mentioned per check
        const sovValues = results.map((r) => {
          const competitors = Array.isArray(r.competitorMentions) ? r.competitorMentions : [];
          if (!r.brandMentioned) return 0;
          return 1 / (1 + competitors.length);
        });
        const shareOfVoice =
          Math.round((sovValues.reduce((a, b) => a + b, 0) / results.length) * 10000) / 100;

        const latest = results[0]; // sorted desc
        const latestSentiment = (latest?.sentiment as 'positive' | 'neutral' | 'negative' | null) ?? null;

        return {
          engine: eng,
          visibilityPct,
          avgPosition,
          latestSentiment,
          shareOfVoice,
          lastCheckedAt: latest?.checkedAt?.toISOString() ?? null,
          checks: results.length,
          latestResponseText: (latest?.responseText as string | null) ?? null,
        };
      });

      return {
        id: p.id,
        promptText: p.promptText,
        intentStage: p.intentStage,
        engines: configuredEngines,
        isActive: p.isActive,
        createdAt: p.createdAt.toISOString(),
        latestVisibilityPct,
        latestMentionPosition,
        lastCheckedAt,
        engineStats,
      };
    });
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

  async checkPrompt(promptId: string, force = false) {
    const prompt = await this.db.db.query.trackedPrompts.findFirst({
      where: eq(trackedPrompts.id, promptId),
    });
    // Scheduled checks skip inactive prompts; manual (force=true) runs always proceed
    if (!prompt || (!force && !prompt.isActive)) return;

    const project = await this.db.db.query.projects.findFirst({
      where: eq(projects.id, prompt.projectId),
    });
    if (!project) return;

    // Prefer brand name from the project's business profile over the project name.
    // Project names can have suffixes like "Mashreq 4" that AI engines never use.
    const bp = project.businessProfile as Record<string, unknown> | null;
    const rawBrandName =
      (typeof bp?.companyName === 'string' && bp.companyName) ||
      (typeof bp?.businessName === 'string' && bp.businessName) ||
      (typeof bp?.business_name === 'string' && bp.business_name) ||
      project.name;
    // Also strip any trailing numeric project-copy suffixes (e.g. "Acme 3" → "Acme")
    const brandName = rawBrandName.replace(/[\s\-_]+\d+$/, '').trim() || rawBrandName;

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

        // Per-prompt competitors take priority; fall back to business profile competitors.
        // bp.competitors may be an array of strings OR objects { name, url, ... } depending
        // on how the business profile was generated — normalise to string[] here.
        const promptCompetitors = (prompt.competitors as string[]) ?? [];
        const rawBpCompetitors = (bp?.competitors as Array<string | { name?: string }>) ?? [];
        const bpCompetitors = rawBpCompetitors
          .map((c) => (typeof c === 'string' ? c : (c?.name ?? '')))
          .filter(Boolean) as string[];
        const competitors = promptCompetitors.length > 0 ? promptCompetitors : bpCompetitors;

        const parseResult = this.parser.parse(
          response.text,
          brandName,
          project.domain,
          competitors,
        );

        // AI-powered position extraction — semantically understands any response format.
        // Falls back to the regex result if the API call fails.
        const aiPosition = parseResult.brandMentioned
          ? await this.aiExtractPosition(
              response.text,
              brandName,
              project.domain,
              prompt.promptText,
              this.config.get<string>('OPENAI_API_KEY') ?? '',
            )
          : null;
        const finalPosition = aiPosition ?? parseResult.mentionPosition;

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
          mentionPosition: finalPosition,
          responseText: response.text,
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

  // ─── AI Position Extraction ───────────────────────────────

  /**
   * Use GPT-4o-mini to semantically extract brand position from an AI engine response.
   * This is the authoritative position source — it handles any response format (numbered
   * lists, markdown headings, categorised sections, prose) without fragile regex patterns.
   *
   * Passes the original prompt for context so the extractor can distinguish a ranking
   * question ("best banks in UAE") from a specific lookup ("which bank has NEO banking").
   *
   * Falls back to null on any error — the regex result from the parser is the fallback.
   */
  private async aiExtractPosition(
    responseText: string,
    brandName: string,
    brandDomain: string,
    promptText: string,
    apiKey: string,
  ): Promise<number | null> {
    if (!apiKey || !responseText) return null;
    try {
      const cleanBrand = brandName.replace(/[\s\-_]+\d+$/, '').trim() || brandName;
      const cleanDomain = brandDomain.replace(/^https?:\/\//, '').replace(/^www\./, '');
      // 10 000 chars covers any realistic AI response without exceeding token budget
      const truncated = responseText.slice(0, 10000);

      const extractionPrompt = `An AI assistant responded to this question: "${promptText}"

Brand to locate: "${cleanBrand}" (domain: ${cleanDomain})

RESPONSE:
---
${truncated}
---

Determine the rank/position of "${cleanBrand}" inside any list in the response.

Rules (apply the FIRST that matches):
1. Explicit numbered list — "6. ${cleanBrand}" or "${cleanBrand} is ranked 6th" → return 6
2. Numbered heading — "### 6. ${cleanBrand}" → return 6
3. Sequential entries under section headings (counted in order they appear) → return that ordinal (1st entry = 1, 2nd = 2, …)
4. Mentioned only in flowing prose, a table cell, or as a passing example (not a list item) → null
5. Not mentioned → null

Reply with ONLY valid JSON, no explanation: {"position": <integer or null>}`;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: extractionPrompt }],
          max_tokens: 20,
          temperature: 0,
          response_format: { type: 'json_object' },
        }),
      });

      if (!res.ok) return null;

      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content?.trim() ?? '';
      const parsed = JSON.parse(content) as { position?: unknown };
      const pos = parsed.position;
      return typeof pos === 'number' && Number.isFinite(pos) && pos >= 1 ? Math.round(pos) : null;
    } catch {
      return null;
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

  // ─── Schedule ─────────────────────────────────────────────

  async getSchedule(): Promise<{ hour: number; nextRun: string | null }> {
    try {
      const schedulers = await this.queue.getJobSchedulers();
      const scheduler = schedulers.find((s) => s.id === 'daily-prompt-check');
      if (scheduler?.pattern) {
        // pattern is "0 H * * *"
        const parts = scheduler.pattern.split(' ');
        const hour = parseInt(parts[1], 10);
        const nextRun = scheduler.next != null ? new Date(Number(scheduler.next)).toISOString() : null;
        return { hour: isNaN(hour) ? 4 : hour, nextRun };
      }
    } catch {
      // fall through
    }
    return { hour: 4, nextRun: null };
  }

  async updateSchedule(hour: number): Promise<{ hour: number }> {
    await this.queue.upsertJobScheduler(
      'daily-prompt-check',
      { pattern: `0 ${hour} * * *` },
      { name: 'check-all', data: {} },
    );
    this.logger.log(`Updated daily prompt check schedule to ${hour}:00 UTC`);
    return { hour };
  }
}
