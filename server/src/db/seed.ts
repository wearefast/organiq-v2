import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

async function seed() {
  console.log('🌱 Seeding database...');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://calibrate:calibrate@localhost:5432/calibrate_commerce',
  });
  const db = drizzle(pool, { schema });

  // Create a demo user
  const [user] = await db
    .insert(schema.users)
    .values({
      clerkId: 'demo_clerk_id',
      email: 'demo@calibratecommerce.com',
    })
    .onConflictDoNothing()
    .returning();

  if (user) {
    console.log(`Created user: ${user.email}`);

    // Create a sample audit
    const [audit] = await db
      .insert(schema.audits)
      .values({
        websiteUrl: 'https://example.com',
        status: 'COMPLETE',
        seoScore: 62,
        geoScore: 45,
        aeoScore: 38,
        contentGapCount: 47,
        estimatedTrafficLoss: 3500,
        seedKeywords: ['seo agency', 'digital marketing', 'content strategy'],
        userId: user.id,
      })
      .returning();

    // Create a sample lead
    await db.insert(schema.leads).values({
      email: 'lead@example.com',
      name: 'Jane Smith',
      websiteUrl: 'https://example.com',
      businessDetails: {
        description: 'Digital marketing agency focused on B2B SaaS',
        industry: 'Marketing',
      },
      auditId: audit.id,
      score: 72,
      status: 'NEW',
    });

    // Create a sample keyword project
    const [project] = await db
      .insert(schema.keywordProjects)
      .values({
        userId: user.id,
        name: 'Example.com SEO Campaign',
        websiteUrl: 'https://example.com',
        seedKeywords: ['seo agency', 'digital marketing', 'content strategy'],
      })
      .returning();

    await db.insert(schema.keywords).values([
      {
        projectId: project.id,
        keyword: 'best seo agency',
        kd: 45,
        searchVolume: 2400,
        intent: 'COMMERCIAL',
        funnel: 'BOFU',
        status: 'DISCOVERED',
      },
      {
        projectId: project.id,
        keyword: 'what is seo',
        kd: 78,
        searchVolume: 74000,
        intent: 'INFORMATIONAL',
        funnel: 'TOFU',
        status: 'DISCOVERED',
      },
      {
        projectId: project.id,
        keyword: 'seo content strategy guide',
        kd: 32,
        searchVolume: 1900,
        intent: 'INFORMATIONAL',
        funnel: 'MOFU',
        status: 'DISCOVERED',
      },
    ]);
  }

  console.log('✅ Seed complete');
  await pool.end();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
