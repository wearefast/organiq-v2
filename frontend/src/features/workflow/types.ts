// ─── Workflow Types ───────────────────────────────────────────

export type RunStatus = 'draft' | 'running' | 'paused' | 'completed' | 'failed';

export type StepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'awaiting_approval'
  | 'approved'
  | 'revision_requested'
  | 'rejected'
  | 'failed'
  | 'skipped';

export type ApprovalDecision = 'approved' | 'revision_requested' | 'rejected';

export interface WorkflowRun {
  id: string;
  projectId: string;
  organizationId: string;
  status: RunStatus;
  currentStep: string | null;
  creditsUsed: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StepArtifact {
  id: string;
  workflowStepId: string;
  workflowRunId: string;
  stepKey: string;
  version: number;
  data: unknown;
  reasoning: string | null;
  createdAt: string;
}

export interface StepApproval {
  id: string;
  workflowStepId: string;
  artifactId: string;
  decision: ApprovalDecision;
  notes: string | null;
  reviewerId: string;
  createdAt: string;
}

export interface WorkflowStep {
  id: string;
  workflowRunId: string;
  stepKey: string;
  stepNumber: number;
  phase: number;
  status: StepStatus;
  startedAt: string | null;
  completedAt: string | null;
  creditsUsed: number;
  iterations: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  estimatedDurationMs: number | null;
  artifacts: StepArtifact[];
  approvals: StepApproval[];
}

export interface WorkflowRunDetail extends WorkflowRun {
  steps: WorkflowStep[];
}

export interface StepToolCall {
  id: string;
  workflowStepId: string;
  toolName: string;
  input: unknown;
  output: unknown;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
}

// ─── Step Metadata ───────────────────────────────────────────

export interface StepDefinition {
  key: string;
  number: number;
  phase: number;
  label: string;
  description: string;
  dependsOn: string[];
}

export const PHASE_LABELS: Record<number, string> = {
  1: 'Intelligence & Audit',
  2: 'Keyword Research',
  3: 'Strategy & Planning',
  4: 'Content Production',
};

export const STEP_DEFINITIONS: StepDefinition[] = [
  { key: 'seed-keywords', number: 1, phase: 1, label: 'Seed Keywords', description: 'Generate initial keyword set from business profile', dependsOn: [] },
  { key: 'site-audit', number: 2, phase: 1, label: 'Site Audit', description: 'Technical SEO audit of the domain', dependsOn: [] },
  { key: 'ai-intelligence', number: 3, phase: 1, label: 'AI Intelligence', description: 'Evaluate AI search visibility and citability', dependsOn: ['site-audit'] },
  { key: 'serp-niche-map', number: 4, phase: 1, label: 'SERP Niche Map', description: 'Map SERP landscape for seed keywords', dependsOn: ['seed-keywords'] },
  { key: 'competitor-buckets', number: 5, phase: 1, label: 'Competitor Buckets', description: 'Identify and categorize competitors', dependsOn: ['serp-niche-map'] },
  { key: 'competitor-metrics', number: 6, phase: 1, label: 'Competitor Metrics', description: 'Deep metrics analysis of top competitors', dependsOn: ['ai-intelligence', 'competitor-buckets'] },
  { key: 'search-demand', number: 7, phase: 1, label: 'Search Demand', description: 'Analyze search demand trends and volume', dependsOn: ['seed-keywords'] },
  { key: 'phase1-baseline', number: 8, phase: 2, label: 'Phase 1 Baseline', description: 'Consolidate Phase 1 findings into research baseline', dependsOn: ['competitor-metrics', 'search-demand'] },
  { key: 'method01-competitor-pages', number: 9, phase: 2, label: 'Method 01: Competitor Pages', description: 'Extract keywords from competitor top pages', dependsOn: ['phase1-baseline'] },
  { key: 'method02-seed-expansion', number: 10, phase: 2, label: 'Method 02: Seed Expansion', description: 'Expand seed keywords via related terms', dependsOn: ['phase1-baseline'] },
  { key: 'method03-content-gap-import', number: 11, phase: 2, label: 'Method 03: Content Gap', description: 'Identify content gaps via competitor overlap', dependsOn: ['phase1-baseline', 'method01-competitor-pages', 'method02-seed-expansion'] },
  { key: 'consolidated-keywords', number: 12, phase: 2, label: 'Consolidated Keywords', description: 'Merge and deduplicate all keyword methods', dependsOn: ['method01-competitor-pages', 'method02-seed-expansion', 'method03-content-gap-import'] },
  { key: 'verdict-strategy', number: 13, phase: 3, label: 'Verdict & Strategy', description: 'Final strategic recommendations', dependsOn: ['consolidated-keywords'] },
  { key: 'topical-map', number: 14, phase: 3, label: 'Topical Map', description: 'Generate content pillars and topic clusters', dependsOn: ['verdict-strategy'] },
  { key: 'content-brief', number: 15, phase: 4, label: 'Content Brief', description: 'Create detailed content briefs from topical map', dependsOn: ['topical-map'] },
  { key: 'content-article', number: 16, phase: 4, label: 'Content Article', description: 'Generate optimized articles from briefs', dependsOn: ['content-brief'] },
  { key: 'content-images', number: 17, phase: 4, label: 'Content Images', description: 'Generate AI images for article illustrations', dependsOn: ['content-article'] },
];
