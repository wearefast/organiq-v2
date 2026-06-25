import {
  pgTable,
  text,
  timestamp,
  integer,
  decimal,
  boolean,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ───────────────────────────────────────────────────

export const orgPlanEnum = pgEnum('org_plan', [
  'starter',
  'pro',
  'agency',
  'enterprise',
]);

export const orgRoleEnum = pgEnum('org_role', ['owner', 'admin', 'member', 'user']);

export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'expired',
  'revoked',
]);

export const accessGrantTypeEnum = pgEnum('access_grant_type', [
  'org',
  'workspace',
  'project',
]);

export const creditTypeEnum = pgEnum('credit_type', [
  'purchase',
  'usage',
  'refund',
  'bonus',
]);

export const workflowRunStatusEnum = pgEnum('workflow_run_status', [
  'draft',
  'running',
  'paused',
  'completed',
  'failed',
]);

export const stepStatusEnum = pgEnum('step_status', [
  'pending',
  'running',
  'completed',
  'awaiting_approval',
  'approved',
  'revision_requested',
  'rejected',
  'failed',
  'skipped',
]);

export const approvalDecisionEnum = pgEnum('approval_decision', [
  'approved',
  'revision_requested',
  'rejected',
]);

export const keywordIntentEnum = pgEnum('keyword_intent', [
  'transactional',
  'commercial',
  'informational',
  'navigational',
]);

export const funnelStageEnum = pgEnum('funnel_stage', ['tofu', 'mofu', 'bofu']);

export const keywordStatusEnum = pgEnum('keyword_status', [
  'discovered',
  'approved',
  'brief_ready',
  'written',
  'published',
]);

export const contentTypeEnum = pgEnum('content_type', ['brief', 'article']);

export const contentStatusEnum = pgEnum('content_status', [
  'draft',
  'review',
  'approved',
  'published',
]);

export const reportTypeEnum = pgEnum('report_type', [
  'full_strategy',
  'ai_visibility',
  'keyword_research',
  'content_plan',
]);

export const decaySeverityEnum = pgEnum('decay_severity', ['low', 'medium', 'high', 'critical']);

export const notificationTypeEnum = pgEnum('notification_type', [
  'decay_alert',
  'workflow_complete',
  'approval_needed',
  'system',
]);

// ─── Organizations ───────────────────────────────────────────

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clerkOrgId: text('clerk_org_id').notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    plan: orgPlanEnum('plan').default('starter').notNull(),
    creditsBalance: integer('credits_balance').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    clerkOrgIdIdx: uniqueIndex('organizations_clerk_org_id_idx').on(table.clerkOrgId),
    slugIdx: uniqueIndex('organizations_slug_idx').on(table.slug),
  }),
);

// ─── Org Members ─────────────────────────────────────────────

export const orgMembers = pgTable(
  'org_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    clerkUserId: text('clerk_user_id').notNull(),
    role: orgRoleEnum('role').default('user').notNull(),
    email: text('email').notNull(),
    name: text('name'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    orgUserIdx: uniqueIndex('org_members_org_user_idx').on(table.organizationId, table.clerkUserId),
  }),
);

// ─── Invitations ────────────────────────────────────────────

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    /** Admin who sent this invitation — nullable (SET NULL) so pending invites survive admin departure */
    invitedByMemberId: uuid('invited_by_member_id').references(() => orgMembers.id, { onDelete: 'set null' }),
    email: text('email').notNull(),
    role: orgRoleEnum('role').notNull().default('user'),
    status: invitationStatusEnum('status').notNull().default('pending'),
    /** Secure token included in the invite link */
    token: text('token').notNull(),
    /** Clerk organization invitation ID — used to revoke via Clerk API on cancel */
    clerkInvitationId: text('clerk_invitation_id'),
    /** [{type:'org'} | {type:'workspace',workspaceId:string} | {type:'project',workspaceId:string,projectId:string}] */
    accessGrants: jsonb('access_grants').$type<Array<
      | { type: 'org' }
      | { type: 'workspace'; workspaceId: string }
      | { type: 'project'; workspaceId: string; projectId: string }
    >>().notNull().default([]),
    expiresAt: timestamp('expires_at').notNull(),
    acceptedAt: timestamp('accepted_at'),
    /** When the invitation was revoked */
    revokedAt: timestamp('revoked_at'),
    /** Member who revoked — nullable (SET NULL) in case revoking admin later leaves */
    revokedByMemberId: uuid('revoked_by_member_id').references(() => orgMembers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tokenIdx: uniqueIndex('invitations_token_idx').on(table.token),
    orgStatusIdx: index('invitations_org_status_idx').on(table.organizationId, table.status),
    orgEmailIdx: index('invitations_org_email_idx').on(table.organizationId, table.email),
  }),
);

// ─── Access Grants ───────────────────────────────────────────

export const accessGrants = pgTable(
  'access_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id').notNull().references(() => orgMembers.id, { onDelete: 'cascade' }),
    grantType: accessGrantTypeEnum('grant_type').notNull(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    grantedByMemberId: uuid('granted_by_member_id').references(() => orgMembers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    orgMemberIdx: index('access_grants_org_member_idx').on(table.organizationId, table.memberId),
    memberTypeIdx: index('access_grants_member_type_idx').on(table.memberId, table.grantType),
    workspaceIdx: index('access_grants_workspace_idx').on(table.workspaceId),
    projectIdx: index('access_grants_project_idx').on(table.projectId),
  }),
);

// ─── Workspace Credit Limits ──────────────────────────────────

export const workspaceCreditLimits = pgTable(
  'workspace_credit_limits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    monthlyLimit: integer('monthly_limit').notNull(),
    currentMonthUsage: integer('current_month_usage').notNull().default(0),
    /** Start of the current monthly billing period */
    periodStart: timestamp('period_start').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    workspaceIdx: uniqueIndex('workspace_credit_limits_workspace_idx').on(table.workspaceId),
    orgIdx: index('workspace_credit_limits_org_idx').on(table.organizationId),
  }),
);

// ─── Credit Ledger ───────────────────────────────────────────

export const creditLedger = pgTable(
  'credit_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    type: creditTypeEnum('type').notNull(),
    description: text('description').notNull(),
    workflowRunId: uuid('workflow_run_id'),
    stepKey: text('step_key'),
    /** Workspace the credit debit belongs to — denormalized for fast workspace usage queries */
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    orgCreatedIdx: index('credit_ledger_org_created_idx').on(table.organizationId, table.createdAt),
  }),
);

// ─── Subscriptions ───────────────────────────────────────────

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'past_due',
  'canceled',
  'trialing',
  'incomplete',
]);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    stripeSubscriptionId: text('stripe_subscription_id').notNull(),
    stripeCustomerId: text('stripe_customer_id').notNull(),
    stripePriceId: text('stripe_price_id').notNull(),
    plan: orgPlanEnum('plan').notNull(),
    status: subscriptionStatusEnum('status').notNull().default('active'),
    currentPeriodStart: timestamp('current_period_start').notNull(),
    currentPeriodEnd: timestamp('current_period_end').notNull(),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
    monthlyCredits: integer('monthly_credits').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('subscriptions_org_idx').on(table.organizationId),
    stripeSubIdx: uniqueIndex('subscriptions_stripe_sub_idx').on(table.stripeSubscriptionId),
    stripeCustomerIdx: index('subscriptions_stripe_customer_idx').on(table.stripeCustomerId),
  }),
);

// ─── Purchases (one-time credit packs) ──────────────────────

export const purchases = pgTable(
  'purchases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    stripePaymentIntentId: text('stripe_payment_intent_id').notNull(),
    stripeCustomerId: text('stripe_customer_id').notNull(),
    amount: integer('amount').notNull(),
    credits: integer('credits').notNull(),
    currency: text('currency').notNull().default('usd'),
    status: text('status').notNull().default('succeeded'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('purchases_org_idx').on(table.organizationId),
    stripePaymentIdx: uniqueIndex('purchases_stripe_payment_idx').on(table.stripePaymentIntentId),
  }),
);

// ─── Workspaces ──────────────────────────────────────────────

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgSlugIdx: uniqueIndex('workspaces_org_slug_idx').on(table.organizationId, table.slug),
  }),
);

// ─── Projects ────────────────────────────────────────────────

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    domain: text('domain').notNull(),
    country: text('country').default('US').notNull(),
    language: text('language').default('en').notNull(),
    industry: text('industry'),
    /** User-supplied direct competitors — when provided (≥ 2), AI competitor discovery is skipped during profile generation */
    directCompetitors: text('direct_competitors').array(),
    /** User-supplied sitemap URL — when set, this is probed first before auto-discovery */
    customSitemapUrl: text('custom_sitemap_url'),
    /** Page URLs discovered from the site's sitemap.xml — populated on project create/domain-update */
    sitemapUrls: text('sitemap_urls').array(),
    /** When the sitemap was last crawled */
    sitemapDiscoveredAt: timestamp('sitemap_discovered_at'),
    /** AI-synthesized business profile — populated via the project-level refresh action */
    businessProfile: jsonb('business_profile'),
    /** When the business profile was last generated */
    businessProfileUpdatedAt: timestamp('business_profile_updated_at'),
    /** Multi-target definitions: [{key, domain, country, language}] */
    targets: jsonb('targets').$type<Array<{ key: string; domain: string; country: string; language: string }>>().default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    workspaceIdx: index('projects_workspace_idx').on(table.workspaceId),
    orgIdx: index('projects_org_idx').on(table.organizationId),
  }),
);

// ─── Workflow Runs ───────────────────────────────────────────

export const workflowRuns = pgTable(
  'workflow_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    status: workflowRunStatusEnum('status').default('draft').notNull(),
    currentStep: text('current_step'),
    targetKey: text('target_key'),
    creditsUsed: integer('credits_used').default(0).notNull(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index('workflow_runs_project_idx').on(table.projectId),
    orgIdx: index('workflow_runs_org_idx').on(table.organizationId),
  }),
);

// ─── Workflow Steps ──────────────────────────────────────────

export const workflowSteps = pgTable(
  'workflow_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workflowRunId: uuid('workflow_run_id').notNull().references(() => workflowRuns.id, { onDelete: 'cascade' }),
    stepKey: text('step_key').notNull(),
    stepNumber: integer('step_number').notNull(),
    phase: integer('phase').notNull(),
    status: stepStatusEnum('status').default('pending').notNull(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    creditsUsed: integer('credits_used').default(0).notNull(),
    iterations: integer('iterations').default(0).notNull(),
    error: text('error'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    runStepIdx: uniqueIndex('workflow_steps_run_step_idx').on(table.workflowRunId, table.stepKey),
  }),
);

// ─── Step Artifacts ──────────────────────────────────────────

export const stepArtifacts = pgTable(
  'step_artifacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workflowStepId: uuid('workflow_step_id').notNull().references(() => workflowSteps.id, { onDelete: 'cascade' }),
    workflowRunId: uuid('workflow_run_id').notNull().references(() => workflowRuns.id, { onDelete: 'cascade' }),
    stepKey: text('step_key').notNull(),
    version: integer('version').default(1).notNull(),
    data: jsonb('data').notNull(),
    reasoning: text('reasoning'),
    thinkingContent: text('thinking_content'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    runStepVersionIdx: index('step_artifacts_run_step_version_idx').on(
      table.workflowRunId,
      table.stepKey,
      table.version,
    ),
  }),
);

// ─── Step Approvals ──────────────────────────────────────────

export const stepApprovals = pgTable(
  'step_approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workflowStepId: uuid('workflow_step_id').notNull().references(() => workflowSteps.id, { onDelete: 'cascade' }),
    artifactId: uuid('artifact_id').notNull().references(() => stepArtifacts.id, { onDelete: 'cascade' }),
  decision: approvalDecisionEnum('decision').notNull(),
  notes: text('notes'),
    reviewerId: text('reviewer_id').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    stepIdx: index('step_approvals_step_idx').on(table.workflowStepId),
  }),
);

// ─── Step Tool Calls ─────────────────────────────────────────

export const stepToolCalls = pgTable(
  'step_tool_calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workflowStepId: uuid('workflow_step_id').notNull().references(() => workflowSteps.id, { onDelete: 'cascade' }),
    toolName: text('tool_name').notNull(),
    input: jsonb('input').notNull(),
    output: jsonb('output'),
    durationMs: integer('duration_ms'),
    error: text('error'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    stepIdx: index('step_tool_calls_step_idx').on(table.workflowStepId),
  }),
);

// ─── Workflow Context ────────────────────────────────────────

export const workflowContext = pgTable(
  'workflow_context',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workflowRunId: uuid('workflow_run_id').notNull().references(() => workflowRuns.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: jsonb('value').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    runKeyIdx: uniqueIndex('workflow_context_run_key_idx').on(table.workflowRunId, table.key),
  }),
);

// ─── Keywords ────────────────────────────────────────────────

export const keywords = pgTable(
  'keywords',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    workflowRunId: uuid('workflow_run_id').references(() => workflowRuns.id, { onDelete: 'set null' }),
    keyword: text('keyword').notNull(),
    volume: integer('volume'),
    difficulty: integer('difficulty'),
    cpc: decimal('cpc', { precision: 10, scale: 2 }),
    intent: keywordIntentEnum('intent'),
    funnelStage: funnelStageEnum('funnel_stage'),
    status: keywordStatusEnum('status').default('discovered').notNull(),
    sourceStep: text('source_step'),
    parentTopic: text('parent_topic'),
    serpFeatures: jsonb('serp_features'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    projectStatusIdx: index('keywords_project_status_idx').on(table.projectId, table.status),
    projectKeywordIdx: uniqueIndex('keywords_project_keyword_idx').on(table.projectId, table.keyword),
  }),
);

// ─── Topical Maps ────────────────────────────────────────────

export const topicalMaps = pgTable(
  'topical_maps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    workflowRunId: uuid('workflow_run_id').references(() => workflowRuns.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    pillars: jsonb('pillars').notNull(),
    calendar: jsonb('calendar'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index('topical_maps_project_idx').on(table.projectId),
  }),
);

// ─── Topical Map Pages ───────────────────────────────────────
// Normalised rows extracted from topicalMaps.pillars JSONB.
// Each page gets a stable UUID that other tables (contentPieces) can FK against.

export const topicalMapPages = pgTable(
  'topical_map_pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    topicalMapId: uuid('topical_map_id').notNull().references(() => topicalMaps.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    pillarTitle: text('pillar_title').notNull(),
    clusterTitle: text('cluster_title').notNull(),
    title: text('title').notNull(),
    keyword: text('keyword'),
    suggestedUrl: text('suggested_url'),
    contentType: text('content_type'),
    intent: text('intent'),
    funnelStage: text('funnel_stage'),
    volume: integer('volume'),
    difficulty: integer('difficulty'),
    estimatedWordCount: integer('estimated_word_count'),
    priority: text('priority'),
    linksTo: text('links_to').array(),
    linksFrom: text('links_from').array(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    mapIdx: index('topical_map_pages_map_idx').on(table.topicalMapId),
    projectIdx: index('topical_map_pages_project_idx').on(table.projectId),
    mapTitleIdx: uniqueIndex('topical_map_pages_map_title_idx').on(table.topicalMapId, table.title),
  }),
);

// ─── Content Pieces ──────────────────────────────────────────

export const contentPieces = pgTable(
  'content_pieces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    keywordId: uuid('keyword_id').references(() => keywords.id, { onDelete: 'set null' }),
    topicalMapId: uuid('topical_map_id').references(() => topicalMaps.id, { onDelete: 'set null' }),
    topicalMapPageId: uuid('topical_map_page_id').references(() => topicalMapPages.id, { onDelete: 'set null' }),
    workflowRunId: uuid('workflow_run_id').references(() => workflowRuns.id, { onDelete: 'set null' }),
    sourceStepKey: text('source_step_key'),
    type: contentTypeEnum('type').notNull(),
    status: contentStatusEnum('status').default('draft').notNull(),
    title: text('title').notNull(),
    briefData: jsonb('brief_data'),
    articleData: jsonb('article_data'),
    scores: jsonb('scores'),
    wordCount: integer('word_count'),
    scheduledPublishAt: timestamp('scheduled_publish_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index('content_pieces_project_idx').on(table.projectId),
    statusIdx: index('content_pieces_status_idx').on(table.projectId, table.status),
    runStepIdx: uniqueIndex('content_pieces_run_step_idx').on(table.workflowRunId, table.sourceStepKey),
    pageIdx: index('content_pieces_page_idx').on(table.topicalMapPageId),
  }),
);

// ─── Content Images ──────────────────────────────────────────

export const contentImages = pgTable(
  'content_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contentPieceId: uuid('content_piece_id').notNull().references(() => contentPieces.id, { onDelete: 'cascade' }),
    index: integer('index').notNull(),
    altText: text('alt_text'),
    prompt: text('prompt'),
    base64: text('base64').notNull(),
    revisedPrompt: text('revised_prompt'),
    size: text('size'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pieceIdx: index('content_images_piece_idx').on(table.contentPieceId),
    pieceIndexIdx: uniqueIndex('content_images_piece_index_idx').on(table.contentPieceId, table.index),
  }),
);

// ─── Project Assets (user-uploaded) ──────────────────────────

export const projectAssets = pgTable(
  'project_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    base64: text('base64').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index('project_assets_project_idx').on(table.projectId),
  }),
);

// ─── Reports ─────────────────────────────────────────────────

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    workflowRunId: uuid('workflow_run_id').references(() => workflowRuns.id, { onDelete: 'set null' }),
    type: reportTypeEnum('type').notNull(),
    title: text('title').notNull(),
    filePath: text('file_path'),
    generatedAt: timestamp('generated_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index('reports_project_idx').on(table.projectId),
    typeIdx: index('reports_type_idx').on(table.type),
  }),
);

// ─── GSC Connections ─────────────────────────────────────────

export const gscConnections = pgTable(
  'gsc_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    siteUrl: text('site_url').notNull(),
    encryptedAccessToken: text('encrypted_access_token').notNull(),
    encryptedRefreshToken: text('encrypted_refresh_token').notNull(),
    tokenExpiresAt: timestamp('token_expires_at'),
    lastSyncAt: timestamp('last_sync_at'),
    syncStatus: text('sync_status').default('pending').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: uniqueIndex('gsc_connections_project_idx').on(table.projectId),
    orgIdx: index('gsc_connections_org_idx').on(table.organizationId),
  }),
);

// ─── GSC Keyword Data ────────────────────────────────────────

export const gscKeywordData = pgTable(
  'gsc_keyword_data',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    connectionId: uuid('connection_id').notNull().references(() => gscConnections.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    query: text('query').notNull(),
    page: text('page').default('').notNull(),
    clicks: integer('clicks').default(0).notNull(),
    impressions: integer('impressions').default(0).notNull(),
    ctr: decimal('ctr', { precision: 8, scale: 6 }),
    position: decimal('position', { precision: 8, scale: 2 }),
    date: timestamp('date').notNull(),
    country: text('country'),
    device: text('device'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    connectionIdx: index('gsc_keyword_data_connection_idx').on(table.connectionId),
    projectDateIdx: index('gsc_keyword_data_project_date_idx').on(table.projectId, table.date),
    queryIdx: index('gsc_keyword_data_query_idx').on(table.query),
    uniqueRow: uniqueIndex('gsc_keyword_data_unique_row_idx').on(table.projectId, table.query, table.page, table.date),
  }),
);

// ─── API Usage Logs ──────────────────────────────────────────

export const apiUsageLogs = pgTable(
  'api_usage_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    workflowRunId: uuid('workflow_run_id').references(() => workflowRuns.id, { onDelete: 'set null' }),
    stepKey: text('step_key'),
    provider: text('provider').notNull(),
    endpoint: text('endpoint').notNull(),
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    requestCount: integer('request_count').default(1).notNull(),
    costUsd: decimal('cost_usd', { precision: 10, scale: 6 }).notNull(),
    durationMs: integer('duration_ms'),
    success: boolean('success').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    orgCreatedAtIdx: index('api_usage_logs_org_created_at_idx').on(table.organizationId, table.createdAt),
    projectCreatedAtIdx: index('api_usage_logs_project_created_at_idx').on(table.projectId, table.createdAt),
    runStepIdx: index('api_usage_logs_run_step_idx').on(table.workflowRunId, table.stepKey),
  }),
);

// ─── Relations ───────────────────────────────────────────────

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(orgMembers),
  creditLedger: many(creditLedger),
  workspaces: many(workspaces),
  workflowRuns: many(workflowRuns),
  invitations: many(invitations),
  workspaceCreditLimits: many(workspaceCreditLimits),
  apiUsageLogs: many(apiUsageLogs),
}));

export const orgMembersRelations = relations(orgMembers, ({ one, many }) => ({
  organization: one(organizations, { fields: [orgMembers.organizationId], references: [organizations.id] }),
  grants: many(accessGrants, { relationName: 'memberGrants' }),
  grantedGrants: many(accessGrants, { relationName: 'grantedBy' }),
  sentInvitations: many(invitations, { relationName: 'invitedBy' }),
  revokedInvitations: many(invitations, { relationName: 'revokedBy' }),
}));

export const creditLedgerRelations = relations(creditLedger, ({ one }) => ({
  organization: one(organizations, { fields: [creditLedger.organizationId], references: [organizations.id] }),
  workspace: one(workspaces, { fields: [creditLedger.workspaceId], references: [workspaces.id] }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  organization: one(organizations, { fields: [subscriptions.organizationId], references: [organizations.id] }),
}));

export const purchasesRelations = relations(purchases, ({ one }) => ({
  organization: one(organizations, { fields: [purchases.organizationId], references: [organizations.id] }),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  organization: one(organizations, { fields: [workspaces.organizationId], references: [organizations.id] }),
  projects: many(projects),
  accessGrants: many(accessGrants),
  creditLimit: one(workspaceCreditLimits, { fields: [workspaces.id], references: [workspaceCreditLimits.workspaceId] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [projects.workspaceId], references: [workspaces.id] }),
  organization: one(organizations, { fields: [projects.organizationId], references: [organizations.id] }),
  workflowRuns: many(workflowRuns),
  keywords: many(keywords),
  topicalMaps: many(topicalMaps),
  contentPieces: many(contentPieces),
  reports: many(reports),
  intelligence: many(projectIntelligence),
  refreshSuggestions: many(refreshSuggestions),
  assets: many(projectAssets),
  accessGrants: many(accessGrants),
}));

export const projectAssetsRelations = relations(projectAssets, ({ one }) => ({
  project: one(projects, { fields: [projectAssets.projectId], references: [projects.id] }),
}));

export const workflowRunsRelations = relations(workflowRuns, ({ one, many }) => ({
  project: one(projects, { fields: [workflowRuns.projectId], references: [projects.id] }),
  organization: one(organizations, { fields: [workflowRuns.organizationId], references: [organizations.id] }),
  steps: many(workflowSteps),
  artifacts: many(stepArtifacts),
  context: many(workflowContext),
}));

export const workflowStepsRelations = relations(workflowSteps, ({ one, many }) => ({
  workflowRun: one(workflowRuns, { fields: [workflowSteps.workflowRunId], references: [workflowRuns.id] }),
  artifacts: many(stepArtifacts),
  approvals: many(stepApprovals),
  toolCalls: many(stepToolCalls),
}));

export const stepArtifactsRelations = relations(stepArtifacts, ({ one, many }) => ({
  workflowStep: one(workflowSteps, { fields: [stepArtifacts.workflowStepId], references: [workflowSteps.id] }),
  workflowRun: one(workflowRuns, { fields: [stepArtifacts.workflowRunId], references: [workflowRuns.id] }),
  approvals: many(stepApprovals),
}));

export const stepApprovalsRelations = relations(stepApprovals, ({ one }) => ({
  workflowStep: one(workflowSteps, { fields: [stepApprovals.workflowStepId], references: [workflowSteps.id] }),
  artifact: one(stepArtifacts, { fields: [stepApprovals.artifactId], references: [stepArtifacts.id] }),
}));

export const stepToolCallsRelations = relations(stepToolCalls, ({ one }) => ({
  workflowStep: one(workflowSteps, { fields: [stepToolCalls.workflowStepId], references: [workflowSteps.id] }),
}));

export const workflowContextRelations = relations(workflowContext, ({ one }) => ({
  workflowRun: one(workflowRuns, { fields: [workflowContext.workflowRunId], references: [workflowRuns.id] }),
}));

export const keywordsRelations = relations(keywords, ({ one }) => ({
  project: one(projects, { fields: [keywords.projectId], references: [projects.id] }),
  workflowRun: one(workflowRuns, { fields: [keywords.workflowRunId], references: [workflowRuns.id] }),
}));

export const topicalMapsRelations = relations(topicalMaps, ({ one, many }) => ({
  project: one(projects, { fields: [topicalMaps.projectId], references: [projects.id] }),
  workflowRun: one(workflowRuns, { fields: [topicalMaps.workflowRunId], references: [workflowRuns.id] }),
  contentPieces: many(contentPieces),
  pages: many(topicalMapPages),
}));

export const topicalMapPagesRelations = relations(topicalMapPages, ({ one, many }) => ({
  topicalMap: one(topicalMaps, { fields: [topicalMapPages.topicalMapId], references: [topicalMaps.id] }),
  project: one(projects, { fields: [topicalMapPages.projectId], references: [projects.id] }),
  contentPieces: many(contentPieces),
}));

export const contentPiecesRelations = relations(contentPieces, ({ one, many }) => ({
  project: one(projects, { fields: [contentPieces.projectId], references: [projects.id] }),
  keyword: one(keywords, { fields: [contentPieces.keywordId], references: [keywords.id] }),
  topicalMap: one(topicalMaps, { fields: [contentPieces.topicalMapId], references: [topicalMaps.id] }),
  topicalMapPage: one(topicalMapPages, { fields: [contentPieces.topicalMapPageId], references: [topicalMapPages.id] }),
  workflowRun: one(workflowRuns, { fields: [contentPieces.workflowRunId], references: [workflowRuns.id] }),
  images: many(contentImages),
}));

export const contentImagesRelations = relations(contentImages, ({ one }) => ({
  contentPiece: one(contentPieces, { fields: [contentImages.contentPieceId], references: [contentPieces.id] }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  project: one(projects, { fields: [reports.projectId], references: [projects.id] }),
  workflowRun: one(workflowRuns, { fields: [reports.workflowRunId], references: [workflowRuns.id] }),
}));

export const gscConnectionsRelations = relations(gscConnections, ({ one, many }) => ({
  project: one(projects, { fields: [gscConnections.projectId], references: [projects.id] }),
  organization: one(organizations, { fields: [gscConnections.organizationId], references: [organizations.id] }),
  keywordData: many(gscKeywordData),
}));

export const gscKeywordDataRelations = relations(gscKeywordData, ({ one }) => ({
  connection: one(gscConnections, { fields: [gscKeywordData.connectionId], references: [gscConnections.id] }),
  project: one(projects, { fields: [gscKeywordData.projectId], references: [projects.id] }),
}));

// ─── Relations: Invitations ───────────────────────────────────

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, { fields: [invitations.organizationId], references: [organizations.id] }),
  invitedBy: one(orgMembers, {
    fields: [invitations.invitedByMemberId],
    references: [orgMembers.id],
    relationName: 'invitedBy',
  }),
  revokedBy: one(orgMembers, {
    fields: [invitations.revokedByMemberId],
    references: [orgMembers.id],
    relationName: 'revokedBy',
  }),
}));

// ─── Relations: Access Grants ────────────────────────────────

export const accessGrantsRelations = relations(accessGrants, ({ one }) => ({
  organization: one(organizations, { fields: [accessGrants.organizationId], references: [organizations.id] }),
  member: one(orgMembers, {
    fields: [accessGrants.memberId],
    references: [orgMembers.id],
    relationName: 'memberGrants',
  }),
  grantedBy: one(orgMembers, {
    fields: [accessGrants.grantedByMemberId],
    references: [orgMembers.id],
    relationName: 'grantedBy',
  }),
  workspace: one(workspaces, { fields: [accessGrants.workspaceId], references: [workspaces.id] }),
  project: one(projects, { fields: [accessGrants.projectId], references: [projects.id] }),
}));

// ─── Relations: Workspace Credit Limits ──────────────────────

export const workspaceCreditLimitsRelations = relations(workspaceCreditLimits, ({ one }) => ({
  organization: one(organizations, { fields: [workspaceCreditLimits.organizationId], references: [organizations.id] }),
  workspace: one(workspaces, { fields: [workspaceCreditLimits.workspaceId], references: [workspaces.id] }),
}));

// ─── Dead Letter Queue ───────────────────────────────────────

export const dlqFailedSteps = pgTable(
  'dlq_failed_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workflowStepId: uuid('workflow_step_id').references(() => workflowSteps.id, { onDelete: 'set null' }),
    workflowRunId: uuid('workflow_run_id').references(() => workflowRuns.id, { onDelete: 'set null' }),
    stepKey: text('step_key').notNull(),
    error: text('error').notNull(),
    attemptCount: integer('attempt_count').notNull(),
    jobData: jsonb('job_data').notNull(),
    failedAt: timestamp('failed_at').defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at'),
  },
  (table) => ({
    unresolvedIdx: index('dlq_unresolved_idx').on(table.resolvedAt),
  }),
);

// ─── Keyword Decay Alerts ────────────────────────────────────

export const keywordDecayAlerts = pgTable(
  'keyword_decay_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    keyword: text('keyword').notNull(),
    page: text('page').default('').notNull(),
    previousPosition: decimal('previous_position', { precision: 8, scale: 2 }).notNull(),
    currentPosition: decimal('current_position', { precision: 8, scale: 2 }).notNull(),
    positionDelta: decimal('position_delta', { precision: 8, scale: 2 }).notNull(),
    previousClicks: integer('previous_clicks').default(0).notNull(),
    currentClicks: integer('current_clicks').default(0).notNull(),
    severity: decaySeverityEnum('severity').notNull(),
    detectedAt: timestamp('detected_at').defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at'),
    snapshotStartDate: timestamp('snapshot_start_date').notNull(),
    snapshotEndDate: timestamp('snapshot_end_date').notNull(),
  },
  (table) => ({
    projectIdx: index('keyword_decay_alerts_project_idx').on(table.projectId),
    orgIdx: index('keyword_decay_alerts_org_idx').on(table.organizationId),
    severityIdx: index('keyword_decay_alerts_severity_idx').on(table.severity, table.resolvedAt),
  }),
);

// ─── Notifications ───────────────────────────────────────────

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    metadata: jsonb('metadata'),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    orgUnreadIdx: index('notifications_org_unread_idx').on(table.organizationId, table.readAt),
    projectIdx: index('notifications_project_idx').on(table.projectId),
    typeIdx: index('notifications_type_idx').on(table.type),
  }),
);

export const keywordDecayAlertsRelations = relations(keywordDecayAlerts, ({ one }) => ({
  project: one(projects, { fields: [keywordDecayAlerts.projectId], references: [projects.id] }),
  organization: one(organizations, { fields: [keywordDecayAlerts.organizationId], references: [organizations.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  organization: one(organizations, { fields: [notifications.organizationId], references: [organizations.id] }),
  project: one(projects, { fields: [notifications.projectId], references: [projects.id] }),
}));

// ─── LLM Traffic (R5) ────────────────────────────────────────

export const llmTrafficSessions = pgTable(
  'llm_traffic_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    engine: text('engine').notNull(),
    referrer: text('referrer'),
    landingPage: text('landing_page').notNull(),
    sessionId: text('session_id').notNull(),
    country: text('country'),
    device: text('device'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    projectEngineIdx: index('llm_traffic_sessions_project_engine_idx').on(table.projectId, table.engine),
    createdAtIdx: index('llm_traffic_sessions_created_at_idx').on(table.createdAt),
    sessionIdx: uniqueIndex('llm_traffic_sessions_session_idx').on(table.sessionId),
  }),
);

export const llmTrafficStats = pgTable(
  'llm_traffic_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    engine: text('engine').notNull(),
    date: timestamp('date').notNull(),
    sessions: integer('sessions').default(0).notNull(),
    topPages: jsonb('top_pages'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    projectDateIdx: index('llm_traffic_stats_project_date_idx').on(table.projectId, table.date),
    uniqueDay: uniqueIndex('llm_traffic_stats_unique_day_idx').on(table.projectId, table.engine, table.date),
  }),
);

export const llmTrafficSessionsRelations = relations(llmTrafficSessions, ({ one }) => ({
  project: one(projects, { fields: [llmTrafficSessions.projectId], references: [projects.id] }),
}));

export const llmTrafficStatsRelations = relations(llmTrafficStats, ({ one }) => ({
  project: one(projects, { fields: [llmTrafficStats.projectId], references: [projects.id] }),
}));

// ─── LLM Audit Results ───────────────────────────────────────

export const llmAuditResults = pgTable(
  'llm_audit_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    auditRunId: uuid('audit_run_id').notNull(),
    pageUrl: text('page_url').notNull(),
    aiIndexabilityScore: integer('ai_indexability_score'),
    botPermissions: jsonb('bot_permissions'),
    contentChecks: jsonb('content_checks'),
    trustSignals: jsonb('trust_signals'),
    contentChunking: jsonb('content_chunking'),
    issues: jsonb('issues'),
    auditedAt: timestamp('audited_at').defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index('llm_audit_results_project_idx').on(table.projectId),
    runIdx: index('llm_audit_results_run_idx').on(table.auditRunId),
    projectRunIdx: index('llm_audit_results_project_run_idx').on(table.projectId, table.auditRunId),
  }),
);

export const llmAuditResultsRelations = relations(llmAuditResults, ({ one }) => ({
  project: one(projects, { fields: [llmAuditResults.projectId], references: [projects.id] }),
}));

// ─── Tracked Prompts ─────────────────────────────────────────

export const intentStageEnum = pgEnum('intent_stage', ['awareness', 'consideration', 'decision']);

export const trackedPrompts = pgTable(
  'tracked_prompts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    promptText: text('prompt_text').notNull(),
    intentStage: intentStageEnum('intent_stage').default('awareness'),
    engines: jsonb('engines').$type<string[]>().default([]),
    competitors: jsonb('competitors').$type<string[]>().default([]),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index('tracked_prompts_project_idx').on(table.projectId),
    activeIdx: index('tracked_prompts_active_idx').on(table.projectId, table.isActive),
  }),
);

// ─── Prompt Visibility Results ───────────────────────────────

export const promptVisibilityResults = pgTable(
  'prompt_visibility_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    promptId: uuid('prompt_id').notNull().references(() => trackedPrompts.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    aiEngine: text('ai_engine').notNull(),
    checkedAt: timestamp('checked_at').notNull().defaultNow(),
    brandMentioned: boolean('brand_mentioned').notNull(),
    mentionPosition: integer('mention_position'),
    responseText: text('response_text'),
    responseExcerpt: text('response_excerpt'),
    competitorMentions: jsonb('competitor_mentions').$type<Array<{ brand: string; position: number; domain?: string }>>(),
    visibilityPct: decimal('visibility_pct', { precision: 5, scale: 2 }),
    sentiment: text('sentiment'),
  },
  (table) => ({
    promptIdx: index('prompt_visibility_prompt_idx').on(table.promptId),
    projectIdx: index('prompt_visibility_project_idx').on(table.projectId),
    checkedIdx: index('prompt_visibility_checked_idx').on(table.checkedAt),
  }),
);

// ─── Relations: Tracked Prompts + Visibility Results ─────────

export const trackedPromptsRelations = relations(trackedPrompts, ({ one, many }) => ({
  project: one(projects, { fields: [trackedPrompts.projectId], references: [projects.id] }),
  results: many(promptVisibilityResults),
}));

export const promptVisibilityResultsRelations = relations(promptVisibilityResults, ({ one }) => ({
  prompt: one(trackedPrompts, { fields: [promptVisibilityResults.promptId], references: [trackedPrompts.id] }),
  project: one(projects, { fields: [promptVisibilityResults.projectId], references: [projects.id] }),
}));

// ─── Agent Runs ──────────────────────────────────────────────

export const agentRunStatusEnum = pgEnum('agent_run_status', ['running', 'completed', 'failed']);

export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    agentType: text('agent_type').notNull(),
    userPrompt: text('user_prompt').notNull(),
    response: text('response'),
    recommendations: jsonb('recommendations').$type<Array<{ title: string; rationale: string; action?: string }>>(),
    citedData: jsonb('cited_data').$type<Array<{ metric: string; value: string; source: string }>>(),
    creditCost: integer('credit_cost').notNull().default(0),
    status: agentRunStatusEnum('status').notNull().default('running'),
    error: text('error'),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index('agent_runs_project_idx').on(table.projectId),
    orgIdx: index('agent_runs_org_idx').on(table.organizationId),
    createdIdx: index('agent_runs_created_idx').on(table.createdAt),
  }),
);

export const agentRunsRelations = relations(agentRuns, ({ one }) => ({
  project: one(projects, { fields: [agentRuns.projectId], references: [projects.id] }),
  organization: one(organizations, { fields: [agentRuns.organizationId], references: [organizations.id] }),
}));

// ─── Scheduled Workflows ─────────────────────────────────────

export const scheduledWorkflows = pgTable(
  'scheduled_workflows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    agentType: text('agent_type').notNull(),
    prompt: text('prompt').notNull(),
    scheduleCron: text('schedule_cron').notNull(),
    deliveryChannel: text('delivery_channel').notNull(),
    deliveryTarget: text('delivery_target').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    lastRunAt: timestamp('last_run_at'),
    nextRunAt: timestamp('next_run_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index('scheduled_workflows_project_idx').on(table.projectId),
    activeIdx: index('scheduled_workflows_active_idx').on(table.isActive),
  }),
);

export const workflowRunHistory = pgTable(
  'workflow_run_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workflowId: uuid('workflow_id').notNull().references(() => scheduledWorkflows.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    ranAt: timestamp('ran_at').notNull().defaultNow(),
    status: text('status').notNull(),
    agentResponse: text('agent_response'),
    delivered: boolean('delivered').default(false).notNull(),
    errorMessage: text('error_message'),
  },
  (table) => ({
    workflowIdx: index('workflow_run_history_workflow_idx').on(table.workflowId),
    projectIdx: index('workflow_run_history_project_idx').on(table.projectId),
  }),
);

export const scheduledWorkflowsRelations = relations(scheduledWorkflows, ({ one, many }) => ({
  project: one(projects, { fields: [scheduledWorkflows.projectId], references: [projects.id] }),
  organization: one(organizations, { fields: [scheduledWorkflows.organizationId], references: [organizations.id] }),
  runs: many(workflowRunHistory),
}));

export const workflowRunHistoryRelations = relations(workflowRunHistory, ({ one }) => ({
  workflow: one(scheduledWorkflows, { fields: [workflowRunHistory.workflowId], references: [scheduledWorkflows.id] }),
  project: one(projects, { fields: [workflowRunHistory.projectId], references: [projects.id] }),
}));

// ─── Project Intelligence Store ─────────────────────────────

export const projectIntelligence = pgTable(
  'project_intelligence',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    targetKey: text('target_key').notNull().default('__foundation__'),
    dataType: text('data_type').notNull(),
    data: jsonb('data').notNull(),
    version: integer('version').notNull().default(1),
    producedBy: text('produced_by').notNull(),
    workflowRunId: uuid('workflow_run_id').references(() => workflowRuns.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    projectTargetDatatypeIdx: uniqueIndex('pi_project_target_datatype_unique').on(table.projectId, table.targetKey, table.dataType),
    orgProjectIdx: index('pi_org_project_idx').on(table.organizationId, table.projectId),
    projectTargetIdx: index('pi_project_target_idx').on(table.projectId, table.targetKey),
  }),
);

export const projectIntelligenceRelations = relations(projectIntelligence, ({ one }) => ({
  project: one(projects, { fields: [projectIntelligence.projectId], references: [projects.id] }),
  organization: one(organizations, { fields: [projectIntelligence.organizationId], references: [organizations.id] }),
  workflowRun: one(workflowRuns, { fields: [projectIntelligence.workflowRunId], references: [workflowRuns.id] }),
}));

// ─── Refresh Suggestions ─────────────────────────────────────

export const refreshSuggestions = pgTable(
  'refresh_suggestions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    targetKey: text('target_key'),
    dataType: text('data_type').notNull(),
    lastUpdated: timestamp('last_updated').notNull(),
    reason: text('reason').notNull(),
    suggestedBy: text('suggested_by').notNull(),
    suggestedAt: timestamp('suggested_at').defaultNow().notNull(),
    dismissed: boolean('dismissed').notNull().default(false),
    refreshedAt: timestamp('refreshed_at'),
  },
  (table) => ({
    projectActiveIdx: index('rs_project_active_idx').on(table.projectId, table.organizationId),
  }),
);

export const refreshSuggestionsRelations = relations(refreshSuggestions, ({ one }) => ({
  project: one(projects, { fields: [refreshSuggestions.projectId], references: [projects.id] }),
  organization: one(organizations, { fields: [refreshSuggestions.organizationId], references: [organizations.id] }),
}));

// ─── Forum Intelligence ──────────────────────────────────────

export const forumTopicStatusEnum = pgEnum('forum_topic_status', ['active', 'paused']);

export const forumOpportunityStatusEnum = pgEnum('forum_opportunity_status', [
  'new',
  'seen',
  'replied',
  'dismissed',
]);

export const forumTopics = pgTable(
  'forum_topics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    topic: text('topic').notNull(),
    source: text('source').notNull().default('auto'),
    status: forumTopicStatusEnum('status').notNull().default('active'),
    lastScannedAt: timestamp('last_scanned_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    projectStatusIdx: index('forum_topics_project_status_idx').on(table.projectId, table.status),
    projectTopicIdx: uniqueIndex('forum_topics_project_topic_idx').on(table.projectId, table.topic),
  }),
);

export const forumOpportunities = pgTable(
  'forum_opportunities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id').notNull().references(() => forumTopics.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    title: text('title').notNull(),
    snippet: text('snippet'),
    subreddit: text('subreddit'),
    publishedDate: text('published_date'),
    isQuestion: boolean('is_question').notNull().default(false),
    score: integer('score').notNull().default(0),
    status: forumOpportunityStatusEnum('status').notNull().default('new'),
    discoveredAt: timestamp('discovered_at').defaultNow().notNull(),
  },
  (table) => ({
    projectStatusIdx: index('forum_opps_project_status_idx').on(table.projectId, table.status),
    topicIdx: index('forum_opps_topic_idx').on(table.topicId),
    urlUniqueIdx: uniqueIndex('forum_opps_project_url_idx').on(table.projectId, table.url),
  }),
);

export const forumTopicsRelations = relations(forumTopics, ({ one, many }) => ({
  project: one(projects, { fields: [forumTopics.projectId], references: [projects.id] }),
  opportunities: many(forumOpportunities),
}));

export const forumOpportunitiesRelations = relations(forumOpportunities, ({ one }) => ({
  project: one(projects, { fields: [forumOpportunities.projectId], references: [projects.id] }),
  topic: one(forumTopics, { fields: [forumOpportunities.topicId], references: [forumTopics.id] }),
}));
