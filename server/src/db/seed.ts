import { db } from './index';
import { organizations, orgMembers, workspaces, projects } from './schema';

async function seed() {
  console.log('🌱 Seeding Pulse OS v2 database...');

  // Create a demo organization
  const [org] = await db
    .insert(organizations)
    .values({
      clerkOrgId: 'org_demo',
      name: 'Demo Agency',
      slug: 'demo-agency',
      plan: 'pro',
      creditsBalance: 5000,
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
      domain: 'acme.com',
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
