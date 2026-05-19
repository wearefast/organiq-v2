/**
 * Deterministic test fixtures for unit & integration tests.
 * UUIDs are fixed to make assertions easy.
 */

export const TEST_ORG = {
  id: '00000000-0000-4000-a000-000000000001',
  clerkOrgId: 'org_test_123',
  name: 'Test Organization',
  slug: 'test-org',
  plan: 'pro' as const,
  creditsBalance: 1000,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
};

export const TEST_MEMBER = {
  id: '00000000-0000-4000-a000-000000000002',
  organizationId: TEST_ORG.id,
  clerkUserId: 'user_test_456',
  role: 'owner' as const,
  email: 'test@example.com',
  name: 'Test User',
  createdAt: new Date('2025-01-01T00:00:00Z'),
};

export const TEST_WORKSPACE = {
  id: '00000000-0000-4000-a000-000000000003',
  organizationId: TEST_ORG.id,
  name: 'Test Workspace',
  slug: 'test-workspace',
  domain: 'example.com',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
};

export const TEST_PROJECT = {
  id: '00000000-0000-4000-a000-000000000004',
  workspaceId: TEST_WORKSPACE.id,
  organizationId: TEST_ORG.id,
  name: 'Test Project',
  domain: 'example.com',
  country: 'US',
  language: 'en',
  industry: 'Technology',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
};

export const TEST_WORKFLOW_RUN = {
  id: '00000000-0000-4000-a000-000000000005',
  projectId: TEST_PROJECT.id,
  organizationId: TEST_ORG.id,
  status: 'running' as const,
  currentStep: 'phase1-baseline',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
};
