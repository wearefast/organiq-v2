import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { ScraperService } from '../integrations/services/scraper.service';
import { OpenAIService, BusinessProfile, DeepRead, KeywordResearchSteps, CompetitorClassification } from '../integrations/services/openai.service';
import { PageSpeedService } from '../integrations/services/pagespeed.service';
import { AhrefsService } from '../integrations/services/ahrefs.service';
import { SerpService, CompetitorCandidate } from '../integrations/services/serp.service';
import { audits, leads } from '../../db/schema';

interface AuditJobData {
  auditId: string;
  leadId: string;
  websiteUrl: string;
}

@Processor('audit-queue')
export class AuditProcessor extends WorkerHost {
  private readonly logger = new Logger(AuditProcessor.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly scraperService: ScraperService,
    private readonly openaiService: OpenAIService,
    private readonly pageSpeedService: PageSpeedService,
    private readonly ahrefsService: AhrefsService,
    private readonly serpService: SerpService,
  ) {
    super();
  }

  async process(job: Job<AuditJobData>): Promise<void> {
    const { auditId, leadId, websiteUrl } = job.data;
    this.logger.log(`Processing audit ${auditId} for ${websiteUrl}`);

    try {
      // Mark as processing
      await this.updateAudit(auditId, { status: 'PROCESSING', currentStep: 'SCRAPING' });
      await job.updateProgress(5);

      // Read user-selected countries from audit record
      const [auditRow] = await this.database.db
        .select({ countries: audits.countries })
        .from(audits)
        .where(eq(audits.id, auditId));
      const userCountries = (auditRow?.countries as string[]) ?? [];

      // Step 1a: Scrape
      const scrapeResult = await this.scraperService.scrape(websiteUrl);
      await this.updateAudit(auditId, {
        currentStep: 'SCRAPE_COMPLETE',
        rawData: { scrape: scrapeResult },
      });
      await job.updateProgress(10);
      this.logger.log(`Audit ${auditId}: scrape complete`);

      // Step 1b: Generate business profile via OpenAI
      await this.updateAudit(auditId, { currentStep: 'GENERATING_PROFILE' });
      await job.updateProgress(12);

      // Fetch businessDescription from the lead record
      const [lead] = await this.database.db
        .select({ businessDetails: leads.businessDetails })
        .from(leads)
        .where(eq(leads.id, leadId));

      const businessDescription =
        (lead?.businessDetails as Record<string, string>)?.description || '';

      const businessProfile = await this.openaiService.generateBusinessProfile(
        scrapeResult.bodyText,
        businessDescription,
      );

      await this.updateAudit(auditId, {
        currentStep: 'PROFILE_COMPLETE',
        businessProfile,
        seedKeywords: businessProfile.seedKeywords,
      });
      await job.updateProgress(18);
      this.logger.log(`Audit ${auditId}: business profile generated with ${businessProfile.seedKeywords.length} seed keywords`);

      // Step 2: Deep-Read Business Profile distillation
      await this.updateAudit(auditId, { currentStep: 'DEEPREAD_RUNNING' });
      await job.updateProgress(19);

      const deepRead = await this.openaiService.generateDeepRead(businessProfile);
      await this.updateAudit(auditId, {
        currentStep: 'DEEPREAD_COMPLETE',
        rawData: { deepRead },
      });
      await job.updateProgress(20);
      this.logger.log(`Audit ${auditId}: deep-read distillation complete`);

      // Step 3: PageSpeed Insights (non-blocking — skip on any failure)
      await this.updateAudit(auditId, { currentStep: 'PAGESPEED_RUNNING' });
      await job.updateProgress(22);

      let pageSpeedResult = null;
      try {
        pageSpeedResult = await this.pageSpeedService.analyze(websiteUrl);
      } catch (psError) {
        this.logger.error(`Audit ${auditId}: PageSpeed threw unexpectedly: ${psError}`);
      }
      if (pageSpeedResult) {
        await this.updateAudit(auditId, {
          currentStep: 'PAGESPEED_COMPLETE',
          rawData: { pageSpeed: pageSpeedResult },
        });
        this.logger.log(
          `Audit ${auditId}: PageSpeed complete — mobile perf=${pageSpeedResult.mobile.performanceScore}, desktop perf=${pageSpeedResult.desktop.performanceScore}`,
        );
      } else {
        await this.updateAudit(auditId, { currentStep: 'PAGESPEED_COMPLETE' });
        this.logger.warn(`Audit ${auditId}: PageSpeed skipped, continuing pipeline`);
      }
      await job.updateProgress(30);

      // Step 03: Identify Core Keywords (Ahrefs + OpenAI classification)
      await this.updateAudit(auditId, { currentStep: 'KEYWORDS_RUNNING' });
      await job.updateProgress(32);

      // Parse country: prefer user-selected countries, fallback to geography-based detection
      const countryCode = userCountries.length > 0
        ? userCountries[0]
        : this.parseCountryCode(businessProfile.geography);

      // Collect keyword data from Ahrefs (returns null if no API key)
      const domain = new URL(websiteUrl).hostname;
      const [organicKeywords, matchingTerms] = await Promise.all([
        this.ahrefsService.getOrganicKeywords(domain, countryCode),
        this.ahrefsService.getMatchingTerms(businessProfile.seedKeywords, countryCode),
      ]);

      // Merge and deduplicate keyword pool
      const keywordMap = new Map<string, (typeof organicKeywords extends (infer T)[] | null ? T : never)>();
      if (organicKeywords) {
        for (const kw of organicKeywords) keywordMap.set(kw.keyword, kw);
      }
      if (matchingTerms) {
        for (const kw of matchingTerms) {
          if (!keywordMap.has(kw.keyword)) keywordMap.set(kw.keyword, kw);
        }
      }
      const keywordPool = Array.from(keywordMap.values());

      const poolSize = keywordPool.length;
      this.logger.log(
        `Audit ${auditId}: keyword pool assembled — ${organicKeywords?.length ?? 0} organic + ${matchingTerms?.length ?? 0} matching = ${poolSize} unique`,
      );

      // Persist Ahrefs data collection as its own step
      await this.updateAudit(auditId, {
        currentStep: 'KW_AHREFS_COMPLETE',
        rawData: {
          ahrefsSummary: {
            organicCount: organicKeywords?.length ?? 0,
            matchingCount: matchingTerms?.length ?? 0,
            poolSize,
          },
          keywordPool: keywordPool.map(kw => ({
            keyword: kw.keyword,
            volume: kw.volume,
            difficulty: kw.difficulty,
            traffic: kw.traffic,
            position: kw.position ?? null,
            intent: kw.intent,
          })),
        },
      });
      await job.updateProgress(33);

      // Classify via 5-step intelligence chain (works in degraded mode with empty pool — uses seedKeywords only)
      const { research: keywordResearch, steps: keywordSteps } = await this.openaiService.classifyKeywords(
        businessProfile,
        deepRead,
        poolSize > 0 ? keywordPool : null,
        scrapeResult.bodyText,
        async (pct, subStepKey, partialSteps) => {
          await job.updateProgress(pct);
          await this.updateAudit(auditId, {
            currentStep: subStepKey,
            rawData: { keywordSteps: partialSteps },
          });
        },
      );

      // Enrich volume/KD from Ahrefs data (GPT may hallucinate metrics — trust Ahrefs only)
      if (poolSize > 0) {
        const metricsMap = new Map(keywordPool.map(kw => [kw.keyword.toLowerCase(), kw]));
        for (const kw of keywordResearch.coreKeywords) {
          const match = metricsMap.get(kw.keyword.toLowerCase());
          kw.volume = match?.volume ?? null;
          kw.difficulty = match?.difficulty ?? null;
        }
        for (const kw of keywordResearch.moneyKeywords) {
          const match = metricsMap.get(kw.keyword.toLowerCase());
          kw.volume = match?.volume ?? null;
          kw.difficulty = match?.difficulty ?? null;
        }
        this.logger.log(`Audit ${auditId}: enriched keyword metrics from Ahrefs pool`);
      }

      await this.updateAudit(auditId, {
        currentStep: 'KEYWORDS_COMPLETE',
        rawData: { keywordResearch, seedExpansions: keywordResearch.seedExpansions, keywordSteps },
      });
      await job.updateProgress(45);
      this.logger.log(
        `Audit ${auditId}: keyword chain complete — ${keywordResearch.coreKeywords.length} core, ${keywordResearch.moneyKeywords.length} money, ${keywordResearch.primaryTopics.length} topics, ${keywordResearch.coreTopics.length} core topics`,
      );

      // Step 04: Competitor Discovery via Google SERP + Classification
      await this.updateAudit(auditId, { currentStep: 'COMPETITORS_RUNNING' });
      await job.updateProgress(46);

      // Pick top keywords to search: up to 5 seed + top 5 money keywords = max 10 queries
      const searchKeywords = [
        ...businessProfile.seedKeywords.slice(0, 5),
        ...keywordResearch.moneyKeywords.slice(0, 5).map(k => k.keyword),
      ];
      const uniqueSearchKeywords = [...new Set(searchKeywords)];

      this.logger.log(
        `Audit ${auditId}: searching SERP for ${uniqueSearchKeywords.length} keywords (country=${countryCode})`,
      );

      const competitorCandidates: CompetitorCandidate[] = await this.serpService.discoverCompetitors(
        uniqueSearchKeywords,
        domain,
        countryCode,
      );

      // Persist raw SERP competitor candidates
      await this.updateAudit(auditId, {
        currentStep: 'SERP_COMPLETE',
        rawData: {
          serpCandidates: competitorCandidates.slice(0, 20).map(c => ({
            domain: c.domain,
            occurrences: c.occurrences,
            avgPosition: Math.round(c.positions.reduce((a, b) => a + b, 0) / c.positions.length),
            sampleUrls: c.sampleUrls,
          })),
        },
      });
      await job.updateProgress(48);
      this.logger.log(
        `Audit ${auditId}: SERP discovery found ${competitorCandidates.length} candidate domains`,
      );

      // Classify competitors via OpenAI (Direct vs Organic)
      let competitors: CompetitorClassification = { directCompetitors: [], organicCompetitors: [] };
      if (competitorCandidates.length > 0) {
        competitors = await this.openaiService.classifyCompetitors(
          competitorCandidates.slice(0, 15),
          businessProfile,
          deepRead,
        );
      }

      await this.updateAudit(auditId, {
        currentStep: 'COMPETITORS_COMPLETE',
        rawData: { competitors },
      });
      await job.updateProgress(50);
      this.logger.log(
        `Audit ${auditId}: competitor classification complete — ${competitors.directCompetitors.length} direct, ${competitors.organicCompetitors.length} organic`,
      );

      // Step 5: Competitor Metrics (Ahrefs) — non-blocking
      await this.updateAudit(auditId, { currentStep: 'COMPETITOR_METRICS_RUNNING' });
      await job.updateProgress(51);

      let competitorMetrics: Record<string, unknown> | null = null;
      try {
        const allDirectDomains = competitors.directCompetitors.map(c => c.domain);
        const clientMetrics = await this.ahrefsService.getDomainOverview(domain, countryCode);

        // Fetch metrics + top pages for each competitor (max 3 concurrent)
        const competitorResults: Array<Record<string, unknown>> = [];
        const batchSize = 3;
        for (let i = 0; i < allDirectDomains.length; i += batchSize) {
          const batch = allDirectDomains.slice(i, i + batchSize);
          const batchResults = await Promise.all(
            batch.map(async (compDomain) => {
              const [overview, topPages] = await Promise.all([
                this.ahrefsService.getDomainOverview(compDomain, countryCode),
                this.ahrefsService.getTopPages(compDomain, countryCode, 5),
              ]);
              const hasBlog = topPages.some(p =>
                /\/(blog|resources|articles|news|insights)(\/|$)/i.test(p.url),
              );
              const blogPage = topPages.find(p =>
                /\/(blog|resources|articles|news|insights)(\/|$)/i.test(p.url),
              );
              const reason = competitors.directCompetitors.find(c => c.domain === compDomain)?.reason || '';
              return {
                domain: compDomain,
                type: 'direct',
                reason,
                metrics: overview ?? { domain: compDomain, domainRating: 0, ahrefsRank: null, backlinks: 0, referringDomains: 0, orgKeywords: 0, orgTraffic: 0, orgCost: null },
                topPages,
                hasBlog,
                blogUrl: blogPage?.url ?? null,
              };
            }),
          );
          competitorResults.push(...batchResults);
        }

        competitorMetrics = {
          clientMetrics: clientMetrics ?? { domain, domainRating: 0, ahrefsRank: null, backlinks: 0, referringDomains: 0, orgKeywords: 0, orgTraffic: 0, orgCost: null },
          competitors: competitorResults,
        };
      } catch (metricsError) {
        this.logger.error(`Audit ${auditId}: Competitor metrics failed: ${metricsError}`);
      }

      if (competitorMetrics) {
        await this.updateAudit(auditId, {
          currentStep: 'COMPETITOR_METRICS_COMPLETE',
          rawData: { competitorMetrics },
        });
        const compArr = competitorMetrics.competitors as Array<Record<string, unknown>>;
        const avgDR = compArr.length > 0
          ? Math.round(compArr.reduce((sum, c) => sum + ((c.metrics as Record<string, number>)?.domainRating ?? 0), 0) / compArr.length)
          : 0;
        this.logger.log(
          `Audit ${auditId}: competitor metrics complete — ${compArr.length} competitors, avg DR=${avgDR}`,
        );
      } else {
        await this.updateAudit(auditId, { currentStep: 'COMPETITOR_METRICS_COMPLETE' });
        this.logger.warn(`Audit ${auditId}: competitor metrics skipped (no API key or error)`);
      }
      await job.updateProgress(60);

      // Step 6: Organic Competitor Analysis (Ahrefs) — non-blocking
      await this.updateAudit(auditId, { currentStep: 'ORGANIC_COMPETITORS_RUNNING' });
      await job.updateProgress(61);

      let organicCompetitorMetrics: Record<string, unknown> | null = null;
      try {
        // Excluded platforms that are never real organic competitors
        const EXCLUDED_PLATFORMS = new Set([
          'youtube.com', 'instagram.com', 'facebook.com', 'linkedin.com',
          'twitter.com', 'x.com', 'pinterest.com', 'tiktok.com', 'reddit.com',
          'amazon.com', 'amazon.ae', 'amazon.co.uk', 'amazon.de', 'amazon.fr',
          'ebay.com', 'walmart.com', 'noon.com', 'alibaba.com',
          'yelp.com', 'tripadvisor.com', 'capterra.com', 'g2.com',
          'canva.com', 'zapier.com', 'wikipedia.org',
        ]);

        const directDomains = new Set(competitors.directCompetitors.map(c => c.domain));
        const gptOrganicCompetitors = competitors.organicCompetitors || [];

        // Primary: Ahrefs organic competitors by keyword overlap
        const ahrefsOrganic = await this.ahrefsService.getOrganicCompetitors(domain, countryCode, 20);

        let selectedCompetitors: Array<{
          domain: string;
          source: 'ahrefs' | 'gpt';
          reason: string;
          overlapMetrics: { keywordsCommon: number; keywordsCompetitorOnly: number; sharePercent: number } | null;
        }> = [];

        if (ahrefsOrganic && ahrefsOrganic.length > 0) {
          // Filter exclusions and direct competitors
          const filtered = ahrefsOrganic.filter(c =>
            c.domain !== domain &&
            !directDomains.has(c.domain) &&
            !EXCLUDED_PLATFORMS.has(c.domain),
          );

          selectedCompetitors = filtered.slice(0, 10).map(c => ({
            domain: c.domain,
            source: 'ahrefs' as const,
            reason: `Ranks for ${c.keywordsCommon} common keywords (${c.sharePercent}% overlap)`,
            overlapMetrics: {
              keywordsCommon: c.keywordsCommon,
              keywordsCompetitorOnly: c.keywordsCompetitorOnly,
              sharePercent: c.sharePercent,
            },
          }));
        }

        // Merge GPT-classified organic competitors (lower priority)
        if (selectedCompetitors.length < 10 && gptOrganicCompetitors.length > 0) {
          const alreadyIncluded = new Set(selectedCompetitors.map(c => c.domain));
          for (const gptComp of gptOrganicCompetitors) {
            if (selectedCompetitors.length >= 10) break;
            if (!alreadyIncluded.has(gptComp.domain) && !EXCLUDED_PLATFORMS.has(gptComp.domain)) {
              selectedCompetitors.push({
                domain: gptComp.domain,
                source: 'gpt',
                reason: gptComp.reason,
                overlapMetrics: null,
              });
            }
          }
        }

        // Enrich each organic competitor with metrics + top pages (batch 3 concurrent)
        const enrichedCompetitors: Array<Record<string, unknown>> = [];
        const batchSize = 3;
        for (let i = 0; i < selectedCompetitors.length; i += batchSize) {
          const batch = selectedCompetitors.slice(i, i + batchSize);
          const batchResults = await Promise.all(
            batch.map(async (comp) => {
              const [overview, topPages] = await Promise.all([
                this.ahrefsService.getDomainOverview(comp.domain, countryCode),
                this.ahrefsService.getTopPages(comp.domain, countryCode, 5),
              ]);
              const contentPattern = /\/(blog|resources|articles|news|insights|guide|how-to|learn|magazine)(\/|$)/i;
              const contentPages = topPages.filter(p => contentPattern.test(p.url));
              const hasBlog = contentPages.length > 0;
              const blogUrl = contentPages[0]?.url ?? null;
              return {
                domain: comp.domain,
                source: comp.source,
                reason: comp.reason,
                overlapMetrics: comp.overlapMetrics,
                metrics: overview ?? { domain: comp.domain, domainRating: 0, ahrefsRank: null, backlinks: 0, referringDomains: 0, orgKeywords: 0, orgTraffic: 0, orgCost: null },
                topPages,
                contentPages,
                hasBlog,
                blogUrl,
              };
            }),
          );
          enrichedCompetitors.push(...batchResults);
        }

        organicCompetitorMetrics = {
          source: ahrefsOrganic && ahrefsOrganic.length > 0 ? 'ahrefs' : 'gpt-only',
          competitors: enrichedCompetitors,
        };
      } catch (orgError) {
        this.logger.error(`Audit ${auditId}: Organic competitor analysis failed: ${orgError}`);
      }

      if (organicCompetitorMetrics) {
        await this.updateAudit(auditId, {
          currentStep: 'ORGANIC_COMPETITORS_COMPLETE',
          rawData: { organicCompetitorMetrics },
        });
        const orgArr = organicCompetitorMetrics.competitors as Array<Record<string, unknown>>;
        const avgOverlap = orgArr.length > 0
          ? Math.round(orgArr.reduce((sum, c) => sum + ((c.overlapMetrics as Record<string, number>)?.sharePercent ?? 0), 0) / orgArr.length)
          : 0;
        this.logger.log(
          `Audit ${auditId}: organic competitor analysis complete — ${orgArr.length} competitors, avg overlap=${avgOverlap}%`,
        );
      } else {
        await this.updateAudit(auditId, { currentStep: 'ORGANIC_COMPETITORS_COMPLETE' });
        this.logger.warn(`Audit ${auditId}: organic competitor analysis skipped`);
      }
      await job.updateProgress(70);

      // Step 7: Content Gap Analysis — non-blocking
      await this.updateAudit(auditId, { currentStep: 'CONTENT_GAP_RUNNING' });
      await job.updateProgress(71);

      let contentGapResult: Record<string, unknown> | null = null;
      try {
        type GapCandidate = {
          domain: string;
          source: 'direct' | 'organic';
          domainRating: number;
          orgKeywords: number;
          orgTraffic: number;
          topPagesCount: number;
          overlapShare: number;
          commonKeywords: number;
        };

        const getNumber = (value: unknown) => (typeof value === 'number' ? value : 0);
        const getTopPagesCount = (candidate: Record<string, unknown>) => {
          const topPages = candidate.topPages;
          return Array.isArray(topPages) ? topPages.length : 0;
        };
        const hasStoredFootprint = (candidate: GapCandidate) =>
          candidate.topPagesCount > 0 ||
          candidate.orgKeywords > 0 ||
          candidate.orgTraffic > 0 ||
          candidate.overlapShare > 0 ||
          candidate.commonKeywords > 0;

        const directMetricCandidates = competitorMetrics
          ? (competitorMetrics.competitors as Array<Record<string, unknown>>).map((candidate) => {
            const metrics = (candidate.metrics as Record<string, unknown>) ?? {};
            return {
              domain: candidate.domain as string,
              source: 'direct' as const,
              domainRating: getNumber(metrics.domainRating),
              orgKeywords: getNumber(metrics.orgKeywords),
              orgTraffic: getNumber(metrics.orgTraffic),
              topPagesCount: getTopPagesCount(candidate),
              overlapShare: 0,
              commonKeywords: 0,
            };
          })
          : competitors.directCompetitors.map((candidate) => ({
            domain: candidate.domain,
            source: 'direct' as const,
            domainRating: 0,
            orgKeywords: 0,
            orgTraffic: 0,
            topPagesCount: 0,
            overlapShare: 0,
            commonKeywords: 0,
          }));

        const filteredDirectCandidates = directMetricCandidates.filter(hasStoredFootprint);
        const directCandidatePool = (filteredDirectCandidates.length > 0 ? filteredDirectCandidates : directMetricCandidates)
          .sort((a, b) =>
            Number(b.topPagesCount > 0) - Number(a.topPagesCount > 0) ||
            b.orgKeywords - a.orgKeywords ||
            b.orgTraffic - a.orgTraffic ||
            b.domainRating - a.domainRating,
          );

        const organicMetricCandidates = organicCompetitorMetrics
          ? (organicCompetitorMetrics.competitors as Array<Record<string, unknown>>).map((candidate) => {
            const metrics = (candidate.metrics as Record<string, unknown>) ?? {};
            const overlapMetrics = (candidate.overlapMetrics as Record<string, unknown>) ?? {};
            return {
              domain: candidate.domain as string,
              source: 'organic' as const,
              domainRating: getNumber(metrics.domainRating),
              orgKeywords: getNumber(metrics.orgKeywords),
              orgTraffic: getNumber(metrics.orgTraffic),
              topPagesCount: getTopPagesCount(candidate),
              overlapShare: getNumber(overlapMetrics.sharePercent),
              commonKeywords: getNumber(overlapMetrics.keywordsCommon),
            };
          })
          : competitors.organicCompetitors.map((candidate) => ({
            domain: candidate.domain,
            source: 'organic' as const,
            domainRating: 0,
            orgKeywords: 0,
            orgTraffic: 0,
            topPagesCount: 0,
            overlapShare: 0,
            commonKeywords: 0,
          }));

        const filteredOrganicCandidates = organicMetricCandidates.filter(hasStoredFootprint);
        const organicCandidatePool = (filteredOrganicCandidates.length > 0 ? filteredOrganicCandidates : organicMetricCandidates)
          .sort((a, b) =>
            b.overlapShare - a.overlapShare ||
            b.commonKeywords - a.commonKeywords ||
            Number(b.topPagesCount > 0) - Number(a.topPagesCount > 0) ||
            b.orgKeywords - a.orgKeywords ||
            b.orgTraffic - a.orgTraffic ||
            b.domainRating - a.domainRating,
          );

        this.logger.log(
          `Audit ${auditId}: content gap ranked direct candidates — ${directCandidatePool.map(candidate => candidate.domain).join(', ') || 'none'}`,
        );
        this.logger.log(
          `Audit ${auditId}: content gap ranked organic candidates — ${organicCandidatePool.map(candidate => candidate.domain).join(', ') || 'none'}`,
        );

        // Get target's keyword pool from persisted data (or re-fetch)
        const [auditRow] = await this.database.db
          .select({ rawData: audits.rawData })
          .from(audits)
          .where(eq(audits.id, auditId));
        const existingRawData = (auditRow?.rawData || {}) as Record<string, unknown>;
        let targetKeywords = existingRawData.keywordPool as Array<Record<string, unknown>> | undefined;

        if (!targetKeywords || targetKeywords.length === 0) {
          // Fallback: re-fetch (will cache-hit same day)
          const fetched = await this.ahrefsService.getOrganicKeywords(domain, countryCode, 500);
          targetKeywords = fetched?.map(kw => ({ keyword: kw.keyword, volume: kw.volume, difficulty: kw.difficulty, traffic: kw.traffic, position: kw.position ?? null, intent: kw.intent })) ?? [];
        }

        const targetKeywordSet = new Set(
          targetKeywords
            .filter(kw => ((kw.position as number) ?? 999) <= 50)
            .map(kw => (kw.keyword as string).toLowerCase()),
        );

        const selectUsableCandidates = async (
          candidatePool: GapCandidate[],
          targetCount: number,
          selectedDomains: Set<string>,
        ) => {
          const selected: Array<{
            candidate: GapCandidate;
            keywords: Array<{ keyword: string; position: number; volume: number; difficulty: number }>;
          }> = [];
          const batchSize = 3;

          for (let i = 0; i < candidatePool.length && selected.length < targetCount; i += batchSize) {
            const batch = candidatePool
              .slice(i, i + batchSize)
              .filter(candidate => !selectedDomains.has(candidate.domain));

            if (batch.length === 0) continue;

            const batchResults = await Promise.all(
              batch.map(async (candidate) => {
                const keywords = await this.ahrefsService.getOrganicKeywords(candidate.domain, countryCode, 200);
                return { candidate, keywords };
              }),
            );

            for (const { candidate, keywords } of batchResults) {
              if (selectedDomains.has(candidate.domain)) continue;

              const usableKeywords = (keywords ?? [])
                .filter(keyword => (keyword.position ?? 999) <= 20 && (keyword.volume ?? 0) >= 10)
                .map(keyword => ({
                  keyword: keyword.keyword,
                  position: keyword.position ?? 0,
                  volume: keyword.volume ?? 0,
                  difficulty: keyword.difficulty ?? 0,
                }));

              if (usableKeywords.length === 0) {
                const reasons: string[] = [];
                if (candidate.topPagesCount === 0) reasons.push('no top pages');
                if (!hasStoredFootprint(candidate)) reasons.push('no stored organic footprint');
                reasons.push('no top-20 keywords with volume >= 10');
                this.logger.log(
                  `Audit ${auditId}: content gap skipped ${candidate.domain} (${candidate.source}) — ${reasons.join(', ')}`,
                );
                continue;
              }

              selected.push({ candidate, keywords: usableKeywords });
              selectedDomains.add(candidate.domain);
              this.logger.log(
                `Audit ${auditId}: content gap selected ${candidate.domain} (${candidate.source}) with ${usableKeywords.length} usable keywords`,
              );

              if (selected.length >= targetCount) break;
            }
          }

          return selected;
        };

        const selectedDomains = new Set<string>();
        const selectedDirectCompetitors = await selectUsableCandidates(directCandidatePool, 3, selectedDomains);
        const selectedOrganicCompetitors = await selectUsableCandidates(organicCandidatePool, 2, selectedDomains);
        const selectedGapCompetitors = [...selectedDirectCompetitors, ...selectedOrganicCompetitors];
        const gapCompetitors = selectedGapCompetitors.map(({ candidate }) => candidate.domain);

        if (gapCompetitors.length === 0) {
          throw new Error('No usable competitors available for content gap analysis');
        }

        this.logger.log(
          `Audit ${auditId}: content gap analyzing competitors — ${gapCompetitors.join(', ')}`,
        );

        // Use the already-probed competitor keywords from candidate selection.
        const competitorKeywordMap = new Map<string, Array<{ keyword: string; position: number; volume: number; difficulty: number }>>();
        for (const { candidate, keywords } of selectedGapCompetitors) {
          competitorKeywordMap.set(candidate.domain, keywords);
        }
        await job.updateProgress(76);

        // Compute gap: keywords where ≥2 competitors rank but target doesn't
        const keywordCompetitorMap = new Map<string, Array<{ domain: string; position: number }>>();
        const keywordMetaMap = new Map<string, { volume: number; difficulty: number }>();
        for (const [compD, compKws] of competitorKeywordMap) {
          for (const kw of compKws) {
            const kwLower = kw.keyword.toLowerCase();
            if (targetKeywordSet.has(kwLower)) continue; // target already ranks
            if (!keywordCompetitorMap.has(kwLower)) keywordCompetitorMap.set(kwLower, []);
            keywordCompetitorMap.get(kwLower)!.push({ domain: compD, position: kw.position });
            // Keep best volume/difficulty
            const existing = keywordMetaMap.get(kwLower);
            if (!existing || kw.volume > existing.volume) {
              keywordMetaMap.set(kwLower, { volume: kw.volume, difficulty: kw.difficulty });
            }
          }
        }

        // Filter: ≥2 competitors, volume ≥10, exclude branded (competitor domain name in keyword)
        const competitorDomainWords = new Set(gapCompetitors.flatMap(d => d.replace(/\.(com|io|org|net|co).*$/, '').split(/[.-]/)));
        const gapKeywords: Array<{
          keyword: string;
          volume: number;
          difficulty: number;
          competitorCount: number;
          competitorPositions: Array<{ domain: string; position: number }>;
          opportunity: number;
        }> = [];
        const emergingOpportunities: Array<{
          keyword: string;
          volume: number;
          difficulty: number;
          competitorCount: number;
          competitorPositions: Array<{ domain: string; position: number }>;
          opportunity: number;
        }> = [];

        for (const [kwLower, compPositions] of keywordCompetitorMap) {
          const meta = keywordMetaMap.get(kwLower);
          if (!meta || meta.volume < 10) continue;
          // Exclude branded
          const words = kwLower.split(/\s+/);
          if (words.some(w => competitorDomainWords.has(w))) continue;

          const opportunity = Math.round(meta.volume / (meta.difficulty + 1));
          const entry = {
            keyword: kwLower,
            volume: meta.volume,
            difficulty: meta.difficulty,
            competitorPositions: compPositions,
            opportunity,
          };

          if (compPositions.length >= 2) {
            gapKeywords.push({ ...entry, competitorCount: compPositions.length });
          } else {
            // Single high-DR competitor — emerging opportunity
            emergingOpportunities.push({ ...entry, competitorCount: compPositions.length });
          }
        }

        // Sort by opportunity descending, limit to top 100 gap + top 50 emerging
        gapKeywords.sort((a, b) => b.opportunity - a.opportunity);
        const topGap = gapKeywords.slice(0, 100);
        emergingOpportunities.sort((a, b) => b.opportunity - a.opportunity);
        const topEmerging = emergingOpportunities.slice(0, 50);

        await job.updateProgress(80);

        // Classify gap keywords via OpenAI
        const classificationInput = topGap.map(k => ({
          keyword: k.keyword,
          volume: k.volume,
          difficulty: k.difficulty,
          competitorCount: k.competitorCount,
        }));

        const classifications = await this.openaiService.classifyContentGap(
          classificationInput,
          businessProfile,
        );

        // Merge classifications into gap keywords
        const classMap = new Map(classifications.map(c => [c.keyword.toLowerCase(), c]));
        const classifiedGap = topGap.map(kw => {
          const cls = classMap.get(kw.keyword.toLowerCase());
          return {
            keyword: kw.keyword,
            volume: kw.volume,
            difficulty: kw.difficulty,
            intent: cls?.intent ?? 'informational',
            funnel: cls?.funnel ?? 'TOFU',
            contentType: cls?.contentType ?? 'Blog Post',
            opportunity: kw.opportunity,
            competitorCount: kw.competitorCount,
            competitorPositions: kw.competitorPositions,
            parentTopic: cls?.parentTopic ?? 'Uncategorized',
          };
        });

        // Build topic groups
        const topicMap = new Map<string, typeof classifiedGap>();
        for (const kw of classifiedGap) {
          if (!topicMap.has(kw.parentTopic)) topicMap.set(kw.parentTopic, []);
          topicMap.get(kw.parentTopic)!.push(kw);
        }
        const topicGroups = Array.from(topicMap.entries()).map(([topic, kws]) => {
          const totalVolume = kws.reduce((sum, k) => sum + k.volume, 0);
          const avgDifficulty = Math.round(kws.reduce((sum, k) => sum + k.difficulty, 0) / kws.length);
          const funnelCounts = { TOFU: 0, MOFU: 0, BOFU: 0 };
          for (const k of kws) funnelCounts[k.funnel as keyof typeof funnelCounts] = (funnelCounts[k.funnel as keyof typeof funnelCounts] || 0) + 1;
          const dominantFunnel = Object.entries(funnelCounts).sort((a, b) => b[1] - a[1])[0][0];
          return {
            topic,
            keywords: kws.map(k => k.keyword),
            totalVolume,
            avgDifficulty,
            dominantFunnel,
          };
        }).sort((a, b) => b.totalVolume - a.totalVolume);

        const estimatedMissedTraffic = classifiedGap.reduce((sum, k) => sum + Math.round(k.volume * 0.3), 0);

        contentGapResult = {
          summary: {
            totalGapKeywords: classifiedGap.length,
            estimatedMissedTraffic,
            avgDifficulty: classifiedGap.length > 0 ? Math.round(classifiedGap.reduce((s, k) => s + k.difficulty, 0) / classifiedGap.length) : 0,
            competitorsAnalyzed: gapCompetitors,
          },
          keywords: classifiedGap,
          emergingOpportunities: topEmerging,
          topicGroups,
        };
      } catch (gapError) {
        this.logger.error(`Audit ${auditId}: Content gap analysis failed: ${gapError}`);
      }

      if (contentGapResult) {
        const gapCount = (contentGapResult.keywords as Array<unknown>).length;
        await this.updateAudit(auditId, {
          currentStep: 'CONTENT_GAP_COMPLETE',
          rawData: { contentGap: contentGapResult },
          contentGapCount: gapCount,
        });
        this.logger.log(
          `Audit ${auditId}: content gap complete — ${gapCount} gap keywords, ${(contentGapResult.topicGroups as Array<unknown>).length} topic groups`,
        );
      } else {
        await this.updateAudit(auditId, { currentStep: 'CONTENT_GAP_COMPLETE' });
        this.logger.warn(`Audit ${auditId}: content gap analysis skipped`);
      }
      await job.updateProgress(85);

      // TODO: Step 8 — Scoring
      // TODO: Step 9 — Report Generation
      // TODO: Step 10 — Email Delivery

      // Mark audit as complete (end of currently implemented pipeline)
      await this.updateAudit(auditId, { status: 'COMPLETE', currentStep: 'COMPLETE' });
      await job.updateProgress(100);
      this.logger.log(`Audit ${auditId}: pipeline complete`);

    } catch (error) {
      this.logger.error(`Audit ${auditId} failed: ${error}`);
      await this.updateAudit(auditId, { status: 'FAILED' });
      throw error;
    }
  }

  private async updateAudit(
    auditId: string,
    data: {
      status?: 'PENDING' | 'PROCESSING' | 'COMPLETE' | 'FAILED';
      currentStep?: string;
      rawData?: Record<string, unknown>;
      businessProfile?: BusinessProfile;
      seedKeywords?: string[];
      contentGapCount?: number;
    },
  ) {
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    if (data.status) updateFields.status = data.status;
    if (data.businessProfile) updateFields.businessProfile = data.businessProfile;
    if (data.seedKeywords) updateFields.seedKeywords = data.seedKeywords;
    if (data.contentGapCount !== undefined) updateFields.contentGapCount = data.contentGapCount;

    if (data.rawData) {
      // Merge new data into existing rawData
      const [existing] = await this.database.db
        .select({ rawData: audits.rawData })
        .from(audits)
        .where(eq(audits.id, auditId));

      const merged = {
        ...((existing?.rawData as Record<string, unknown>) || {}),
        ...data.rawData,
      };
      if (data.currentStep) {
        (merged as Record<string, unknown>).currentStep = data.currentStep;
      }
      updateFields.rawData = merged;
    } else if (data.currentStep) {
      const [existing] = await this.database.db
        .select({ rawData: audits.rawData })
        .from(audits)
        .where(eq(audits.id, auditId));

      updateFields.rawData = {
        ...((existing?.rawData as Record<string, unknown>) || {}),
        currentStep: data.currentStep,
      };
    }

    try {
      // PostgreSQL JSONB does not support \u0000 (null bytes) — strip them from JSON fields only
      for (const key of ['rawData', 'businessProfile'] as const) {
        if (updateFields[key]) {
          updateFields[key] = JSON.parse(
            JSON.stringify(updateFields[key]).replace(/\\u0000/g, ''),
          );
        }
      }
      await this.database.db
        .update(audits)
        .set(updateFields)
        .where(eq(audits.id, auditId));
    } catch (err) {
      const snapshot = JSON.stringify(updateFields).slice(0, 2000);
      this.logger.error(
        `updateAudit failed for ${auditId} at step=${data.currentStep || 'N/A'}: ${err}\nPayload: ${snapshot}`,
      );
      throw err;
    }
  }

  private parseCountryCode(geography: string): string {
    const geoLower = geography.toLowerCase().trim();
    const map: Record<string, string> = {
      'united states': 'us', 'usa': 'us', 'us': 'us',
      'united kingdom': 'gb', 'uk': 'gb', 'gb': 'gb',
      'canada': 'ca', 'australia': 'au', 'india': 'in',
      'germany': 'de', 'france': 'fr', 'spain': 'es',
      'italy': 'it', 'netherlands': 'nl', 'brazil': 'br',
      'mexico': 'mx', 'japan': 'jp', 'south korea': 'kr',
      'singapore': 'sg', 'uae': 'ae', 'south africa': 'za',
      'new zealand': 'nz', 'ireland': 'ie', 'sweden': 'se',
      'norway': 'no', 'denmark': 'dk', 'finland': 'fi',
      'portugal': 'pt', 'poland': 'pl', 'switzerland': 'ch',
      'austria': 'at', 'belgium': 'be',
    };
    // Try direct match, then check if geography contains a known country name
    if (map[geoLower]) return map[geoLower];
    for (const [name, code] of Object.entries(map)) {
      if (geoLower.includes(name)) return code;
    }
    return 'us'; // fallback
  }
}
