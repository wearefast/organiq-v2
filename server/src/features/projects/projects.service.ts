import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, and, inArray } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { WebCrawlerService } from '../../shared/web-crawler/web-crawler.service';
import { projects } from '../../db/schema';
import { sanitizeDomain } from '../../shared/utils/sanitize-domain';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly webCrawler: WebCrawlerService,
  ) {}

  async findAllByWorkspace(workspaceId: string, allowedIds?: string[]) {
    // Guard: empty array means the user has grants but none match any project.
    if (allowedIds !== undefined && allowedIds.length === 0) return [];
    const where = allowedIds !== undefined
      ? and(eq(projects.workspaceId, workspaceId), inArray(projects.id, allowedIds))
      : eq(projects.workspaceId, workspaceId);
    return this.db.db.query.projects.findMany({
      where,
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });
  }

  async findById(id: string, organizationId: string) {
    const project = await this.db.db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.organizationId, organizationId)),
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async create(data: {
    workspaceId: string;
    organizationId: string;
    name: string;
    domain: string;
    country?: string;
    language?: string;
    industry?: string;
  }) {
    const [project] = await this.db.db
      .insert(projects)
      .values({ ...data, domain: sanitizeDomain(data.domain) })
      .returning();

    // Fire-and-forget sitemap discovery — project creation succeeds immediately
    this.discoverAndStoreSitemap(project.id, project.domain, {
      country: project.country ?? undefined,
      language: project.language ?? undefined,
    }).catch((err) =>
      this.logger.warn(`Sitemap discovery failed for project ${project.id}: ${err.message}`),
    );

    return project;
  }

  async update(
    id: string,
    organizationId: string,
    data: { name?: string; domain?: string; country?: string; language?: string; industry?: string },
  ) {
    const sanitized = data.domain ? { ...data, domain: sanitizeDomain(data.domain) } : data;
    const [updated] = await this.db.db
      .update(projects)
      .set({ ...sanitized, updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)))
      .returning();
    if (!updated) throw new NotFoundException('Project not found');

    // Re-discover sitemap when domain or locale changes
    if (data.domain || data.country || data.language) {
      this.discoverAndStoreSitemap(updated.id, updated.domain, {
        country: updated.country ?? undefined,
        language: updated.language ?? undefined,
      }).catch((err) =>
        this.logger.warn(`Sitemap re-discovery failed for project ${updated.id}: ${err.message}`),
      );
    }

    return updated;
  }

  /**
   * Manually trigger a sitemap refresh for a project.
   * Called from the refresh-sitemap controller endpoint.
   */
  async refreshSitemap(id: string, organizationId: string) {
    const project = await this.findById(id, organizationId);
    await this.discoverAndStoreSitemap(project.id, project.domain, {
      country: project.country ?? undefined,
      language: project.language ?? undefined,
    });
    return this.findById(id, organizationId);
  }

  /**
   * Crawl the site's sitemap and persist discovered URLs on the project record.
   * Uses WebCrawlerService (global) for SSRF-safe fetching.
   * Locale hints (country + language) are required for accurate sitemap selection
   * on multi-locale sites (e.g. en-ae vs en-gb on the same domain).
   */
  async discoverAndStoreSitemap(
    projectId: string,
    domain: string,
    hints?: { country?: string; language?: string },
  ): Promise<void> {
    const siteUrl = `https://${domain}`;
    this.logger.log(`Discovering sitemap for ${domain} (country=${hints?.country ?? 'none'}, lang=${hints?.language ?? 'none'})`);
    const { pageUrls } = await this.webCrawler.discoverSitePages(siteUrl, 25, hints);
    await this.db.db
      .update(projects)
      .set({ sitemapUrls: pageUrls, sitemapDiscoveredAt: new Date(), updatedAt: new Date() })
      .where(eq(projects.id, projectId));
    this.logger.log(`Stored ${pageUrls.length} sitemap URL(s) for project ${projectId}`);
  }

  async remove(id: string, organizationId: string) {
    const [deleted] = await this.db.db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)))
      .returning();
    if (!deleted) throw new NotFoundException('Project not found');
    return deleted;
  }

  async updateTargets(
    id: string,
    organizationId: string,
    targets: Array<{ key: string; domain: string; country: string; language: string }>,
  ) {
    // Validate targets array
    if (!Array.isArray(targets) || targets.length > 20) {
      throw new Error('targets must be an array with at most 20 entries');
    }
    const seenKeys = new Set<string>();
    for (const t of targets) {
      if (!t.key || !t.domain || !t.country || !t.language) {
        throw new Error('Each target must have key, domain, country, and language');
      }
      if (t.key.length > 64 || !/^[a-z0-9_-]+$/.test(t.key)) {
        throw new Error(`Invalid target key "${t.key}": must be lowercase alphanumeric/dash/underscore, max 64 chars`);
      }
      if (seenKeys.has(t.key)) {
        throw new Error(`Duplicate target key: "${t.key}"`);
      }
      seenKeys.add(t.key);
    }

    const [updated] = await this.db.db
      .update(projects)
      .set({ targets, updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)))
      .returning();
    if (!updated) throw new NotFoundException('Project not found');
    return updated;
  }
}
