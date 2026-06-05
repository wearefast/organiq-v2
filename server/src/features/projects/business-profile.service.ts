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

  async refresh(projectId: string, organizationId: string) {
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

    let sitemapUrls = project.sitemapUrls ?? [];
    if (sitemapUrls.length === 0) {
      this.logger.log(`No sitemap on project ${projectId} — discovering now`);
      try {
        const siteUrl = domain.startsWith('http') ? domain : `https://${domain}`;
        const { pageUrls } = await this.webCrawler.discoverSitePages(siteUrl, 25, {
          country: project.country ?? undefined,
          language: project.language ?? undefined,
        });
        sitemapUrls = pageUrls;
        // Persist discovered URLs so future runs don't pay this cost
        await this.db.db
          .update(projects)
          .set({ sitemapUrls: pageUrls, sitemapDiscoveredAt: new Date(), updatedAt: new Date() })
          .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)));
        this.logger.log(`Sitemap discovered: ${pageUrls.length} pages for project ${projectId}`);
      } catch (err) {
        this.logger.warn(`Sitemap discovery failed for ${domain}: ${(err as Error).message}`);
      }
    }

    const keyPages = [baseUrl, `${baseUrl}/about`, `${baseUrl}/services`, `${baseUrl}/about-us`, `${baseUrl}/contact`];
    const sitemapPages = sitemapUrls.slice(0, 20);
    // Deduplicate: sitemap pages take priority; always include key pages
    const seen = new Set<string>();
    const pagesToScrape: string[] = [];
    for (const url of [...sitemapPages, ...keyPages]) {
      if (!seen.has(url)) { seen.add(url); pagesToScrape.push(url); }
    }
    const cappedPages = pagesToScrape.slice(0, 25); // hard cap to avoid runaway cost
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
            const dr = drData as Record<string, unknown>;
            const bl = backlinkData as Record<string, unknown>;
            return {
              domainAuthority: {
                domain_rating: dr?.domainRating ?? null,
                referring_domains: bl?.liveRefDomains ?? null,
                backlinks: bl?.live ?? null,
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
   * Ask GPT-4o-mini for the top 10 competitors of a brand in a given country.
   * Returns a clean string[] parsed from the numbered list response.
   * Fails silently — competitor discovery is best-effort.
   */
  private async discoverCompetitors(
    brandName: string,
    countryCode: string,
    apiKey: string,
  ): Promise<string[]> {
    if (!apiKey) return [];
    try {
      const location = (() => {
        try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) ?? countryCode; }
        catch { return countryCode; }
      })();

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a market research assistant. Reply with only what is requested — no introduction, no commentary.' },
            { role: 'user', content: `Who are the top 10 direct competitors for ${brandName} in ${location}? Give me only a numbered list of competitor brand names, nothing else.` },
          ],
          max_tokens: 300,
          temperature: 0.2,
        }),
      });

      if (!res.ok) {
        this.logger.warn(`Competitor discovery call failed: HTTP ${res.status}`);
        return [];
      }

      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = data.choices?.[0]?.message?.content ?? '';

      // Parse numbered or bulleted list: strip "1. ", "- ", "* ", etc.
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
