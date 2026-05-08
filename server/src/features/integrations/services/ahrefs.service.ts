import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

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

export interface AhrefsDomainOverview {
  domain: string;
  domainRating: number;
  ahrefsRank: number | null;
  backlinks: number;
  referringDomains: number;
  orgKeywords: number;
  orgTraffic: number;
  orgCost: number | null;
}

export interface AhrefsTopPage {
  url: string;
  traffic: number;
  topKeyword: string | null;
  topKeywordVolume: number | null;
  topKeywordPosition: number | null;
}

export interface AhrefsOrganicCompetitor {
  domain: string;
  domainRating: number;
  keywordsCommon: number;
  keywordsCompetitorOnly: number;
  sharePercent: number;
  traffic: number;
}

const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function resolveRedisHost() {
  const configuredHost = process.env.REDIS_HOST?.trim();

  if (configuredHost) {
    if (process.platform === 'win32' && configuredHost.toLowerCase() === 'localhost') {
      return '127.0.0.1';
    }

    return configuredHost;
  }

  return process.platform === 'win32' ? '127.0.0.1' : 'localhost';
}

@Injectable()
export class AhrefsService {
  private readonly logger = new Logger(AhrefsService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.ahrefs.com/v3';
  private readonly redis: Redis;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('AHREFS_API_KEY', '');
    this.redis = new Redis({
      host: resolveRedisHost(),
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    this.redis.connect().catch(() => {
      this.logger.warn('Redis not available for Ahrefs caching — proceeding without cache');
    });
  }

  private async cachedRequest<T>(cacheKey: string, path: string, params: Record<string, string>): Promise<T | null> {
    // Try cache first
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.logger.debug(`Ahrefs cache hit: ${cacheKey}`);
        return JSON.parse(cached) as T;
      }
    } catch { /* cache miss or redis unavailable */ }

    const result = await this.request<T>(path, params);
    if (result !== null) {
      try {
        await this.redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS);
      } catch { /* non-critical */ }
    }
    return result;
  }

  private async request<T>(path: string, params: Record<string, string>): Promise<T | null> {
    if (!this.apiKey) {
      this.logger.warn(`Ahrefs API key not configured — skipping ${path}`);
      return null;
    }

    const url = new URL(`${this.baseUrl}${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const doFetch = async (): Promise<T | null> => {
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(30_000),
      });

      if (res.status === 429) {
        throw new Error('RATE_LIMITED');
      }

      if (!res.ok) {
        this.logger.error(`Ahrefs ${path} returned ${res.status}: ${res.statusText}`);
        return null;
      }

      const units = res.headers.get('x-api-units-cost-total-actual');
      if (units) this.logger.debug(`Ahrefs ${path} consumed ${units} units`);

      return (await res.json()) as T;
    };

    try {
      return await doFetch();
    } catch (error) {
      if (error instanceof Error && error.message === 'RATE_LIMITED') {
        this.logger.warn(`Ahrefs ${path} rate limited — retrying in 2s`);
        await new Promise(r => setTimeout(r, 2000));
        try {
          return await doFetch();
        } catch (retryErr) {
          this.logger.error(`Ahrefs ${path} retry failed: ${retryErr}`);
          return null;
        }
      }
      this.logger.error(`Ahrefs ${path} request failed: ${error}`);
      return null;
    }
  }

  async getOrganicKeywords(
    domain: string,
    country = 'us',
    limit = 100,
  ): Promise<AhrefsKeyword[] | null> {
    if (!this.apiKey) {
      this.logger.warn('Ahrefs API key not configured — skipping organic keywords');
      return null;
    }

    this.logger.log(`Fetching organic keywords for ${domain} (${country})`);

    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `ahrefs:organic-keywords:${domain}:${country}:${today}:${limit}`;
    const result = await this.cachedRequest<{ keywords: Array<Record<string, unknown>> }>(
      cacheKey,
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

  async getDomainOverview(domain: string, country = 'us'): Promise<AhrefsDomainOverview | null> {
    if (!this.apiKey) {
      this.logger.warn('Ahrefs API key not configured — skipping domain overview');
      return null;
    }

    this.logger.log(`Fetching domain overview for ${domain} (${country})`);
    const today = new Date().toISOString().split('T')[0];
    const cachePrefix = `ahrefs:overview:${domain}:${country}:${today}`;

    // 1. Domain Rating
    const drResult = await this.cachedRequest<{ domain_rating: { domain_rating: number; ahrefs_rank: number | null } }>(
      `${cachePrefix}:dr`,
      '/site-explorer/domain-rating',
      { target: domain, date: today },
    );

    // 2. Backlinks Stats
    const blResult = await this.cachedRequest<{ metrics: { live: number; live_refdomains: number } }>(
      `${cachePrefix}:bl`,
      '/site-explorer/backlinks-stats',
      { target: domain, mode: 'domain', date: today },
    );

    // 3. Metrics (organic traffic, keywords)
    const mResult = await this.cachedRequest<{ metrics: { org_keywords: number; org_traffic: number; org_cost: number | null } }>(
      `${cachePrefix}:metrics`,
      '/site-explorer/metrics',
      { target: domain, mode: 'domain', country, date: today },
    );

    return {
      domain,
      domainRating: drResult?.domain_rating?.domain_rating ?? 0,
      ahrefsRank: drResult?.domain_rating?.ahrefs_rank ?? null,
      backlinks: blResult?.metrics?.live ?? 0,
      referringDomains: blResult?.metrics?.live_refdomains ?? 0,
      orgKeywords: mResult?.metrics?.org_keywords ?? 0,
      orgTraffic: mResult?.metrics?.org_traffic ?? 0,
      orgCost: mResult?.metrics?.org_cost ?? null,
    };
  }

  async getTopPages(domain: string, country = 'us', limit = 5): Promise<AhrefsTopPage[]> {
    if (!this.apiKey) {
      this.logger.warn('Ahrefs API key not configured — skipping top pages');
      return [];
    }

    this.logger.log(`Fetching top ${limit} pages for ${domain} (${country})`);
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `ahrefs:top-pages:${domain}:${country}:${today}:${limit}`;

    const result = await this.cachedRequest<{ pages: Array<Record<string, unknown>> }>(
      cacheKey,
      '/site-explorer/top-pages',
      {
        target: domain,
        mode: 'domain',
        country,
        date: today,
        limit: String(limit),
        select: 'url,sum_traffic,top_keyword,top_keyword_volume,top_keyword_best_position',
        order_by: 'sum_traffic:desc',
      },
    );

    if (!result?.pages) return [];

    return result.pages.map(p => ({
      url: (p.url as string) ?? '',
      traffic: (p.sum_traffic as number) ?? 0,
      topKeyword: (p.top_keyword as string) ?? null,
      topKeywordVolume: (p.top_keyword_volume as number) ?? null,
      topKeywordPosition: (p.top_keyword_best_position as number) ?? null,
    }));
  }

  async getOrganicCompetitors(domain: string, country: string, limit = 20): Promise<AhrefsOrganicCompetitor[] | null> {
    if (!this.apiKey) {
      this.logger.warn('Ahrefs API key not configured — skipping organic competitors');
      return null;
    }

    this.logger.log(`Fetching organic competitors for ${domain} (${country})`);
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `ahrefs:organic-competitors:${domain}:${country}:${today}:${limit}`;

    const result = await this.cachedRequest<{ competitors: Array<Record<string, unknown>> }>(
      cacheKey,
      '/site-explorer/organic-competitors',
      {
        target: domain,
        mode: 'domain',
        country,
        date: today,
        limit: String(limit),
        select: 'competitor_domain,domain_rating,keywords_common,keywords_competitor,share,traffic',
        order_by: 'share:desc',
      },
    );

    if (!result?.competitors) return null;

    return result.competitors.map(c => ({
      domain: (c.competitor_domain as string) ?? '',
      domainRating: (c.domain_rating as number) ?? 0,
      keywordsCommon: (c.keywords_common as number) ?? 0,
      keywordsCompetitorOnly: (c.keywords_competitor as number) ?? 0,
      sharePercent: Math.round(((c.share as number) ?? 0) * 100),
      traffic: (c.traffic as number) ?? 0,
    }));
  }

  async getContentGap(target: string, competitors: string[]) {
    this.logger.log(`Running content gap: ${target} vs ${competitors.join(', ')}`);
    // TODO: Implement /v3/site-explorer/content-gap
    return [];
  }
}
