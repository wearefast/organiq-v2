import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AhrefsKeyword {
  keyword: string;
  volume: number | null;
  difficulty: number | null;
  traffic: number | null;
  intent: {
    informational: boolean;
    commercial: boolean;
    transactional: boolean;
    navigational: boolean;
  };
  parentTopic?: string;
  position?: number;
}

@Injectable()
export class AhrefsService {
  private readonly logger = new Logger(AhrefsService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.ahrefs.com/v3';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('AHREFS_API_KEY', '');
  }

  private async request<T>(path: string, params: Record<string, string>): Promise<T | null> {
    if (!this.apiKey) {
      this.logger.warn(`Ahrefs API key not configured — skipping ${path}`);
      return null;
    }

    const url = new URL(`${this.baseUrl}${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    try {
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        this.logger.error(`Ahrefs ${path} returned ${res.status}: ${res.statusText}`);
        return null;
      }

      return (await res.json()) as T;
    } catch (error) {
      this.logger.error(`Ahrefs ${path} request failed: ${error}`);
      return null;
    }
  }

  async getOrganicKeywords(
    domain: string,
    country = 'us',
    limit = 100,
  ): Promise<AhrefsKeyword[] | null> {
    this.logger.log(`Fetching organic keywords for ${domain} (${country})`);

    const today = new Date().toISOString().split('T')[0];
    const result = await this.request<{ keywords: Array<Record<string, unknown>> }>(
      '/site-explorer/organic-keywords',
      {
        target: domain,
        mode: 'domain',
        country,
        date: today,
        limit: String(limit),
        select: 'keyword,volume,keyword_difficulty,best_position,sum_traffic,is_informational,is_commercial,is_transactional,is_navigational',
        order_by: 'sum_traffic:desc',
      },
    );

    if (!result?.keywords) return null;

    return result.keywords.map((kw) => ({
      keyword: kw.keyword as string,
      volume: (kw.volume as number) ?? null,
      difficulty: (kw.keyword_difficulty as number) ?? null,
      traffic: (kw.sum_traffic as number) ?? null,
      intent: {
        informational: (kw.is_informational as boolean) ?? false,
        commercial: (kw.is_commercial as boolean) ?? false,
        transactional: (kw.is_transactional as boolean) ?? false,
        navigational: (kw.is_navigational as boolean) ?? false,
      },
      position: (kw.best_position as number) ?? undefined,
    }));
  }

  async getMatchingTerms(
    keywords: string[],
    country = 'us',
    limit = 100,
  ): Promise<AhrefsKeyword[] | null> {
    this.logger.log(`Fetching matching terms for [${keywords.slice(0, 3).join(', ')}...] (${country})`);

    const result = await this.request<{ keywords: Array<Record<string, unknown>> }>(
      '/keywords-explorer/matching-terms',
      {
        keywords: keywords.join(','),
        country,
        limit: String(limit),
        select: 'keyword,volume,difficulty,parent_topic,traffic_potential,intents',
        match_mode: 'terms',
        order_by: 'volume:desc',
      },
    );

    if (!result?.keywords) return null;

    return result.keywords.map((kw) => {
      const intents = (kw.intents as Record<string, boolean>) || {};
      return {
        keyword: kw.keyword as string,
        volume: (kw.volume as number) ?? null,
        difficulty: (kw.difficulty as number) ?? null,
        traffic: (kw.traffic_potential as number) ?? null,
        intent: {
          informational: intents.informational ?? false,
          commercial: intents.commercial ?? false,
          transactional: intents.transactional ?? false,
          navigational: intents.navigational ?? false,
        },
        parentTopic: (kw.parent_topic as string) ?? undefined,
      };
    });
  }

  async getRelatedTerms(
    keywords: string[],
    country = 'us',
    limit = 50,
  ): Promise<AhrefsKeyword[] | null> {
    this.logger.log(`Fetching related terms for [${keywords.slice(0, 3).join(', ')}...] (${country})`);

    const result = await this.request<{ keywords: Array<Record<string, unknown>> }>(
      '/keywords-explorer/related-terms',
      {
        keywords: keywords.join(','),
        country,
        limit: String(limit),
        select: 'keyword,volume,difficulty,parent_topic,traffic_potential,intents',
        order_by: 'volume:desc',
      },
    );

    if (!result?.keywords) return null;

    return result.keywords.map((kw) => {
      const intents = (kw.intents as Record<string, boolean>) || {};
      return {
        keyword: kw.keyword as string,
        volume: (kw.volume as number) ?? null,
        difficulty: (kw.difficulty as number) ?? null,
        traffic: (kw.traffic_potential as number) ?? null,
        intent: {
          informational: intents.informational ?? false,
          commercial: intents.commercial ?? false,
          transactional: intents.transactional ?? false,
          navigational: intents.navigational ?? false,
        },
        parentTopic: (kw.parent_topic as string) ?? undefined,
      };
    });
  }

  async getDomainOverview(domain: string) {
    this.logger.log(`Fetching domain overview for ${domain}`);
    // TODO: Implement /v3/site-explorer/overview
    return { domainRating: 0, referringDomains: 0, backlinks: 0, estimatedMonthlyTraffic: 0, totalKeywords: 0 };
  }

  async getTopPages(domain: string, limit = 5) {
    this.logger.log(`Fetching top pages for ${domain}`);
    // TODO: Implement /v3/site-explorer/top-pages
    return [];
  }

  async getContentGap(target: string, competitors: string[]) {
    this.logger.log(`Running content gap: ${target} vs ${competitors.join(', ')}`);
    // TODO: Implement /v3/site-explorer/content-gap
    return [];
  }
}
