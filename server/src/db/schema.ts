import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ───────────────────────────────────────────────────

export const auditStatusEnum = pgEnum('audit_status', [
  'PENDING',
  'PROCESSING',
  'COMPLETE',
  'FAILED',
]);

export const leadStatusEnum = pgEnum('lead_status', [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'CONVERTED',
  'LOST',
]);

export const keywordIntentEnum = pgEnum('keyword_intent', [
  'TRANSACTIONAL',
  'COMMERCIAL',
  'INFORMATIONAL',
  'NAVIGATIONAL',
]);

export const funnelStageEnum = pgEnum('funnel_stage', ['TOFU', 'MOFU', 'BOFU']);

export const keywordStatusEnum = pgEnum('keyword_status', [
  'DISCOVERED',
  'APPROVED',
  'BRIEF_READY',
  'WRITTEN',
  'PUBLISHED',
]);

export const contentStatusEnum = pgEnum('content_status', [
  'BRIEF',
  'DRAFT',
  'REVIEW',
  'APPROVED',
  'PUBLISHED',
]);

export const workflowStatusEnum = pgEnum('workflow_status', [
  'DRAFT',
  'RUNNING',
  'AWAITING_APPROVAL',
  'REVISION_REQUESTED',
  'APPROVED',
  'COMPLETED',
  'FAILED',
  'ARCHIVED',
]);

export const workflowArtifactStatusEnum = pgEnum('workflow_artifact_status', [
  'DRAFT',
  'AWAITING_APPROVAL',
  'APPROVED',
  'REVISION_REQUESTED',
  'REJECTED',
  'SUPERSEDED',
]);

export const workflowDecisionEnum = pgEnum('workflow_decision', [
  'APPROVED',
  'REVISION_REQUESTED',
  'REJECTED',
]);

export const competitorBucketEnum = pgEnum('competitor_bucket', [
  'DIRECT',
  'ORGANIC',
  'UNCLASSIFIED',
]);

export const competitorStatusEnum = pgEnum('competitor_status', [
  'CANDIDATE',
  'APPROVED',
  'REJECTED',
]);

export const keywordDedupeStatusEnum = pgEnum('keyword_dedupe_status', [
  'KEPT',
  'DUPLICATE_EXISTING',
  'DUPLICATE_CROSS_METHOD',
  'IRRELEVANT',
  'REJECTED',
]);

export const keywordApprovalStatusEnum = pgEnum('keyword_approval_status', [
  'CANDIDATE',
  'APPROVED',
  'REJECTED',
]);

export const workflowJobStatusEnum = pgEnum('workflow_job_status', [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
]);

// ─── Users ───────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    clerkId: text('clerk_id').notNull(),
    email: text('email').notNull(),
    orgId: text('org_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    clerkIdIdx: uniqueIndex('users_clerk_id_idx').on(table.clerkId),
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
  }),
);

// ─── Leads ───────────────────────────────────────────────────

export const leads = pgTable('leads', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull(),
  name: text('name').notNull(),
  websiteUrl: text('website_url').notNull(),
  businessDetails: jsonb('business_details').notNull(),
  auditId: text('audit_id').unique(),
  score: integer('score'),
  status: leadStatusEnum('status').default('NEW').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Audits ──────────────────────────────────────────────────

export const audits = pgTable('audits', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  websiteUrl: text('website_url').notNull(),
  status: auditStatusEnum('status').default('PENDING').notNull(),
  businessProfile: jsonb('business_profile'),
  seoScore: integer('seo_score'),
  geoScore: integer('geo_score'),
  aeoScore: integer('aeo_score'),
  contentGapCount: integer('content_gap_count'),
  estimatedTrafficLoss: integer('estimated_traffic_loss'),
  competitors: jsonb('competitors'),
  seedKeywords: jsonb('seed_keywords').$type<string[]>().default([]),
  countries: jsonb('countries').$type<string[]>().default([]),
  reportUrl: text('report_url'),
  rawData: jsonb('raw_data'),
  userId: text('user_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Keyword Projects ────────────────────────────────────────

export const keywordProjects = pgTable('keyword_projects', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  websiteUrl: text('website_url').notNull(),
  seedKeywords: jsonb('seed_keywords').$type<string[]>().default([]),
  competitors: jsonb('competitors'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Keyword Workflow Runs ──────────────────────────────────

export const keywordWorkflowRuns = pgTable('keyword_workflow_runs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull(),
  language: text('language').default('en').notNull(),
  country: text('country').notNull(),
  status: workflowStatusEnum('status').default('DRAFT').notNull(),
  currentStep: text('current_step'),
  currentCheckpoint: text('current_checkpoint'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Keyword Workflow Artifacts ─────────────────────────────

export const keywordWorkflowArtifacts = pgTable(
  'keyword_workflow_artifacts',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    workflowRunId: text('workflow_run_id').notNull(),
    stepKey: text('step_key').notNull(),
    version: integer('version').default(1).notNull(),
    status: workflowArtifactStatusEnum('status').default('DRAFT').notNull(),
    summary: jsonb('summary'),
    payload: jsonb('payload').notNull(),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    workflowStepVersionIdx: uniqueIndex('keyword_workflow_artifacts_run_step_version_idx').on(
      table.workflowRunId,
      table.stepKey,
      table.version,
    ),
  }),
);

// ─── Keyword Workflow Approvals ─────────────────────────────

export const keywordWorkflowApprovals = pgTable('keyword_workflow_approvals', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  artifactId: text('artifact_id').notNull(),
  decision: workflowDecisionEnum('decision').notNull(),
  notes: text('notes'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at').defaultNow().notNull(),
});

// ─── Content Gap Imports ───────────────────────────────────

export const contentGapImports = pgTable('content_gap_imports', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  workflowRunId: text('workflow_run_id').notNull(),
  format: text('format').notNull(),
  headers: jsonb('headers').$type<string[]>().default([]).notNull(),
  rows: jsonb('rows').$type<Record<string, string>[]>().default([]).notNull(),
  rowCount: integer('row_count').default(0).notNull(),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Project Competitors ───────────────────────────────────

export const projectCompetitors = pgTable('project_competitors', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull(),
  workflowRunId: text('workflow_run_id').notNull(),
  domain: text('domain').notNull(),
  bucket: competitorBucketEnum('bucket').default('UNCLASSIFIED').notNull(),
  status: competitorStatusEnum('status').default('CANDIDATE').notNull(),
  rationale: text('rationale'),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Project Competitor Metrics ────────────────────────────

export const projectCompetitorMetrics = pgTable('project_competitor_metrics', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  competitorId: text('competitor_id').notNull().unique(),
  domainRating: integer('domain_rating'),
  organicTraffic: integer('organic_traffic'),
  organicKeywords: integer('organic_keywords'),
  referringDomains: integer('referring_domains'),
  backlinks: integer('backlinks'),
  topPages: jsonb('top_pages').$type<Record<string, unknown>[]>().default([]).notNull(),
  capturedAt: timestamp('captured_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Topical Maps ────────────────────────────────────────────

export const topicalMaps = pgTable('topical_maps', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull(),
  workflowRunId: text('workflow_run_id'),
  name: text('name').notNull(),
  language: text('language').default('en').notNull(),
  country: text('country'),
  structure: jsonb('structure').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Keywords ────────────────────────────────────────────────

export const keywords = pgTable('keywords', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull(),
  workflowRunId: text('workflow_run_id'),
  keyword: text('keyword').notNull(),
  kd: integer('kd'),
  searchVolume: integer('search_volume'),
  intent: keywordIntentEnum('intent').notNull(),
  funnel: funnelStageEnum('funnel').notNull(),
  targetUrl: text('target_url'),
  language: text('language').default('en').notNull(),
  country: text('country'),
  parentTopic: text('parent_topic'),
  sourceMethods: jsonb('source_methods').$type<string[]>().default([]),
  sourceArtifactIds: jsonb('source_artifact_ids').$type<string[]>().default([]),
  approvalStatus: keywordApprovalStatusEnum('approval_status').default('CANDIDATE').notNull(),
  dedupeStatus: keywordDedupeStatusEnum('dedupe_status').default('KEPT').notNull(),
  existingCoverageUrl: text('existing_coverage_url'),
  contentType: text('content_type'),
  notes: text('notes'),
  lsiKeywords: jsonb('lsi_keywords'),
  status: keywordStatusEnum('status').default('DISCOVERED').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Keyword Workflow Jobs ───────────────────────────────────

export const keywordWorkflowJobs = pgTable('keyword_workflow_jobs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  workflowRunId: text('workflow_run_id').notNull(),
  stepKey: text('step_key').notNull(),
  jobType: text('job_type').notNull(),
  status: workflowJobStatusEnum('status').default('PENDING').notNull(),
  progress: integer('progress').default(0).notNull(),
  error: text('error'),
  resultArtifactId: text('result_artifact_id'),
  inputPayload: jsonb('input_payload').notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Content Pieces ──────────────────────────────────────────

export const contentPieces = pgTable('content_pieces', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  keywordId: text('keyword_id').notNull().unique(),
  workflowRunId: text('workflow_run_id'),
  title: text('title').notNull(),
  brief: jsonb('brief'),
  body: text('body'),
  language: text('language').default('en').notNull(),
  country: text('country'),
  reviewNotes: jsonb('review_notes'),
  status: contentStatusEnum('status').default('BRIEF').notNull(),
  publishedUrl: text('published_url'),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Relations ───────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  audits: many(audits),
  keywordProjects: many(keywordProjects),
}));

export const leadsRelations = relations(leads, ({ one }) => ({
  audit: one(audits, { fields: [leads.auditId], references: [audits.id] }),
}));

export const auditsRelations = relations(audits, ({ one }) => ({
  user: one(users, { fields: [audits.userId], references: [users.id] }),
  lead: one(leads, { fields: [audits.id], references: [leads.auditId] }),
}));

export const keywordProjectsRelations = relations(keywordProjects, ({ one, many }) => ({
  user: one(users, { fields: [keywordProjects.userId], references: [users.id] }),
  workflowRuns: many(keywordWorkflowRuns),
  competitors: many(projectCompetitors),
  topicalMaps: many(topicalMaps),
  keywords: many(keywords),
}));

export const keywordWorkflowRunsRelations = relations(keywordWorkflowRuns, ({ one, many }) => ({
  project: one(keywordProjects, { fields: [keywordWorkflowRuns.projectId], references: [keywordProjects.id] }),
  artifacts: many(keywordWorkflowArtifacts),
  jobs: many(keywordWorkflowJobs),
  contentGapImports: many(contentGapImports),
  competitors: many(projectCompetitors),
  topicalMaps: many(topicalMaps),
  keywords: many(keywords),
  contentPieces: many(contentPieces),
}));

export const keywordWorkflowJobsRelations = relations(keywordWorkflowJobs, ({ one }) => ({
  workflowRun: one(keywordWorkflowRuns, { fields: [keywordWorkflowJobs.workflowRunId], references: [keywordWorkflowRuns.id] }),
  resultArtifact: one(keywordWorkflowArtifacts, { fields: [keywordWorkflowJobs.resultArtifactId], references: [keywordWorkflowArtifacts.id] }),
}));

export const keywordWorkflowArtifactsRelations = relations(keywordWorkflowArtifacts, ({ one, many }) => ({
  workflowRun: one(keywordWorkflowRuns, { fields: [keywordWorkflowArtifacts.workflowRunId], references: [keywordWorkflowRuns.id] }),
  approvals: many(keywordWorkflowApprovals),
}));

export const keywordWorkflowApprovalsRelations = relations(keywordWorkflowApprovals, ({ one }) => ({
  artifact: one(keywordWorkflowArtifacts, { fields: [keywordWorkflowApprovals.artifactId], references: [keywordWorkflowArtifacts.id] }),
}));

export const contentGapImportsRelations = relations(contentGapImports, ({ one }) => ({
  workflowRun: one(keywordWorkflowRuns, { fields: [contentGapImports.workflowRunId], references: [keywordWorkflowRuns.id] }),
}));

export const projectCompetitorsRelations = relations(projectCompetitors, ({ one }) => ({
  project: one(keywordProjects, { fields: [projectCompetitors.projectId], references: [keywordProjects.id] }),
  workflowRun: one(keywordWorkflowRuns, { fields: [projectCompetitors.workflowRunId], references: [keywordWorkflowRuns.id] }),
  metrics: one(projectCompetitorMetrics, { fields: [projectCompetitors.id], references: [projectCompetitorMetrics.competitorId] }),
}));

export const projectCompetitorMetricsRelations = relations(projectCompetitorMetrics, ({ one }) => ({
  competitor: one(projectCompetitors, { fields: [projectCompetitorMetrics.competitorId], references: [projectCompetitors.id] }),
}));

export const topicalMapsRelations = relations(topicalMaps, ({ one }) => ({
  project: one(keywordProjects, { fields: [topicalMaps.projectId], references: [keywordProjects.id] }),
  workflowRun: one(keywordWorkflowRuns, { fields: [topicalMaps.workflowRunId], references: [keywordWorkflowRuns.id] }),
}));

export const keywordsRelations = relations(keywords, ({ one }) => ({
  project: one(keywordProjects, { fields: [keywords.projectId], references: [keywordProjects.id] }),
  workflowRun: one(keywordWorkflowRuns, { fields: [keywords.workflowRunId], references: [keywordWorkflowRuns.id] }),
  contentPiece: one(contentPieces, { fields: [keywords.id], references: [contentPieces.keywordId] }),
}));

export const contentPiecesRelations = relations(contentPieces, ({ one }) => ({
  keyword: one(keywords, { fields: [contentPieces.keywordId], references: [keywords.id] }),
  workflowRun: one(keywordWorkflowRuns, { fields: [contentPieces.workflowRunId], references: [keywordWorkflowRuns.id] }),
}));
