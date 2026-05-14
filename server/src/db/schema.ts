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

export const orgRoleEnum = pgEnum('org_role', ['owner', 'admin', 'member']);

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
    role: orgRoleEnum('role').default('member').notNull(),
    email: text('email').notNull(),
    name: text('name'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    orgUserIdx: uniqueIndex('org_members_org_user_idx').on(table.organizationId, table.clerkUserId),
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
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    orgCreatedIdx: index('credit_ledger_org_created_idx').on(table.organizationId, table.createdAt),
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
    domain: text('domain'),
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

// ─── Content Pieces ──────────────────────────────────────────

export const contentPieces = pgTable(
  'content_pieces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    keywordId: uuid('keyword_id').references(() => keywords.id, { onDelete: 'set null' }),
    topicalMapId: uuid('topical_map_id').references(() => topicalMaps.id, { onDelete: 'set null' }),
    workflowRunId: uuid('workflow_run_id').references(() => workflowRuns.id, { onDelete: 'set null' }),
    sourceStepKey: text('source_step_key'),
    type: contentTypeEnum('type').notNull(),
    status: contentStatusEnum('status').default('draft').notNull(),
    title: text('title').notNull(),
    briefData: jsonb('brief_data'),
    articleData: jsonb('article_data'),
    scores: jsonb('scores'),
    wordCount: integer('word_count'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index('content_pieces_project_idx').on(table.projectId),
    statusIdx: index('content_pieces_status_idx').on(table.projectId, table.status),
    runStepIdx: uniqueIndex('content_pieces_run_step_idx').on(table.workflowRunId, table.sourceStepKey),
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

// ─── Relations ───────────────────────────────────────────────

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(orgMembers),
  creditLedger: many(creditLedger),
  workspaces: many(workspaces),
  workflowRuns: many(workflowRuns),
}));

export const orgMembersRelations = relations(orgMembers, ({ one }) => ({
  organization: one(organizations, { fields: [orgMembers.organizationId], references: [organizations.id] }),
}));

export const creditLedgerRelations = relations(creditLedger, ({ one }) => ({
  organization: one(organizations, { fields: [creditLedger.organizationId], references: [organizations.id] }),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  organization: one(organizations, { fields: [workspaces.organizationId], references: [organizations.id] }),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [projects.workspaceId], references: [workspaces.id] }),
  organization: one(organizations, { fields: [projects.organizationId], references: [organizations.id] }),
  workflowRuns: many(workflowRuns),
  keywords: many(keywords),
  topicalMaps: many(topicalMaps),
  contentPieces: many(contentPieces),
  reports: many(reports),
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
}));

export const contentPiecesRelations = relations(contentPieces, ({ one, many }) => ({
  project: one(projects, { fields: [contentPieces.projectId], references: [projects.id] }),
  keyword: one(keywords, { fields: [contentPieces.keywordId], references: [keywords.id] }),
  topicalMap: one(topicalMaps, { fields: [contentPieces.topicalMapId], references: [topicalMaps.id] }),
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
