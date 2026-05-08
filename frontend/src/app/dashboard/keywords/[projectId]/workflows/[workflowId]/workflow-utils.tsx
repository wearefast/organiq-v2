/**
 * workflow-utils.tsx
 * Pure utility functions and types for the keyword workflow page.
 * No server-only code — safe to import from both server and client components.
 */

import type { KeywordWorkflowArtifact, PersistedKeywordWorkflowKeyword } from '@/features/keywords/services/keywords.service';

// Re-export PersistedKeywordWorkflowKeyword so workspace components can use it
export type { PersistedKeywordWorkflowKeyword };

// ===== CONSTANTS =====

export const WORKFLOW_STEPS = [
  'business-profile',
  'seed-keywords',
  'serp-niche-map',
  'competitor-buckets',
  'competitor-metrics',
  'phase1-baseline',
  'method01-competitor-pages',
  'method02-seed-expansion',
  'method03-content-gap-import',
  'consolidated-keywords',
  'topical-map',
  'content-brief',
  'content-article',
] as const;

export type WorkflowStep = (typeof WORKFLOW_STEPS)[number];

// ===== TYPES =====

export type Method02SourceKeyword = {
  keyword: string;
  parentTopic: string | null;
  searchVolume: number | null;
  intent: string | null;
  funnel: string | null;
  sourceMethods: string[];
  approvalStatus: string | null;
  dedupeStatus: string | null;
  source: 'project-keywords' | 'project-seeds';
};

export type ContentBriefCandidate = {
  keyword: string;
  pillar: string;
  contentType: 'pillar' | 'cluster';
  suggestedUrlPath: string | null;
  sourceMethods: string[];
  sourceArtifactIds: string[];
  existingCoverageUrl: string | null;
};

export type ContentBriefSource = {
  targetKeyword: string;
  pillar: string;
  contentType: 'pillar' | 'cluster';
  suggestedUrlPath: string | null;
  market: {
    language: string;
    country: string;
  };
  titleOptions: string[];
  briefOutline: string[];
  internalLinkTargets: string[];
  editorialNotes: string[];
  researchContext: {
    sourceMethods: string[];
    sourceArtifactIds: string[];
    existingCoverageUrl: string | null;
  };
};

export type PersistedWorkflowContentPiece = {
  id: string;
  keywordId: string;
  workflowRunId: string | null;
  title: string;
  brief: Record<string, unknown> | null;
  body: string | null;
  language: string;
  country: string | null;
  reviewNotes: Record<string, unknown> | null;
  status: 'BRIEF' | 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED';
  publishedUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
};

export type ArtifactFormDraftValues = {
  summary: string;
  headline: string;
  keyFindings: string;
  recommendedAction: string;
  evidence: string;
  openQuestions: string;
};

export type GeneratedBusinessProfileDraft = {
  summary: string;
  headline: string;
  brandIdentity: string;
  toneOfVoice: string;
  targetMarket: string;
  operationalModel: string;
  services: string[];
  geography: string;
  seedKeywords: string[];
  recommendedAction: string;
  openQuestions: string[];
};

export type SeedKeywordStepSource = {
  sourceArtifactId: string | null;
  keywords: string[];
};

export type SerpNicheMapStepSource = {
  sourceArtifactId: string | null;
  keywords: string[];
};

export type WorkflowStepVisualStatus =
  | 'complete'
  | 'current'
  | 'next'
  | 'draft'
  | 'in-review'
  | 'needs-revision'
  | 'rejected'
  | 'upcoming';

// ===== BASIC UTILITIES =====

export function readObjectRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function normalizeCheckpointCopy(value: string) {
  return value
    .replace(/artifact versions?/gi, 'checkpoint history')
    .replace(/source artifacts?/gi, 'source checkpoints')
    .replace(/artifacts?/gi, 'checkpoints')
    .replace(/next artifact version/gi, 'next checkpoint')
    .replace(/latest approved artifact/gi, 'latest approved checkpoint')
    .replace(/latest artifact/gi, 'latest checkpoint')
    .replace(/structured brief input artifact/gi, 'structured brief input checkpoint')
    .replace(/content brief artifact/gi, 'content brief checkpoint')
    .replace(/content article artifact/gi, 'content article checkpoint')
    .replace(/topical-map artifact/gi, 'topical-map checkpoint')
    .replace(/consolidated keywords artifact/gi, 'consolidated keywords checkpoint')
    .replace(/consolidated artifact/gi, 'consolidated checkpoint');
}

export function shouldHideCheckpointMetadataKey(key: string) {
  return key === 'version' || key === 'sourceArtifactVersion' || key === 'sourceVersion';
}

export function readArtifactText(section: Record<string, unknown> | null | undefined) {
  if (!section) return null;

  const note = section.note;
  if (typeof note === 'string' && note.trim().length > 0) {
    return normalizeCheckpointCopy(note);
  }

  const details = Object.entries(section)
    .filter(([key, value]) => key !== 'note' && value != null && !shouldHideCheckpointMetadataKey(key))
    .map(([key, value]) => {
      const normalizedValue = Array.isArray(value)
        ? `${value.length} item${value.length === 1 ? '' : 's'}`
        : typeof value === 'object'
          ? `${Object.keys(value as Record<string, unknown>).length} field${Object.keys(value as Record<string, unknown>).length === 1 ? '' : 's'}`
          : normalizeCheckpointCopy(String(value).replaceAll('_', ' '));
      return `${normalizeCheckpointCopy(key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' '))}: ${normalizedValue}`;
    });

  return details.length > 0 ? details.join(' · ') : null;
}

export function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
}

export function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function htmlToText(html: string) {
  return normalizeWhitespace(
    decodeHtmlEntities(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<[^>]+>/g, ' '),
    ),
  );
}

// ===== ARTIFACT UTILITIES =====

export function getArtifactFormDraftValues(artifact: KeywordWorkflowArtifact | undefined) {
  if (!artifact) return undefined;

  const payload = readObjectRecord(artifact.payload);
  const summary = readObjectRecord(artifact.summary);

  return {
    summary: typeof summary?.note === 'string' ? normalizeCheckpointCopy(summary.note) : '',
    headline: typeof payload?.headline === 'string' ? normalizeCheckpointCopy(payload.headline) : '',
    keyFindings: readStringArray(payload?.keyFindings).map(normalizeCheckpointCopy).join('\n'),
    recommendedAction:
      typeof payload?.recommendedAction === 'string' ? normalizeCheckpointCopy(payload.recommendedAction) : '',
    evidence: readStringArray(payload?.evidence).map(normalizeCheckpointCopy).join('\n'),
    openQuestions: readStringArray(payload?.openQuestions).map(normalizeCheckpointCopy).join('\n'),
  } satisfies ArtifactFormDraftValues;
}

export function extractBusinessProfileSeedKeywordsFromFindings(findings: string[]) {
  const seedKeywordLine = findings.find((finding) => finding.toLowerCase().startsWith('suggested seed keywords:'));
  if (!seedKeywordLine) return [];

  return seedKeywordLine
    .slice(seedKeywordLine.indexOf(':') + 1)
    .split(',')
    .map((keyword) => normalizeWhitespace(keyword))
    .filter(Boolean);
}

export function readBusinessProfileSeedKeywords(artifact: KeywordWorkflowArtifact | undefined) {
  if (!artifact) return [];

  const payload = readObjectRecord(artifact.payload);
  const directKeywords = readStringArray(payload?.seedKeywords);
  if (directKeywords.length > 0) return directKeywords;

  const generatedProfile = readObjectRecord(payload?.generatedProfile);
  const generatedSeedKeywords = readStringArray(generatedProfile?.seedKeywords);
  if (generatedSeedKeywords.length > 0) return generatedSeedKeywords;

  return extractBusinessProfileSeedKeywordsFromFindings(readStringArray(payload?.keyFindings));
}

export function getRenderableArtifactPayload(artifact: KeywordWorkflowArtifact | null | undefined) {
  const payload = readObjectRecord(artifact?.payload);
  if (!payload || artifact?.stepKey !== 'business-profile') return payload;
  if (readStringArray(payload.seedKeywords).length > 0) return payload;

  const seedKeywords = readBusinessProfileSeedKeywords(artifact);
  if (seedKeywords.length === 0) return payload;

  return { ...payload, seedKeywords } satisfies Record<string, unknown>;
}

export function readApprovedSeedKeywords(artifact: KeywordWorkflowArtifact | undefined) {
  if (!artifact) return [];
  const payload = readObjectRecord(artifact.payload);
  const directKeywords = readStringArray(payload?.approvedKeywords);
  if (directKeywords.length > 0) return directKeywords;
  return readStringArray(payload?.keyFindings);
}

export function getSeedKeywordStepSource(artifacts: KeywordWorkflowArtifact[] | undefined) {
  const businessProfileArtifacts = artifacts ?? [];
  const sourceArtifact =
    businessProfileArtifacts.find(
      (artifact) => artifact.status === 'APPROVED' && readBusinessProfileSeedKeywords(artifact).length > 0,
    ) ?? businessProfileArtifacts.find((artifact) => readBusinessProfileSeedKeywords(artifact).length > 0);

  if (!sourceArtifact) return undefined;
  const keywords = readBusinessProfileSeedKeywords(sourceArtifact);
  if (keywords.length === 0) return undefined;

  return { sourceArtifactId: sourceArtifact.id, keywords } satisfies SeedKeywordStepSource;
}

export function getSeedKeywordDraftValues(source: SeedKeywordStepSource | undefined) {
  if (!source) return undefined;

  return {
    summary: `Loaded ${source.keywords.length} seed keyword${source.keywords.length === 1 ? '' : 's'} from the latest business-profile checkpoint for confirmation.`,
    headline: 'Step 1 generated seed keyword candidates',
    keyFindings: source.keywords.join('\n'),
    recommendedAction:
      'Review the generated seed keywords, remove weak terms, add missing commercial variants, and approve the confirmed list before SERP mapping.',
    evidence: ['Source checkpoint: business-profile'].join('\n'),
    openQuestions: '',
  } satisfies ArtifactFormDraftValues;
}

export function getSerpNicheMapStepSource(artifacts: KeywordWorkflowArtifact[] | undefined) {
  const seedKeywordArtifacts = artifacts ?? [];
  const sourceArtifact =
    seedKeywordArtifacts.find(
      (artifact) => artifact.status === 'APPROVED' && readApprovedSeedKeywords(artifact).length > 0,
    ) ?? seedKeywordArtifacts.find((artifact) => readApprovedSeedKeywords(artifact).length > 0);

  if (!sourceArtifact) return undefined;
  const keywords = readApprovedSeedKeywords(sourceArtifact);
  if (keywords.length === 0) return undefined;

  return { sourceArtifactId: sourceArtifact.id, keywords } satisfies SerpNicheMapStepSource;
}

export function getSerpNicheMapDraftValues(source: SerpNicheMapStepSource | undefined) {
  if (!source) return undefined;

  return {
    summary: `Loaded ${source.keywords.length} approved seed keyword${source.keywords.length === 1 ? '' : 's'} from the latest seed-keywords checkpoint for SERP mapping.`,
    headline: 'Step 2 approved seed keyword source set',
    keyFindings: source.keywords.join('\n'),
    recommendedAction:
      'Group the approved seed keywords into SERP topic families, capture dominant ranking page types, and document the niche structure before competitor bucketing.',
    evidence: ['Source checkpoint: seed-keywords'].join('\n'),
    openQuestions: '',
  } satisfies ArtifactFormDraftValues;
}

export function sanitizeGeneratedBusinessProfileDraft(payload: Record<string, unknown>): GeneratedBusinessProfileDraft {
  return {
    summary: typeof payload.summary === 'string' ? payload.summary.trim() : '',
    headline: typeof payload.headline === 'string' ? payload.headline.trim() : '',
    brandIdentity: typeof payload.brandIdentity === 'string' ? payload.brandIdentity.trim() : '',
    toneOfVoice: typeof payload.toneOfVoice === 'string' ? payload.toneOfVoice.trim() : '',
    targetMarket: typeof payload.targetMarket === 'string' ? payload.targetMarket.trim() : '',
    operationalModel: typeof payload.operationalModel === 'string' ? payload.operationalModel.trim() : '',
    services: readStringArray(payload.services),
    geography: typeof payload.geography === 'string' ? payload.geography.trim() : '',
    seedKeywords: readStringArray(payload.seedKeywords),
    recommendedAction: typeof payload.recommendedAction === 'string' ? payload.recommendedAction.trim() : '',
    openQuestions: readStringArray(payload.openQuestions),
  };
}

export function buildBusinessProfileKeyFindings(draft: GeneratedBusinessProfileDraft) {
  const findings = [
    draft.brandIdentity
      ? `Brand identity: ${draft.brandIdentity}${draft.toneOfVoice ? ` Tone of voice: ${draft.toneOfVoice}` : ''}`
      : null,
    draft.targetMarket ? `Target market: ${draft.targetMarket}` : null,
    draft.operationalModel ? `Operational model: ${draft.operationalModel}` : null,
    draft.services.length > 0 ? `Services / products offered: ${draft.services.join(', ')}` : null,
    draft.geography ? `Geographic focus: ${draft.geography}` : null,
    draft.seedKeywords.length > 0 ? `Suggested seed keywords: ${draft.seedKeywords.join(', ')}` : null,
  ];
  return findings.filter((finding): finding is string => Boolean(finding));
}

// ===== STEP LABEL / DESCRIPTION HELPERS =====

export function formatWorkflowStepLabel(stepKey: WorkflowStep) {
  return stepKey
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function isWorkflowStepKey(value: string): value is WorkflowStep {
  return WORKFLOW_STEPS.includes(value as WorkflowStep);
}

export function getWorkflowStepDescription(stepKey: WorkflowStep) {
  switch (stepKey) {
    case 'business-profile':
      return 'Draft and confirm the business profile from site evidence.';
    case 'seed-keywords':
      return 'Confirm the Step 1 seed list before SERP validation.';
    case 'serp-niche-map':
      return 'Map the niche structure and page patterns in SERP.';
    case 'competitor-buckets':
      return 'Separate direct and organic competitors for review.';
    case 'competitor-metrics':
      return 'Capture authority, traffic, and top-page evidence.';
    case 'phase1-baseline':
      return 'Record existing winners and dedupe guardrails.';
    case 'method01-competitor-pages':
      return 'Mine approved direct competitor pages for candidates.';
    case 'method02-seed-expansion':
      return 'Expand approved seeds into grouped parent topics.';
    case 'method03-content-gap-import':
      return 'Store the strategist-reviewed Ahrefs Content Gap import.';
    case 'consolidated-keywords':
      return 'Merge and deduplicate the final keyword ledger.';
    case 'topical-map':
      return 'Approve pillar and cluster structure for content planning.';
    case 'content-brief':
      return 'Prepare brief inputs from the approved topical map.';
    case 'content-article':
      return 'Prepare article inputs before draft generation.';
    default:
      return 'Workflow checkpoint';
  }
}

// ===== VISUAL STATUS HELPERS =====

export function getWizardBadgeTone(status: WorkflowStepVisualStatus) {
  switch (status) {
    case 'complete': return 'bg-[#ECFDF3] text-[#027A48]';
    case 'current': return 'bg-[#EEF4FF] text-[#3538CD]';
    case 'next': return 'bg-[#F9FAFB] text-[#667085]';
    case 'draft': return 'bg-[#F4F6FA] text-[#344054]';
    case 'in-review': return 'bg-[#FEF3F2] text-[#B42318]';
    case 'needs-revision': return 'bg-[#FFF1F3] text-[#C01048]';
    case 'rejected': return 'bg-[#FEF3F2] text-[#B42318]';
    case 'upcoming':
    default: return 'bg-[#F9FAFB] text-[#667085]';
  }
}

export function getWizardMarkerTone(status: WorkflowStepVisualStatus) {
  switch (status) {
    case 'complete': return 'border-[#12B76A] bg-[#ECFDF3] text-[#027A48]';
    case 'current': return 'border-[#3538CD] bg-[#EEF4FF] text-[#3538CD]';
    case 'next': return 'border-[#D0D5DD] bg-white text-[#98A2B3]';
    case 'draft': return 'border-[#98A2B3] bg-[#F4F6FA] text-[#344054]';
    case 'in-review': return 'border-[#F97066] bg-[#FEF3F2] text-[#B42318]';
    case 'needs-revision': return 'border-[#F670C7] bg-[#FFF1F3] text-[#C01048]';
    case 'rejected': return 'border-[#F97066] bg-[#FEF3F2] text-[#B42318]';
    case 'upcoming':
    default: return 'border-[#D0D5DD] bg-white text-[#98A2B3]';
  }
}

export function getWorkflowStepStatusLabel(status: WorkflowStepVisualStatus) {
  switch (status) {
    case 'complete': return 'Complete';
    case 'current': return 'Current';
    case 'next': return 'Next';
    case 'draft': return 'Draft';
    case 'in-review': return 'Awaiting approval';
    case 'needs-revision': return 'Needs revision';
    case 'rejected': return 'Rejected';
    case 'upcoming':
    default: return 'Upcoming';
  }
}

export function WorkflowStatusIcon({ status }: { status: WorkflowStepVisualStatus }) {
  const iconClassName = 'h-3.5 w-3.5';

  switch (status) {
    case 'complete':
      return (
        <svg className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'in-review':
      return (
        <svg className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16h.01" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case 'current':
      return (
        <svg className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'draft':
      return (
        <svg className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16l7.5-7.5 2 2L10 18H8v-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 7l2 2" />
        </svg>
      );
    case 'needs-revision':
      return (
        <svg className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 12a8 8 0 0113.66-5.66" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 4v5h-5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 12a8 8 0 01-13.66 5.66" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 20v-5h5" />
        </svg>
      );
    case 'rejected':
      return (
        <svg className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18" />
        </svg>
      );
    case 'upcoming':
    default:
      return (
        <svg className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="8" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l2.5 1.5" />
        </svg>
      );
  }
}

export function getWorkflowStepVisualStatus(args: {
  stepKey: WorkflowStep;
  currentStepKey: WorkflowStep | null;
  nextStepKey: WorkflowStep | null;
  artifactStatus: KeywordWorkflowArtifact['status'] | null;
}): WorkflowStepVisualStatus {
  const { stepKey, currentStepKey, nextStepKey, artifactStatus } = args;

  if (artifactStatus === 'APPROVED') return 'complete';

  if (stepKey === currentStepKey) {
    if (artifactStatus === 'AWAITING_APPROVAL') return 'in-review';
    if (artifactStatus === 'REVISION_REQUESTED') return 'needs-revision';
    if (artifactStatus === 'REJECTED') return 'rejected';
    if (artifactStatus === 'DRAFT') return 'draft';
    return 'current';
  }

  if (artifactStatus === 'REVISION_REQUESTED') return 'needs-revision';
  if (artifactStatus === 'REJECTED') return 'rejected';
  if (artifactStatus === 'AWAITING_APPROVAL') return 'in-review';
  if (artifactStatus === 'DRAFT') return 'draft';
  if (stepKey === nextStepKey) return 'next';
  return 'upcoming';
}

// ===== ARTIFACT COLLECTION HELPERS =====

export function getLatestArtifacts(artifacts: KeywordWorkflowArtifact[] | undefined) {
  const latestByStep = new Map<string, KeywordWorkflowArtifact>();
  for (const artifact of artifacts ?? []) {
    if (!latestByStep.has(artifact.stepKey)) {
      latestByStep.set(artifact.stepKey, artifact);
    }
  }
  return Array.from(latestByStep.values());
}

export function getArtifactHistory(artifacts: KeywordWorkflowArtifact[] | undefined) {
  const grouped = new Map<string, KeywordWorkflowArtifact[]>();
  for (const artifact of artifacts ?? []) {
    const existing = grouped.get(artifact.stepKey) ?? [];
    existing.push(artifact);
    grouped.set(artifact.stepKey, existing);
  }
  return Array.from(grouped.entries()).sort(([left], [right]) => {
    const leftIndex = WORKFLOW_STEPS.indexOf(left as WorkflowStep);
    const rightIndex = WORKFLOW_STEPS.indexOf(right as WorkflowStep);
    if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
}

export function getLatestApprovedArtifact(artifacts: KeywordWorkflowArtifact[] | undefined, stepKey: string) {
  return (artifacts ?? []).find(
    (artifact) => artifact.stepKey === stepKey && artifact.status === 'APPROVED',
  );
}

// ===== PARSE UTILITIES =====

export function parsePhase1WinningUrls(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [url, topKeyword, note] = line.split('|').map((part) => part.trim());
      return { url, topKeyword: topKeyword || null, note: note || null };
    })
    .filter((entry) => entry.url.length > 0);
}

export function parseMethod02Clusters(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [parentTopic, clusterKeyword, note] = line.split('|').map((part) => part.trim());
      return { parentTopic, clusterKeyword: clusterKeyword || null, note: note || null };
    })
    .filter((entry) => entry.parentTopic.length > 0);
}

export function toLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseMetricValue(rawValue: FormDataEntryValue | null, label: string) {
  const value = String(rawValue ?? '').trim();
  if (!value) return undefined;
  const parsedValue = Number(value);
  if (Number.isNaN(parsedValue)) throw new Error(`${label} must be a valid number.`);
  return parsedValue;
}

export function parseCompetitorTopPages(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [url, traffic, topKeyword, note] = line.split('|').map((part) => part.trim());
      const page: Record<string, unknown> = { url };
      if (traffic) {
        const parsedTraffic = Number(traffic);
        page.traffic = Number.isNaN(parsedTraffic) ? traffic : parsedTraffic;
      }
      if (topKeyword) page.topKeyword = topKeyword;
      if (note) page.note = note;
      return page;
    })
    .filter((page) => typeof page.url === 'string' && page.url.length > 0);
}

export function formatCompetitorTopPages(topPages: Record<string, unknown>[] | undefined | null) {
  return (topPages ?? [])
    .map((page) => {
      const url = typeof page.url === 'string' ? page.url : '';
      const traffic = page.traffic == null ? '' : String(page.traffic);
      const topKeyword = typeof page.topKeyword === 'string' ? page.topKeyword : '';
      const note = typeof page.note === 'string' ? page.note : '';
      return [url, traffic, topKeyword, note].filter((part) => part.length > 0).join(' | ');
    })
    .filter(Boolean)
    .join('\n');
}

// ===== COMPETITOR / METHOD BUILDERS =====

export function getStoredTopPageCandidates(selectedCompetitors: Record<string, unknown>[]) {
  const topPagesByUrl = new Map<string, Record<string, unknown>>();
  for (const competitor of selectedCompetitors) {
    const domain = typeof competitor.domain === 'string' ? competitor.domain : 'competitor';
    const metrics = competitor.metrics;
    if (!metrics || typeof metrics !== 'object') continue;
    const topPages = (metrics as Record<string, unknown>).topPages;
    if (!Array.isArray(topPages)) continue;
    for (const topPage of topPages) {
      if (!topPage || typeof topPage !== 'object') continue;
      const page = topPage as Record<string, unknown>;
      const url = typeof page.url === 'string' ? page.url.trim() : '';
      if (!url || topPagesByUrl.has(url)) continue;
      const candidate: Record<string, unknown> = {
        url,
        note:
          typeof page.note === 'string' && page.note.trim().length > 0
            ? page.note.trim()
            : `${domain} top page`,
      };
      if (typeof page.traffic === 'number') {
        candidate.traffic = page.traffic;
      } else if (typeof page.traffic === 'string' && page.traffic.trim().length > 0) {
        const parsedTraffic = Number(page.traffic);
        candidate.traffic = Number.isNaN(parsedTraffic) ? page.traffic : parsedTraffic;
      }
      if (typeof page.topKeyword === 'string' && page.topKeyword.trim().length > 0) {
        candidate.topKeyword = page.topKeyword.trim();
      }
      topPagesByUrl.set(url, candidate);
    }
  }
  return Array.from(topPagesByUrl.values());
}

export function mergeTopPageCandidates(...candidateGroups: Record<string, unknown>[][]) {
  const topPagesByUrl = new Map<string, Record<string, unknown>>();
  for (const candidateGroup of candidateGroups) {
    for (const candidate of candidateGroup) {
      const url = typeof candidate.url === 'string' ? candidate.url.trim() : '';
      if (!url || topPagesByUrl.has(url)) continue;
      topPagesByUrl.set(url, candidate);
    }
  }
  return Array.from(topPagesByUrl.values());
}

export function buildMethod01AutoFindings(
  selectedCompetitors: Record<string, unknown>[],
  topPageCandidates: Record<string, unknown>[],
) {
  const findings = [
    `${selectedCompetitors.length} approved direct competitors contributed ${topPageCandidates.length} stored top pages for Method 01 review.`,
  ];

  for (const competitor of selectedCompetitors) {
    const domain = typeof competitor.domain === 'string' ? competitor.domain : 'competitor';
    const metrics = competitor.metrics;
    const metricRecord = metrics && typeof metrics === 'object' ? (metrics as Record<string, unknown>) : null;
    const topPageCount = metricRecord && Array.isArray(metricRecord.topPages) ? metricRecord.topPages.length : 0;
    const metricSummary: string[] = [];
    if (typeof metricRecord?.domainRating === 'number') metricSummary.push(`DR ${metricRecord.domainRating}`);
    if (typeof metricRecord?.organicTraffic === 'number') metricSummary.push(`traffic ${metricRecord.organicTraffic}`);
    if (typeof metricRecord?.organicKeywords === 'number') metricSummary.push(`keywords ${metricRecord.organicKeywords}`);
    findings.push(
      `${domain} contributes ${topPageCount} stored top pages${metricSummary.length > 0 ? ` (${metricSummary.join(', ')})` : ''}.`,
    );
  }

  const keywordMappedPages = topPageCandidates.filter(
    (candidate) => typeof candidate.topKeyword === 'string' && candidate.topKeyword.trim().length > 0,
  ).length;
  if (keywordMappedPages > 0) {
    findings.push(`${keywordMappedPages} stored top pages already include a mapped top keyword for consolidation review.`);
  }
  return findings;
}

export function buildMethod01AutoEvidence(selectedCompetitors: Record<string, unknown>[]) {
  return selectedCompetitors
    .map((competitor) => {
      const domain = typeof competitor.domain === 'string' ? competitor.domain : '';
      const metrics = competitor.metrics;
      const metricRecord = metrics && typeof metrics === 'object' ? (metrics as Record<string, unknown>) : null;
      const evidenceParts = [domain];
      if (typeof metricRecord?.domainRating === 'number') evidenceParts.push(`DR ${metricRecord.domainRating}`);
      if (typeof metricRecord?.organicTraffic === 'number') evidenceParts.push(`Traffic ${metricRecord.organicTraffic}`);
      if (typeof metricRecord?.organicKeywords === 'number') evidenceParts.push(`Keywords ${metricRecord.organicKeywords}`);
      if (typeof metricRecord?.capturedAt === 'string' && metricRecord.capturedAt.length > 0) evidenceParts.push(`Captured ${metricRecord.capturedAt}`);
      return evidenceParts.filter(Boolean).join(' | ');
    })
    .filter((line) => line.length > 0);
}

export function buildMethod02ParentTopicCandidates(selectedKeywords: Method02SourceKeyword[]) {
  return selectedKeywords.map((sourceKeyword) => ({
    parentTopic: sourceKeyword.parentTopic?.trim() || sourceKeyword.keyword,
    clusterKeyword: sourceKeyword.keyword,
    note:
      typeof sourceKeyword.searchVolume === 'number'
        ? `volume ${sourceKeyword.searchVolume}`
        : sourceKeyword.source === 'project-seeds'
          ? 'project seed keyword'
          : sourceKeyword.intent || null,
  }));
}

export function mergeMethod02ParentTopicCandidates(
  ...candidateGroups: Array<Array<{ parentTopic: string; clusterKeyword: string | null; note: string | null }>>
) {
  const candidatesByKey = new Map<string, { parentTopic: string; clusterKeyword: string | null; note: string | null }>();
  for (const candidateGroup of candidateGroups) {
    for (const candidate of candidateGroup) {
      const parentTopic = candidate.parentTopic.trim();
      const clusterKeyword = candidate.clusterKeyword?.trim() || null;
      const key = `${parentTopic}::${clusterKeyword ?? ''}`;
      if (!parentTopic || candidatesByKey.has(key)) continue;
      candidatesByKey.set(key, { parentTopic, clusterKeyword, note: candidate.note });
    }
  }
  return Array.from(candidatesByKey.values());
}

export function buildMethod02AutoFindings(
  selectedKeywords: Method02SourceKeyword[],
  parentTopicCandidates: Array<{ parentTopic: string; clusterKeyword: string | null; note: string | null }>,
) {
  const uniqueParentTopics = new Set(parentTopicCandidates.map((candidate) => candidate.parentTopic));
  const findings = [
    `${selectedKeywords.length} source keywords rolled into ${uniqueParentTopics.size} parent topic candidates for Method 02.`,
  ];
  if (selectedKeywords.some((keyword) => keyword.source === 'project-seeds')) {
    findings.push('No discovered project keyword rows are stored yet, so Method 02 is using the current seed list as the interim source set.');
  }
  const keywordsByParentTopic = new Map<string, number>();
  for (const candidate of parentTopicCandidates) {
    keywordsByParentTopic.set(candidate.parentTopic, (keywordsByParentTopic.get(candidate.parentTopic) ?? 0) + 1);
  }
  for (const [parentTopic, keywordCount] of Array.from(keywordsByParentTopic.entries()).slice(0, 5)) {
    findings.push(`${parentTopic} currently groups ${keywordCount} source keyword${keywordCount === 1 ? '' : 's'}.`);
  }
  return findings;
}

export function buildMethod02AutoEvidence(selectedKeywords: Method02SourceKeyword[]) {
  return selectedKeywords.map((sourceKeyword) => {
    const evidenceParts = [sourceKeyword.keyword];
    if (sourceKeyword.parentTopic) evidenceParts.push(`Parent topic ${sourceKeyword.parentTopic}`);
    if (typeof sourceKeyword.searchVolume === 'number') evidenceParts.push(`Volume ${sourceKeyword.searchVolume}`);
    if (sourceKeyword.intent) evidenceParts.push(`Intent ${sourceKeyword.intent}`);
    if (sourceKeyword.source === 'project-seeds') evidenceParts.push('Seed keyword fallback');
    return evidenceParts.join(' | ');
  });
}

// ===== CONSOLIDATION BUILDERS =====

export function buildConsolidatedKeywordsPayload(sourceArtifacts: Array<Record<string, unknown>>) {
  const existingKeywords = new Set<string>();
  const consolidatedKeywords = new Map<
    string,
    {
      keyword: string;
      parentTopic: string | null;
      sourceMethods: string[];
      sourceArtifactIds: string[];
      approvalStatus: 'CANDIDATE';
      dedupeStatus: 'KEPT';
      existingCoverageUrl: string | null;
    }
  >();
  const duplicateExistingKeywords = new Set<string>();

  const readKeywordValue = (value: unknown) => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      const keyword = (value as Record<string, unknown>).keyword;
      return typeof keyword === 'string' ? keyword : null;
    }
    return null;
  };

  // Collect phase1 baseline existing keywords (dedupe guardrail)
  for (const sourceArtifact of sourceArtifacts) {
    const stepKey = typeof sourceArtifact.stepKey === 'string' ? sourceArtifact.stepKey : null;
    const payload = sourceArtifact.payload;
    if (stepKey !== 'phase1-baseline' || !payload || typeof payload !== 'object') continue;
    const phase1Baseline = (payload as Record<string, unknown>).phase1Baseline;
    const existingKeywordRows = Array.isArray((payload as Record<string, unknown>).existingKeywords)
      ? (payload as Record<string, unknown>).existingKeywords
      : Array.isArray((payload as Record<string, unknown>).dedupeList)
        ? (payload as Record<string, unknown>).dedupeList
        : phase1Baseline && typeof phase1Baseline === 'object' && Array.isArray((phase1Baseline as Record<string, unknown>).existingKeywords)
          ? (phase1Baseline as Record<string, unknown>).existingKeywords
          : [];
    if (!Array.isArray(existingKeywordRows)) continue;
    for (const existingKeyword of existingKeywordRows) {
      const keywordValue = readKeywordValue(existingKeyword);
      if (!keywordValue) continue;
      const normalizedKeyword = keywordValue.trim().toLowerCase();
      if (normalizedKeyword) existingKeywords.add(normalizedKeyword);
    }
  }

  const addConsolidatedKeyword = (
    rawKeyword: string | null,
    stepKey: string,
    artifactId: string,
    parentTopic: string | null,
  ) => {
    const normalizedKeyword = rawKeyword?.trim().toLowerCase() ?? '';
    if (!normalizedKeyword) return;
    if (existingKeywords.has(normalizedKeyword)) {
      duplicateExistingKeywords.add(normalizedKeyword);
      return;
    }
    const existingCandidate = consolidatedKeywords.get(normalizedKeyword);
    if (existingCandidate) {
      if (!existingCandidate.sourceMethods.includes(stepKey)) existingCandidate.sourceMethods.push(stepKey);
      if (!existingCandidate.sourceArtifactIds.includes(artifactId)) existingCandidate.sourceArtifactIds.push(artifactId);
      if (!existingCandidate.parentTopic && parentTopic) existingCandidate.parentTopic = parentTopic;
      return;
    }
    consolidatedKeywords.set(normalizedKeyword, {
      keyword: rawKeyword?.trim() ?? normalizedKeyword,
      parentTopic,
      sourceMethods: [stepKey],
      sourceArtifactIds: [artifactId],
      approvalStatus: 'CANDIDATE',
      dedupeStatus: 'KEPT',
      existingCoverageUrl: null,
    });
  };

  for (const sourceArtifact of sourceArtifacts) {
    const artifactId = typeof sourceArtifact.id === 'string' ? sourceArtifact.id : '';
    const stepKey = typeof sourceArtifact.stepKey === 'string' ? sourceArtifact.stepKey : null;
    const payload = sourceArtifact.payload;
    if (!artifactId || !stepKey || !payload || typeof payload !== 'object') continue;
    const payloadRecord = payload as Record<string, unknown>;

    if (stepKey === 'method01-competitor-pages') {
      const candidateKeywords = Array.isArray(payloadRecord.candidateKeywords) ? payloadRecord.candidateKeywords : [];
      for (const candidateKeyword of candidateKeywords) {
        if (!candidateKeyword || typeof candidateKeyword !== 'object') continue;
        const keywordRecord = candidateKeyword as Record<string, unknown>;
        const keyword = typeof keywordRecord.keyword === 'string' ? keywordRecord.keyword : null;
        addConsolidatedKeyword(keyword, stepKey, artifactId, null);
      }
      const topPageCandidates = Array.isArray(payloadRecord.topPageCandidates)
        ? payloadRecord.topPageCandidates
        : Array.isArray(payloadRecord.competitorPages)
          ? payloadRecord.competitorPages
          : [];
      if (!Array.isArray(topPageCandidates)) continue;
      for (const topPageCandidate of topPageCandidates) {
        if (!topPageCandidate || typeof topPageCandidate !== 'object') continue;
        const page = topPageCandidate as Record<string, unknown>;
        const topKeyword = typeof page.topKeyword === 'string' ? page.topKeyword : null;
        addConsolidatedKeyword(topKeyword, stepKey, artifactId, null);
      }
      continue;
    }

    if (stepKey === 'method02-seed-expansion') {
      const parentTopicCandidates = Array.isArray(payloadRecord.parentTopicCandidates) ? payloadRecord.parentTopicCandidates : [];
      if (!Array.isArray(parentTopicCandidates)) continue;
      for (const parentTopicCandidate of parentTopicCandidates) {
        if (!parentTopicCandidate || typeof parentTopicCandidate !== 'object') continue;
        const candidate = parentTopicCandidate as Record<string, unknown>;
        const clusterKeyword = typeof candidate.clusterKeyword === 'string' ? candidate.clusterKeyword : null;
        const parentTopic = typeof candidate.parentTopic === 'string' ? candidate.parentTopic : null;
        addConsolidatedKeyword(clusterKeyword, stepKey, artifactId, parentTopic);
      }
      const groupedParentTopics = Array.isArray(payloadRecord.parentTopicGroups) ? payloadRecord.parentTopicGroups : [];
      for (const parentTopicGroup of groupedParentTopics) {
        if (!parentTopicGroup || typeof parentTopicGroup !== 'object') continue;
        const groupRecord = parentTopicGroup as Record<string, unknown>;
        const parentTopic = typeof groupRecord.parentTopic === 'string' ? groupRecord.parentTopic : null;
        const groupKeywords = Array.isArray(groupRecord.keywords) ? groupRecord.keywords : [];
        for (const groupKeyword of groupKeywords) {
          const keyword = readKeywordValue(groupKeyword);
          addConsolidatedKeyword(keyword, stepKey, artifactId, parentTopic);
        }
      }
      const expandedKeywordSources = [payloadRecord.matchingTerms, payloadRecord.relatedTerms];
      for (const keywordSource of expandedKeywordSources) {
        if (!Array.isArray(keywordSource)) continue;
        for (const keywordEntry of keywordSource) {
          if (!keywordEntry || typeof keywordEntry !== 'object') continue;
          const keywordRecord = keywordEntry as Record<string, unknown>;
          const keyword = typeof keywordRecord.keyword === 'string' ? keywordRecord.keyword : null;
          const parentTopic = typeof keywordRecord.parentTopic === 'string' ? keywordRecord.parentTopic : null;
          addConsolidatedKeyword(keyword, stepKey, artifactId, parentTopic);
        }
      }
    }

    if (stepKey === 'method03-content-gap-import') {
      const gapKeywords = Array.isArray(payloadRecord.gapKeywords)
        ? payloadRecord.gapKeywords
        : Array.isArray(payloadRecord.importRows)
          ? payloadRecord.importRows
          : [];
      if (!Array.isArray(gapKeywords)) continue;
      for (const gapKw of gapKeywords) {
        if (!gapKw || typeof gapKw !== 'object') continue;
        const kw = gapKw as Record<string, unknown>;
        const keyword = typeof kw.keyword === 'string' ? kw.keyword : null;
        const parentTopic = typeof kw.parentTopic === 'string' ? kw.parentTopic : null;
        addConsolidatedKeyword(keyword, stepKey, artifactId, parentTopic);
      }
    }
  }

  return {
    consolidatedKeywords: Array.from(consolidatedKeywords.values()).sort((left, right) =>
      left.keyword.localeCompare(right.keyword),
    ),
    duplicateExistingKeywords: Array.from(duplicateExistingKeywords.values()).sort((left, right) =>
      left.localeCompare(right),
    ),
  };
}

export function slugifyPathSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildTopicalMapPayload(sourceArtifact: Record<string, unknown>) {
  const artifactId = typeof sourceArtifact.id === 'string' ? sourceArtifact.id : '';
  const stepKey = typeof sourceArtifact.stepKey === 'string' ? sourceArtifact.stepKey : null;
  const payload = sourceArtifact.payload;

  if (stepKey !== 'consolidated-keywords' || !artifactId || !payload || typeof payload !== 'object') {
    return {
      primaryTopics: [] as Array<{
        pillar: string;
        clusterKeywords: string[];
        clusterCount: number;
        suggestedUrlPath: string | null;
        sourceMethods: string[];
        sourceArtifactIds: string[];
        existingCoverageUrls: string[];
      }>,
      contentBriefQueue: [] as Array<{
        keyword: string;
        pillar: string;
        contentType: 'pillar' | 'cluster';
        suggestedUrlPath: string | null;
        sourceMethods: string[];
        sourceArtifactIds: string[];
        existingCoverageUrl: string | null;
      }>,
      rolloutPriorities: [] as string[],
    };
  }

  const payloadRecord = payload as Record<string, unknown>;
  const consolidatedKeywords = Array.isArray(payloadRecord.consolidatedKeywords)
    ? payloadRecord.consolidatedKeywords
    : [];
  const topicsByPillar = new Map<
    string,
    {
      pillar: string;
      clusterKeywords: Set<string>;
      sourceMethods: Set<string>;
      sourceArtifactIds: Set<string>;
      existingCoverageUrls: Set<string>;
    }
  >();
  const contentBriefQueue = new Map<
    string,
    {
      keyword: string;
      pillar: string;
      contentType: 'pillar' | 'cluster';
      suggestedUrlPath: string | null;
      sourceMethods: Set<string>;
      sourceArtifactIds: Set<string>;
      existingCoverageUrl: string | null;
    }
  >();

  for (const consolidatedKeyword of consolidatedKeywords) {
    if (!consolidatedKeyword || typeof consolidatedKeyword !== 'object') continue;
    const keywordRecord = consolidatedKeyword as Record<string, unknown>;
    const rawKeyword = typeof keywordRecord.keyword === 'string' ? keywordRecord.keyword.trim() : '';
    const dedupeStatus = typeof keywordRecord.dedupeStatus === 'string' ? keywordRecord.dedupeStatus : null;
    if (!rawKeyword || (dedupeStatus && dedupeStatus !== 'KEPT')) continue;

    const pillar =
      typeof keywordRecord.parentTopic === 'string' && keywordRecord.parentTopic.trim().length > 0
        ? keywordRecord.parentTopic.trim()
        : rawKeyword;
    const pillarKey = pillar.toLowerCase();
    const sourceMethods = Array.isArray(keywordRecord.sourceMethods)
      ? keywordRecord.sourceMethods.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];
    const sourceArtifactIds = Array.isArray(keywordRecord.sourceArtifactIds)
      ? keywordRecord.sourceArtifactIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];
    const existingCoverageUrl =
      typeof keywordRecord.existingCoverageUrl === 'string' && keywordRecord.existingCoverageUrl.trim().length > 0
        ? keywordRecord.existingCoverageUrl.trim()
        : null;
    const suggestedUrlPath = (() => {
      const slug = slugifyPathSegment(rawKeyword);
      return slug.length > 0 ? `/${slug}` : null;
    })();

    const existingTopic =
      topicsByPillar.get(pillarKey) ??
      {
        pillar,
        clusterKeywords: new Set<string>(),
        sourceMethods: new Set<string>(),
        sourceArtifactIds: new Set<string>([artifactId]),
        existingCoverageUrls: new Set<string>(),
      };
    existingTopic.clusterKeywords.add(rawKeyword);
    existingTopic.sourceArtifactIds.add(artifactId);
    for (const sourceMethod of sourceMethods) existingTopic.sourceMethods.add(sourceMethod);
    for (const sourceArtifactId of sourceArtifactIds) existingTopic.sourceArtifactIds.add(sourceArtifactId);
    if (existingCoverageUrl) existingTopic.existingCoverageUrls.add(existingCoverageUrl);
    topicsByPillar.set(pillarKey, existingTopic);

    const queueEntry =
      contentBriefQueue.get(rawKeyword.toLowerCase()) ??
      {
        keyword: rawKeyword,
        pillar,
        contentType: rawKeyword.toLowerCase() === pillarKey ? 'pillar' : ('cluster' as 'pillar' | 'cluster'),
        suggestedUrlPath,
        sourceMethods: new Set<string>(),
        sourceArtifactIds: new Set<string>([artifactId]),
        existingCoverageUrl,
      };
    for (const sourceMethod of sourceMethods) queueEntry.sourceMethods.add(sourceMethod);
    for (const sourceArtifactId of sourceArtifactIds) queueEntry.sourceArtifactIds.add(sourceArtifactId);
    if (!queueEntry.existingCoverageUrl && existingCoverageUrl) queueEntry.existingCoverageUrl = existingCoverageUrl;
    contentBriefQueue.set(rawKeyword.toLowerCase(), queueEntry);
  }

  const primaryTopics = Array.from(topicsByPillar.values())
    .map((topic) => {
      const slug = slugifyPathSegment(topic.pillar);
      return {
        pillar: topic.pillar,
        clusterKeywords: Array.from(topic.clusterKeywords.values()).sort((left, right) => left.localeCompare(right)),
        clusterCount: topic.clusterKeywords.size,
        suggestedUrlPath: slug.length > 0 ? `/${slug}` : null,
        sourceMethods: Array.from(topic.sourceMethods.values()).sort((left, right) => left.localeCompare(right)),
        sourceArtifactIds: Array.from(topic.sourceArtifactIds.values()).sort((left, right) => left.localeCompare(right)),
        existingCoverageUrls: Array.from(topic.existingCoverageUrls.values()).sort((left, right) => left.localeCompare(right)),
      };
    })
    .sort((left, right) => {
      if (right.clusterCount !== left.clusterCount) return right.clusterCount - left.clusterCount;
      return left.pillar.localeCompare(right.pillar);
    });

  const normalizedContentBriefQueue = Array.from(contentBriefQueue.values())
    .map((entry) => ({
      keyword: entry.keyword,
      pillar: entry.pillar,
      contentType: entry.contentType,
      suggestedUrlPath: entry.suggestedUrlPath,
      sourceMethods: Array.from(entry.sourceMethods.values()).sort((left, right) => left.localeCompare(right)),
      sourceArtifactIds: Array.from(entry.sourceArtifactIds.values()).sort((left, right) => left.localeCompare(right)),
      existingCoverageUrl: entry.existingCoverageUrl,
    }))
    .sort((left, right) => left.keyword.localeCompare(right.keyword));

  return {
    primaryTopics,
    contentBriefQueue: normalizedContentBriefQueue,
    rolloutPriorities: primaryTopics.slice(0, 5).map(
      (topic, index) => `${index + 1}. ${topic.pillar} (${topic.clusterCount} keyword${topic.clusterCount === 1 ? '' : 's'})`,
    ),
  };
}

export function readArtifactPayload(
  payloadSource: { payload?: Record<string, unknown> } | Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  return payloadSource && 'payload' in payloadSource && payloadSource.payload && typeof payloadSource.payload === 'object'
    ? (payloadSource.payload as Record<string, unknown>)
    : null;
}

export function getContentBriefQueue(
  payloadSource: { payload?: Record<string, unknown> } | Record<string, unknown> | undefined,
): ContentBriefCandidate[] {
  const payload = readArtifactPayload(payloadSource);
  if (!payload) return [];
  if (!Array.isArray(payload.contentBriefQueue)) return [];

  return payload.contentBriefQueue
    .map((entry: unknown) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const keyword = typeof record.keyword === 'string' ? record.keyword.trim() : '';
      const pillar = typeof record.pillar === 'string' ? record.pillar.trim() : '';
      if (!keyword || !pillar) return null;
      return {
        keyword,
        pillar,
        contentType: record.contentType === 'pillar' ? 'pillar' : ('cluster' as 'pillar' | 'cluster'),
        suggestedUrlPath:
          typeof record.suggestedUrlPath === 'string' && record.suggestedUrlPath.trim().length > 0
            ? record.suggestedUrlPath.trim()
            : null,
        sourceMethods: Array.isArray(record.sourceMethods)
          ? record.sourceMethods.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
          : [],
        sourceArtifactIds: Array.isArray(record.sourceArtifactIds)
          ? record.sourceArtifactIds.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
          : [],
        existingCoverageUrl:
          typeof record.existingCoverageUrl === 'string' && record.existingCoverageUrl.trim().length > 0
            ? record.existingCoverageUrl.trim()
            : null,
      };
    })
    .filter((entry): entry is ContentBriefCandidate => Boolean(entry));
}

export function getContentBriefSource(
  payloadSource: { payload?: Record<string, unknown> } | Record<string, unknown> | undefined,
): ContentBriefSource | null {
  const payload = readArtifactPayload(payloadSource);
  if (!payload) return null;

  const targetKeyword = typeof payload.targetKeyword === 'string' ? payload.targetKeyword.trim() : '';
  const pillar = typeof payload.pillar === 'string' ? payload.pillar.trim() : '';
  if (!targetKeyword || !pillar) return null;

  const market = payload.market && typeof payload.market === 'object' ? (payload.market as Record<string, unknown>) : null;
  const researchContext =
    payload.researchContext && typeof payload.researchContext === 'object'
      ? (payload.researchContext as Record<string, unknown>)
      : null;

  return {
    targetKeyword,
    pillar,
    contentType: payload.contentType === 'pillar' ? 'pillar' : 'cluster',
    suggestedUrlPath:
      typeof payload.suggestedUrlPath === 'string' && payload.suggestedUrlPath.trim().length > 0
        ? payload.suggestedUrlPath.trim()
        : null,
    market: {
      language: typeof market?.language === 'string' ? market.language : 'en',
      country: typeof market?.country === 'string' ? market.country : '',
    },
    titleOptions: Array.isArray(payload.titleOptions)
      ? payload.titleOptions.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
      : [],
    briefOutline: Array.isArray(payload.briefOutline)
      ? payload.briefOutline.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
      : [],
    internalLinkTargets: Array.isArray(payload.internalLinkTargets)
      ? payload.internalLinkTargets.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
      : [],
    editorialNotes: Array.isArray(payload.editorialNotes)
      ? payload.editorialNotes.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
      : [],
    researchContext: {
      sourceMethods: Array.isArray(researchContext?.sourceMethods)
        ? researchContext.sourceMethods.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
        : [],
      sourceArtifactIds: Array.isArray(researchContext?.sourceArtifactIds)
        ? researchContext.sourceArtifactIds.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
        : [],
      existingCoverageUrl:
        typeof researchContext?.existingCoverageUrl === 'string' && researchContext.existingCoverageUrl.trim().length > 0
          ? researchContext.existingCoverageUrl.trim()
          : null,
    },
  };
}

// ===== CONTENT BRIEF / ARTICLE BUILDERS =====

export function toTitleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

export function buildContentBriefTitleOptions(
  keyword: string,
  pillar: string,
  country: string,
  contentType: 'pillar' | 'cluster',
) {
  const titleKeyword = toTitleCase(keyword);
  const titlePillar = toTitleCase(pillar);
  const market = country.toUpperCase();

  if (contentType === 'pillar') {
    return [
      `${titleKeyword}: What It Includes, Pricing, and Buyer Considerations in ${market}`,
      `${titleKeyword} Guide for ${market}: Scope, Deliverables, and Next Steps`,
    ];
  }

  return [
    `${titleKeyword}: Where It Fits Within ${titlePillar}`,
    `${titleKeyword} in ${market}: Key Considerations, Costs, and FAQs`,
  ];
}

export function buildContentBriefOutline(keyword: string, pillar: string, contentType: 'pillar' | 'cluster') {
  if (contentType === 'pillar') {
    return [
      `Define ${keyword} and the core commercial use cases.`,
      `Break down the primary service or solution areas under ${pillar}.`,
      `Explain pricing, delivery scope, and qualification criteria.`,
      `Answer the highest-intent FAQs tied to ${keyword}.`,
    ];
  }
  return [
    `Explain what ${keyword} means in the context of ${pillar}.`,
    `Compare ${keyword} against adjacent options or alternatives.`,
    `Cover pricing, scope, or implementation considerations for ${keyword}.`,
    `Add FAQs and internal links back to the parent pillar.`,
  ];
}

export function buildContentArticleSectionPlan(
  keyword: string,
  pillar: string,
  contentType: 'pillar' | 'cluster',
  briefOutline: string[],
) {
  const outline = briefOutline.length > 0 ? briefOutline : buildContentBriefOutline(keyword, pillar, contentType);
  return [
    `Introduction: align ${keyword} with the primary reader intent and market context.`,
    ...outline,
    `Conclusion: summarize the next step and reinforce the conversion path for ${keyword}.`,
  ];
}

export function buildContentArticleDraftChecklist(
  keyword: string,
  contentType: 'pillar' | 'cluster',
  suggestedUrlPath: string | null,
  internalLinkTargets: string[],
) {
  const checklist = [
    `Keep the opening tightly aligned to ${keyword} and the approved brief context.`,
    contentType === 'pillar'
      ? 'Cover the full commercial scope before branching into supporting sections.'
      : 'Keep the draft tightly scoped to the cluster query and link back to the parent pillar.',
  ];
  if (suggestedUrlPath) checklist.push(`Preserve the planned slug ${suggestedUrlPath} in the draft metadata.`);
  if (internalLinkTargets.length > 0) checklist.push(`Include internal links to ${internalLinkTargets.join(', ')}.`);
  return checklist;
}

// ===== EXPORT / CSV UTILITIES =====

export function toDownloadFileToken(value: string) {
  const token = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return token.length > 0 ? token : 'workflow';
}

export function toCsvValue(value: string | number | null | undefined) {
  const normalizedValue = value == null ? '' : String(value);
  return `"${normalizedValue.replace(/"/g, '""')}"`;
}

export function buildKeywordLedgerCsv(keywords: PersistedKeywordWorkflowKeyword[]) {
  const headers = [
    'Keyword', 'Parent Topic', 'Intent', 'Funnel', 'Search Volume',
    'Target URL', 'Existing Coverage URL', 'Content Type', 'Source Methods',
    'Approval Status', 'Keyword Status', 'Notes',
  ];
  const rows = keywords.map((keyword) =>
    [
      keyword.keyword, keyword.parentTopic, keyword.intent, keyword.funnel,
      keyword.searchVolume, keyword.targetUrl, keyword.existingCoverageUrl,
      keyword.contentType, keyword.sourceMethods?.join('; ') ?? '',
      keyword.approvalStatus, keyword.status, keyword.notes,
    ]
      .map((value) => toCsvValue(value as string | number | null | undefined))
      .join(','),
  );
  return [headers.map((header) => toCsvValue(header)).join(','), ...rows].join('\n');
}

// ===== ROUTING UTILITIES =====

export function getWorkflowPath(projectId: string, workflowId: string) {
  return `/dashboard/keywords/${projectId}/workflows/${workflowId}`;
}
