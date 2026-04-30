import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { ScraperService } from '../integrations/services/scraper.service';
import { OpenAIService, BusinessProfile, DeepRead, KeywordResearchSteps } from '../integrations/services/openai.service';
import { PageSpeedService } from '../integrations/services/pagespeed.service';
import { AhrefsService } from '../integrations/services/ahrefs.service';
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

      // Step 3: PageSpeed Insights (tech debt — skipped when rate limited)
      await this.updateAudit(auditId, { currentStep: 'PAGESPEED_RUNNING' });
      await job.updateProgress(22);

      const pageSpeedResult = await this.pageSpeedService.analyze(websiteUrl);
      await this.updateAudit(auditId, {
        currentStep: 'PAGESPEED_COMPLETE',
        rawData: { pageSpeed: pageSpeedResult },
      });
      await job.updateProgress(30);
      if (pageSpeedResult) {
        this.logger.log(
          `Audit ${auditId}: PageSpeed complete — mobile perf=${pageSpeedResult.mobile.performanceScore}, desktop perf=${pageSpeedResult.desktop.performanceScore}`,
        );
      } else {
        this.logger.warn(`Audit ${auditId}: PageSpeed failed, continuing pipeline`);
      }

      // Step 03: Identify Core Keywords (Ahrefs + OpenAI classification)
      await this.updateAudit(auditId, { currentStep: 'KEYWORDS_RUNNING' });
      await job.updateProgress(32);

      // Parse country from geography (e.g. "United States" → "us")
      const countryCode = this.parseCountryCode(businessProfile.geography);

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

      // Classify via 5-step intelligence chain (works in degraded mode with empty pool — uses seedKeywords only)
      const { research: keywordResearch, steps: keywordSteps } = await this.openaiService.classifyKeywords(
        businessProfile,
        deepRead,
        poolSize > 0 ? keywordPool : null,
        scrapeResult.bodyText,
        async (pct) => { await job.updateProgress(pct); },
      );

      await this.updateAudit(auditId, {
        currentStep: 'KEYWORDS_COMPLETE',
        rawData: { keywordResearch, seedExpansions: keywordResearch.seedExpansions, keywordSteps },
      });
      await job.updateProgress(45);
      this.logger.log(
        `Audit ${auditId}: keyword chain complete — ${keywordResearch.coreKeywords.length} core, ${keywordResearch.moneyKeywords.length} money, ${keywordResearch.primaryTopics.length} topics, ${keywordResearch.coreTopics.length} core topics`,
      );

      // TODO: Step 4 — Competitor Discovery (SerpAPI)
      // TODO: Step 5 — Competitor Metrics (Ahrefs)
      // TODO: Step 6 — Competitor Top Pages (Ahrefs)
      // TODO: Step 7 — Content Gap (Ahrefs)
      // TODO: Step 8 — Scoring
      // TODO: Step 9 — Report Generation
      // TODO: Step 10 — Email Delivery

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
    },
  ) {
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    if (data.status) updateFields.status = data.status;
    if (data.businessProfile) updateFields.businessProfile = data.businessProfile;
    if (data.seedKeywords) updateFields.seedKeywords = data.seedKeywords;

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

    await this.database.db
      .update(audits)
      .set(updateFields)
      .where(eq(audits.id, auditId));
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
