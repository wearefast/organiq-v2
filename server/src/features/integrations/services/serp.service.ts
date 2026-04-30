import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SerpOrganicResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

export interface SerpSearchResult {
  organic: SerpOrganicResult[];
}

export interface CompetitorCandidate {
  domain: string;
  occurrences: number;
  positions: number[];
  sampleUrls: string[];
}

@Injectable()
export class SerpService {
  private readonly logger = new Logger(SerpService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://google.serper.dev/search';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('SERPER_API_KEY', '');
  }

  async search(query: string, country = 'us', num = 10): Promise<SerpSearchResult | null> {
    if (!this.apiKey) {
      this.logger.warn('Serper API key not configured — skipping SERP search');
      return null;
    }

    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, gl: country, num }),
      });

      if (!res.ok) {
        this.logger.error(`Serper search returned ${res.status}: ${res.statusText}`);
        return null;
      }

      const data = (await res.json()) as Record<string, unknown>;
      const organic = Array.isArray(data.organic)
        ? (data.organic as Array<Record<string, unknown>>).map((r, i) => ({
            title: (r.title as string) || '',
            link: (r.link as string) || '',
            snippet: (r.snippet as string) || '',
            position: (r.position as number) ?? i + 1,
          }))
        : [];

      return { organic };
    } catch (error) {
      this.logger.error(`Serper search failed: ${error}`);
      return null;
    }
  }

  async discoverCompetitors(
    keywords: string[],
    ownDomain: string,
    country = 'us',
  ): Promise<CompetitorCandidate[]> {
    if (!this.apiKey) {
      this.logger.warn('Serper API key not configured — skipping competitor discovery');
      return [];
    }

    const domainMap = new Map<string, { positions: number[]; urls: Set<string> }>();
    const ownHost = ownDomain.replace(/^www\./, '');

    for (const keyword of keywords) {
      const result = await this.search(keyword, country);
      if (!result) continue;

      for (const item of result.organic) {
        try {
          const host = new URL(item.link).hostname.replace(/^www\./, '');
          if (host === ownHost) continue;

          let entry = domainMap.get(host);
          if (!entry) {
            entry = { positions: [], urls: new Set() };
            domainMap.set(host, entry);
          }
          entry.positions.push(item.position);
          entry.urls.add(item.link);
        } catch {
          // skip malformed URLs
        }
      }
    }

    return Array.from(domainMap.entries())
      .map(([domain, data]) => ({
        domain,
        occurrences: data.positions.length,
        positions: data.positions,
        sampleUrls: Array.from(data.urls).slice(0, 5),
      }))
      .sort((a, b) => b.occurrences - a.occurrences);
  }
}
