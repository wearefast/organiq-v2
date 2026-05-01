import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq, desc } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { audits } from '../../db/schema';
import { CreateAuditDto } from './dto/create-audit.dto';

@Injectable()
export class AuditService {
  constructor(
    private readonly database: DatabaseService,
    @InjectQueue('audit-queue') private readonly auditQueue: Queue,
  ) {}

  async create(dto: CreateAuditDto) {
    const [audit] = await this.database.db
      .insert(audits)
      .values({
        websiteUrl: dto.websiteUrl,
        status: 'PENDING',
        countries: dto.countries ?? [],
      })
      .returning();

    await this.auditQueue.add(
      'process-audit',
      { auditId: audit.id, websiteUrl: dto.websiteUrl },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    return { auditId: audit.id };
  }

  async getStatus(id: string) {
    const [audit] = await this.database.db
      .select()
      .from(audits)
      .where(eq(audits.id, id));

    if (!audit) throw new NotFoundException('Audit not found');

    const rawData = (audit.rawData || {}) as Record<string, unknown>;
    const currentStep = (rawData.currentStep as string) || null;

    const stepMap: Record<string, { step: string; progress: number; message: string }> = {
      // PENDING
      PENDING: { step: 'Queued', progress: 0, message: 'Your audit is queued...' },
      // PROCESSING sub-steps
      SCRAPING: { step: 'Scraping', progress: 5, message: 'Scraping your website...' },
      SCRAPE_COMPLETE: { step: 'Scraping', progress: 10, message: 'Website scraped successfully.' },
      GENERATING_PROFILE: { step: 'Business Profile', progress: 12, message: 'Generating AI business profile...' },
      PROFILE_COMPLETE: { step: 'Business Profile', progress: 18, message: 'Business profile generated.' },
      DEEPREAD_RUNNING: { step: 'Deep Read', progress: 19, message: 'Distilling business profile...' },
      DEEPREAD_COMPLETE: { step: 'Deep Read', progress: 20, message: 'Deep-read analysis complete.' },
      PAGESPEED_RUNNING: { step: 'PageSpeed', progress: 22, message: 'Running PageSpeed analysis...' },
      PAGESPEED_COMPLETE: { step: 'PageSpeed', progress: 30, message: 'PageSpeed analysis complete.' },
      KEYWORDS_RUNNING: { step: 'Keywords', progress: 32, message: 'Fetching keyword data from Ahrefs...' },
      KW_AHREFS_COMPLETE: { step: 'Keywords · Ahrefs', progress: 33, message: 'Keyword pool assembled from Ahrefs.' },
      KW_STEP_31: { step: 'Keywords · 3.1', progress: 34, message: 'Extracting website context...' },
      KW_STEP_32: { step: 'Keywords · 3.2', progress: 36, message: 'Classifying core & money keywords...' },
      KW_STEP_33: { step: 'Keywords · 3.3', progress: 38, message: 'Building topic clusters...' },
      KW_STEP_34: { step: 'Keywords · 3.4', progress: 40, message: 'Discovering niche entities...' },
      KW_STEP_35: { step: 'Keywords · 3.5', progress: 44, message: 'Deduplicating & finalizing core topics...' },
      KEYWORDS_COMPLETE: { step: 'Keywords', progress: 45, message: 'Keyword classification complete.' },
      COMPETITORS_RUNNING: { step: 'Competitors', progress: 46, message: 'Searching Google for competitors...' },
      SERP_COMPLETE: { step: 'Competitors · SERP', progress: 48, message: 'SERP discovery complete.' },
      COMPETITORS_COMPLETE: { step: 'Competitors', progress: 50, message: 'Competitor classification complete.' },
      // COMPLETE / FAILED
      COMPLETE: { step: 'Done', progress: 100, message: 'Audit complete!' },
      FAILED: { step: 'Failed', progress: 0, message: 'Audit failed' },
    };

    let info: { step: string; progress: number; message: string };

    if (audit.status === 'COMPLETE' || audit.status === 'FAILED') {
      info = stepMap[audit.status];
    } else if (currentStep && stepMap[currentStep]) {
      info = stepMap[currentStep];
    } else {
      info = stepMap[audit.status] || stepMap.PENDING;
    }

    return {
      auditId: audit.id,
      status: audit.status,
      currentStep: currentStep || audit.status,
      ...info,
      completedSteps: this.buildCompletedSteps(rawData, audit.businessProfile as Record<string, unknown> | null),
      scores: audit.status === 'COMPLETE'
        ? {
            technicalSeo: audit.seoScore,
            contentCoverage: audit.contentGapCount ? Math.max(0, 100 - audit.contentGapCount) : null,
            backlinkAuthority: audit.geoScore,
            aeoGeoReadiness: audit.aeoScore,
          }
        : null,
    };
  }

  private buildCompletedSteps(
    rawData: Record<string, unknown>,
    businessProfile: Record<string, unknown> | null,
  ): Array<{ key: string; label: string; summary: Record<string, unknown> }> {
    const steps: Array<{ key: string; label: string; summary: Record<string, unknown> }> = [];
    const currentStep = (rawData.currentStep as string) || '';

    // Ordered step keys — a step is complete if its data exists in rawData
    const scrape = rawData.scrape as Record<string, unknown> | undefined;
    if (scrape) {
      steps.push({
        key: 'SCRAPE',
        label: 'Website crawl',
        summary: {
          title: scrape.title || '',
          h1Count: Array.isArray(scrape.h1s) ? scrape.h1s.length : 0,
          internalLinkCount: scrape.internalLinkCount ?? 0,
          imageCount: scrape.imageAltCoverage ?? 0,
          schemaDetected: !!scrape.schemaMarkupPresent,
        },
      });
    }

    if (businessProfile) {
      steps.push({
        key: 'PROFILE',
        label: 'AI business profile',
        summary: {
          brandIdentity: (businessProfile.brandIdentity as string) || '',
          targetMarket: (businessProfile.targetMarket as string) || '',
          serviceCount: Array.isArray(businessProfile.services) ? businessProfile.services.length : 0,
          seedKeywordCount: Array.isArray(businessProfile.seedKeywords) ? businessProfile.seedKeywords.length : 0,
        },
      });
    }

    const deepRead = rawData.deepRead as Record<string, unknown> | undefined;
    if (deepRead) {
      steps.push({
        key: 'DEEPREAD',
        label: 'Deep-read analysis',
        summary: {
          whatTheySell: deepRead.whatTheySell || '',
          whoTheyServe: deepRead.whoTheyServe || '',
          howTheyPosition: deepRead.howTheyPosition || '',
          whatMakesThemDifferent: deepRead.whatMakesThemDifferent || '',
        },
      });
    }

    const pageSpeed = rawData.pageSpeed as Record<string, unknown> | undefined;
    const pageSpeedStatus = rawData.pageSpeedStatus as string | undefined;
    if (pageSpeed) {
      const mobile = (pageSpeed.mobile as Record<string, unknown>) || {};
      const desktop = (pageSpeed.desktop as Record<string, unknown>) || {};
      steps.push({
        key: 'PAGESPEED',
        label: 'PageSpeed analysis',
        summary: {
          mobilePerf: mobile.performanceScore ?? null,
          desktopPerf: desktop.performanceScore ?? null,
          mobileSeo: mobile.seoScore ?? null,
          lcp: mobile.lcp ?? null,
        },
      });
    } else if (pageSpeedStatus === 'background') {
      steps.push({
        key: 'PAGESPEED',
        label: 'PageSpeed analysis',
        summary: { status: 'Running in background' },
      });
    } else if (pageSpeedStatus === 'unavailable') {
      steps.push({
        key: 'PAGESPEED',
        label: 'PageSpeed analysis',
        summary: { status: 'No data available' },
      });
    }

    const ahrefsSummary = rawData.ahrefsSummary as Record<string, unknown> | undefined;
    if (ahrefsSummary) {
      steps.push({
        key: 'KW_AHREFS',
        label: 'Ahrefs keyword data',
        summary: {
          organicCount: ahrefsSummary.organicCount ?? 0,
          matchingCount: ahrefsSummary.matchingCount ?? 0,
          poolSize: ahrefsSummary.poolSize ?? 0,
        },
      });
    }

    // Keyword sub-steps from keywordSteps
    const kwSteps = rawData.keywordSteps as Record<string, unknown> | undefined;
    if (kwSteps) {
      const s31 = kwSteps.step31 as Record<string, unknown> | null;
      if (s31) {
        steps.push({
          key: 'KW_STEP_31',
          label: 'Context extraction',
          summary: {
            offeringCount: Array.isArray(s31.offerings) ? s31.offerings.length : 0,
            conversionPhraseCount: Array.isArray(s31.conversionPhrases) ? s31.conversionPhrases.length : 0,
            pageCount: Array.isArray(s31.pageMapping) ? s31.pageMapping.length : 0,
          },
        });
      }

      const s32 = kwSteps.step32 as Record<string, unknown> | null;
      if (s32) {
        steps.push({
          key: 'KW_STEP_32',
          label: 'Core & money keywords',
          summary: {
            coreCount: Array.isArray(s32.coreKeywords) ? s32.coreKeywords.length : 0,
            moneyCount: Array.isArray(s32.moneyKeywords) ? s32.moneyKeywords.length : 0,
          },
        });
      }

      const s33 = kwSteps.step33 as Record<string, unknown> | null;
      if (s33) {
        steps.push({
          key: 'KW_STEP_33',
          label: 'Topic clusters',
          summary: {
            topicCount: Array.isArray(s33.primaryTopics) ? s33.primaryTopics.length : 0,
            expansionCount: Array.isArray(s33.seedExpansions) ? s33.seedExpansions.length : 0,
          },
        });
      }

      const s34 = kwSteps.step34 as Record<string, unknown> | null;
      if (s34) {
        steps.push({
          key: 'KW_STEP_34',
          label: 'Entity discovery',
          summary: {
            entityCount: Array.isArray(s34.entities) ? s34.entities.length : 0,
          },
        });
      }

      const s35 = kwSteps.step35 as Record<string, unknown> | null;
      if (s35) {
        steps.push({
          key: 'KW_STEP_35',
          label: 'Dedup & core topics',
          summary: {
            coreTopicCount: Array.isArray(s35.coreTopics) ? s35.coreTopics.length : 0,
          },
        });
      }
    }

    const serpCandidates = rawData.serpCandidates as Array<Record<string, unknown>> | undefined;
    if (serpCandidates && serpCandidates.length > 0) {
      steps.push({
        key: 'SERP_COMPLETE',
        label: 'Google SERP discovery',
        summary: { candidateCount: serpCandidates.length },
      });
    }

    const competitors = rawData.competitors as Record<string, unknown> | undefined;
    if (competitors) {
      const direct = Array.isArray(competitors.directCompetitors) ? competitors.directCompetitors.length : 0;
      const organic = Array.isArray(competitors.organicCompetitors) ? competitors.organicCompetitors.length : 0;
      steps.push({
        key: 'COMPETITORS_COMPLETE',
        label: 'Competitor classification',
        summary: { directCount: direct, organicCount: organic },
      });
    }

    const competitorMetrics = rawData.competitorMetrics as Record<string, unknown> | undefined;
    if (competitorMetrics) {
      const compArr = Array.isArray(competitorMetrics.competitors) ? competitorMetrics.competitors : [];
      const avgDR = compArr.length > 0
        ? Math.round(compArr.reduce((sum: number, c: Record<string, unknown>) => sum + ((c.metrics as Record<string, number>)?.domainRating ?? 0), 0) / compArr.length)
        : 0;
      steps.push({
        key: 'COMPETITOR_METRICS_COMPLETE',
        label: 'Competitor metrics (Ahrefs)',
        summary: { competitorCount: compArr.length, avgDR },
      });
    }

    const organicCompetitorMetrics = rawData.organicCompetitorMetrics as Record<string, unknown> | undefined;
    if (organicCompetitorMetrics) {
      const orgArr = Array.isArray(organicCompetitorMetrics.competitors) ? organicCompetitorMetrics.competitors : [];
      const avgOverlap = orgArr.length > 0
        ? Math.round(orgArr.reduce((sum: number, c: Record<string, unknown>) => sum + ((c.overlapMetrics as Record<string, number>)?.sharePercent ?? 0), 0) / orgArr.length)
        : 0;
      steps.push({
        key: 'ORGANIC_COMPETITORS_COMPLETE',
        label: 'Organic competitor analysis',
        summary: { competitorCount: orgArr.length, avgOverlap },
      });
    }

    const contentGap = rawData.contentGap as Record<string, unknown> | undefined;
    if (contentGap) {
      const summary = contentGap.summary as Record<string, unknown>;
      steps.push({
        key: 'CONTENT_GAP_COMPLETE',
        label: 'Content gap analysis',
        summary: { gapKeywords: summary?.totalGapKeywords ?? 0, missedTraffic: summary?.estimatedMissedTraffic ?? 0 },
      });
    }

    return steps;
  }

  async findAll(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const rows = await this.database.db
      .select()
      .from(audits)
      .orderBy(desc(audits.createdAt))
      .limit(limit)
      .offset(offset);
    return { audits: rows, page, limit };
  }

  async findOne(id: string) {
    const [audit] = await this.database.db
      .select()
      .from(audits)
      .where(eq(audits.id, id));
    if (!audit) throw new NotFoundException('Audit not found');

    const rawData = (audit.rawData || {}) as Record<string, unknown>;
    const scrape = (rawData.scrape || {}) as Record<string, unknown>;

    return {
      id: audit.id,
      websiteUrl: audit.websiteUrl,
      status: audit.status,
      createdAt: audit.createdAt,
      updatedAt: audit.updatedAt,
      seedKeywords: audit.seedKeywords,
      siteName: (scrape.siteName as string) || '',
      ogImage: (scrape.ogImage as string) || '',
      favicon: (scrape.favicon as string) || '',
      pipeline: {
        scrape: rawData.scrape ?? null,
        businessProfile: audit.businessProfile ?? null,
        deepRead: rawData.deepRead ?? null,
        pageSpeed: rawData.pageSpeed ?? null,
        pageSpeedStatus: (rawData.pageSpeedStatus as string) ?? null,
        keywordResearch: rawData.keywordResearch ?? null,
        competitors: rawData.competitors ?? null,
        competitorMetrics: rawData.competitorMetrics ?? null,
        organicCompetitorMetrics: rawData.organicCompetitorMetrics ?? null,
        contentGap: rawData.contentGap ?? null,
        serpCandidates: rawData.serpCandidates ?? null,
      },
      seedExpansions: (rawData.seedExpansions as string[]) ?? [],
      scores: {
        seoScore: audit.seoScore,
        geoScore: audit.geoScore,
        aeoScore: audit.aeoScore,
        contentGapCount: audit.contentGapCount,
        estimatedTrafficLoss: audit.estimatedTrafficLoss,
      },
    };
  }
}
