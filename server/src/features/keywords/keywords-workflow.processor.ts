import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { and, desc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { AhrefsService } from '../integrations/services/ahrefs.service';
import { SerpService } from '../integrations/services/serp.service';
import { OpenAIService } from '../integrations/services/openai.service';
import { BusinessProfile } from '../integrations/services/openai.service';
import {
  contentPieces,
  keywordProjects,
  keywordWorkflowArtifacts,
  keywordWorkflowJobs,
  keywordWorkflowRuns,
  keywords,
  projectCompetitorMetrics,
  projectCompetitors,
} from '../../db/schema';

interface StepGenerationJobData {
  jobId: string;
  workflowRunId: string;
  projectId: string;
  stepKey: string;
  inputPayload: Record<string, unknown>;
}

interface ArticleGenerationJobData {
  workflowRunId: string;
  targetKeyword: string;
  projectId: string;
}

@Processor('keyword-queue')
export class KeywordWorkflowProcessor extends WorkerHost {
  private readonly logger = new Logger(KeywordWorkflowProcessor.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly ahrefsService: AhrefsService,
    private readonly serpService: SerpService,
    private readonly openaiService: OpenAIService,
  ) {
    super();
  }

  async process(job: Job<StepGenerationJobData | ArticleGenerationJobData>): Promise<void> {
    // Handle article generation jobs (no jobId — fired after content-article approval)
    if (job.name === 'generate-article') {
      await this.generateArticleContent(job.data as ArticleGenerationJobData);
      return;
    }

    const { jobId, stepKey } = job.data as StepGenerationJobData;
    const stepData = job.data as StepGenerationJobData;

    // Skip legacy job types (triggerDiscovery / triggerGapAnalysis)
    if (!jobId) {
      this.logger.warn(`Skipping legacy job: ${job.name}`);
      return;
    }

    this.logger.log(`Processing keyword workflow job ${jobId} for step "${stepKey}"`);

    try {
      await this.updateJobStatus(jobId, 'PROCESSING', 0);

      switch (job.name) {
        case 'generate-serp-niche-map':
          await this.generateSerpNicheMap(stepData);
          break;
        case 'generate-competitor-discovery':
          await this.generateCompetitorDiscovery(stepData);
          break;
        case 'generate-competitor-metrics':
          await this.generateCompetitorMetrics(stepData);
          break;
        case 'generate-phase1-baseline':
          await this.generatePhase1Baseline(stepData);
          break;
        case 'generate-method01':
          await this.generateMethod01(stepData);
          break;
        case 'generate-method02':
          await this.generateMethod02(stepData);
          break;
        case 'generate-method03':
          await this.generateMethod03(stepData);
          break;
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(`Job ${jobId} failed: ${error}`);
      await this.updateJobStatus(jobId, 'FAILED', 0, String(error));
      throw error;
    }
  }

  // ─── Step Handlers ───────────────────────────────────────────

  private async generateSerpNicheMap(data: StepGenerationJobData): Promise<void> {
    const { jobId, workflowRunId, projectId, inputPayload } = data;
    const seedKeywords = inputPayload.seedKeywords as string[];
    const country = inputPayload.country as string;

    await this.updateJobStatus(jobId, 'PROCESSING', 10);

    // Search SERP for each seed keyword (max 15)
    const serpResults: Array<{ keyword: string; organic: Array<{ title: string; link: string; snippet: string; position: number }> }> = [];
    const keywordsToSearch = seedKeywords.slice(0, 15);

    for (let i = 0; i < keywordsToSearch.length; i++) {
      const keyword = keywordsToSearch[i];
      const result = await this.serpService.search(keyword, country, 10);
      if (result) {
        serpResults.push({ keyword, organic: result.organic });
      }
      await this.updateJobStatus(jobId, 'PROCESSING', 10 + Math.round((i + 1) / keywordsToSearch.length * 70));
    }

    // Extract niche structure from SERP results
    const domainOccurrences = new Map<string, number>();
    const pageTypes = new Map<string, number>();

    for (const result of serpResults) {
      for (const item of result.organic) {
        try {
          const host = new URL(item.link).hostname.replace(/^www\./, '');
          domainOccurrences.set(host, (domainOccurrences.get(host) || 0) + 1);

          // Detect page types
          if (/\/(blog|articles|news|insights|magazine)/i.test(item.link)) {
            pageTypes.set('blog', (pageTypes.get('blog') || 0) + 1);
          } else if (/\/(service|services|solutions)/i.test(item.link)) {
            pageTypes.set('service', (pageTypes.get('service') || 0) + 1);
          } else if (/\/(product|shop|store|category)/i.test(item.link)) {
            pageTypes.set('ecommerce', (pageTypes.get('ecommerce') || 0) + 1);
          } else {
            pageTypes.set('other', (pageTypes.get('other') || 0) + 1);
          }
        } catch { /* skip malformed URLs */ }
      }
    }

    await this.updateJobStatus(jobId, 'PROCESSING', 85);

    const payload = {
      serpResults: serpResults.map(r => ({
        keyword: r.keyword,
        topResults: r.organic.slice(0, 5).map(o => ({
          title: o.title,
          link: o.link,
          position: o.position,
        })),
      })),
      nicheMap: {
        dominantDomains: Array.from(domainOccurrences.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([domain, count]) => ({ domain, occurrences: count })),
        pageTypeDistribution: Object.fromEntries(pageTypes),
        searchedKeywords: keywordsToSearch,
      },
      sourceKeywords: seedKeywords,
      country,
    };

    const summary = {
      keywordsSearched: keywordsToSearch.length,
      totalResults: serpResults.reduce((sum, r) => sum + r.organic.length, 0),
      dominantDomainsFound: Math.min(domainOccurrences.size, 20),
    };

    await this.createArtifactAndComplete(jobId, workflowRunId, projectId, 'serp-niche-map', payload, summary);
  }

  private async generateCompetitorDiscovery(data: StepGenerationJobData): Promise<void> {
    const { jobId, workflowRunId, projectId, inputPayload } = data;
    const seedKeywords = inputPayload.seedKeywords as string[];
    const clientDomain = inputPayload.clientDomain as string;
    const country = inputPayload.country as string;

    await this.updateJobStatus(jobId, 'PROCESSING', 10);

    // SERP-based competitor discovery
    const serpCandidates = await this.serpService.discoverCompetitors(
      seedKeywords.slice(0, 10),
      clientDomain,
      country,
    );
    await this.updateJobStatus(jobId, 'PROCESSING', 50);

    // Ahrefs organic competitors
    const ahrefsOrganic = await this.ahrefsService.getOrganicCompetitors(clientDomain, country, 20);
    await this.updateJobStatus(jobId, 'PROCESSING', 80);

    const payload = {
      serpCandidates: serpCandidates.slice(0, 20).map(c => ({
        domain: c.domain,
        occurrences: c.occurrences,
        avgPosition: c.positions.length > 0
          ? Math.round(c.positions.reduce((a, b) => a + b, 0) / c.positions.length)
          : 0,
        sampleUrls: c.sampleUrls,
      })),
      ahrefsOrganic: (ahrefsOrganic ?? []).slice(0, 15).map(c => ({
        domain: c.domain,
        domainRating: c.domainRating,
        keywordsCommon: c.keywordsCommon,
        sharePercent: c.sharePercent,
        traffic: c.traffic,
      })),
      clientDomain,
      country,
      degraded: !ahrefsOrganic ? true : undefined,
    };

    const summary = {
      serpCandidatesFound: serpCandidates.length,
      ahrefsCompetitorsFound: ahrefsOrganic?.length ?? 0,
      degraded: !ahrefsOrganic,
    };

    await this.createArtifactAndComplete(jobId, workflowRunId, projectId, 'competitor-buckets', payload, summary);
  }

  private async generateCompetitorMetrics(data: StepGenerationJobData): Promise<void> {
    const { jobId, workflowRunId, projectId, inputPayload } = data;
    const competitorIds = inputPayload.competitorIds as string[];
    const country = inputPayload.country as string;

    await this.updateJobStatus(jobId, 'PROCESSING', 10);

    // Load approved competitors from DB
    const competitors = await this.database.db
      .select()
      .from(projectCompetitors)
      .where(
        and(
          eq(projectCompetitors.workflowRunId, workflowRunId),
          eq(projectCompetitors.status, 'APPROVED'),
        ),
      );

    const metricsResults: Array<Record<string, unknown>> = [];
    const batchSize = 3;

    for (let i = 0; i < competitors.length; i += batchSize) {
      const batch = competitors.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (comp) => {
          const [overview, topPages] = await Promise.all([
            this.ahrefsService.getDomainOverview(comp.domain, country),
            this.ahrefsService.getTopPages(comp.domain, country, 5),
          ]);

          // Upsert metrics in DB
          const metricsValues = {
            domainRating: overview?.domainRating != null ? Math.round(overview.domainRating) : null,
            organicTraffic: overview?.orgTraffic != null ? Math.round(overview.orgTraffic) : null,
            organicKeywords: overview?.orgKeywords != null ? Math.round(overview.orgKeywords) : null,
            referringDomains: overview?.referringDomains != null ? Math.round(overview.referringDomains) : null,
            backlinks: overview?.backlinks != null ? Math.round(overview.backlinks) : null,
            topPages: topPages.map(p => ({ url: p.url, traffic: p.traffic, topKeyword: p.topKeyword })),
            capturedAt: new Date(),
            updatedAt: new Date(),
          };

          const [existing] = await this.database.db
            .select()
            .from(projectCompetitorMetrics)
            .where(eq(projectCompetitorMetrics.competitorId, comp.id));

          if (existing) {
            await this.database.db
              .update(projectCompetitorMetrics)
              .set(metricsValues)
              .where(eq(projectCompetitorMetrics.competitorId, comp.id));
          } else {
            await this.database.db
              .insert(projectCompetitorMetrics)
              .values({ competitorId: comp.id, ...metricsValues });
          }

          return {
            domain: comp.domain,
            bucket: comp.bucket,
            domainRating: overview?.domainRating ?? 0,
            organicTraffic: overview?.orgTraffic ?? 0,
            organicKeywords: overview?.orgKeywords ?? 0,
            referringDomains: overview?.referringDomains ?? 0,
            backlinks: overview?.backlinks ?? 0,
            topPages,
          };
        }),
      );
      metricsResults.push(...batchResults);
      await this.updateJobStatus(jobId, 'PROCESSING', 10 + Math.round((i + batchSize) / competitors.length * 80));
    }

    const payload = {
      competitorMetrics: metricsResults,
      country,
      competitorsAnalyzed: competitors.length,
      degraded: metricsResults.every(m => (m.domainRating as number) === 0) ? true : undefined,
    };

    const summary = {
      competitorsAnalyzed: competitors.length,
      avgDomainRating: metricsResults.length > 0
        ? Math.round(metricsResults.reduce((s, m) => s + (m.domainRating as number), 0) / metricsResults.length)
        : 0,
    };

    await this.createArtifactAndComplete(jobId, workflowRunId, projectId, 'competitor-metrics', payload, summary);
  }

  private async generatePhase1Baseline(data: StepGenerationJobData): Promise<void> {
    const { jobId, workflowRunId, projectId, inputPayload } = data;
    const clientDomain = inputPayload.clientDomain as string;
    const country = inputPayload.country as string;

    await this.updateJobStatus(jobId, 'PROCESSING', 10);

    // Get client's top pages
    const topPages = await this.ahrefsService.getTopPages(clientDomain, country, 20);
    await this.updateJobStatus(jobId, 'PROCESSING', 40);

    // Get client's organic keywords
    const organicKeywords = await this.ahrefsService.getOrganicKeywords(clientDomain, country, 200);
    await this.updateJobStatus(jobId, 'PROCESSING', 80);

    // Build core topics from top pages
    const coreTopics = new Set<string>();
    for (const page of topPages) {
      if (page.topKeyword) {
        coreTopics.add(page.topKeyword);
      }
    }

    // Build dedupe list from existing keywords (top 50 positions)
    const dedupeList = (organicKeywords ?? [])
      .filter(kw => (kw.position ?? 999) <= 50)
      .map(kw => kw.keyword);

    const payload = {
      existingTopPages: topPages.map(p => ({
        url: p.url,
        traffic: p.traffic,
        topKeyword: p.topKeyword,
        topKeywordVolume: p.topKeywordVolume,
        topKeywordPosition: p.topKeywordPosition,
      })),
      existingKeywords: (organicKeywords ?? []).map(kw => ({
        keyword: kw.keyword,
        volume: kw.volume,
        difficulty: kw.difficulty,
        traffic: kw.traffic,
        position: kw.position ?? null,
        intent: kw.intent,
      })),
      coreTopics: Array.from(coreTopics),
      dedupeList,
      clientDomain,
      country,
      degraded: !organicKeywords && topPages.length === 0 ? true : undefined,
    };

    const summary = {
      topPagesFound: topPages.length,
      existingKeywordsFound: organicKeywords?.length ?? 0,
      coreTopicsIdentified: coreTopics.size,
      dedupeListSize: dedupeList.length,
    };

    await this.createArtifactAndComplete(jobId, workflowRunId, projectId, 'phase1-baseline', payload, summary);
  }

  private async generateMethod01(data: StepGenerationJobData): Promise<void> {
    const { jobId, workflowRunId, projectId, inputPayload } = data;
    const country = inputPayload.country as string;

    await this.updateJobStatus(jobId, 'PROCESSING', 10);

    // Load approved DIRECT competitors
    const directCompetitors = await this.database.db
      .select()
      .from(projectCompetitors)
      .where(
        and(
          eq(projectCompetitors.workflowRunId, workflowRunId),
          eq(projectCompetitors.status, 'APPROVED'),
          eq(projectCompetitors.bucket, 'DIRECT'),
        ),
      );

    const competitorPages: Array<Record<string, unknown>> = [];
    const candidateKeywords: Array<Record<string, unknown>> = [];
    const batchSize = 3;

    for (let i = 0; i < directCompetitors.length; i += batchSize) {
      const batch = directCompetitors.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (comp) => {
          const [topPages, organicKws] = await Promise.all([
            this.ahrefsService.getTopPages(comp.domain, country, 30),
            this.ahrefsService.getOrganicKeywords(comp.domain, country, 50),
          ]);
          return { domain: comp.domain, topPages, organicKws };
        }),
      );

      for (const { domain, topPages, organicKws } of batchResults) {
        competitorPages.push(...topPages.map(p => ({
          domain,
          url: p.url,
          traffic: p.traffic,
          topKeyword: p.topKeyword,
          topKeywordVolume: p.topKeywordVolume,
        })));
        if (organicKws) {
          candidateKeywords.push(...organicKws.map(kw => ({
            keyword: kw.keyword,
            volume: kw.volume,
            difficulty: kw.difficulty,
            traffic: kw.traffic,
            position: kw.position ?? null,
            intent: kw.intent,
            sourceDomain: domain,
          })));
        }
      }
      await this.updateJobStatus(jobId, 'PROCESSING', 10 + Math.round((i + batchSize) / directCompetitors.length * 80));
    }

    const payload = {
      competitorPages,
      candidateKeywords,
      competitorsAnalyzed: directCompetitors.map(c => c.domain),
      country,
      degraded: candidateKeywords.length === 0 && competitorPages.length === 0 ? true : undefined,
    };

    const summary = {
      competitorsAnalyzed: directCompetitors.length,
      topPagesFound: competitorPages.length,
      candidateKeywordsFound: candidateKeywords.length,
    };

    await this.createArtifactAndComplete(jobId, workflowRunId, projectId, 'method01-competitor-pages', payload, summary);
  }

  private async generateMethod02(data: StepGenerationJobData): Promise<void> {
    const { jobId, workflowRunId, projectId, inputPayload } = data;
    const seedKeywords = inputPayload.seedKeywords as string[];
    const country = inputPayload.country as string;

    await this.updateJobStatus(jobId, 'PROCESSING', 10);

    const matchingTerms: Array<Record<string, unknown>> = [];
    const relatedTerms: Array<Record<string, unknown>> = [];
    const parentTopicGroups = new Map<string, string[]>();

    for (let i = 0; i < seedKeywords.length; i++) {
      const seed = seedKeywords[i];
      const [matching, related] = await Promise.all([
        this.ahrefsService.getMatchingTerms([seed], country, 100),
        this.ahrefsService.getRelatedTerms([seed], country, 50),
      ]);

      if (matching) {
        for (const kw of matching) {
          matchingTerms.push({
            keyword: kw.keyword,
            volume: kw.volume,
            difficulty: kw.difficulty,
            traffic: kw.traffic,
            intent: kw.intent,
            parentTopic: kw.parentTopic ?? null,
            sourceSeed: seed,
          });
          if (kw.parentTopic) {
            const group = parentTopicGroups.get(kw.parentTopic) ?? [];
            group.push(kw.keyword);
            parentTopicGroups.set(kw.parentTopic, group);
          }
        }
      }

      if (related) {
        for (const kw of related) {
          relatedTerms.push({
            keyword: kw.keyword,
            volume: kw.volume,
            difficulty: kw.difficulty,
            traffic: kw.traffic,
            intent: kw.intent,
            parentTopic: kw.parentTopic ?? null,
            sourceSeed: seed,
          });
          if (kw.parentTopic) {
            const group = parentTopicGroups.get(kw.parentTopic) ?? [];
            group.push(kw.keyword);
            parentTopicGroups.set(kw.parentTopic, group);
          }
        }
      }

      await this.updateJobStatus(jobId, 'PROCESSING', 10 + Math.round((i + 1) / seedKeywords.length * 80));
    }

    const payload = {
      matchingTerms,
      relatedTerms,
      parentTopicGroups: Array.from(parentTopicGroups.entries()).map(([topic, kws]) => ({
        parentTopic: topic,
        keywords: [...new Set(kws)],
        keywordCount: new Set(kws).size,
      })),
      seedKeywords,
      country,
      degraded: matchingTerms.length === 0 && relatedTerms.length === 0 ? true : undefined,
    };

    const summary = {
      seedsExpanded: seedKeywords.length,
      matchingTermsFound: matchingTerms.length,
      relatedTermsFound: relatedTerms.length,
      parentTopicGroupsFound: parentTopicGroups.size,
    };

    await this.createArtifactAndComplete(jobId, workflowRunId, projectId, 'method02-seed-expansion', payload, summary);
  }

  // ─── Article Generation ───────────────────────────────────────

  private async generateArticleContent(data: ArticleGenerationJobData): Promise<void> {
    const { workflowRunId, targetKeyword } = data;
    this.logger.log(`Generating article content for "${targetKeyword}" (workflow ${workflowRunId})`);

    const [workflowKeyword] = await this.database.db
      .select()
      .from(keywords)
      .where(and(eq(keywords.workflowRunId, workflowRunId), eq(keywords.keyword, targetKeyword)));

    if (!workflowKeyword) {
      this.logger.warn(`Keyword "${targetKeyword}" not found in workflow ${workflowRunId} — skipping article generation`);
      return;
    }

    const [contentPiece] = await this.database.db
      .select()
      .from(contentPieces)
      .where(eq(contentPieces.keywordId, workflowKeyword.id));

    if (!contentPiece) {
      this.logger.warn(`No content piece found for keyword "${targetKeyword}" — skipping article generation`);
      return;
    }

    const brief = contentPiece.brief && typeof contentPiece.brief === 'object'
      ? (contentPiece.brief as Record<string, unknown>)
      : {};
    const articleInput = contentPiece.reviewNotes && typeof contentPiece.reviewNotes === 'object'
      ? ((contentPiece.reviewNotes as Record<string, unknown>).articleInput as Record<string, unknown> | undefined) ?? {}
      : {};

    const combinedBrief: Record<string, unknown> = {
      ...brief,
      ...articleInput,
      title: contentPiece.title,
      targetKeyword,
    };

    const articleBody = await this.openaiService.generateArticle(combinedBrief);

    await this.database.db
      .update(contentPieces)
      .set({ body: articleBody, status: 'PUBLISHED' as const })
      .where(eq(contentPieces.id, contentPiece.id));

    this.logger.log(`Article generation complete for "${targetKeyword}" (${articleBody.length} chars)`);
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private async updateJobStatus(
    jobId: string,
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
    progress: number,
    error?: string,
  ): Promise<void> {
    const updates: Record<string, unknown> = { status, progress };
    if (status === 'PROCESSING' && progress === 0) {
      updates.startedAt = new Date();
    }
    if (status === 'COMPLETED' || status === 'FAILED') {
      updates.completedAt = new Date();
    }
    if (error) {
      updates.error = error.slice(0, 2000);
    }

    await this.database.db
      .update(keywordWorkflowJobs)
      .set(updates)
      .where(eq(keywordWorkflowJobs.id, jobId));
  }

  private async createArtifactAndComplete(
    jobId: string,
    workflowRunId: string,
    projectId: string,
    stepKey: string,
    payload: Record<string, unknown>,
    summary: Record<string, unknown>,
  ): Promise<void> {
    const [latestArtifact] = await this.database.db
      .select()
      .from(keywordWorkflowArtifacts)
      .where(
        and(
          eq(keywordWorkflowArtifacts.workflowRunId, workflowRunId),
          eq(keywordWorkflowArtifacts.stepKey, stepKey),
        ),
      )
      .orderBy(desc(keywordWorkflowArtifacts.createdAt), desc(keywordWorkflowArtifacts.id))
      .limit(1);

    if (latestArtifact?.status === 'APPROVED') {
      throw new Error(`Approved step "${stepKey}" cannot be regenerated.`);
    }

    const [artifact] = latestArtifact
      ? await this.database.db
          .update(keywordWorkflowArtifacts)
          .set({
            status: 'AWAITING_APPROVAL',
            summary,
            payload,
          })
          .where(eq(keywordWorkflowArtifacts.id, latestArtifact.id))
          .returning()
      : await this.database.db
          .insert(keywordWorkflowArtifacts)
          .values({
            workflowRunId,
            stepKey,
            status: 'AWAITING_APPROVAL',
            summary,
            payload,
          })
          .returning();

    // Update workflow run status
    await this.database.db
      .update(keywordWorkflowRuns)
      .set({
        status: 'AWAITING_APPROVAL',
        currentStep: stepKey,
        currentCheckpoint: stepKey,
        updatedAt: new Date(),
      })
      .where(eq(keywordWorkflowRuns.id, workflowRunId));

    // Mark job complete
    await this.database.db
      .update(keywordWorkflowJobs)
      .set({
        status: 'COMPLETED',
        progress: 100,
        resultArtifactId: artifact.id,
        completedAt: new Date(),
      })
      .where(eq(keywordWorkflowJobs.id, jobId));

    this.logger.log(`Job ${jobId} completed → checkpoint ${artifact.id} (${stepKey})`);
  }

  private async generateMethod03(data: StepGenerationJobData): Promise<void> {
    const { jobId, workflowRunId, projectId, inputPayload } = data;
    const clientDomain = inputPayload.clientDomain as string;
    const country = inputPayload.country as string;

    await this.updateJobStatus(jobId, 'PROCESSING', 5);

    // Load approved DIRECT competitors
    const directCompetitors = await this.database.db
      .select()
      .from(projectCompetitors)
      .where(
        and(
          eq(projectCompetitors.workflowRunId, workflowRunId),
          eq(projectCompetitors.status, 'APPROVED'),
          eq(projectCompetitors.bucket, 'DIRECT'),
        ),
      );

    if (directCompetitors.length === 0) {
      throw new Error('No approved direct competitors found. Approve the competitor-buckets step first.');
    }

    // Load project seed keywords for OpenAI context
    const [project] = await this.database.db
      .select()
      .from(keywordProjects)
      .where(eq(keywordProjects.id, projectId));

    await this.updateJobStatus(jobId, 'PROCESSING', 10);

    // Fetch client's existing organic keywords (exclusion set — keywords they already rank for)
    const clientOrganic = await this.ahrefsService.getOrganicKeywords(clientDomain, country, 500);
    const clientKeywordSet = new Set(
      (clientOrganic ?? []).map((kw) => kw.keyword.toLowerCase().trim()),
    );

    await this.updateJobStatus(jobId, 'PROCESSING', 25);

    // For each direct competitor, fetch organic keywords and build gap map
    type GapEntry = {
      keyword: string;
      volume: number | null;
      difficulty: number | null;
      competitors: string[];
      intent: { informational: boolean; commercial: boolean; transactional: boolean; navigational: boolean };
    };
    const gapKeywordMap = new Map<string, GapEntry>();
    const batchSize = 3;

    for (let i = 0; i < directCompetitors.length; i += batchSize) {
      const batch = directCompetitors.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (comp) => ({
          domain: comp.domain,
          keywords: await this.ahrefsService.getOrganicKeywords(comp.domain, country, 200),
        })),
      );

      for (const { domain, keywords: compKeywords } of batchResults) {
        if (!compKeywords) continue;
        for (const kw of compKeywords) {
          const normalized = kw.keyword.toLowerCase().trim();
          if (clientKeywordSet.has(normalized)) continue;
          const existing = gapKeywordMap.get(normalized);
          if (existing) {
            if (!existing.competitors.includes(domain)) existing.competitors.push(domain);
          } else {
            gapKeywordMap.set(normalized, {
              keyword: kw.keyword,
              volume: kw.volume,
              difficulty: kw.difficulty,
              competitors: [domain],
              intent: kw.intent,
            });
          }
        }
      }

      await this.updateJobStatus(
        jobId,
        'PROCESSING',
        25 + Math.round(((i + batchSize) / directCompetitors.length) * 45),
      );
    }

    // Sort: multi-competitor overlap first, then by volume
    const sortedGap = Array.from(gapKeywordMap.values())
      .sort((a, b) => {
        if (b.competitors.length !== a.competitors.length) return b.competitors.length - a.competitors.length;
        return (b.volume ?? 0) - (a.volume ?? 0);
      })
      .slice(0, 150);

    await this.updateJobStatus(jobId, 'PROCESSING', 75);

    // OpenAI enrichment — classify by intent, funnel, content type, parent topic
    type ClassifiedGapKeyword = {
      keyword: string;
      volume: number | null;
      difficulty: number | null;
      competitorCount: number;
      competitors: string[];
      intent: string;
      funnel: string;
      contentType: string;
      parentTopic: string;
    };
    let classifiedKeywords: ClassifiedGapKeyword[] = [];

    if (sortedGap.length > 0) {
      const minimalProfile: BusinessProfile = {
        brandIdentity: clientDomain,
        targetMarket: country.toUpperCase(),
        operationalModel: 'ecommerce',
        services: Array.isArray(project?.seedKeywords) && project.seedKeywords.length > 0
          ? (project.seedKeywords as string[])
          : [clientDomain],
        geography: country.toUpperCase(),
        toneOfVoice: 'professional',
        seedKeywords: Array.isArray(project?.seedKeywords) ? (project.seedKeywords as string[]) : [],
      };

      try {
        const classifications = await this.openaiService.classifyContentGap(
          sortedGap.map((kw) => ({
            keyword: kw.keyword,
            volume: kw.volume ?? 0,
            difficulty: kw.difficulty ?? 0,
            competitorCount: kw.competitors.length,
          })),
          minimalProfile,
        );

        const classMap = new Map(classifications.map((c) => [c.keyword.toLowerCase().trim(), c]));
        classifiedKeywords = sortedGap.map((kw) => {
          const cls = classMap.get(kw.keyword.toLowerCase().trim());
          return {
            keyword: kw.keyword,
            volume: kw.volume,
            difficulty: kw.difficulty,
            competitorCount: kw.competitors.length,
            competitors: kw.competitors,
            intent: cls?.intent ?? (kw.intent.transactional ? 'transactional' : kw.intent.commercial ? 'commercial' : 'informational'),
            funnel: cls?.funnel ?? 'TOFU',
            contentType: cls?.contentType ?? 'Blog Post',
            parentTopic: cls?.parentTopic ?? 'Uncategorized',
          };
        });
      } catch (err) {
        this.logger.warn(`Method 03 OpenAI classification failed: ${err} — using Ahrefs intent fallback`);
        classifiedKeywords = sortedGap.map((kw) => ({
          keyword: kw.keyword,
          volume: kw.volume,
          difficulty: kw.difficulty,
          competitorCount: kw.competitors.length,
          competitors: kw.competitors,
          intent: kw.intent.transactional ? 'transactional' : kw.intent.commercial ? 'commercial' : 'informational',
          funnel: 'TOFU',
          contentType: 'Blog Post',
          parentTopic: 'Uncategorized',
        }));
      }
    }

    await this.updateJobStatus(jobId, 'PROCESSING', 95);

    const payload = {
      gapKeywords: classifiedKeywords,
      competitorsAnalyzed: directCompetitors.map((c) => c.domain),
      clientDomain,
      country,
      clientExclusionKeywordsCount: clientKeywordSet.size,
      dataSource: 'api-approximation' as const,
      generatedAt: new Date().toISOString(),
      degraded: classifiedKeywords.length === 0 ? true : undefined,
    };

    const summary = {
      gapKeywordsFound: classifiedKeywords.length,
      competitorsAnalyzed: directCompetitors.length,
      clientExclusionKeywordsCount: clientKeywordSet.size,
      multiCompetitorGapKeywords: classifiedKeywords.filter((kw) => kw.competitorCount > 1).length,
    };

    await this.createArtifactAndComplete(jobId, workflowRunId, projectId, 'method03-content-gap-import', payload, summary);
  }
}
