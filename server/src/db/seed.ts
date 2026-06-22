import { db } from './index';
import { organizations, orgMembers, workspaces, projects } from './schema';
import { eq } from 'drizzle-orm';

const DEV_CREDITS = 10_000;

async function seed() {
  console.log('🌱 Seeding Pulse OS v2 database...');

  // Top up all existing organizations with dev credits
  const existingOrgs = await db.query.organizations.findMany();
  for (const existing of existingOrgs) {
    if (existing.creditsBalance < DEV_CREDITS) {
      await db
        .update(organizations)
        .set({ creditsBalance: DEV_CREDITS, updatedAt: new Date() })
        .where(eq(organizations.id, existing.id));
      console.log(`  ✓ Topped up org "${existing.name}" to ${DEV_CREDITS} credits (was ${existing.creditsBalance})`);
    }
  }

  // Create a demo organization
  const [org] = await db
    .insert(organizations)
    .values({
      clerkOrgId: 'org_demo',
      name: 'Demo Agency',
      slug: 'demo-agency',
      plan: 'pro',
      creditsBalance: DEV_CREDITS,
    })
    .returning();

  console.log(`  ✓ Organization: ${org.name} (${org.id})`);

  // Create a demo member
  const [member] = await db
    .insert(orgMembers)
    .values({
      organizationId: org.id,
      clerkUserId: 'user_demo',
      role: 'owner',
      email: 'demo@pulse.dev',
      name: 'Demo User',
    })
    .returning();

  console.log(`  ✓ Member: ${member.email}`);

  // Create a demo workspace
  const [workspace] = await db
    .insert(workspaces)
    .values({
      organizationId: org.id,
      name: 'Acme Corp',
      slug: 'acme-corp',
    })
    .returning();

  console.log(`  ✓ Workspace: ${workspace.name}`);

  // Create a demo project
  const [project] = await db
    .insert(projects)
    .values({
      workspaceId: workspace.id,
      organizationId: org.id,
      name: 'Acme SEO',
      domain: 'acme.com',
      country: 'US',
      language: 'en',
      industry: 'saas',
    })
    .returning();

  console.log(`  ✓ Project: ${project.name}`);

  console.log('\n✅ Seed complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
