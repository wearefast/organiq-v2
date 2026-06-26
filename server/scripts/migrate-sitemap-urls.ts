/**
 * One-time migration script — Phase 3 of the sitemap normalization plan.
 *
 * Copies all sitemap URLs from the legacy `projects.sitemap_urls` text[] column
 * into the new `project_sitemap_urls` table for projects that have not yet been
 * migrated (i.e., have legacy data but no rows in the new table).
 *
 * IDEMPOTENT: Projects already migrated are skipped. Safe to run multiple times.
 * BATCHED: Processes 50 projects per batch with a 100ms delay to avoid DB overload.
 *
 * Usage (run from server/ directory):
 *   npx ts-node -r tsconfig-paths/register scripts/migrate-sitemap-urls.ts
 *
 * Verification query to run after completion (should return 0 rows):
 *   SELECT p.id, p.domain, cardinality(p.sitemap_urls) AS legacy, COUNT(psu.id) AS new_count
 *   FROM projects p
 *   LEFT JOIN project_sitemap_urls psu ON psu.project_id = p.id
 *   WHERE p.sitemap_urls IS NOT NULL
 *   GROUP BY p.id
 *   HAVING cardinality(p.sitemap_urls) != COUNT(psu.id);
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, isNotNull, notInArray, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import * as schema from '../src/db/schema';

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 100;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  console.log('=== Sitemap URL Migration Script (Phase 3) ===');
  console.log(`Connected to database`);

  // Count projects that have legacy data but no rows in the new table
  const toMigrateResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.projects)
    .where(
      sql`${schema.projects.sitemapUrls} IS NOT NULL
          AND cardinality(${schema.projects.sitemapUrls}) > 0
          AND ${schema.projects.id} NOT IN (
            SELECT DISTINCT project_id FROM project_sitemap_urls
          )`,
    );

  const toMigrate = toMigrateResult[0]?.count ?? 0;
  console.log(`Projects requiring migration: ${toMigrate}`);

  if (toMigrate === 0) {
    console.log('Nothing to migrate. Exiting.');
    await pool.end();
    return;
  }

  let offset = 0;
  let totalMigrated = 0;
  let totalUrls = 0;

  while (true) {
    // Fetch a batch of projects with legacy sitemap data not yet in the new table
    const batch = await db
      .select({
        id: schema.projects.id,
        domain: schema.projects.domain,
        sitemapUrls: schema.projects.sitemapUrls,
        sitemapDiscoveredAt: schema.projects.sitemapDiscoveredAt,
      })
      .from(schema.projects)
      .where(
        sql`${schema.projects.sitemapUrls} IS NOT NULL
            AND cardinality(${schema.projects.sitemapUrls}) > 0
            AND ${schema.projects.id} NOT IN (
              SELECT DISTINCT project_id FROM project_sitemap_urls
            )`,
      )
      .limit(BATCH_SIZE)
      .offset(offset);

    if (batch.length === 0) break;

    for (const project of batch) {
      const legacyUrls = project.sitemapUrls ?? [];
      if (legacyUrls.length === 0) {
        console.log(`[SKIP] Project ${project.id} (${project.domain}) — no legacy sitemap data`);
        continue;
      }

      const discoveredAt = project.sitemapDiscoveredAt ?? new Date();
      const batchId = randomUUID();

      try {
        await db.transaction(async (tx) => {
          await tx.insert(schema.projectSitemapUrls).values(
            legacyUrls.map((url, idx) => ({
              projectId: project.id,
              url,
              position: idx,
              discoveredAt,
              discoveryBatchId: batchId,
              updatedAt: new Date(),
            })),
          );

          await tx
            .update(schema.projects)
            .set({ sitemapUrlCount: legacyUrls.length, updatedAt: new Date() })
            .where(eq(schema.projects.id, project.id));
        });

        totalMigrated++;
        totalUrls += legacyUrls.length;
        console.log(
          `[${totalMigrated}/${toMigrate}] Migrated project ${project.id} (${project.domain}) — ${legacyUrls.length} URLs`,
        );
      } catch (err) {
        console.error(
          `ERROR migrating project ${project.id} (${project.domain}): ${(err as Error).message}`,
        );
        // Continue with remaining projects — do not abort on single failure
      }
    }

    offset += BATCH_SIZE;
    if (batch.length === BATCH_SIZE) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log('');
  console.log('=== Migration Complete ===');
  console.log(`Projects migrated: ${totalMigrated}`);
  console.log(`Total URLs inserted: ${totalUrls}`);
  console.log('');
  console.log('Run the verification query to confirm 0 discrepancies:');
  console.log(`
  SELECT p.id, p.domain, cardinality(p.sitemap_urls) AS legacy, COUNT(psu.id) AS new_count
  FROM projects p
  LEFT JOIN project_sitemap_urls psu ON psu.project_id = p.id
  WHERE p.sitemap_urls IS NOT NULL
  GROUP BY p.id
  HAVING cardinality(p.sitemap_urls) != COUNT(psu.id);
  `);

  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
