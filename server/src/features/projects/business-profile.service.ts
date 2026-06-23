import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { PromptService } from '../../shared/prompt/prompt.service';
import { SkillService } from '../../agents/skill.service';
import { AgentRuntime } from '../../agents/agent.runtime';
import { CreditsService } from '../credits/credits.service';
import { FirecrawlService } from '../integrations/firecrawl/firecrawl.service';
import { WebCrawlerService } from '../../shared/web-crawler/web-crawler.service';
import { AhrefsService } from '../integrations/ahrefs/ahrefs.service';
import { SerperService } from '../integrations/serper/serper.service';
import { projects } from '../../db/schema';
const BUSINESS_PROFILE_CREDIT_COST = 30;
const BUSINESS_PROFILE_PROMPT_PATH = 'discovery/business-profile.prompt.md';
const BUSINESS_PROFILE_SKILL = 'business-profile-analysis';

@Injectable()
export class BusinessProfileService {
  private readonly logger = new Logger(BusinessProfileService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly promptService: PromptService,
    private readonly skillService: SkillService,
    private readonly agentRuntime: AgentRuntime,
    private readonly creditsService: CreditsService,
    private readonly firecrawl: FirecrawlService,
    private readonly webCrawler: WebCrawlerService,
    private readonly ahrefs: AhrefsService,
    private readonly serper: SerperService,
    private readonly config: ConfigService,
  ) {}

  async getProfile(projectId: string, organizationId: string) {
    const project = await this.db.db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)),
    });
    if (!project) throw new NotFoundException('Project not found');

    return {
      profile: project.businessProfile ?? null,
      updatedAt: project.businessProfileUpdatedAt ?? null,
    };
  }

  async refresh(projectId: string, organizationId: string, forceRediscover = false) {
    // 1. Ownership check
    const project = await this.db.db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)),
    });
    if (!project) throw new NotFoundException('Project not found');

    // 2. Pre-flight credit check
    const balance = await this.creditsService.getBalance(organizationId);
    if (balance < BUSINESS_PROFILE_CREDIT_COST) {
      throw new BadRequestException(
        `Insufficient credits: business profile requires ${BUSINESS_PROFILE_CREDIT_COST} credits but your balance is ${balance}.`,
      );
    }

    // 3. Ensure sitemap is populated — discover it now if missing (blocking, needed for page coverage)
    const domain = project.domain;
    const baseUrl = domain.startsWith('http') ? domain.replace(/\/$/, '') : `https://${domain}`;
    this.logger.log(`Refreshing business profile for ${baseUrl}`);

    // Re-discover sitemap only when the project has none yet (first profile generation)
    // or when explicitly refreshing. On project creation, ProjectsService.discoverAndStoreSitemap
    // runs concurrently with limit=100 — re-running here with a second write would race.
    let sitemapUrls = project.sitemapUrls ?? [];
    if (sitemapUrls.length === 0 || forceRediscover) {
      try {
        const siteUrl = domain.startsWith('http') ? domain : `https://${domain}`;
        this.logger.log(`Discovering sitemap for ${domain} (country=${project.country ?? 'none'}, lang=${project.language ?? 'none'}, customSitemapUrl=${project.customSitemapUrl ?? 'none'})`);
        const { pageUrls } = await this.webCrawler.discoverSitePages(siteUrl, 100, {
          country: project.country ?? undefined,
          language: project.language ?? undefined,
          customSitemapUrl: project.customSitemapUrl ?? undefined,
        });
        sitemapUrls = pageUrls;
        await this.db.db
          .update(projects)
          .set({ sitemapUrls: pageUrls, sitemapDiscoveredAt: new Date(), updatedAt: new Date() })
          .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)));
        this.logger.log(`Sitemap discovered: ${pageUrls.length} pages for project ${projectId}`);
      } catch (err) {
        this.logger.warn(`Sitemap discovery failed for ${domain}: ${(err as Error).message}`);
      }
    } else {
      this.logger.log(`Using existing sitemap with ${sitemapUrls.length} URLs for project ${projectId}`);
    }

    const keyPages = [baseUrl, `${baseUrl}/about`, `${baseUrl}/services`, `${baseUrl}/about-us`, `${baseUrl}/contact`, `${baseUrl}/how-to`, `${baseUrl}/faq`];
    const sitemapPages = sitemapUrls.slice(0, 35);
    // Deduplicate: sitemap pages take priority; always include key pages
    const seen = new Set<string>();
    const pagesToScrape: string[] = [];
    for (const url of [...sitemapPages, ...keyPages]) {
      if (!seen.has(url)) { seen.add(url); pagesToScrape.push(url); }
    }
    const cappedPages = pagesToScrape.slice(0, 40); // hard cap to avoid runaway cost
    const scrapedPages: Array<{ url: string; data: unknown }> = [];
    const start = Date.now();

    await Promise.all(
      cappedPages.map(async (url) => {
        try {
          const content = await this.firecrawl.scrape(url);
          scrapedPages.push({ url, data: content });
        } catch (err) {
          this.logger.warn(`Firecrawl scrape failed for ${url}: ${(err as Error).message}`);
          scrapedPages.push({ url, data: null });
        }
      }),
    );

    const pipelineData = {
      rawData: {
        domain,
        scrapedPages: scrapedPages.filter((p) => p.data !== null),
        /** Full sitemap — known URL inventory for the agent to reference */
        sitemapUrls,
        ...(await (async () => {
          try {
            const [drData, backlinkData] = await Promise.all([
              this.ahrefs.getDomainRating(domain),
              this.ahrefs.getBacklinksStats(domain),
            ]);
            // Ahrefs v3 domain-rating: { domain_rating: { domain_rating: float, ahrefs_rank: int } }
            const drObj = ((drData as Record<string, unknown>)?.domain_rating) as Record<string, unknown> | undefined;
            // Ahrefs v3 backlinks-stats: { metrics: { live: int, live_refdomains: int, all_time: int, all_time_refdomains: int } }
            const blMetrics = ((backlinkData as Record<string, unknown>)?.metrics) as Record<string, unknown> | undefined;
            return {
              domainAuthority: {
                domain_rating: drObj?.domain_rating != null ? Math.round(Number(drObj.domain_rating)) : null,
                ahrefs_rank: drObj?.ahrefs_rank != null ? Number(drObj.ahrefs_rank) : null,
                referring_domains: blMetrics?.live_refdomains != null ? Number(blMetrics.live_refdomains) : null,
                backlinks: blMetrics?.live != null ? Number(blMetrics.live) : null,
                backlinks_all_time: blMetrics?.all_time != null ? Number(blMetrics.all_time) : null,
                data_source: 'ahrefs',
              },
            };
          } catch (err) {
            this.logger.warn(`Ahrefs enrichment failed for ${domain}: ${(err as Error).message}`);
            return {};
          }
        })()),
      },
      metadata: {
        domain,
        pagesAttempted: cappedPages.length,
        pagesScraped: scrapedPages.filter((p) => p.data !== null).length,
        sitemapUrlCount: sitemapUrls.length,
        durationMs: Date.now() - start,
      },
    };

    // 4. Load prompt + skill
    const context: Record<string, unknown> = {
      domain,
      country: project.country,
      language: project.language,
      industry: project.industry ?? '',
    };

    const prompt = await this.promptService.loadPrompt(BUSINESS_PROFILE_PROMPT_PATH, context);
    const skillContent = await this.skillService.loadSkill(BUSINESS_PROFILE_SKILL);

    // 5. Run agent via local AgentRuntime
    const runtimeResult = await this.agentRuntime.execute({
      stepKey: 'business-profile',
      projectId,
      organizationId,
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      allowedTools: [],
      skillContent,
      pipelineData,
      maxIterations: 2,
    });

    if (runtimeResult.finishReason === 'error') {
      throw new BadRequestException(`Business profile analysis failed: ${runtimeResult.error}`);
    }

    // 5.5. Discover top competitors — lightweight GPT-4o-mini call, best-effort
    const profileOutput = runtimeResult.output as Record<string, unknown>;
    const rawBrand =
      (typeof profileOutput.companyName === 'string' && profileOutput.companyName) ||
      (typeof profileOutput.businessName === 'string' && profileOutput.businessName) ||
      project.name;
    const cleanBrand = rawBrand.replace(/[\s\-_]+\d+$/, '').trim() || rawBrand;

    const discoveredCompetitors = await this.discoverCompetitors(
      cleanBrand,
      project.country,
      project.industry ?? (profileOutput.industry as string) ?? '',
      profileOutput,
      this.config.get<string>('OPENAI_API_KEY') ?? '',
    );

    const profileWithCompetitors: Record<string, unknown> = {
      ...profileOutput,
      ...(discoveredCompetitors.length > 0 ? { competitors: discoveredCompetitors } : {}),
    };

    // 6. Persist to project (always — analysis already completed)
    const [updated] = await this.db.db
      .update(projects)
      .set({
        businessProfile: profileWithCompetitors,
        businessProfileUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
      .returning();

    // 7. Debit credits (best-effort — must not lose persisted analysis)
    try {
      await this.creditsService.debit({
        organizationId,
        amount: BUSINESS_PROFILE_CREDIT_COST,
        description: 'Business Profile analysis',
      });
    } catch (debitErr) {
      this.logger.warn(
        `Credit debit failed for project ${projectId}: ${debitErr instanceof Error ? debitErr.message : 'Unknown'}`,
      );
    }

    return {
      profile: updated.businessProfile,
      updatedAt: updated.businessProfileUpdatedAt,
    };
  }

  /**
   * Discover direct competitors using a two-step grounded approach:
   * 1. Run Google searches via Serper using service-specific queries derived from the business profile
   * 2. Extract real domains from organic results, then use GPT to filter to true direct competitors
   *
   * Falls back to pure GPT if Serper is unavailable.
   */
  private async discoverCompetitors(
    brandName: string,
    countryCode: string,
    industry: string,
    profileOutput: Record<string, unknown>,
    apiKey: string,
  ): Promise<string[]> {
    if (!apiKey) return [];
    try {
      const location = (() => {
        try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) ?? countryCode; }
        catch { return countryCode; }
      })();

      // --- Step 1: Build grounded search queries from what the business actually does ---
      const description = (profileOutput.description as string) ?? '';
      const businessType = (profileOutput.businessType as string) ?? '';
      const keywords = Array.isArray(profileOutput.keywords)
        ? (profileOutput.keywords as string[]).slice(0, 3).join(', ')
        : '';
      const targetAudience = (profileOutput.targetAudience as string) ?? '';

      // Derive a short service phrase: prefer explicit businessType, then first 8 words of description
      const servicePhrase = businessType && businessType.length < 60
        ? businessType
        : description.split(/\s+/).slice(0, 8).join(' ');

      // Build 2–3 complementary queries for broad coverage
      const searchQueries: string[] = [];
      if (servicePhrase) {
        searchQueries.push(`${servicePhrase} ${location}`);
      }
      if (keywords) {
        searchQueries.push(`${keywords} site:${countryCode.toLowerCase()} OR ${location}`);
      }
      if (industry && searchQueries.length < 2) {
        searchQueries.push(`${industry} companies ${location}`);
      }
      // Always add a fallback with just industry + location
      searchQueries.push(`${industry || servicePhrase} ${location}`.trim());

      // Deduplicate and cap
      const uniqueQueries = [...new Set(searchQueries)].slice(0, 3);
      this.logger.log(`Competitor discovery: running ${uniqueQueries.length} Serper search(es) for "${brandName}" in ${location}`);

      // --- Step 2: Execute Serper searches and extract organic domains ---
      const ownDomain = (profileOutput.domain as string) ?? '';
      const seenDomains = new Set<string>();
      const candidateEntries: string[] = []; // "Brand - domain.com" format

      for (const query of uniqueQueries) {
        try {
          const raw = await this.serper.search({ query, country: countryCode.toLowerCase(), num: 10 });
          const result = raw as { organic?: Array<{ title?: string; link?: string; snippet?: string }> };
          for (const item of result.organic ?? []) {
            if (!item.link) continue;
            let domain: string;
            try { domain = new URL(item.link).hostname.replace(/^www\./, ''); }
            catch { continue; }
            // Exclude own domain, social media, and Wikipedia
            if (
              seenDomains.has(domain) ||
              domain === ownDomain ||
              /facebook|instagram|twitter|x\.com|linkedin|youtube|wikipedia|google|bing|yahoo/i.test(domain)
            ) continue;
            seenDomains.add(domain);
            const title = (item.title ?? domain).replace(/\s*[|\-–—].*$/, '').trim();
            candidateEntries.push(`${title} - ${domain}`);
          }
        } catch (searchErr) {
          this.logger.warn(`Serper search failed for "${query}": ${(searchErr as Error).message}`);
        }
      }

      this.logger.log(`Competitor discovery: ${candidateEntries.length} candidates from Serper for "${brandName}"`);

      // --- Step 3: Use GPT to filter candidates to true direct competitors ---
      // If Serper returned nothing, fall back to pure LLM approach
      const contextBlock = candidateEntries.length > 0
        ? `These websites appeared in Google search results for the same service/market:\n${candidateEntries.slice(0, 25).map((e, i) => `${i + 1}. ${e}`).join('\n')}\n\nFrom this list, identify the ones that are DIRECT competitors to "${brandName}".`
        : `Identify the top 10 DIRECT competitors for "${brandName}" operating in ${location}. They operate in the ${industry || servicePhrase} space.`;

      const systemPrompt = 'You are a market research analyst. Reply only with what is requested — no introduction, no commentary.';
      const userPrompt = `${contextBlock}

A DIRECT competitor offers the same core product/service to the same target audience: ${targetAudience || 'same market'}.
Do NOT include: the brand itself, general e-commerce platforms, logistics companies, delivery apps, or tangentially related businesses.

Return exactly a numbered list (up to 10) in this format:
1. BrandName - domain.com`;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 500,
          temperature: 0.1,
        }),
      });

      if (!res.ok) {
        this.logger.warn(`Competitor discovery LLM call failed: HTTP ${res.status}`);
        // Return raw Serper candidates as fallback (up to 10)
        return candidateEntries.slice(0, 10);
      }

      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = data.choices?.[0]?.message?.content ?? '';

      return text
        .split('\n')
        .map((line) => line.replace(/^[\s\d.*\-•)]+/, '').trim())
        .filter((line) => line.length > 1 && line.length < 80)
        .slice(0, 10);
    } catch (err) {
      this.logger.warn(`Competitor discovery failed: ${(err as Error).message}`);
      return [];
    }
  }

  async update(projectId: string, organizationId: string, profile: Record<string, unknown>) {
    const project = await this.db.db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)),
    });
    if (!project) throw new NotFoundException('Project not found');

    const [updated] = await this.db.db
      .update(projects)
      .set({ businessProfile: profile, businessProfileUpdatedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
      .returning();

    return {
      profile: updated.businessProfile,
      updatedAt: updated.businessProfileUpdatedAt,
    };
  }
}
