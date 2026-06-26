import { Injectable, Logger } from '@nestjs/common';
import { eq, asc, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../shared/database/database.service';
import { projectSitemapUrls, projects } from '../../db/schema';

/** Maximum rows per INSERT batch — avoids generating multi-MB SQL strings for large sitemaps */
const INSERT_BATCH_SIZE = 500;

/**
 * SitemapRepository — single source of truth for sitemap URL reads and writes.
 *
 * DUAL-WRITE TRANSITION (Phase 1–4):
 *   setUrls() writes to BOTH project_sitemap_urls (new) AND projects.sitemap_urls (legacy)
 *   in one transaction. This guarantees a clean rollback path if the new table needs to
 *   be abandoned during the migration window.
 *
 *   getUrls() reads the new table first. If no rows exist (project not yet migrated),
 *   it falls back to the legacy projects.sitemap_urls array column.
 *
 * PHASE 5 (cleanup):
 *   Remove the dual-write block in setUrls() and the legacy fallback in getUrls() once
 *   the 7-day verification gate passes. Then drop projects.sitemap_urls and
 *   projects.sitemap_discovered_at via the 0029_drop_legacy_sitemap.sql migration.
 */
@Injectable()
export class SitemapRepository {
  private readonly logger = new Logger(SitemapRepository.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Returns the discovered URLs for a project.
   *
   * Read order: new table → legacy column (fallback for unmigrated projects).
   */
  async getUrls(projectId: string): Promise<string[]> {
    const rows = await this.db.db
      .select({ url: projectSitemapUrls.url })
      .from(projectSitemapUrls)
      .where(eq(projectSitemapUrls.projectId, projectId))
      .orderBy(asc(projectSitemapUrls.position));

    if (rows.length > 0) {
      return rows.map((r) => r.url);
    }

    // PHASE 5 TODO: remove this fallback block after 7-day verification gate passes.
    const project = await this.db.db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { sitemapUrls: true },
    });
    const legacy = project?.sitemapUrls ?? [];
    if (legacy.length > 0) {
      this.logger.log(
        `getUrls: project ${projectId} not yet migrated — reading from legacy sitemap_urls column (${legacy.length} URLs)`,
      );
    }
    return legacy;
  }

  /**
   * Persists sitemap URLs for a project.
   *
   * Dual-writes to BOTH project_sitemap_urls AND the legacy projects.sitemap_urls column
   * atomically inside a single transaction. The legacy write will be removed in Phase 5.
   *
   * Large sitemaps are inserted in batches of INSERT_BATCH_SIZE rows to avoid
   * generating excessively large SQL strings for sites with thousands of URLs.
   *
   * @param projectId - project UUID
   * @param urls - ordered list of discovered URLs (position = array index)
   * @param options.batchId - optional UUID to group URLs from one discovery run;
   *                          a new UUID is generated if not provided
   * @param options.organizationId - when provided, the legacy projects table update
   *                                 is guarded with an AND organizationId = ? clause
   *                                 to prevent cross-org writes during the transition
   */
  async setUrls(
    projectId: string,
    urls: string[],
    options?: { batchId?: string; organizationId?: string },
  ): Promise<void> {
    const batchId = options?.batchId ?? randomUUID();
    const now = new Date();

    // Resolve organizationId — required for the new table column.
    // Use the caller-supplied value when available (saves a DB round-trip);
    // otherwise look it up from the projects table.
    let organizationId = options?.organizationId;
    if (!organizationId) {
      const proj = await this.db.db.query.projects.findFirst({
        where: eq(projects.id, projectId),
        columns: { organizationId: true },
      });
      if (!proj) throw new Error(`setUrls: project ${projectId} not found`);
      organizationId = proj.organizationId;
    }

    await this.db.db.transaction(async (tx) => {
      // 1. Replace all rows for this project in the normalised table
      await tx
        .delete(projectSitemapUrls)
        .where(eq(projectSitemapUrls.projectId, projectId));

      if (urls.length > 0) {
        // Insert in batches of INSERT_BATCH_SIZE to avoid multi-MB SQL for large sitemaps
        const rows = urls.map((url, idx) => ({
          projectId,
          organizationId,
          url,
          position: idx,
          discoveredAt: now,
          discoveryBatchId: batchId,
          updatedAt: now,
        }));
        for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
          await tx.insert(projectSitemapUrls).values(rows.slice(i, i + INSERT_BATCH_SIZE));
        }
      }

      // 2. PHASE 5 TODO: remove this dual-write block once verification gate passes.
      // organizationId guard mirrors the original direct DB update in business-profile.service.ts
      // to prevent cross-org writes during the migration transition window.
      const projectsWhere = organizationId
        ? and(eq(projects.id, projectId), eq(projects.organizationId, organizationId))
        : eq(projects.id, projectId);
      await tx
        .update(projects)
        .set({
          sitemapUrls: urls,
          sitemapDiscoveredAt: now,
          sitemapUrlCount: urls.length,
          updatedAt: now,
        })
        .where(projectsWhere);
    });

    this.logger.log(
      `setUrls: stored ${urls.length} URL(s) for project ${projectId} (batchId: ${batchId})`,
    );
  }

  /**
   * One-time migration helper. Copies URLs from the legacy projects.sitemap_urls array
   * into project_sitemap_urls. Idempotent — skips projects that already have rows.
   *
   * Used by server/scripts/migrate-sitemap-urls.ts.
   *
   * @returns number of URLs imported (0 if already migrated or no legacy data)
   */
  async importFromLegacy(projectId: string): Promise<number> {
    // Idempotency check: skip if the new table already has rows for this project
    const existing = await this.db.db
      .select({ id: projectSitemapUrls.id })
      .from(projectSitemapUrls)
      .where(eq(projectSitemapUrls.projectId, projectId))
      .limit(1);

    if (existing.length > 0) {
      return 0;
    }

    const project = await this.db.db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { organizationId: true, sitemapUrls: true, sitemapDiscoveredAt: true },
    });

    const legacyUrls = project?.sitemapUrls ?? [];
    if (legacyUrls.length === 0) return 0;

    const organizationId = project!.organizationId;
    const discoveredAt = project?.sitemapDiscoveredAt ?? new Date();
    const batchId = randomUUID();

    await this.db.db.transaction(async (tx) => {
      await tx.insert(projectSitemapUrls).values(
        legacyUrls.map((url, idx) => ({
          projectId,
          organizationId,
          url,
          position: idx,
          discoveredAt,
          discoveryBatchId: batchId,
          updatedAt: new Date(),
        })),
      );

      await tx
        .update(projects)
        .set({ sitemapUrlCount: legacyUrls.length, updatedAt: new Date() })
        .where(eq(projects.id, projectId));
    });

    this.logger.log(
      `importFromLegacy: migrated ${legacyUrls.length} URL(s) for project ${projectId}`,
    );
    return legacyUrls.length;
  }
}
