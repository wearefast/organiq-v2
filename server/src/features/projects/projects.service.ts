import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
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

  async findAllByWorkspace(workspaceId: string) {
    return this.db.db.query.projects.findMany({
      where: eq(projects.workspaceId, workspaceId),
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
    this.discoverAndStoreSitemap(project.id, project.domain).catch((err) =>
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

    // Re-discover sitemap when domain changes
    if (data.domain) {
      this.discoverAndStoreSitemap(updated.id, updated.domain).catch((err) =>
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
    await this.discoverAndStoreSitemap(project.id, project.domain);
    return this.findById(id, organizationId);
  }

  /**
   * Crawl the site's sitemap and persist discovered URLs on the project record.
   * Uses WebCrawlerService (global) for SSRF-safe fetching.
   */
  async discoverAndStoreSitemap(projectId: string, domain: string): Promise<void> {
    const siteUrl = `https://${domain}`;
    this.logger.log(`Discovering sitemap for ${domain}`);
    const { pageUrls } = await this.webCrawler.discoverSitePages(siteUrl, 25);
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
}
