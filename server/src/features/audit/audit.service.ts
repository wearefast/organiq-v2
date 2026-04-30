import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { audits } from '../../db/schema';

@Injectable()
export class AuditService {
  constructor(private readonly database: DatabaseService) {}

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
      KEYWORDS_RUNNING: { step: 'Keywords', progress: 32, message: 'Identifying core keywords & topics...' },
      KEYWORDS_COMPLETE: { step: 'Keywords', progress: 45, message: 'Keyword classification complete.' },
      // TODO: add steps as pipeline grows
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
      ...info,
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

    return {
      id: audit.id,
      websiteUrl: audit.websiteUrl,
      status: audit.status,
      createdAt: audit.createdAt,
      updatedAt: audit.updatedAt,
      seedKeywords: audit.seedKeywords,
      pipeline: {
        scrape: rawData.scrape ?? null,
        businessProfile: audit.businessProfile ?? null,
        deepRead: rawData.deepRead ?? null,
        pageSpeed: rawData.pageSpeed ?? null,
        keywordResearch: rawData.keywordResearch ?? null,
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
