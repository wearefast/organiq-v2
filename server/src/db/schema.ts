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

// ─── Topical Maps ────────────────────────────────────────────

export const topicalMaps = pgTable('topical_maps', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  structure: jsonb('structure').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Keywords ────────────────────────────────────────────────

export const keywords = pgTable('keywords', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull(),
  keyword: text('keyword').notNull(),
  kd: integer('kd'),
  searchVolume: integer('search_volume'),
  intent: keywordIntentEnum('intent').notNull(),
  funnel: funnelStageEnum('funnel').notNull(),
  targetUrl: text('target_url'),
  lsiKeywords: jsonb('lsi_keywords'),
  status: keywordStatusEnum('status').default('DISCOVERED').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Content Pieces ──────────────────────────────────────────

export const contentPieces = pgTable('content_pieces', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  keywordId: text('keyword_id').notNull().unique(),
  title: text('title').notNull(),
  brief: jsonb('brief'),
  body: text('body'),
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
  topicalMaps: many(topicalMaps),
  keywords: many(keywords),
}));

export const topicalMapsRelations = relations(topicalMaps, ({ one }) => ({
  project: one(keywordProjects, { fields: [topicalMaps.projectId], references: [keywordProjects.id] }),
}));

export const keywordsRelations = relations(keywords, ({ one }) => ({
  project: one(keywordProjects, { fields: [keywords.projectId], references: [keywordProjects.id] }),
  contentPiece: one(contentPieces, { fields: [keywords.id], references: [contentPieces.keywordId] }),
}));

export const contentPiecesRelations = relations(contentPieces, ({ one }) => ({
  keyword: one(keywords, { fields: [contentPieces.keywordId], references: [keywords.id] }),
}));
