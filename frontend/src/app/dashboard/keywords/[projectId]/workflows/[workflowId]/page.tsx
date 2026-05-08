import { readFile } from 'fs/promises';
import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { join } from 'path';
import {
  approveKeywordWorkflowCheckpoint,
  createKeywordWorkflowArtifact,
  createKeywordWorkflowCompetitor,
  createKeywordWorkflowContentGapImport,
  getKeywordProject,
  getKeywordWorkflow,
  rejectKeywordWorkflowCheckpoint,
  requestKeywordWorkflowRevision,
  type KeywordWorkflowArtifact,
  type PersistedKeywordWorkflowKeyword,
  upsertKeywordWorkflowCompetitorMetrics,
} from '@/features/keywords/services/keywords.service';
import { ArtifactPayloadView, hasArtifactPayloadContent } from '@/features/keywords/components/artifact-payload-view';
import { CollapsiblePanel } from '@/features/keywords/components/collapsible-panel';
import { WorkflowArtifactForm } from '@/features/keywords/components/workflow-artifact-form';
import { WorkflowShellLayout, CollapsedWorkflowRail } from '@/features/keywords/components/workflow-shell-layout';
import { GenerateStepButton } from '@/features/keywords/components/generate-step-button';
import { ContentPieceStatusCard } from '@/features/keywords/components/content-piece-status-card';
import { KeywordLedgerTable, type LedgerKeyword } from '@/features/keywords/components/keyword-ledger-table';
import { TopicalMapView } from '@/features/keywords/components/topical-map-view';
import { Method03Table } from '@/features/keywords/components/method03-table';
import { SerpCandidatesView } from '@/features/keywords/components/serp-candidates-view';
import { CompetitorMetricsView } from '@/features/keywords/components/competitor-metrics-view';
import { BusinessProfileKeyFindings } from '@/features/keywords/components/business-profile-key-findings';
import { Method01PagesView } from '@/features/keywords/components/method01-pages-view';

const WORKFLOW_STEPS = [
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

type Method02SourceKeyword = {
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

type ContentBriefCandidate = {
  keyword: string;
  pillar: string;
  contentType: 'pillar' | 'cluster';
  suggestedUrlPath: string | null;
  sourceMethods: string[];
  sourceArtifactIds: string[];
  existingCoverageUrl: string | null;
};

type ContentBriefSource = {
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

type PersistedWorkflowContentPiece = {
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

type ArtifactFormDraftValues = {
  summary: string;
  headline: string;
  keyFindings: string;
  recommendedAction: string;
  evidence: string;
  openQuestions: string;
};

type GeneratedBusinessProfileDraft = {
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

type SeedKeywordStepSource = {
  sourceArtifactId: string | null;
  keywords: string[];
};

type SerpNicheMapStepSource = {
  sourceArtifactId: string | null;
  keywords: string[];
};

type WorkflowStepVisualStatus =
  | 'complete'
  | 'current'
  | 'next'
  | 'draft'
  | 'in-review'
  | 'needs-revision'
  | 'rejected'
  | 'upcoming';

function readObjectRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeCheckpointCopy(value: string) {
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

function shouldHideCheckpointMetadataKey(key: string) {
  return key === 'version' || key === 'sourceArtifactVersion' || key === 'sourceVersion';
}

function readArtifactText(section: Record<string, unknown> | null | undefined) {
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

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
}

function getArtifactFormDraftValues(artifact: KeywordWorkflowArtifact | undefined) {
  if (!artifact) {
    return undefined;
  }

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

function extractBusinessProfileSeedKeywordsFromFindings(findings: string[]) {
  const seedKeywordLine = findings.find((finding) => finding.toLowerCase().startsWith('suggested seed keywords:'));

  if (!seedKeywordLine) {
    return [];
  }

  return seedKeywordLine
    .slice(seedKeywordLine.indexOf(':') + 1)
    .split(',')
    .map((keyword) => normalizeWhitespace(keyword))
    .filter(Boolean);
}

function readBusinessProfileSeedKeywords(artifact: KeywordWorkflowArtifact | undefined) {
  if (!artifact) {
    return [];
  }

  const payload = readObjectRecord(artifact.payload);
  const directKeywords = readStringArray(payload?.seedKeywords);

  if (directKeywords.length > 0) {
    return directKeywords;
  }

  const generatedProfile = readObjectRecord(payload?.generatedProfile);
  const generatedSeedKeywords = readStringArray(generatedProfile?.seedKeywords);

  if (generatedSeedKeywords.length > 0) {
    return generatedSeedKeywords;
  }

  return extractBusinessProfileSeedKeywordsFromFindings(readStringArray(payload?.keyFindings));
}

function getRenderableArtifactPayload(artifact: KeywordWorkflowArtifact | null | undefined) {
  const payload = readObjectRecord(artifact?.payload);

  if (!payload || artifact?.stepKey !== 'business-profile') {
    return payload;
  }

  if (readStringArray(payload.seedKeywords).length > 0) {
    return payload;
  }

  const seedKeywords = readBusinessProfileSeedKeywords(artifact);

  if (seedKeywords.length === 0) {
    return payload;
  }

  return {
    ...payload,
    seedKeywords,
  } satisfies Record<string, unknown>;
}

function getSeedKeywordStepSource(artifacts: KeywordWorkflowArtifact[] | undefined) {
  const businessProfileArtifacts = artifacts ?? [];
  const sourceArtifact =
    businessProfileArtifacts.find(
      (artifact) => artifact.status === 'APPROVED' && readBusinessProfileSeedKeywords(artifact).length > 0,
    ) ?? businessProfileArtifacts.find((artifact) => readBusinessProfileSeedKeywords(artifact).length > 0);

  if (!sourceArtifact) {
    return undefined;
  }

  const keywords = readBusinessProfileSeedKeywords(sourceArtifact);

  if (keywords.length === 0) {
    return undefined;
  }

  return {
    sourceArtifactId: sourceArtifact.id,
    keywords,
  } satisfies SeedKeywordStepSource;
}

function getSeedKeywordDraftValues(source: SeedKeywordStepSource | undefined) {
  if (!source) {
    return undefined;
  }

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

function readApprovedSeedKeywords(artifact: KeywordWorkflowArtifact | undefined) {
  if (!artifact) {
    return [];
  }

  const payload = readObjectRecord(artifact.payload);
  const directKeywords = readStringArray(payload?.approvedKeywords);

  if (directKeywords.length > 0) {
    return directKeywords;
  }

  return readStringArray(payload?.keyFindings);
}

function getSerpNicheMapStepSource(artifacts: KeywordWorkflowArtifact[] | undefined) {
  const seedKeywordArtifacts = artifacts ?? [];
  const sourceArtifact =
    seedKeywordArtifacts.find(
      (artifact) => artifact.status === 'APPROVED' && readApprovedSeedKeywords(artifact).length > 0,
    ) ?? seedKeywordArtifacts.find((artifact) => readApprovedSeedKeywords(artifact).length > 0);

  if (!sourceArtifact) {
    return undefined;
  }

  const keywords = readApprovedSeedKeywords(sourceArtifact);

  if (keywords.length === 0) {
    return undefined;
  }

  return {
    sourceArtifactId: sourceArtifact.id,
    keywords,
  } satisfies SerpNicheMapStepSource;
}

function getSerpNicheMapDraftValues(source: SerpNicheMapStepSource | undefined) {
  if (!source) {
    return undefined;
  }

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

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function htmlToText(html: string) {
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

async function readWorkspaceEnvValue(key: string) {
  const envPaths = [
    join(process.cwd(), '.env.local'),
    join(process.cwd(), '.env'),
    join(process.cwd(), '..', '.env.local'),
    join(process.cwd(), '..', '.env'),
  ];

  for (const envPath of envPaths) {
    try {
      const fileContents = await readFile(envPath, 'utf8');
      const match = fileContents.match(new RegExp(`^${key}=(.*)$`, 'm'));

      if (!match) {
        continue;
      }

      return match[1].trim().replace(/^['\"]|['\"]$/g, '');
    } catch {
      continue;
    }
  }

  return null;
}

async function fetchWebsiteText(websiteUrl: string) {
  const response = await fetch(websiteUrl, {
    cache: 'no-store',
    headers: {
      'User-Agent': 'PulseKeywordWorkflow/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Website fetch failed with status ${response.status}.`);
  }

  const html = await response.text();
  return htmlToText(html).slice(0, 12000);
}

function sanitizeGeneratedBusinessProfileDraft(payload: Record<string, unknown>): GeneratedBusinessProfileDraft {
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

function buildBusinessProfileKeyFindings(draft: GeneratedBusinessProfileDraft) {
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

function formatWorkflowStepLabel(stepKey: (typeof WORKFLOW_STEPS)[number]) {
  return stepKey
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function isWorkflowStepKey(value: string): value is (typeof WORKFLOW_STEPS)[number] {
  return WORKFLOW_STEPS.includes(value as (typeof WORKFLOW_STEPS)[number]);
}

function getWorkflowStepDescription(stepKey: (typeof WORKFLOW_STEPS)[number]) {
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

function getWizardBadgeTone(status: WorkflowStepVisualStatus) {
  switch (status) {
    case 'complete':
      return 'bg-[#ECFDF3] text-[#027A48]';
    case 'current':
      return 'bg-[#EEF4FF] text-[#3538CD]';
    case 'next':
      return 'bg-[#F9FAFB] text-[#667085]';
    case 'draft':
      return 'bg-[#F4F6FA] text-[#344054]';
    case 'in-review':
      return 'bg-[#FEF3F2] text-[#B42318]';
    case 'needs-revision':
      return 'bg-[#FFF1F3] text-[#C01048]';
    case 'rejected':
      return 'bg-[#FEF3F2] text-[#B42318]';
    case 'upcoming':
      return 'bg-[#F9FAFB] text-[#667085]';
    default:
      return 'bg-[#F9FAFB] text-[#667085]';
  }
}

function getWizardMarkerTone(status: WorkflowStepVisualStatus) {
  switch (status) {
    case 'complete':
      return 'border-[#12B76A] bg-[#ECFDF3] text-[#027A48]';
    case 'current':
      return 'border-[#3538CD] bg-[#EEF4FF] text-[#3538CD]';
    case 'next':
      return 'border-[#D0D5DD] bg-white text-[#98A2B3]';
    case 'draft':
      return 'border-[#98A2B3] bg-[#F4F6FA] text-[#344054]';
    case 'in-review':
      return 'border-[#F97066] bg-[#FEF3F2] text-[#B42318]';
    case 'needs-revision':
      return 'border-[#F670C7] bg-[#FFF1F3] text-[#C01048]';
    case 'rejected':
      return 'border-[#F97066] bg-[#FEF3F2] text-[#B42318]';
    case 'upcoming':
      return 'border-[#D0D5DD] bg-white text-[#98A2B3]';
    default:
      return 'border-[#D0D5DD] bg-white text-[#98A2B3]';
  }
}

function getWorkflowStepStatusLabel(status: WorkflowStepVisualStatus) {
  switch (status) {
    case 'complete':
      return 'Complete';
    case 'current':
      return 'Current';
    case 'next':
      return 'Next';
    case 'draft':
      return 'Draft';
    case 'in-review':
      return 'Awaiting approval';
    case 'needs-revision':
      return 'Needs revision';
    case 'rejected':
      return 'Rejected';
    case 'upcoming':
      return 'Upcoming';
    default:
      return 'Upcoming';
  }
}

function WorkflowStatusIcon({ status }: { status: WorkflowStepVisualStatus }) {
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

function getWorkflowStepVisualStatus(args: {
  stepKey: (typeof WORKFLOW_STEPS)[number];
  currentStepKey: (typeof WORKFLOW_STEPS)[number] | null;
  nextStepKey: (typeof WORKFLOW_STEPS)[number] | null;
  artifactStatus: KeywordWorkflowArtifact['status'] | null;
}) {
  const { stepKey, currentStepKey, nextStepKey, artifactStatus } = args;

  if (artifactStatus === 'APPROVED') {
    return 'complete' satisfies WorkflowStepVisualStatus;
  }

  if (stepKey === currentStepKey) {
    if (artifactStatus === 'AWAITING_APPROVAL') return 'in-review' satisfies WorkflowStepVisualStatus;
    if (artifactStatus === 'REVISION_REQUESTED') return 'needs-revision' satisfies WorkflowStepVisualStatus;
    if (artifactStatus === 'REJECTED') return 'rejected' satisfies WorkflowStepVisualStatus;
    if (artifactStatus === 'DRAFT') return 'draft' satisfies WorkflowStepVisualStatus;
    return 'current' satisfies WorkflowStepVisualStatus;
  }

  if (artifactStatus === 'REVISION_REQUESTED') return 'needs-revision' satisfies WorkflowStepVisualStatus;
  if (artifactStatus === 'REJECTED') return 'rejected' satisfies WorkflowStepVisualStatus;
  if (artifactStatus === 'AWAITING_APPROVAL') return 'in-review' satisfies WorkflowStepVisualStatus;
  if (artifactStatus === 'DRAFT') return 'draft' satisfies WorkflowStepVisualStatus;
  if (stepKey === nextStepKey) return 'next' satisfies WorkflowStepVisualStatus;
  return 'upcoming' satisfies WorkflowStepVisualStatus;
}

function getLatestArtifacts(artifacts: KeywordWorkflowArtifact[] | undefined) {
  const latestByStep = new Map<string, KeywordWorkflowArtifact>();

  for (const artifact of artifacts ?? []) {
    if (!latestByStep.has(artifact.stepKey)) {
      latestByStep.set(artifact.stepKey, artifact);
    }
  }

  return Array.from(latestByStep.values());
}

function getArtifactHistory(artifacts: KeywordWorkflowArtifact[] | undefined) {
  const grouped = new Map<string, KeywordWorkflowArtifact[]>();

  for (const artifact of artifacts ?? []) {
    const existing = grouped.get(artifact.stepKey) ?? [];
    existing.push(artifact);
    grouped.set(artifact.stepKey, existing);
  }

  return Array.from(grouped.entries()).sort(([left], [right]) => {
    const leftIndex = WORKFLOW_STEPS.indexOf(left as (typeof WORKFLOW_STEPS)[number]);
    const rightIndex = WORKFLOW_STEPS.indexOf(right as (typeof WORKFLOW_STEPS)[number]);

    if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
}

function parsePhase1WinningUrls(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [url, topKeyword, note] = line.split('|').map((part) => part.trim());

      return {
        url,
        topKeyword: topKeyword || null,
        note: note || null,
      };
    })
    .filter((entry) => entry.url.length > 0);
}

function parseMethod02Clusters(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [parentTopic, clusterKeyword, note] = line.split('|').map((part) => part.trim());

      return {
        parentTopic,
        clusterKeyword: clusterKeyword || null,
        note: note || null,
      };
    })
    .filter((entry) => entry.parentTopic.length > 0);
}

function toLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseMetricValue(rawValue: FormDataEntryValue | null, label: string) {
  const value = String(rawValue ?? '').trim();

  if (!value) {
    return undefined;
  }

  const parsedValue = Number(value);

  if (Number.isNaN(parsedValue)) {
    throw new Error(`${label} must be a valid number.`);
  }

  return parsedValue;
}

function parseCompetitorTopPages(value: string) {
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

      if (topKeyword) {
        page.topKeyword = topKeyword;
      }

      if (note) {
        page.note = note;
      }

      return page;
    })
    .filter((page) => typeof page.url === 'string' && page.url.length > 0);
}

function formatCompetitorTopPages(topPages: Record<string, unknown>[] | undefined | null) {
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

function getStoredTopPageCandidates(selectedCompetitors: Record<string, unknown>[]) {
  const topPagesByUrl = new Map<string, Record<string, unknown>>();

  for (const competitor of selectedCompetitors) {
    const domain = typeof competitor.domain === 'string' ? competitor.domain : 'competitor';
    const metrics = competitor.metrics;

    if (!metrics || typeof metrics !== 'object') {
      continue;
    }

    const topPages = (metrics as Record<string, unknown>).topPages;

    if (!Array.isArray(topPages)) {
      continue;
    }

    for (const topPage of topPages) {
      if (!topPage || typeof topPage !== 'object') {
        continue;
      }

      const page = topPage as Record<string, unknown>;
      const url = typeof page.url === 'string' ? page.url.trim() : '';

      if (!url || topPagesByUrl.has(url)) {
        continue;
      }

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

function mergeTopPageCandidates(...candidateGroups: Record<string, unknown>[][]) {
  const topPagesByUrl = new Map<string, Record<string, unknown>>();

  for (const candidateGroup of candidateGroups) {
    for (const candidate of candidateGroup) {
      const url = typeof candidate.url === 'string' ? candidate.url.trim() : '';

      if (!url || topPagesByUrl.has(url)) {
        continue;
      }

      topPagesByUrl.set(url, candidate);
    }
  }

  return Array.from(topPagesByUrl.values());
}

function buildMethod01AutoFindings(
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

    if (typeof metricRecord?.domainRating === 'number') {
      metricSummary.push(`DR ${metricRecord.domainRating}`);
    }

    if (typeof metricRecord?.organicTraffic === 'number') {
      metricSummary.push(`traffic ${metricRecord.organicTraffic}`);
    }

    if (typeof metricRecord?.organicKeywords === 'number') {
      metricSummary.push(`keywords ${metricRecord.organicKeywords}`);
    }

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

function buildMethod01AutoEvidence(selectedCompetitors: Record<string, unknown>[]) {
  return selectedCompetitors
    .map((competitor) => {
      const domain = typeof competitor.domain === 'string' ? competitor.domain : '';
      const metrics = competitor.metrics;
      const metricRecord = metrics && typeof metrics === 'object' ? (metrics as Record<string, unknown>) : null;
      const evidenceParts = [domain];

      if (typeof metricRecord?.domainRating === 'number') {
        evidenceParts.push(`DR ${metricRecord.domainRating}`);
      }

      if (typeof metricRecord?.organicTraffic === 'number') {
        evidenceParts.push(`Traffic ${metricRecord.organicTraffic}`);
      }

      if (typeof metricRecord?.organicKeywords === 'number') {
        evidenceParts.push(`Keywords ${metricRecord.organicKeywords}`);
      }

      if (typeof metricRecord?.capturedAt === 'string' && metricRecord.capturedAt.length > 0) {
        evidenceParts.push(`Captured ${metricRecord.capturedAt}`);
      }

      return evidenceParts.filter(Boolean).join(' | ');
    })
    .filter((line) => line.length > 0);
}

function buildMethod02ParentTopicCandidates(selectedKeywords: Method02SourceKeyword[]) {
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

function mergeMethod02ParentTopicCandidates(...candidateGroups: Array<Array<{ parentTopic: string; clusterKeyword: string | null; note: string | null }>>) {
  const candidatesByKey = new Map<string, { parentTopic: string; clusterKeyword: string | null; note: string | null }>();

  for (const candidateGroup of candidateGroups) {
    for (const candidate of candidateGroup) {
      const parentTopic = candidate.parentTopic.trim();
      const clusterKeyword = candidate.clusterKeyword?.trim() || null;
      const key = `${parentTopic}::${clusterKeyword ?? ''}`;

      if (!parentTopic || candidatesByKey.has(key)) {
        continue;
      }

      candidatesByKey.set(key, {
        parentTopic,
        clusterKeyword,
        note: candidate.note,
      });
    }
  }

  return Array.from(candidatesByKey.values());
}

function buildMethod02AutoFindings(
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

function buildMethod02AutoEvidence(selectedKeywords: Method02SourceKeyword[]) {
  return selectedKeywords.map((sourceKeyword) => {
    const evidenceParts = [sourceKeyword.keyword];

    if (sourceKeyword.parentTopic) {
      evidenceParts.push(`Parent topic ${sourceKeyword.parentTopic}`);
    }

    if (typeof sourceKeyword.searchVolume === 'number') {
      evidenceParts.push(`Volume ${sourceKeyword.searchVolume}`);
    }

    if (sourceKeyword.intent) {
      evidenceParts.push(`Intent ${sourceKeyword.intent}`);
    }

    if (sourceKeyword.source === 'project-seeds') {
      evidenceParts.push('Seed keyword fallback');
    }

    return evidenceParts.join(' | ');
  });
}

function getLatestApprovedArtifact(
  artifacts: KeywordWorkflowArtifact[] | undefined,
  stepKey: string,
) {
  return (artifacts ?? []).find(
    (artifact) => artifact.stepKey === stepKey && artifact.status === 'APPROVED',
  );
}

function buildConsolidatedKeywordsPayload(sourceArtifacts: Array<Record<string, unknown>>) {
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
    if (typeof value === 'string') {
      return value;
    }

    if (value && typeof value === 'object') {
      const keyword = (value as Record<string, unknown>).keyword;
      return typeof keyword === 'string' ? keyword : null;
    }

    return null;
  };

  for (const sourceArtifact of sourceArtifacts) {
    const stepKey = typeof sourceArtifact.stepKey === 'string' ? sourceArtifact.stepKey : null;
    const payload = sourceArtifact.payload;

    if (stepKey !== 'phase1-baseline' || !payload || typeof payload !== 'object') {
      continue;
    }

    const phase1Baseline = (payload as Record<string, unknown>).phase1Baseline;

    const existingKeywordRows = Array.isArray((payload as Record<string, unknown>).existingKeywords)
      ? (payload as Record<string, unknown>).existingKeywords
      : Array.isArray((payload as Record<string, unknown>).dedupeList)
        ? (payload as Record<string, unknown>).dedupeList
        : phase1Baseline && typeof phase1Baseline === 'object' && Array.isArray((phase1Baseline as Record<string, unknown>).existingKeywords)
          ? (phase1Baseline as Record<string, unknown>).existingKeywords
          : [];

    if (!Array.isArray(existingKeywordRows)) {
      continue;
    }

    for (const existingKeyword of existingKeywordRows) {
      const keywordValue = readKeywordValue(existingKeyword);

      if (!keywordValue) {
        continue;
      }

      const normalizedKeyword = keywordValue.trim().toLowerCase();

      if (normalizedKeyword) {
        existingKeywords.add(normalizedKeyword);
      }
    }
  }

  const addConsolidatedKeyword = (
    rawKeyword: string | null,
    stepKey: string,
    artifactId: string,
    parentTopic: string | null,
  ) => {
    const normalizedKeyword = rawKeyword?.trim().toLowerCase() ?? '';

    if (!normalizedKeyword) {
      return;
    }

    if (existingKeywords.has(normalizedKeyword)) {
      duplicateExistingKeywords.add(normalizedKeyword);
      return;
    }

    const existingCandidate = consolidatedKeywords.get(normalizedKeyword);

    if (existingCandidate) {
      if (!existingCandidate.sourceMethods.includes(stepKey)) {
        existingCandidate.sourceMethods.push(stepKey);
      }

      if (!existingCandidate.sourceArtifactIds.includes(artifactId)) {
        existingCandidate.sourceArtifactIds.push(artifactId);
      }

      if (!existingCandidate.parentTopic && parentTopic) {
        existingCandidate.parentTopic = parentTopic;
      }

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

    if (!artifactId || !stepKey || !payload || typeof payload !== 'object') {
      continue;
    }

    const payloadRecord = payload as Record<string, unknown>;

    if (stepKey === 'method01-competitor-pages') {
      const candidateKeywords = Array.isArray(payloadRecord.candidateKeywords) ? payloadRecord.candidateKeywords : [];

      for (const candidateKeyword of candidateKeywords) {
        if (!candidateKeyword || typeof candidateKeyword !== 'object') {
          continue;
        }

        const keywordRecord = candidateKeyword as Record<string, unknown>;
        const keyword = typeof keywordRecord.keyword === 'string' ? keywordRecord.keyword : null;
        addConsolidatedKeyword(keyword, stepKey, artifactId, null);
      }

      const topPageCandidates = Array.isArray(payloadRecord.topPageCandidates)
        ? payloadRecord.topPageCandidates
        : Array.isArray(payloadRecord.competitorPages)
          ? payloadRecord.competitorPages
          : [];

      if (!Array.isArray(topPageCandidates)) {
        continue;
      }

      for (const topPageCandidate of topPageCandidates) {
        if (!topPageCandidate || typeof topPageCandidate !== 'object') {
          continue;
        }

        const page = topPageCandidate as Record<string, unknown>;
        const topKeyword = typeof page.topKeyword === 'string' ? page.topKeyword : null;
        addConsolidatedKeyword(topKeyword, stepKey, artifactId, null);
      }

      continue;
    }

    if (stepKey === 'method02-seed-expansion') {
      const parentTopicCandidates = Array.isArray(payloadRecord.parentTopicCandidates) ? payloadRecord.parentTopicCandidates : [];

      if (!Array.isArray(parentTopicCandidates)) {
        continue;
      }

      for (const parentTopicCandidate of parentTopicCandidates) {
        if (!parentTopicCandidate || typeof parentTopicCandidate !== 'object') {
          continue;
        }

        const candidate = parentTopicCandidate as Record<string, unknown>;
        const clusterKeyword = typeof candidate.clusterKeyword === 'string' ? candidate.clusterKeyword : null;
        const parentTopic = typeof candidate.parentTopic === 'string' ? candidate.parentTopic : null;
        addConsolidatedKeyword(clusterKeyword, stepKey, artifactId, parentTopic);
      }

      const groupedParentTopics = Array.isArray(payloadRecord.parentTopicGroups) ? payloadRecord.parentTopicGroups : [];

      for (const parentTopicGroup of groupedParentTopics) {
        if (!parentTopicGroup || typeof parentTopicGroup !== 'object') {
          continue;
        }

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
        if (!Array.isArray(keywordSource)) {
          continue;
        }

        for (const keywordEntry of keywordSource) {
          if (!keywordEntry || typeof keywordEntry !== 'object') {
            continue;
          }

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

      if (!Array.isArray(gapKeywords)) {
        continue;
      }

      for (const gapKw of gapKeywords) {
        if (!gapKw || typeof gapKw !== 'object') {
          continue;
        }

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

function slugifyPathSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildTopicalMapPayload(sourceArtifact: Record<string, unknown>) {
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
    if (!consolidatedKeyword || typeof consolidatedKeyword !== 'object') {
      continue;
    }

    const keywordRecord = consolidatedKeyword as Record<string, unknown>;
    const rawKeyword = typeof keywordRecord.keyword === 'string' ? keywordRecord.keyword.trim() : '';
    const dedupeStatus = typeof keywordRecord.dedupeStatus === 'string' ? keywordRecord.dedupeStatus : null;

    if (!rawKeyword || (dedupeStatus && dedupeStatus !== 'KEPT')) {
      continue;
    }

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

    for (const sourceMethod of sourceMethods) {
      existingTopic.sourceMethods.add(sourceMethod);
    }

    for (const sourceArtifactId of sourceArtifactIds) {
      existingTopic.sourceArtifactIds.add(sourceArtifactId);
    }

    if (existingCoverageUrl) {
      existingTopic.existingCoverageUrls.add(existingCoverageUrl);
    }

    topicsByPillar.set(pillarKey, existingTopic);

    const queueEntry =
      contentBriefQueue.get(rawKeyword.toLowerCase()) ??
      {
        keyword: rawKeyword,
        pillar,
        contentType: rawKeyword.toLowerCase() === pillarKey ? 'pillar' : 'cluster',
        suggestedUrlPath,
        sourceMethods: new Set<string>(),
        sourceArtifactIds: new Set<string>([artifactId]),
        existingCoverageUrl,
      };

    for (const sourceMethod of sourceMethods) {
      queueEntry.sourceMethods.add(sourceMethod);
    }

    for (const sourceArtifactId of sourceArtifactIds) {
      queueEntry.sourceArtifactIds.add(sourceArtifactId);
    }

    if (!queueEntry.existingCoverageUrl && existingCoverageUrl) {
      queueEntry.existingCoverageUrl = existingCoverageUrl;
    }

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
      if (right.clusterCount !== left.clusterCount) {
        return right.clusterCount - left.clusterCount;
      }

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

function readArtifactPayload(
  payloadSource: { payload?: Record<string, unknown> } | Record<string, unknown> | undefined,
) : Record<string, unknown> | null {
  return payloadSource && 'payload' in payloadSource && payloadSource.payload && typeof payloadSource.payload === 'object'
    ? (payloadSource.payload as Record<string, unknown>)
    : null;
}

function getContentBriefQueue(payloadSource: { payload?: Record<string, unknown> } | Record<string, unknown> | undefined): ContentBriefCandidate[] {
  const payload = readArtifactPayload(payloadSource);

  if (!payload) {
    return [];
  }

  if (!Array.isArray(payload.contentBriefQueue)) {
    return [];
  }

  return payload.contentBriefQueue
    .map((entry: unknown) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const keyword = typeof record.keyword === 'string' ? record.keyword.trim() : '';
      const pillar = typeof record.pillar === 'string' ? record.pillar.trim() : '';

      if (!keyword || !pillar) {
        return null;
      }

      return {
        keyword,
        pillar,
        contentType: record.contentType === 'pillar' ? 'pillar' : 'cluster',
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

function getContentBriefSource(
  payloadSource: { payload?: Record<string, unknown> } | Record<string, unknown> | undefined,
): ContentBriefSource | null {
  const payload = readArtifactPayload(payloadSource);

  if (!payload) {
    return null;
  }

  const targetKeyword = typeof payload.targetKeyword === 'string' ? payload.targetKeyword.trim() : '';
  const pillar = typeof payload.pillar === 'string' ? payload.pillar.trim() : '';

  if (!targetKeyword || !pillar) {
    return null;
  }

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

function toTitleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildContentBriefTitleOptions(keyword: string, pillar: string, country: string, contentType: 'pillar' | 'cluster') {
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

function buildContentBriefOutline(keyword: string, pillar: string, contentType: 'pillar' | 'cluster') {
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

function buildContentArticleSectionPlan(
  keyword: string,
  pillar: string,
  contentType: 'pillar' | 'cluster',
  briefOutline: string[],
) {
  const outline =
    briefOutline.length > 0 ? briefOutline : buildContentBriefOutline(keyword, pillar, contentType);

  return [
    `Introduction: align ${keyword} with the primary reader intent and market context.`,
    ...outline,
    `Conclusion: summarize the next step and reinforce the conversion path for ${keyword}.`,
  ];
}

function buildContentArticleDraftChecklist(
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

  if (suggestedUrlPath) {
    checklist.push(`Preserve the planned slug ${suggestedUrlPath} in the draft metadata.`);
  }

  if (internalLinkTargets.length > 0) {
    checklist.push(`Include internal links to ${internalLinkTargets.join(', ')}.`);
  }

  return checklist;
}

function toDownloadFileToken(value: string) {
  const token = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return token.length > 0 ? token : 'workflow';
}

function toCsvValue(value: string | number | null | undefined) {
  const normalizedValue = value == null ? '' : String(value);
  return `"${normalizedValue.replace(/"/g, '""')}"`;
}

function buildKeywordLedgerCsv(keywords: PersistedKeywordWorkflowKeyword[]) {
  const headers = [
    'Keyword',
    'Parent Topic',
    'Intent',
    'Funnel',
    'Search Volume',
    'Target URL',
    'Existing Coverage URL',
    'Content Type',
    'Source Methods',
    'Approval Status',
    'Keyword Status',
    'Notes',
  ];
  const rows = keywords.map((keyword) =>
    [
      keyword.keyword,
      keyword.parentTopic,
      keyword.intent,
      keyword.funnel,
      keyword.searchVolume,
      keyword.targetUrl,
      keyword.existingCoverageUrl,
      keyword.contentType,
      keyword.sourceMethods?.join('; ') ?? '',
      keyword.approvalStatus,
      keyword.status,
      keyword.notes,
    ]
      .map((value) => toCsvValue(value))
      .join(','),
  );

  return [headers.map((header) => toCsvValue(header)).join(','), ...rows].join('\n');
}

function getWorkflowPath(projectId: string, workflowId: string) {
  return `/dashboard/keywords/${projectId}/workflows/${workflowId}`;
}

async function persistArtifactFromFormData(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '').trim();
  const workflowId = String(formData.get('workflowId') ?? '').trim();
  const stepKey = String(formData.get('stepKey') ?? '').trim();
  const summary = String(formData.get('summary') ?? '').trim();
  const headline = String(formData.get('headline') ?? '').trim();
  const keyFindings = String(formData.get('keyFindings') ?? '').trim();
  const recommendedAction = String(formData.get('recommendedAction') ?? '').trim();
  const evidence = String(formData.get('evidence') ?? '').trim();
  const openQuestions = String(formData.get('openQuestions') ?? '').trim();
  const contentGapImport = String(formData.get('contentGapImport') ?? '').trim();
  const baselineWinningUrls = String(formData.get('baselineWinningUrls') ?? '').trim();
  const baselineCoreTopics = String(formData.get('baselineCoreTopics') ?? '').trim();
  const baselineExistingKeywords = String(formData.get('baselineExistingKeywords') ?? '').trim();
  const baselinePriorityVerticals = String(formData.get('baselinePriorityVerticals') ?? '').trim();
  const phase1Baseline =
    stepKey === 'phase1-baseline'
      ? {
          winningUrls: parsePhase1WinningUrls(baselineWinningUrls),
          coreTopics: toLines(baselineCoreTopics),
          existingKeywords: toLines(baselineExistingKeywords),
          priorityVerticals: toLines(baselinePriorityVerticals),
        }
      : null;

  if (!projectId || !workflowId || !stepKey || !keyFindings) {
    throw new Error('Project, workflow, step, and artifact findings are required.');
  }

  if (
    stepKey === 'phase1-baseline' &&
    phase1Baseline &&
    phase1Baseline.winningUrls.length === 0 &&
    phase1Baseline.existingKeywords.length === 0
  ) {
    throw new Error('Phase 1 baseline requires existing winning URLs or existing keywords to deduplicate.');
  }

  const contentGapImportRecord =
    stepKey === 'method03-content-gap-import'
      ? await createKeywordWorkflowContentGapImport(projectId, workflowId, {
          rawImport: contentGapImport,
          notes: evidence || summary || undefined,
        })
      : null;

  const summaryPayload =
    summary || contentGapImportRecord || phase1Baseline
      ? {
          ...(summary ? { note: summary } : {}),
          ...(contentGapImportRecord
            ? {
                importedRows: contentGapImportRecord.rowCount,
                contentGapImportId: contentGapImportRecord.id,
              }
            : {}),
          ...(phase1Baseline
            ? {
                trackedUrls: phase1Baseline.winningUrls.length,
                existingKeywordCount: phase1Baseline.existingKeywords.length,
              }
            : {}),
        }
      : undefined;

  const payload: Record<string, unknown> = {
    headline: headline || null,
    keyFindings: toLines(keyFindings),
    recommendedAction: recommendedAction || null,
    evidence: toLines(evidence),
    openQuestions: toLines(openQuestions),
  };

  if (contentGapImportRecord) {
    payload.contentGapImport = {
      id: contentGapImportRecord.id,
      format: contentGapImportRecord.format,
      headers: contentGapImportRecord.headers,
      rowCount: contentGapImportRecord.rowCount,
      createdAt: contentGapImportRecord.createdAt,
    };
  }

  if (phase1Baseline) {
    payload.phase1Baseline = phase1Baseline;
  }

  if (stepKey === 'business-profile') {
    const workflow = await getKeywordWorkflow(projectId, workflowId);
    const latestBusinessProfileArtifact = (workflow.artifacts ?? []).find((artifact) => artifact.stepKey === 'business-profile');
    const seedKeywords = extractBusinessProfileSeedKeywordsFromFindings(toLines(keyFindings));
    const persistedSeedKeywords = seedKeywords.length > 0 ? seedKeywords : readBusinessProfileSeedKeywords(latestBusinessProfileArtifact);

    if (persistedSeedKeywords.length > 0) {
      payload.seedKeywords = persistedSeedKeywords;
    }
  }

  await createKeywordWorkflowArtifact(projectId, workflowId, {
    stepKey,
    summary: summaryPayload,
    payload,
  });

  return {
    projectId,
    workflowId,
    stepKey,
  };
}

async function approveArtifactAction(formData: FormData) {
  'use server';

  const { projectId, workflowId, stepKey } = await persistArtifactFromFormData(formData);
  await approveKeywordWorkflowCheckpoint(projectId, workflowId, stepKey);

  const workflowPath = getWorkflowPath(projectId, workflowId);
  revalidatePath(workflowPath);
  redirect(workflowPath);
}

async function generateBusinessProfileDraftAction(formData: FormData) {
  'use server';

  const projectId = String(formData.get('projectId') ?? '').trim();
  const workflowId = String(formData.get('workflowId') ?? '').trim();
  const stepKey = String(formData.get('stepKey') ?? '').trim();
  const websiteUrl = String(formData.get('websiteUrl') ?? '').trim();
  const businessProfileContext = String(formData.get('businessProfileContext') ?? '').trim();

  if (!projectId || !workflowId || !websiteUrl) {
    throw new Error('Project, workflow, and website URL are required to generate the business profile.');
  }

  if (stepKey !== 'business-profile') {
    throw new Error('Business profile generation is only available for the business-profile step.');
  }

  const openAiApiKey = process.env.OPENAI_API_KEY || (await readWorkspaceEnvValue('OPENAI_API_KEY'));

  if (!openAiApiKey) {
    throw new Error('OPENAI_API_KEY is not configured for business profile generation.');
  }

  let websiteText = '';
  let sourceEvidence = '';

  try {
    websiteText = await fetchWebsiteText(websiteUrl);
    sourceEvidence = `Fetched homepage content automatically from ${websiteUrl}.`;
  } catch (error) {
    if (!businessProfileContext) {
      throw new Error(
        error instanceof Error
          ? `${error.message} Paste homepage or service-page content and try again.`
          : 'Could not fetch website content automatically. Paste homepage or service-page content and try again.',
      );
    }

    sourceEvidence = `Automatic website fetch failed for ${websiteUrl}; generation used strategist-provided source content instead.`;
  }

  const sourceText = [websiteText, businessProfileContext]
    .map((value) => value.trim())
    .filter(Boolean)
    .join('\n\n---\n\n');

  if (!sourceText) {
    throw new Error('Provide source content before generating the business profile draft.');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5.4',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a senior SEO strategist producing a Step 01 business-profile draft for an internal keyword workflow. Use only the supplied source content. Be concise, evidence-based, and return valid JSON only.',
        },
        {
          role: 'user',
          content: [
            `Website URL: ${websiteUrl}`,
            'Analyze the business and return a structured draft with these exact keys:',
            '{',
            '  "summary": "one-sentence business summary",',
            '  "headline": "core positioning statement",',
            '  "brandIdentity": "brand identity and differentiation",',
            '  "toneOfVoice": "tone and communication style",',
            '  "targetMarket": "who they sell to",',
            '  "operationalModel": "how they work or deliver",',
            '  "services": ["specific services or product lines"],',
            '  "geography": "geographic focus",',
            '  "seedKeywords": ["10 to 15 seed keywords grounded in the source content"],',
            '  "recommendedAction": "what the strategist should review next",',
            '  "openQuestions": ["open questions that need manual confirmation"]',
            '}',
            'Source content:',
            sourceText.slice(0, 16000),
          ].join('\n'),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI business profile generation failed with status ${response.status}.`);
  }

  const responsePayload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const rawDraft = responsePayload.choices?.[0]?.message?.content;

  if (!rawDraft) {
    throw new Error('OpenAI returned an empty business profile draft.');
  }

  const generatedDraft = sanitizeGeneratedBusinessProfileDraft(JSON.parse(rawDraft) as Record<string, unknown>);
  const generatedFindings = buildBusinessProfileKeyFindings(generatedDraft);

  if (generatedFindings.length === 0) {
    throw new Error('OpenAI did not return enough structured detail to create the business profile draft.');
  }

  await createKeywordWorkflowArtifact(projectId, workflowId, {
    stepKey: 'business-profile',
    summary: {
      note: generatedDraft.summary || `AI-generated business profile draft for ${websiteUrl}.`,
      websiteUrl,
      source: 'openai-draft',
    },
    payload: {
      headline: generatedDraft.headline || generatedDraft.brandIdentity || null,
      seedKeywords: generatedDraft.seedKeywords,
      keyFindings: generatedFindings,
      recommendedAction:
        generatedDraft.recommendedAction ||
        'Review the generated business profile, adjust the seed keywords, and approve it before moving to seed confirmation.',
      evidence: [
        sourceEvidence,
        ...(businessProfileContext ? ['Included additional strategist-provided source content in the prompt.'] : []),
      ],
      openQuestions: generatedDraft.openQuestions,
      generatedProfile: {
        brandIdentity: generatedDraft.brandIdentity,
        toneOfVoice: generatedDraft.toneOfVoice,
        targetMarket: generatedDraft.targetMarket,
        operationalModel: generatedDraft.operationalModel,
        services: generatedDraft.services,
        geography: generatedDraft.geography,
        seedKeywords: generatedDraft.seedKeywords,
      },
    },
  });

  revalidatePath(`/dashboard/keywords/${projectId}/workflows/${workflowId}`);
}

async function generateSeedKeywordsDraftAction(formData: FormData) {
  'use server';

  const projectId = String(formData.get('projectId') ?? '').trim();
  const workflowId = String(formData.get('workflowId') ?? '').trim();
  const stepKey = String(formData.get('stepKey') ?? '').trim();

  if (!projectId || !workflowId) {
    throw new Error('Project and workflow are required to generate Step 2 seed keywords.');
  }

  if (stepKey !== 'seed-keywords') {
    throw new Error('Seed keyword generation is only available for the seed-keywords step.');
  }

  const workflow = await getKeywordWorkflow(projectId, workflowId);
  const businessProfileArtifacts = (workflow.artifacts ?? []).filter((artifact) => artifact.stepKey === 'business-profile');
  const source = getSeedKeywordStepSource(businessProfileArtifacts);
  const draftValues = getSeedKeywordDraftValues(source);

  if (!source || !draftValues) {
    throw new Error('Generate or approve the business-profile step first so Step 2 can load the seed keywords for confirmation.');
  }

  await createKeywordWorkflowArtifact(projectId, workflowId, {
    stepKey: 'seed-keywords',
    summary: {
      note: draftValues.summary,
      sourceArtifactId: source.sourceArtifactId,
      sourceStep: 'business-profile',
    },
    payload: {
      headline: draftValues.headline,
      keyFindings: toLines(draftValues.keyFindings),
      recommendedAction: draftValues.recommendedAction,
      evidence: toLines(draftValues.evidence),
      openQuestions: toLines(draftValues.openQuestions),
    },
  });

  revalidatePath(`/dashboard/keywords/${projectId}/workflows/${workflowId}`);
}

async function createMethod01ArtifactAction(formData: FormData) {
  'use server';

  const projectId = String(formData.get('projectId') ?? '').trim();
  const workflowId = String(formData.get('workflowId') ?? '').trim();
  const summary = String(formData.get('summary') ?? '').trim();
  const keyFindings = String(formData.get('keyFindings') ?? '').trim();
  const topPageCandidates = String(formData.get('topPageCandidates') ?? '').trim();
  const recommendedAction = String(formData.get('recommendedAction') ?? '').trim();
  const evidence = String(formData.get('evidence') ?? '').trim();
  const openQuestions = String(formData.get('openQuestions') ?? '').trim();
  const selectedCompetitors = formData
    .getAll('sourceCompetitor')
    .map((entry) => JSON.parse(String(entry)) as Record<string, unknown>);

  if (!projectId || !workflowId) {
    throw new Error('Project and workflow are required to generate Method 01.');
  }

  if (selectedCompetitors.length === 0) {
    throw new Error('Select at least one approved direct competitor for Method 01.');
  }

  const automatedTopPageCandidates = getStoredTopPageCandidates(selectedCompetitors);

  if (automatedTopPageCandidates.length === 0) {
    throw new Error('Selected competitors need stored top pages before Method 01 can be generated.');
  }

  const mergedTopPageCandidates = mergeTopPageCandidates(
    automatedTopPageCandidates,
    parseCompetitorTopPages(topPageCandidates),
  );
  const automatedFindings = buildMethod01AutoFindings(selectedCompetitors, mergedTopPageCandidates);
  const combinedEvidence = [...buildMethod01AutoEvidence(selectedCompetitors), ...toLines(evidence)];

  await createKeywordWorkflowArtifact(projectId, workflowId, {
    stepKey: 'method01-competitor-pages',
    summary: {
      note:
        summary ||
        `Auto-generated from ${selectedCompetitors.length} approved direct competitors and ${mergedTopPageCandidates.length} stored top pages.`,
      sourceCompetitorCount: selectedCompetitors.length,
    },
    payload: {
      headline: 'Approved direct competitor source set',
      sourceCompetitors: selectedCompetitors,
      keyFindings: [...automatedFindings, ...toLines(keyFindings)],
      topPageCandidates: mergedTopPageCandidates,
      recommendedAction:
        recommendedAction || 'Review the strongest competitor-page themes and promote the approved patterns into consolidation.',
      evidence: combinedEvidence,
      openQuestions: toLines(openQuestions),
    },
  });

  revalidatePath(`/dashboard/keywords/${projectId}/workflows/${workflowId}`);
}

async function createMethod02ArtifactAction(formData: FormData) {
  'use server';

  const projectId = String(formData.get('projectId') ?? '').trim();
  const workflowId = String(formData.get('workflowId') ?? '').trim();
  const summary = String(formData.get('summary') ?? '').trim();
  const keyFindings = String(formData.get('keyFindings') ?? '').trim();
  const parentTopicCandidates = String(formData.get('parentTopicCandidates') ?? '').trim();
  const questionKeywords = String(formData.get('questionKeywords') ?? '').trim();
  const recommendedAction = String(formData.get('recommendedAction') ?? '').trim();
  const evidence = String(formData.get('evidence') ?? '').trim();
  const openQuestions = String(formData.get('openQuestions') ?? '').trim();
  const selectedSeedKeywords = formData
    .getAll('sourceSeedKeyword')
    .map((entry) => JSON.parse(String(entry)) as Method02SourceKeyword)
    .filter((entry) => entry.keyword.trim().length > 0);

  if (!projectId || !workflowId) {
    throw new Error('Project and workflow are required to generate Method 02.');
  }

  if (selectedSeedKeywords.length === 0) {
    throw new Error('Select at least one source keyword for Method 02.');
  }

  const automatedParentTopicCandidates = buildMethod02ParentTopicCandidates(selectedSeedKeywords);
  const mergedParentTopicCandidates = mergeMethod02ParentTopicCandidates(
    automatedParentTopicCandidates,
    parseMethod02Clusters(parentTopicCandidates),
  );
  const automatedFindings = buildMethod02AutoFindings(selectedSeedKeywords, mergedParentTopicCandidates);
  const combinedEvidence = [...buildMethod02AutoEvidence(selectedSeedKeywords), ...toLines(evidence)];

  await createKeywordWorkflowArtifact(projectId, workflowId, {
    stepKey: 'method02-seed-expansion',
    summary: {
      note:
        summary ||
        `Auto-generated from ${selectedSeedKeywords.length} source keywords and ${mergedParentTopicCandidates.length} parent topic candidates.`,
      sourceSeedKeywordCount: selectedSeedKeywords.length,
    },
    payload: {
      headline: 'Approved seed keyword source set',
      sourceSeedKeywords: selectedSeedKeywords.map((keyword) => keyword.keyword),
      keyFindings: [...automatedFindings, ...toLines(keyFindings)],
      parentTopicCandidates: mergedParentTopicCandidates,
      questionKeywords: toLines(questionKeywords),
      recommendedAction:
        recommendedAction || 'Review the strongest parent topic groupings and merge the approved clusters into consolidation.',
      evidence: combinedEvidence,
      openQuestions: toLines(openQuestions),
    },
  });

  revalidatePath(`/dashboard/keywords/${projectId}/workflows/${workflowId}`);
}

async function createConsolidatedKeywordsArtifactAction(formData: FormData) {
  'use server';

  const projectId = String(formData.get('projectId') ?? '').trim();
  const workflowId = String(formData.get('workflowId') ?? '').trim();
  const sourceArtifacts = formData
    .getAll('sourceArtifact')
    .map((entry) => JSON.parse(String(entry)) as Record<string, unknown>);

  if (!projectId || !workflowId) {
    throw new Error('Project and workflow are required to generate consolidated keywords.');
  }

  if (sourceArtifacts.length === 0) {
    throw new Error('Approve at least one workflow source before generating consolidated keywords.');
  }

  const { consolidatedKeywords, duplicateExistingKeywords } = buildConsolidatedKeywordsPayload(sourceArtifacts);

  if (consolidatedKeywords.length === 0) {
    throw new Error('No consolidatable keywords were found in the approved workflow sources.');
  }

  await createKeywordWorkflowArtifact(projectId, workflowId, {
    stepKey: 'consolidated-keywords',
    summary: {
      note: `Auto-generated consolidated ledger with ${consolidatedKeywords.length} kept keywords from ${sourceArtifacts.length} approved workflow checkpoints.`,
      sourceArtifactCount: sourceArtifacts.length,
      keptKeywordCount: consolidatedKeywords.length,
      duplicateExistingKeywordCount: duplicateExistingKeywords.length,
    },
    payload: {
      headline: 'Consolidated keyword ledger',
      consolidatedKeywords,
      duplicateExistingKeywords,
      sourceArtifacts: sourceArtifacts.map((artifact) => ({
        id: artifact.id,
        stepKey: artifact.stepKey,
      })),
      recommendedAction: 'Review the kept keyword ledger and approve it before topical map generation.',
      evidence: sourceArtifacts.map((artifact) => {
        const stepKey = typeof artifact.stepKey === 'string' ? artifact.stepKey : 'unknown-step';
        return `${stepKey} | Approved checkpoint`;
      }),
      openQuestions: [],
    },
  });

  revalidatePath(`/dashboard/keywords/${projectId}/workflows/${workflowId}`);
}

async function createTopicalMapArtifactAction(formData: FormData) {
  'use server';

  const projectId = String(formData.get('projectId') ?? '').trim();
  const workflowId = String(formData.get('workflowId') ?? '').trim();
  const sourceArtifact = JSON.parse(String(formData.get('sourceArtifact') ?? '{}')) as Record<string, unknown>;

  if (!projectId || !workflowId) {
    throw new Error('Project and workflow are required to generate the topical map.');
  }

  const { primaryTopics, contentBriefQueue, rolloutPriorities } = buildTopicalMapPayload(sourceArtifact);

  if (primaryTopics.length === 0 || contentBriefQueue.length === 0) {
    throw new Error('Approve a consolidated keyword ledger with kept keywords before generating the topical map.');
  }

  await createKeywordWorkflowArtifact(projectId, workflowId, {
    stepKey: 'topical-map',
    summary: {
      note: `Auto-generated topical map with ${primaryTopics.length} pillars and ${contentBriefQueue.length} mapped keywords from the approved consolidated ledger.`,
      pillarCount: primaryTopics.length,
      mappedKeywordCount: contentBriefQueue.length,
      sourceArtifactId: typeof sourceArtifact.id === 'string' ? sourceArtifact.id : null,
    },
    payload: {
      headline: 'Workflow topical map draft',
      primaryTopics,
      contentBriefQueue,
      rolloutPriorities,
      sourceArtifacts: [
        {
          id: sourceArtifact.id,
          stepKey: sourceArtifact.stepKey,
        },
      ],
      recommendedAction:
        'Review the pillar and cluster structure, then approve the topical map before generating content briefs.',
      evidence: [
        `${typeof sourceArtifact.stepKey === 'string' ? sourceArtifact.stepKey : 'unknown-step'} | Approved checkpoint`,
      ],
      openQuestions: [],
    },
  });

  revalidatePath(`/dashboard/keywords/${projectId}/workflows/${workflowId}`);
}

async function createContentBriefArtifactAction(formData: FormData) {
  'use server';

  const projectId = String(formData.get('projectId') ?? '').trim();
  const workflowId = String(formData.get('workflowId') ?? '').trim();
  const language = String(formData.get('language') ?? 'en').trim();
  const country = String(formData.get('country') ?? '').trim().toLowerCase();
  const editorialNotes = String(formData.get('editorialNotes') ?? '').trim();
  const selectedQueueKey = String(formData.get('selectedQueueKey') ?? '').trim();
  const sourceArtifact = JSON.parse(String(formData.get('sourceArtifact') ?? '{}')) as Record<string, unknown>;
  const queueEntry = getContentBriefQueue(sourceArtifact).find(
    (entry) => `${entry.pillar}::${entry.keyword}` === selectedQueueKey,
  );

  if (!queueEntry) {
    throw new Error('Select an approved topical-map queue entry before generating a content brief checkpoint.');
  }

  const keyword = typeof queueEntry.keyword === 'string' ? queueEntry.keyword.trim() : '';
  const pillar = typeof queueEntry.pillar === 'string' ? queueEntry.pillar.trim() : '';
  const contentType = queueEntry.contentType === 'pillar' ? 'pillar' : 'cluster';
  const suggestedUrlPath =
    typeof queueEntry.suggestedUrlPath === 'string' && queueEntry.suggestedUrlPath.trim().length > 0
      ? queueEntry.suggestedUrlPath.trim()
      : null;
  const sourceMethods = Array.isArray(queueEntry.sourceMethods)
    ? queueEntry.sourceMethods.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];
  const sourceArtifactIds = Array.isArray(queueEntry.sourceArtifactIds)
    ? queueEntry.sourceArtifactIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];
  const existingCoverageUrl =
    typeof queueEntry.existingCoverageUrl === 'string' && queueEntry.existingCoverageUrl.trim().length > 0
      ? queueEntry.existingCoverageUrl.trim()
      : null;

  if (!projectId || !workflowId || !keyword || !pillar || !country) {
    throw new Error('Project, workflow, market, and content brief target are required.');
  }

  await createKeywordWorkflowArtifact(projectId, workflowId, {
    stepKey: 'content-brief',
    summary: {
      note: `Auto-generated content brief input for ${keyword} from the approved topical map.`,
      targetKeyword: keyword,
      sourceArtifactId: typeof sourceArtifact.id === 'string' ? sourceArtifact.id : null,
    },
    payload: {
      headline: `Content brief input for ${keyword}`,
      targetKeyword: keyword,
      pillar,
      contentType,
      suggestedUrlPath,
      market: {
        language,
        country,
      },
      titleOptions: buildContentBriefTitleOptions(keyword, pillar, country, contentType),
      briefOutline: buildContentBriefOutline(keyword, pillar, contentType),
      researchContext: {
        sourceMethods,
        sourceArtifactIds: Array.from(
          new Set([
            ...sourceArtifactIds,
            ...(typeof sourceArtifact.id === 'string' ? [sourceArtifact.id] : []),
          ]),
        ),
        existingCoverageUrl,
      },
      internalLinkTargets: Array.from(new Set([suggestedUrlPath, existingCoverageUrl].filter((value): value is string => Boolean(value)))),
      editorialNotes: toLines(editorialNotes),
      sourceArtifacts: [
        {
          id: sourceArtifact.id,
          stepKey: sourceArtifact.stepKey,
        },
      ],
      recommendedAction: 'Review the brief inputs and approve them before article generation.',
      evidence: [
        `${typeof sourceArtifact.stepKey === 'string' ? sourceArtifact.stepKey : 'unknown-step'} | Approved checkpoint`,
        `${keyword} | ${contentType} | ${suggestedUrlPath ?? 'no suggested URL'}`,
      ],
      openQuestions: [],
    },
  });

  revalidatePath(`/dashboard/keywords/${projectId}/workflows/${workflowId}`);
}

async function createContentArticleArtifactAction(formData: FormData) {
  'use server';

  const projectId = String(formData.get('projectId') ?? '').trim();
  const workflowId = String(formData.get('workflowId') ?? '').trim();
  const selectedTitle = String(formData.get('selectedTitle') ?? '').trim();
  const articleNotes = String(formData.get('articleNotes') ?? '').trim();
  const sourceArtifact = JSON.parse(String(formData.get('sourceArtifact') ?? '{}')) as Record<string, unknown>;
  const briefSource = getContentBriefSource(sourceArtifact);

  if (!projectId || !workflowId || !briefSource) {
    throw new Error('Project, workflow, and approved content brief are required to generate the article input.');
  }

  const marketCountry = briefSource.market.country || 'ae';
  const titleOptions =
    briefSource.titleOptions.length > 0
      ? briefSource.titleOptions
      : buildContentBriefTitleOptions(
          briefSource.targetKeyword,
          briefSource.pillar,
          marketCountry,
          briefSource.contentType,
        );
  const resolvedTitle = titleOptions.includes(selectedTitle) ? selectedTitle : titleOptions[0];
  const articleSections = buildContentArticleSectionPlan(
    briefSource.targetKeyword,
    briefSource.pillar,
    briefSource.contentType,
    briefSource.briefOutline,
  );
  const draftChecklist = buildContentArticleDraftChecklist(
    briefSource.targetKeyword,
    briefSource.contentType,
    briefSource.suggestedUrlPath,
    briefSource.internalLinkTargets,
  );
  const combinedEditorialNotes = [...briefSource.editorialNotes, ...toLines(articleNotes)];

  await createKeywordWorkflowArtifact(projectId, workflowId, {
    stepKey: 'content-article',
    summary: {
      note: `Auto-generated article input for ${briefSource.targetKeyword} from the approved content brief.`,
      targetKeyword: briefSource.targetKeyword,
      sourceArtifactId: typeof sourceArtifact.id === 'string' ? sourceArtifact.id : null,
    },
    payload: {
      headline: `Content article input for ${briefSource.targetKeyword}`,
      targetKeyword: briefSource.targetKeyword,
      pillar: briefSource.pillar,
      contentType: briefSource.contentType,
      title: resolvedTitle,
      titleOptions,
      suggestedUrlPath: briefSource.suggestedUrlPath,
      market: briefSource.market,
      articleSections,
      draftChecklist,
      internalLinkTargets: briefSource.internalLinkTargets,
      researchContext: briefSource.researchContext,
      editorialNotes: combinedEditorialNotes,
      sourceArtifacts: [
        {
          id: sourceArtifact.id,
          stepKey: sourceArtifact.stepKey,
        },
      ],
      recommendedAction:
        'Review the article input and approve it before handing the draft into queue-backed generation or persistence.',
      evidence: [
        `${typeof sourceArtifact.stepKey === 'string' ? sourceArtifact.stepKey : 'unknown-step'} | Approved checkpoint`,
        `${briefSource.targetKeyword} | ${resolvedTitle}`,
      ],
      openQuestions: [],
    },
  });

  revalidatePath(`/dashboard/keywords/${projectId}/workflows/${workflowId}`);
}

async function createCompetitorAction(formData: FormData) {
  'use server';

  const projectId = String(formData.get('projectId') ?? '').trim();
  const workflowId = String(formData.get('workflowId') ?? '').trim();
  const domain = String(formData.get('domain') ?? '').trim();
  const bucket = String(formData.get('bucket') ?? 'UNCLASSIFIED').trim() as 'DIRECT' | 'ORGANIC' | 'UNCLASSIFIED';
  const status = String(formData.get('status') ?? 'APPROVED').trim() as 'CANDIDATE' | 'APPROVED' | 'REJECTED';
  const rationale = String(formData.get('rationale') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();

  if (!projectId || !workflowId || !domain) {
    throw new Error('Project, workflow, and competitor domain are required.');
  }

  await createKeywordWorkflowCompetitor(projectId, workflowId, {
    domain,
    bucket,
    status,
    rationale: rationale || undefined,
    notes: notes || undefined,
  });

  revalidatePath(`/dashboard/keywords/${projectId}/workflows/${workflowId}`);
}

async function saveCompetitorMetricsAction(formData: FormData) {
  'use server';

  const projectId = String(formData.get('projectId') ?? '').trim();
  const workflowId = String(formData.get('workflowId') ?? '').trim();
  const competitorId = String(formData.get('competitorId') ?? '').trim();
  const topPages = String(formData.get('topPages') ?? '').trim();
  const capturedAt = String(formData.get('capturedAt') ?? '').trim();

  if (!projectId || !workflowId || !competitorId) {
    throw new Error('Project, workflow, and competitor are required to save metrics.');
  }

  await upsertKeywordWorkflowCompetitorMetrics(projectId, workflowId, competitorId, {
    domainRating: parseMetricValue(formData.get('domainRating'), 'Domain rating'),
    organicTraffic: parseMetricValue(formData.get('organicTraffic'), 'Organic traffic'),
    organicKeywords: parseMetricValue(formData.get('organicKeywords'), 'Organic keywords'),
    referringDomains: parseMetricValue(formData.get('referringDomains'), 'Referring domains'),
    backlinks: parseMetricValue(formData.get('backlinks'), 'Backlinks'),
    topPages: parseCompetitorTopPages(topPages),
    capturedAt: capturedAt || undefined,
  });

  revalidatePath(`/dashboard/keywords/${projectId}/workflows/${workflowId}`);
}

async function reviewCheckpointAction(formData: FormData) {
  'use server';

  const projectId = String(formData.get('projectId') ?? '').trim();
  const workflowId = String(formData.get('workflowId') ?? '').trim();
  const stepKey = String(formData.get('stepKey') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();
  const decision = String(formData.get('decision') ?? '').trim();

  if (!projectId || !workflowId || !stepKey || !decision) {
    throw new Error('Project, workflow, step, and decision are required.');
  }

  if (decision === 'APPROVED') {
    await approveKeywordWorkflowCheckpoint(projectId, workflowId, stepKey, notes || undefined);
  } else if (decision === 'REVISION_REQUESTED') {
    await requestKeywordWorkflowRevision(projectId, workflowId, stepKey, notes || undefined);
  } else if (decision === 'REJECTED') {
    await rejectKeywordWorkflowCheckpoint(projectId, workflowId, stepKey, notes || undefined);
  } else {
    throw new Error('Unsupported checkpoint decision.');
  }

  const workflowPath = getWorkflowPath(projectId, workflowId);
  revalidatePath(workflowPath);

  if (decision === 'APPROVED') {
    redirect(workflowPath);
  }
}

export default async function KeywordWorkflowPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; workflowId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { projectId, workflowId } = await params;
  const { step: stepParam } = await searchParams;
  const project = await getKeywordProject(projectId);
  const workflow = await getKeywordWorkflow(projectId, workflowId);
  const latestArtifacts = getLatestArtifacts(workflow.artifacts);
  const businessProfileArtifacts = (workflow.artifacts ?? []).filter((artifact) => artifact.stepKey === 'business-profile');
  const seedKeywordArtifacts = (workflow.artifacts ?? []).filter((artifact) => artifact.stepKey === 'seed-keywords');
  const latestBusinessProfileArtifact = businessProfileArtifacts[0];
  const businessProfileDraftValues = getArtifactFormDraftValues(latestBusinessProfileArtifact);
  const seedKeywordStepSource = getSeedKeywordStepSource(businessProfileArtifacts);
  const seedKeywordDraftValues = getSeedKeywordDraftValues(seedKeywordStepSource);
  const serpNicheMapStepSource = getSerpNicheMapStepSource(seedKeywordArtifacts);
  const serpNicheMapDraftValues = getSerpNicheMapDraftValues(serpNicheMapStepSource);
  const workflowStepCandidate = String(workflow.currentCheckpoint ?? workflow.currentStep ?? '').trim();
  const workflowStepKey = isWorkflowStepKey(workflowStepCandidate) ? workflowStepCandidate : null;
  const stepParamTrimmed = stepParam?.trim() ?? '';
  const stepParamKey = isWorkflowStepKey(stepParamTrimmed) ? stepParamTrimmed : null;
  const editableStepKey: (typeof WORKFLOW_STEPS)[number] = workflowStepKey ?? WORKFLOW_STEPS[0];
  const currentStepKey: (typeof WORKFLOW_STEPS)[number] = stepParamKey ?? editableStepKey;
  const isReadOnlyStepView = currentStepKey !== editableStepKey;
  const latestArtifactsByStep = new Map(latestArtifacts.map((artifact) => [artifact.stepKey, artifact]));
  const nextStepKey = editableStepKey
    ? (WORKFLOW_STEPS[WORKFLOW_STEPS.indexOf(editableStepKey) + 1] ?? null)
    : (WORKFLOW_STEPS.find((stepKey) => latestArtifactsByStep.get(stepKey)?.status !== 'APPROVED') ?? null);
  const completedStepCount = WORKFLOW_STEPS.filter(
    (stepKey) => latestArtifactsByStep.get(stepKey)?.status === 'APPROVED',
  ).length;
  const wizardSteps: Array<{
    index: number;
    stepKey: (typeof WORKFLOW_STEPS)[number];
    title: string;
    description: string;
    visualStatus: WorkflowStepVisualStatus;
    statusLabel: string;
    badgeTone: string;
    markerTone: string;
  }> = WORKFLOW_STEPS.map((stepKey, index) => {
    const artifact = latestArtifactsByStep.get(stepKey);
    const visualStatus = getWorkflowStepVisualStatus({
      stepKey,
      currentStepKey: editableStepKey,
      nextStepKey,
      artifactStatus: artifact?.status ?? null,
    });

    return {
      index,
      stepKey,
      title: formatWorkflowStepLabel(stepKey),
      description: getWorkflowStepDescription(stepKey),
      visualStatus,
      statusLabel: getWorkflowStepStatusLabel(visualStatus),
      badgeTone: getWizardBadgeTone(visualStatus),
      markerTone: getWizardMarkerTone(visualStatus),
    };
  });
  const latestSaveStateByStep = Object.fromEntries(
    latestArtifacts.map((artifact) => [
      artifact.stepKey,
      {
        saved: true,
        status: artifact.status,
      },
    ]),
  );
  const activeArtifact = currentStepKey ? latestArtifactsByStep.get(currentStepKey) ?? null : latestArtifacts[0] ?? null;
  const secondaryCheckpointArtifacts = latestArtifacts.filter((artifact) => artifact.id !== activeArtifact?.id);
  const artifactHistory = getArtifactHistory(workflow.artifacts);
  const approvedDirectCompetitors = (workflow.competitors ?? []).filter(
    (competitor) => competitor.bucket === 'DIRECT' && competitor.status === 'APPROVED',
  );
  const approvedPhase1Artifact = getLatestApprovedArtifact(workflow.artifacts, 'phase1-baseline');
  const approvedMethod01Artifact = getLatestApprovedArtifact(workflow.artifacts, 'method01-competitor-pages');
  const approvedMethod02Artifact = getLatestApprovedArtifact(workflow.artifacts, 'method02-seed-expansion');
  const approvedMethod03Artifact = getLatestApprovedArtifact(workflow.artifacts, 'method03-content-gap-import');
  const approvedConsolidatedArtifact = getLatestApprovedArtifact(workflow.artifacts, 'consolidated-keywords');
  const approvedTopicalMapArtifact = getLatestApprovedArtifact(workflow.artifacts, 'topical-map');
  const approvedContentBriefArtifact = getLatestApprovedArtifact(workflow.artifacts, 'content-brief');
  const consolidationSourceArtifacts = [
    approvedPhase1Artifact,
    approvedMethod01Artifact,
    approvedMethod02Artifact,
    approvedMethod03Artifact,
  ].filter((artifact): artifact is KeywordWorkflowArtifact => Boolean(artifact));
  const discoveredMethod02Keywords = (project.keywords ?? [])
    .filter((keyword) => !keyword.workflowRunId)
    .filter((keyword) => keyword.dedupeStatus === 'KEPT' && keyword.approvalStatus !== 'REJECTED')
    .map((keyword) => ({
      keyword: keyword.keyword,
      parentTopic: keyword.parentTopic,
      searchVolume: keyword.searchVolume,
      intent: keyword.intent,
      funnel: keyword.funnel,
      sourceMethods: keyword.sourceMethods ?? [],
      approvalStatus: keyword.approvalStatus,
      dedupeStatus: keyword.dedupeStatus,
      source: 'project-keywords' as const,
    }));
  const sourceMethod02Keywords =
    discoveredMethod02Keywords.length > 0
      ? discoveredMethod02Keywords
      : (project.seedKeywords ?? []).map((seedKeyword) => ({
          keyword: seedKeyword,
          parentTopic: null,
          searchVolume: null,
          intent: null,
          funnel: null,
          sourceMethods: [],
          approvalStatus: null,
          dedupeStatus: 'KEPT',
          source: 'project-seeds' as const,
        }));
  const method02UsesDiscoveredKeywords = discoveredMethod02Keywords.length > 0;
  const approvedContentBriefQueue = getContentBriefQueue(approvedTopicalMapArtifact);
  const approvedContentBrief = getContentBriefSource(approvedContentBriefArtifact);
  const persistedWorkflowKeywords = workflow.persistedKeywords ?? [];
  const persistedTopicalMap = workflow.persistedTopicalMaps?.[0] ?? null;
  const persistedContentPieces = (
    workflow as typeof workflow & { persistedContentPieces?: PersistedWorkflowContentPiece[] }
  ).persistedContentPieces ?? [];
  const persistedTopicalMapPrimaryTopics =
    persistedTopicalMap && Array.isArray(persistedTopicalMap.structure.primaryTopics)
      ? persistedTopicalMap.structure.primaryTopics
      : [];
  const persistedKeywordsById = new Map(persistedWorkflowKeywords.map((keyword) => [keyword.id, keyword]));
  const keywordLedgerCsv = persistedWorkflowKeywords.length > 0 ? buildKeywordLedgerCsv(persistedWorkflowKeywords) : null;
  const keywordLedgerDownloadHref = keywordLedgerCsv
    ? `data:text/csv;charset=utf-8,${encodeURIComponent(keywordLedgerCsv)}`
    : null;
  const persistedTopicalMapJson = persistedTopicalMap ? JSON.stringify(persistedTopicalMap.structure, null, 2) : null;
  const persistedTopicalMapDownloadHref = persistedTopicalMapJson
    ? `data:application/json;charset=utf-8,${encodeURIComponent(persistedTopicalMapJson)}`
    : null;
  const contentArticleTitleOptions = approvedContentBrief
    ? approvedContentBrief.titleOptions.length > 0
      ? approvedContentBrief.titleOptions
      : buildContentBriefTitleOptions(
          approvedContentBrief.targetKeyword,
          approvedContentBrief.pillar,
          approvedContentBrief.market.country || workflow.country,
          approvedContentBrief.contentType,
        )
    : [];
  const PHASE_GROUPS: Record<number, string> = { 0: 'Discovery', 5: 'Research', 9: 'Synthesis', 11: 'Content' };

  const workflowWizard = (
    <section className="w-full rounded-xl border border-[#E8EAF0] bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-[#111827]">Keyword research steps</h2>
      </div>

      <div className="mt-5 grid gap-3 rounded-xl border border-[#E4E7EC] bg-[#FCFCFD] p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">Completed</p>
          <p className="mt-1 text-2xl font-semibold text-[#111827]">
            {completedStepCount}
            <span className="text-base font-medium text-[#667085]">/{WORKFLOW_STEPS.length}</span>
          </p>
          <p className="mt-0.5 text-xs text-[#9CA3AF]">
            {completedStepCount === WORKFLOW_STEPS.length
              ? 'All steps complete'
              : `${WORKFLOW_STEPS.length - completedStepCount} step${WORKFLOW_STEPS.length - completedStepCount === 1 ? '' : 's'} remaining`}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-0">
        {wizardSteps.map((step, index) => (
          <Fragment key={step.stepKey}>
            {PHASE_GROUPS[index] !== undefined ? (
              <p className={`${index === 0 ? '' : 'mt-3 pt-3 '}text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF]`}>
                {PHASE_GROUPS[index]}
              </p>
            ) : null}
            <Link
              href={`/dashboard/keywords/${projectId}/workflows/${workflowId}?step=${step.stepKey}`}
              className="group relative -mx-2 flex gap-3 rounded-lg px-2 py-1 outline-none transition-colors hover:bg-[#FCFCFD] focus-visible:bg-[#FCFCFD] focus-visible:ring-2 focus-visible:ring-[#DA304F]/25"
            >
              <div className="flex flex-col items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${step.markerTone}`}>
                  {index + 1}
                </div>
                {index < wizardSteps.length - 1 ? (
                  <div className={`min-h-[26px] w-px ${step.visualStatus === 'complete' ? 'bg-[#12B76A]' : 'bg-[#E4E7EC]'}`} />
                ) : null}
              </div>

              <div className="min-w-0 flex-1 pb-5">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <p className="min-w-0 truncate text-sm font-medium text-[#111827]">{step.title}</p>

                    <div className="pointer-events-none absolute left-0 top-full z-20 mt-1.5 w-56 rounded-lg border border-[#E8EAF0] bg-white px-3 py-2 text-xs leading-5 text-[#4B5563] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                      {step.description}
                    </div>
                  </div>
                  <span
                    className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${step.badgeTone}`}
                    aria-label={step.statusLabel}
                  >
                    <WorkflowStatusIcon status={step.visualStatus} />
                  </span>
                </div>
              </div>
            </Link>
          </Fragment>
        ))}
      </div>
    </section>
  );
  const collapsedWorkflowWizard = <CollapsedWorkflowRail steps={wizardSteps} projectId={projectId} workflowId={workflowId} />;

  const currentStepWorkspaceTitle = currentStepKey
    ? `${formatWorkflowStepLabel(currentStepKey)} workspace`
    : 'Current step workspace';
  const currentEditableStepLabel = formatWorkflowStepLabel(editableStepKey);
  const businessProfileGenerateFormId = 'business-profile-generate-form';
  const seedKeywordsGenerateFormId = 'seed-keywords-generate-form';
  const showBusinessProfileWorkspace = currentStepKey === 'business-profile';
  const showSeedKeywordsWorkspace = currentStepKey === 'seed-keywords';
  const canAutoGenerateCurrentStep = !isReadOnlyStepView && [
    'serp-niche-map',
    'competitor-buckets',
    'competitor-metrics',
    'phase1-baseline',
    'method01-competitor-pages',
    'method02-seed-expansion',
    'method03-content-gap-import',
  ].includes(currentStepKey ?? '');
  const lockedStepHeaderIndicator = isReadOnlyStepView ? (
    <div className="flex shrink-0 flex-col items-end gap-2">
      <span
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E4E7EC] bg-[#FCFCFD] text-[#667085]"
        aria-label={`Locked step. Only ${currentEditableStepLabel} can be edited or regenerated right now.`}
        title={`Locked step. Only ${currentEditableStepLabel} can be edited or regenerated right now.`}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V8a4.5 4.5 0 1 0-9 0v2.5" />
          <rect x="5.25" y="10.5" width="13.5" height="10.5" rx="2.25" strokeLinecap="round" strokeLinejoin="round" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14.25v3" />
        </svg>
      </span>

      {activeArtifact?.status ? (
        <span className="rounded-full bg-[#EEF4FF] px-3 py-1 text-xs font-medium text-[#3538CD]">
          {activeArtifact.status.replaceAll('_', ' ')}
        </span>
      ) : null}
    </div>
  ) : null;
  const autoGenerateHeaderControl = canAutoGenerateCurrentStep ? (
    <GenerateStepButton projectId={projectId} workflowId={workflowId} stepKey={currentStepKey ?? ''} variant="inline" />
  ) : null;
  const businessProfileHeaderControl = !isReadOnlyStepView && showBusinessProfileWorkspace ? (
    <button
      type="submit"
      form={businessProfileGenerateFormId}
      formNoValidate
      className="shrink-0 rounded-lg bg-[#6366F1] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#4F46E5]"
    >
      Generate
    </button>
  ) : null;
  const seedKeywordsHeaderControl = !isReadOnlyStepView && showSeedKeywordsWorkspace ? (
    <button
      type="submit"
      form={seedKeywordsGenerateFormId}
      formNoValidate
      disabled={!seedKeywordStepSource}
      title={
        seedKeywordStepSource
          ? 'Generate the Step 2 seed-keywords draft from the latest business-profile checkpoint.'
          : 'Generate or approve the business-profile step first to enable Step 2 generation.'
      }
      className="shrink-0 rounded-lg bg-[#6366F1] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#4F46E5] disabled:cursor-not-allowed disabled:bg-[#98A2B3]"
    >
      Generate
    </button>
  ) : null;
  const businessProfileHeaderDisclosure = !isReadOnlyStepView && showBusinessProfileWorkspace ? (
    <form id={businessProfileGenerateFormId} action={generateBusinessProfileDraftAction} className="mt-4">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="workflowId" value={workflowId} />
      <input type="hidden" name="stepKey" value="business-profile" />
      <input type="hidden" name="websiteUrl" value={project.websiteUrl} />

      <CollapsiblePanel
        title="Optional supporting content"
        className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-4"
      >
        <p className="mt-2 text-sm text-[#667085]">
          Add extra homepage or service-page copy here when you want the draft generator to use more context than the automatic website fetch alone.
        </p>
        <p className="mt-2 text-xs text-[#667085]">Source website: {project.websiteUrl}</p>

        <div className="mt-4">
          <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="businessProfileContext">
            Supporting content
          </label>
          <textarea
            id="businessProfileContext"
            name="businessProfileContext"
            rows={6}
            placeholder="Paste homepage or service-page content here if you want to supplement the automatic website fetch."
            className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
          />
          <p className="mt-2 text-xs text-[#667085]">
            Use this when the homepage alone is thin or when the main service page has the details you want the generated draft to reflect.
          </p>
        </div>
      </CollapsiblePanel>
    </form>
  ) : null;
  const seedKeywordsHeaderGenerationForm = !isReadOnlyStepView && showSeedKeywordsWorkspace ? (
    <form id={seedKeywordsGenerateFormId} action={generateSeedKeywordsDraftAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="workflowId" value={workflowId} />
      <input type="hidden" name="stepKey" value="seed-keywords" />
    </form>
  ) : null;
  const showCompetitorBucketsWorkspace = currentStepKey === 'competitor-buckets';
  const showCompetitorMetricsWorkspace = currentStepKey === 'competitor-metrics';
  const showMethod01Workspace = currentStepKey === 'method01-competitor-pages';
  const showMethod02Workspace = currentStepKey === 'method02-seed-expansion';
  const showMethod03Workspace = currentStepKey === 'method03-content-gap-import';
  const showConsolidatedKeywordsWorkspace = currentStepKey === 'consolidated-keywords';
  const showTopicalMapWorkspace = currentStepKey === 'topical-map';
  const showContentBriefWorkspace = currentStepKey === 'content-brief';
  const showContentArticleWorkspace = currentStepKey === 'content-article';
  const showGenericArtifactWorkspace =
    !showCompetitorBucketsWorkspace &&
    !showCompetitorMetricsWorkspace &&
    !showMethod01Workspace &&
    !showMethod02Workspace &&
    !showMethod03Workspace &&
    !showConsolidatedKeywordsWorkspace &&
    !showTopicalMapWorkspace &&
    !showContentBriefWorkspace &&
    !showContentArticleWorkspace;
  const isGenericEditableView = showGenericArtifactWorkspace && !isReadOnlyStepView;

  const currentStepArtifactForm = (
    <WorkflowArtifactForm
      action={approveArtifactAction}
      projectId={projectId}
      workflowId={workflowId}
      defaultStep={currentStepKey ?? 'business-profile'}
      lockedStep
      readOnly={isReadOnlyStepView}
      seedKeywordStepSource={seedKeywordStepSource}
      initialValuesByStep={
        businessProfileDraftValues || seedKeywordDraftValues || serpNicheMapDraftValues
          ? {
              ...(businessProfileDraftValues ? { 'business-profile': businessProfileDraftValues } : {}),
              ...(seedKeywordDraftValues ? { 'seed-keywords': seedKeywordDraftValues } : {}),
              ...(serpNicheMapDraftValues ? { 'serp-niche-map': serpNicheMapDraftValues } : {}),
            }
          : undefined
      }
    />
  );
  const usesArtifactFormApprovalFlow = !isReadOnlyStepView && showGenericArtifactWorkspace;
  const activeArtifactPayload = getRenderableArtifactPayload(activeArtifact);
  const showsInlineCheckpointOutput =
    isReadOnlyStepView ||
    isGenericEditableView ||
    showCompetitorBucketsWorkspace ||
    showCompetitorMetricsWorkspace ||
    showMethod01Workspace ||
    showMethod02Workspace ||
    showMethod03Workspace ||
    showContentBriefWorkspace ||
    showContentArticleWorkspace;

  const activeJobForCurrentStep = currentStepKey ? (workflow.activeJobs?.[currentStepKey] ?? null) : null;

  const activeCheckpointReview = (
    <div className={isReadOnlyStepView ? 'mt-6 space-y-4' : 'mt-6 rounded-xl border border-[#E4E7EC] bg-[#FCFCFD] p-5'}>
      {!isReadOnlyStepView ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-[#111827]">
              {isGenericEditableView ? 'Output' : usesArtifactFormApprovalFlow ? 'Latest checkpoint preview' : 'Approve current checkpoint'}
            </h3>
            <p className="mt-1 text-sm text-[#667085]">
              {isGenericEditableView
                ? 'Review the latest saved checkpoint first. Expand Input only when you need to edit the step or add more generation context.'
                : usesArtifactFormApprovalFlow
                ? 'Approving from the step form saves the current edits and moves the workflow to the next step. Review the latest persisted output here if you need a reference.'
                : 'Review the latest persisted output here before approving the workflow step and continuing.'}
            </p>
          </div>

          {activeArtifact ? (
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#344054]">
                {isWorkflowStepKey(activeArtifact.stepKey) ? formatWorkflowStepLabel(activeArtifact.stepKey) : activeArtifact.stepKey}
              </span>
              <span className="rounded-full bg-[#EEF4FF] px-3 py-1 text-xs font-medium text-[#3538CD]">
                {activeArtifact.status.replaceAll('_', ' ')}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {!activeArtifact ? (
        <div className={isReadOnlyStepView ? 'rounded-lg border border-[#E4E7EC] bg-white p-4' : 'mt-4 rounded-lg border border-[#E4E7EC] bg-white p-4'}>
          {!isReadOnlyStepView && activeJobForCurrentStep ? (
            <div className="flex items-center gap-3">
              <svg className="h-4 w-4 shrink-0 animate-spin text-[#667085]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-[#667085]">Please wait while the data from the previous steps loads.</p>
            </div>
          ) : (
            <p className="text-sm text-[#667085]">
              {isReadOnlyStepView
                ? 'No checkpoint has been saved for this step yet.'
                : isGenericEditableView
                  ? 'No checkpoint has been saved for this step yet. Use Generate in the header or expand Input below to create the first checkpoint.'
                : usesArtifactFormApprovalFlow
                  ? 'Approve the step from the form above to persist the current edits and continue.'
                  : 'Generate or update a checkpoint for the current step before approving it.'}
            </p>
          )}
        </div>
      ) : (
        <>
          {activeArtifact.approvals?.[0] && !isReadOnlyStepView ? (
            <div className="mt-4 rounded-lg border border-[#E4E7EC] bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">Latest decision</p>
              <p className="mt-2 text-sm font-medium text-[#111827]">{activeArtifact.approvals[0].decision.replaceAll('_', ' ')}</p>
              {activeArtifact.approvals[0].notes ? (
                <p className="mt-2 text-sm text-[#667085]">{activeArtifact.approvals[0].notes}</p>
              ) : null}
            </div>
          ) : null}

          {!isReadOnlyStepView && (!usesArtifactFormApprovalFlow || isGenericEditableView) ? (
            <form action={reviewCheckpointAction} className="mt-4 grid gap-3 rounded-lg border border-[#E4E7EC] bg-white p-4">
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="workflowId" value={workflowId} />
              <input type="hidden" name="stepKey" value={activeArtifact.stepKey} />

              <div>
                <label
                  className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]"
                  htmlFor={`active-notes-${activeArtifact.id}`}
                >
                  Review note
                </label>
                <textarea
                  id={`active-notes-${activeArtifact.id}`}
                  name="notes"
                  rows={3}
                  placeholder="Optional checkpoint note"
                  className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  name="decision"
                  value="APPROVED"
                  className="rounded-lg bg-[#101828] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1D2939]"
                >
                  Approve
                </button>
                <button
                  type="submit"
                  name="decision"
                  value="REVISION_REQUESTED"
                  className="rounded-lg border border-[#D0D5DD] bg-white px-4 py-2 text-sm font-medium text-[#344054] transition hover:bg-[#F9FAFB]"
                >
                  Request revision
                </button>
                <button
                  type="submit"
                  name="decision"
                  value="REJECTED"
                  className="rounded-lg border border-[#F04438] bg-white px-4 py-2 text-sm font-medium text-[#B42318] transition hover:bg-[#FFF5F5]"
                >
                  Reject
                </button>
              </div>
            </form>
          ) : null}

          {hasArtifactPayloadContent(activeArtifactPayload) && !showCompetitorBucketsWorkspace && !showCompetitorMetricsWorkspace && !showBusinessProfileWorkspace && !showMethod01Workspace ? (
            showsInlineCheckpointOutput ? (
              <div className="rounded-lg border border-[#E4E7EC] bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">
                  {isReadOnlyStepView ? 'Approved checkpoint details' : 'Latest checkpoint output'}
                </p>
                <div className="mt-3">
                  <ArtifactPayloadView payload={activeArtifactPayload} hiddenKeys={isReadOnlyStepView ? ['recommendedAction'] : undefined} />
                </div>
              </div>
            ) : (
              <details className="mt-4 rounded-lg border border-[#E4E7EC] bg-white p-4">
                <summary className="cursor-pointer text-sm font-medium text-[#111827]">Review latest checkpoint details</summary>
                <div className="mt-3">
                  <ArtifactPayloadView payload={activeArtifactPayload} hiddenKeys={isReadOnlyStepView ? ['recommendedAction'] : undefined} />
                </div>
              </details>
            )
          ) : null}

          {readArtifactText(activeArtifact.summary) ? (
            <div className="mt-4 rounded-lg border border-[#E4E7EC] bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">Latest summary</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[#111827]">{readArtifactText(activeArtifact.summary)}</p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );

  const renderCollapsedInputPanel = ({
    description,
    children,
  }: {
    description: string;
    children: ReactNode;
  }) =>
    isReadOnlyStepView ? null : (
      <CollapsiblePanel
        title="Input"
        className="mt-4 rounded-xl border border-[#E4E7EC] bg-[#FCFCFD] p-5"
      >
        <p className="mt-2 text-sm text-[#667085]">{description}</p>
        <div className="mt-4 space-y-4">{children}</div>
      </CollapsiblePanel>
    );

  const activeWorkspace = (() => {
    if (showGenericArtifactWorkspace) {
      return (
        <section className="rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-[#111827]">{currentStepWorkspaceTitle}</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Review the saved checkpoint output first. Expand Input only when you need to edit the step or add more source context.
              </p>
            </div>

            {lockedStepHeaderIndicator ?? businessProfileHeaderControl ?? seedKeywordsHeaderControl ?? autoGenerateHeaderControl}
          </div>

          {seedKeywordsHeaderGenerationForm}

          {showBusinessProfileWorkspace && Array.isArray(activeArtifactPayload?.keyFindings) && activeArtifactPayload.keyFindings.length > 0 ? (
            <BusinessProfileKeyFindings
              keyFindings={activeArtifactPayload.keyFindings as string[]}
              openQuestions={Array.isArray(activeArtifactPayload?.openQuestions) ? (activeArtifactPayload.openQuestions as string[]) : undefined}
              seedKeywords={Array.isArray(activeArtifactPayload?.seedKeywords) ? (activeArtifactPayload.seedKeywords as string[]) : undefined}
            />
          ) : null}

          {activeCheckpointReview}

          {!isReadOnlyStepView ? (
            <CollapsiblePanel
              title="Input"
              defaultOpen={!activeArtifact}
              className="mt-4 rounded-xl border border-[#E4E7EC] bg-[#FCFCFD] p-5"
            >
              <p className="mt-2 text-sm text-[#667085]">
                Use this panel when you need to revise the current checkpoint fields, add optional source material, or approve changes after editing the input.
              </p>
              {businessProfileHeaderDisclosure}
              {currentStepArtifactForm}
            </CollapsiblePanel>
          ) : null}
        </section>
      );
    }

    if (showCompetitorBucketsWorkspace) {
      return (
        <section className="space-y-4 rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-[#111827]">Competitor buckets</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Identify direct and organic competitors from SERP and Ahrefs, then assign each to a bucket for downstream research.
              </p>
            </div>

            {lockedStepHeaderIndicator ?? autoGenerateHeaderControl}
          </div>

          {(activeArtifactPayload?.serpCandidates || activeArtifactPayload?.ahrefsOrganic) ? (
            <SerpCandidatesView
              serpCandidates={
                Array.isArray(activeArtifactPayload.serpCandidates)
                  ? (activeArtifactPayload.serpCandidates as Array<{ domain: string; occurrences: number; avgPosition: number; sampleUrls?: string[] }>)
                  : []
              }
              ahrefsOrganic={
                Array.isArray(activeArtifactPayload.ahrefsOrganic)
                  ? (activeArtifactPayload.ahrefsOrganic as Array<{ domain: string; domainRating?: number | null; keywordsCommon?: number | null; traffic?: number | null }>)
                  : []
              }
            />
          ) : null}

          {activeCheckpointReview}

          {renderCollapsedInputPanel({
            description:
              'Use this panel to add or refine competitor rows, review the saved roster, and approve the checkpoint after updating the source data.',
            children: (
              <>
                <form action={createCompetitorAction} className="grid gap-4 rounded-lg border border-[#E4E7EC] bg-white p-4">
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="workflowId" value={workflowId} />

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="competitor-domain">
                        Competitor domain
                      </label>
                      <input
                        id="competitor-domain"
                        name="domain"
                        type="text"
                        placeholder="example.com"
                        className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="competitor-bucket">
                        Bucket
                      </label>
                      <select
                        id="competitor-bucket"
                        name="bucket"
                        defaultValue="DIRECT"
                        className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
                      >
                        <option value="DIRECT">Direct</option>
                        <option value="ORGANIC">Organic</option>
                        <option value="UNCLASSIFIED">Unclassified</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="competitor-status">
                        Status
                      </label>
                      <select
                        id="competitor-status"
                        name="status"
                        defaultValue="APPROVED"
                        className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
                      >
                        <option value="APPROVED">Approved</option>
                        <option value="CANDIDATE">Candidate</option>
                        <option value="REJECTED">Rejected</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="competitor-rationale">
                      Why this competitor belongs in the workflow
                    </label>
                    <textarea
                      id="competitor-rationale"
                      name="rationale"
                      rows={3}
                      placeholder="Example: same commercial offer set in AE with repeated SERP overlap on high-intent categories"
                      className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="competitor-notes">
                      Notes
                    </label>
                    <textarea
                      id="competitor-notes"
                      name="notes"
                      rows={2}
                      placeholder="Optional: exclusions, edge cases, or follow-up notes"
                      className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
                    />
                  </div>

                  <div>
                    <button
                      type="submit"
                      className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1F2937]"
                    >
                      Save competitor
                    </button>
                  </div>
                </form>

                {workflow.competitors && workflow.competitors.length > 0 ? (
                  <div className="grid gap-3">
                    {workflow.competitors.map((competitor) => (
                      <div
                        key={competitor.id}
                        className="flex flex-col gap-2 rounded-lg border border-[#E4E7EC] bg-white p-4 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[#111827]">{competitor.domain}</p>
                          {competitor.rationale ? <p className="mt-1 text-sm text-[#667085]">{competitor.rationale}</p> : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <span className="rounded-full bg-[#EEF4FF] px-3 py-1 text-xs font-medium text-[#3538CD]">{competitor.bucket}</span>
                          <span className="rounded-full bg-[#F4F6FA] px-3 py-1 text-xs font-medium text-[#344054]">{competitor.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-[#E4E7EC] bg-white p-8 text-center">
                    <p className="text-sm text-[#9CA3AF]">No competitors added yet.</p>
                  </div>
                )}
              </>
            ),
          })}
        </section>
      );
    }

    if (showCompetitorMetricsWorkspace) {
      return (
        <section className="space-y-4 rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-[#111827]">Competitor metrics</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Capture domain authority, traffic, keyword footprint, and top pages for each approved competitor.
              </p>
            </div>

            {lockedStepHeaderIndicator ?? autoGenerateHeaderControl}
          </div>

          {Array.isArray(activeArtifactPayload?.competitorMetrics) && activeArtifactPayload.competitorMetrics.length > 0 ? (
            <CompetitorMetricsView
              competitorMetrics={
                activeArtifactPayload.competitorMetrics as Array<{
                  domain: string;
                  bucket?: string | null;
                  domainRating?: number | null;
                  organicTraffic?: number | null;
                  organicKeywords?: number | null;
                  referringDomains?: number | null;
                  backlinks?: number | null;
                  topPages?: Array<{ url: string; traffic?: number | null; topKeyword?: string | null; topKeywordVolume?: number | null; topKeywordPosition?: number | null }>;
                }>
              }
            />
          ) : null}

          {activeCheckpointReview}

          {renderCollapsedInputPanel({
            description:
              'Use this panel to capture comparable metrics and top-page evidence for each competitor, then approve the checkpoint from the step form once the source data is current.',
            children: (
              <>
                {workflow.competitors && workflow.competitors.length > 0 ? (
                  <div className="grid gap-4">
                    {workflow.competitors.map((competitor) => (
                      <article key={competitor.id} className="rounded-lg border border-[#E4E7EC] bg-white p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="text-base font-semibold text-[#111827]">{competitor.domain}</h3>
                            {competitor.rationale ? <p className="mt-1 text-sm text-[#667085]">{competitor.rationale}</p> : null}
                            {competitor.notes ? <p className="mt-2 text-sm text-[#667085]">{competitor.notes}</p> : null}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-[#EEF4FF] px-3 py-1 text-xs font-medium text-[#3538CD]">{competitor.bucket}</span>
                            <span className="rounded-full bg-[#F4F6FA] px-3 py-1 text-xs font-medium text-[#344054]">{competitor.status}</span>
                          </div>
                        </div>

                        <form action={saveCompetitorMetricsAction} className="mt-4 grid gap-4 rounded-lg border border-[#D0D5DD] bg-[#FCFCFD] p-4">
                          <input type="hidden" name="projectId" value={projectId} />
                          <input type="hidden" name="workflowId" value={workflowId} />
                          <input type="hidden" name="competitorId" value={competitor.id} />

                          <fieldset disabled={isReadOnlyStepView} className="grid gap-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-medium text-[#111827]">Comparable metrics</p>
                                <p className="mt-1 text-xs text-[#667085]">
                                  Capture the latest DR, traffic, keyword footprint, and top pages for this competitor.
                                </p>
                              </div>
                              {competitor.metrics ? (
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#667085]">
                                  Captured {new Date(competitor.metrics.capturedAt).toLocaleDateString()}
                                </span>
                              ) : null}
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                              <div>
                                <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor={`dr-${competitor.id}`}>
                                  Domain rating
                                </label>
                                <input
                                  id={`dr-${competitor.id}`}
                                  name="domainRating"
                                  type="number"
                                  min="0"
                                  defaultValue={competitor.metrics?.domainRating ?? ''}
                                  className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor={`traffic-${competitor.id}`}>
                                  Organic traffic
                                </label>
                                <input
                                  id={`traffic-${competitor.id}`}
                                  name="organicTraffic"
                                  type="number"
                                  min="0"
                                  defaultValue={competitor.metrics?.organicTraffic ?? ''}
                                  className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor={`keywords-${competitor.id}`}>
                                  Organic keywords
                                </label>
                                <input
                                  id={`keywords-${competitor.id}`}
                                  name="organicKeywords"
                                  type="number"
                                  min="0"
                                  defaultValue={competitor.metrics?.organicKeywords ?? ''}
                                  className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor={`ref-domains-${competitor.id}`}>
                                  Referring domains
                                </label>
                                <input
                                  id={`ref-domains-${competitor.id}`}
                                  name="referringDomains"
                                  type="number"
                                  min="0"
                                  defaultValue={competitor.metrics?.referringDomains ?? ''}
                                  className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor={`backlinks-${competitor.id}`}>
                                  Backlinks
                                </label>
                                <input
                                  id={`backlinks-${competitor.id}`}
                                  name="backlinks"
                                  type="number"
                                  min="0"
                                  defaultValue={competitor.metrics?.backlinks ?? ''}
                                  className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor={`captured-at-${competitor.id}`}>
                                  Captured at
                                </label>
                                <input
                                  id={`captured-at-${competitor.id}`}
                                  name="capturedAt"
                                  type="date"
                                  defaultValue={competitor.metrics?.capturedAt ? competitor.metrics.capturedAt.slice(0, 10) : ''}
                                  className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor={`top-pages-${competitor.id}`}>
                                Top pages
                              </label>
                              <textarea
                                id={`top-pages-${competitor.id}`}
                                name="topPages"
                                rows={5}
                                defaultValue={formatCompetitorTopPages(competitor.metrics?.topPages)}
                                placeholder="One page per line: https://example.com/page | 1200 | best keyword | optional note"
                                className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
                              />
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="submit"
                                className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1F2937]"
                              >
                                Save metrics
                              </button>
                              {competitor.metrics ? (
                                <span className="rounded-full bg-white px-3 py-2 text-xs font-medium text-[#667085]">
                                  DR {competitor.metrics.domainRating ?? 'n/a'} · Traffic {competitor.metrics.organicTraffic ?? 'n/a'}
                                </span>
                              ) : null}
                            </div>
                          </fieldset>
                        </form>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-[#E4E7EC] bg-white p-8 text-center">
                    <p className="text-sm text-[#9CA3AF]">No workflow competitors saved yet. Add them in the competitor-buckets step first.</p>
                  </div>
                )}
              </>
            ),
          })}
        </section>
      );
    }

    if (showMethod01Workspace) {
      return (
        <section className="space-y-4 rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-[#111827]">Method 01 source set</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Build the Method 01 checkpoint from approved direct competitors only. This creates a structured checkpoint tied back to the selected source competitors.
              </p>
            </div>

            {lockedStepHeaderIndicator}
          </div>

          {Array.isArray(activeArtifactPayload?.competitorPages) && activeArtifactPayload.competitorPages.length > 0 ? (
            <Method01PagesView
              pages={
                activeArtifactPayload.competitorPages as Array<{
                  domain: string;
                  url: string;
                  traffic?: number | null;
                  topKeyword?: string | null;
                  topKeywordVolume?: number | null;
                  topKeywordPosition?: number | null;
                }>
              }
              country={typeof activeArtifactPayload?.country === 'string' ? activeArtifactPayload.country : null}
            />
          ) : null}

          {activeCheckpointReview}

          {renderCollapsedInputPanel({
            description:
              'Use this panel to choose the approved direct competitors that should seed Method 01 and generate a fresh checkpoint when the source set is ready.',
            children:
              approvedDirectCompetitors.length === 0 ? (
                <div className="rounded-lg border border-[#E4E7EC] bg-white p-8 text-center">
                  <p className="text-sm text-[#9CA3AF]">
                    No approved direct competitors yet. Save at least one approved direct competitor above before capturing Method 01.
                  </p>
                </div>
              ) : (
                <form action={createMethod01ArtifactAction} className="grid gap-4 rounded-lg border border-[#E4E7EC] bg-white p-4">
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="workflowId" value={workflowId} />

                  <div className="rounded-lg border border-[#D0D5DD] bg-[#FCFCFD] p-4">
                    <p className="text-sm font-medium text-[#111827]">Approved direct competitors</p>
                    <p className="mt-1 text-xs text-[#667085]">
                      Only approved direct competitors appear here because Method 01 should mine competitor top pages from the approved direct set.
                    </p>
                    <p className="mt-2 text-xs text-[#667085]">
                      Stored competitor top pages are ingested automatically when you generate the checkpoint. The fields below are only for extra strategist context.
                    </p>

                    <div className="mt-4 grid gap-3">
                      {approvedDirectCompetitors.map((competitor) => (
                        <label key={competitor.id} className="flex items-start gap-3 rounded-lg border border-[#E4E7EC] bg-white p-3">
                          <input
                            type="checkbox"
                            name="sourceCompetitor"
                            value={JSON.stringify({
                              id: competitor.id,
                              domain: competitor.domain,
                              bucket: competitor.bucket,
                              status: competitor.status,
                              metrics: competitor.metrics
                                ? {
                                    domainRating: competitor.metrics.domainRating,
                                    organicTraffic: competitor.metrics.organicTraffic,
                                    organicKeywords: competitor.metrics.organicKeywords,
                                    referringDomains: competitor.metrics.referringDomains,
                                    backlinks: competitor.metrics.backlinks,
                                    capturedAt: competitor.metrics.capturedAt,
                                    topPages: competitor.metrics.topPages,
                                  }
                                : null,
                            })}
                            defaultChecked
                            className="mt-1 h-4 w-4 rounded border border-[#D0D5DD]"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <p className="text-sm font-medium text-[#111827]">{competitor.domain}</p>
                              <div className="flex flex-wrap gap-2">
                                {competitor.metrics ? <span className="rounded-full bg-[#F9FAFB] px-3 py-1 text-xs font-medium text-[#667085]">DR {competitor.metrics.domainRating ?? 'n/a'}</span> : null}
                                {competitor.metrics ? <span className="rounded-full bg-[#F9FAFB] px-3 py-1 text-xs font-medium text-[#667085]">Traffic {competitor.metrics.organicTraffic ?? 'n/a'}</span> : null}
                                {competitor.metrics ? <span className="rounded-full bg-[#F9FAFB] px-3 py-1 text-xs font-medium text-[#667085]">Keywords {competitor.metrics.organicKeywords ?? 'n/a'}</span> : null}
                              </div>
                            </div>
                            {competitor.rationale ? <p className="mt-2 text-sm text-[#667085]">{competitor.rationale}</p> : null}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method01-summary">Summary note</label>
                    <input id="method01-summary" name="summary" type="text" placeholder="Example: Direct competitors confirm category and comparison page opportunities worth mining" className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method01-findings">Additional analyst notes</label>
                    <textarea id="method01-findings" name="keyFindings" rows={5} placeholder="Optional: add extra Method 01 observations per line" className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method01-top-pages">Additional top page candidates</label>
                    <textarea id="method01-top-pages" name="topPageCandidates" rows={5} placeholder="Optional: add extra pages as https://example.com/page | 1200 | best keyword | optional note" className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method01-action">Recommended next move</label>
                    <textarea id="method01-action" name="recommendedAction" rows={3} placeholder="Example: merge the strongest competitor-page themes into the consolidation pass" className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method01-evidence">Evidence or analyst notes</label>
                    <textarea id="method01-evidence" name="evidence" rows={4} placeholder="Top page observations, ranking patterns, or fit notes" className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method01-open-questions">Open questions or blockers</label>
                    <textarea id="method01-open-questions" name="openQuestions" rows={3} placeholder="Optional: one question or blocker per line" className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]" />
                  </div>

                  <div>
                    <button type="submit" className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1F2937]">Generate Method 01 checkpoint</button>
                  </div>
                </form>
              ),
          })}
        </section>
      );
    }

    if (showMethod02Workspace) {
      return (
        <section className="space-y-4 rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-[#111827]">Method 02 seed expansion</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Build the Method 02 checkpoint from stored project keyword rows when they exist, or fall back to the current project seed keywords until the approved-seed checkpoint is promoted.
              </p>
            </div>

            {lockedStepHeaderIndicator}
          </div>

          {activeCheckpointReview}

          {renderCollapsedInputPanel({
            description:
              'Use this panel to choose the seed set that should drive Method 02 and generate a fresh checkpoint once the source keywords look right.',
            children:
              sourceMethod02Keywords.length === 0 ? (
                <div className="rounded-lg border border-[#E4E7EC] bg-white p-8 text-center">
                  <p className="text-sm text-[#9CA3AF]">No seed keywords are stored on this project yet.</p>
                </div>
              ) : (
                <form action={createMethod02ArtifactAction} className="grid gap-4 rounded-lg border border-[#E4E7EC] bg-white p-4">
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="workflowId" value={workflowId} />

                  <div className="rounded-lg border border-[#D0D5DD] bg-[#FCFCFD] p-4">
                    <p className="text-sm font-medium text-[#111827]">Method 02 source keywords</p>
                    <p className="mt-1 text-xs text-[#667085]">Select the stored keywords that should drive matching terms, related terms, and parent-topic grouping in Method 02.</p>
                    <p className="mt-2 text-xs text-[#667085]">
                      {method02UsesDiscoveredKeywords
                        ? 'Stored project keyword rows are grouped automatically into parent topic candidates when you generate the checkpoint.'
                        : 'No project keyword rows are stored yet, so Method 02 will use the current project seed list as an interim source set.'}
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {sourceMethod02Keywords.map((sourceKeyword) => (
                        <label key={sourceKeyword.keyword} className="flex items-start gap-3 rounded-lg border border-[#E4E7EC] bg-white p-3">
                          <input type="checkbox" name="sourceSeedKeyword" value={JSON.stringify(sourceKeyword)} defaultChecked className="mt-1 h-4 w-4 rounded border border-[#D0D5DD]" />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <span className="text-sm text-[#111827]">{sourceKeyword.keyword}</span>
                              <div className="flex flex-wrap gap-2">
                                {typeof sourceKeyword.searchVolume === 'number' ? <span className="rounded-full bg-[#F9FAFB] px-3 py-1 text-xs font-medium text-[#667085]">Volume {sourceKeyword.searchVolume}</span> : null}
                                {sourceKeyword.intent ? <span className="rounded-full bg-[#F9FAFB] px-3 py-1 text-xs font-medium text-[#667085]">{sourceKeyword.intent}</span> : null}
                              </div>
                            </div>
                            {sourceKeyword.parentTopic ? <p className="mt-2 text-sm text-[#667085]">Parent topic: {sourceKeyword.parentTopic}</p> : null}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method02-summary">Summary note</label>
                    <input id="method02-summary" name="summary" type="text" placeholder="Example: Seed expansion widened the service cluster into pricing, package, and comparison variants" className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method02-findings">Additional analyst notes</label>
                    <textarea id="method02-findings" name="keyFindings" rows={5} placeholder="Optional: add extra Method 02 observations per line" className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method02-parent-topics">Additional parent topic candidates</label>
                    <textarea id="method02-parent-topics" name="parentTopicCandidates" rows={5} placeholder="Optional: add extra candidates as Parent Topic | Cluster Keyword | optional note" className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method02-questions">Additional question and related-term opportunities</label>
                    <textarea id="method02-questions" name="questionKeywords" rows={4} placeholder="Optional: add extra question or related-term opportunities per line" className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method02-action">Recommended next move</label>
                    <textarea id="method02-action" name="recommendedAction" rows={3} placeholder="Example: merge the strongest parent topics into the consolidation pass and compare them against Method 01" className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method02-evidence">Evidence or analyst notes</label>
                    <textarea id="method02-evidence" name="evidence" rows={4} placeholder="Parent topic observations, questions-tab notes, or related-term evidence" className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method02-open-questions">Open questions or blockers</label>
                    <textarea id="method02-open-questions" name="openQuestions" rows={3} placeholder="Optional: one question or blocker per line" className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]" />
                  </div>

                  <div>
                    <button type="submit" className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1F2937]">Generate Method 02 checkpoint</button>
                  </div>
                </form>
              ),
          })}
        </section>
      );
    }

    if (showMethod03Workspace) {
      const method03GapKeywords = (() => {
        const payload = activeArtifact?.payload as Record<string, unknown> | null | undefined;
        if (!payload) return [];
        const raw = payload.gapKeywords;
        if (!Array.isArray(raw)) return [];
        return raw as Array<{ keyword: string; volume: number | null; difficulty: number | null; competitorCount: number; competitors: string[]; intent: string; funnel: string; contentType: string; parentTopic: string }>;
      })();
      const method03CompetitorsAnalyzed = (() => {
        const payload = activeArtifact?.payload as Record<string, unknown> | null | undefined;
        const raw = payload?.competitorsAnalyzed;
        return Array.isArray(raw) ? (raw as string[]) : approvedDirectCompetitors.map((c) => c.domain);
      })();
      const method03DataSource = (() => {
        const payload = activeArtifact?.payload as Record<string, unknown> | null | undefined;
        return typeof payload?.dataSource === 'string' ? payload.dataSource : null;
      })();

      return (
        <section className="space-y-4 rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-[#111827]">Method 03 — Content gap</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Auto-generated via Ahrefs API approximation and OpenAI classification. Override with a manual Ahrefs UI export below for higher accuracy before approving.
              </p>
            </div>
            {lockedStepHeaderIndicator ?? <GenerateStepButton projectId={projectId} workflowId={workflowId} stepKey="method03-content-gap-import" variant="inline" />}
          </div>

          {method03GapKeywords.length > 0 ? (
            <div className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-[#111827]">
                  {method03GapKeywords.length} gap keyword{method03GapKeywords.length === 1 ? '' : 's'} found
                </p>
                <div className="flex flex-wrap gap-2">
                  {method03DataSource === 'api-approximation' ? (
                    <span className="rounded-full bg-[#FFF8E5] px-3 py-1 text-xs font-medium text-[#B45309]">API approximation — override with Ahrefs UI export below for accuracy</span>
                  ) : method03DataSource === 'manual-override' ? (
                    <span className="rounded-full bg-[#ECFDF3] px-3 py-1 text-xs font-medium text-[#027A48]">Manual Ahrefs export applied</span>
                  ) : null}
                  <span className="rounded-full bg-[#F4F6FA] px-3 py-1 text-xs font-medium text-[#344054]">{method03CompetitorsAnalyzed.length} competitor{method03CompetitorsAnalyzed.length === 1 ? '' : 's'} analysed</span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {method03CompetitorsAnalyzed.map((domain) => (
                  <span key={domain} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#344054] border border-[#D0D5DD]">{domain}</span>
                ))}
              </div>

              <div className="mt-4 overflow-x-auto">
                <Method03Table keywords={method03GapKeywords} />
              </div>
            </div>
          ) : null}

          {activeCheckpointReview}

          {!isReadOnlyStepView ? (
            <CollapsiblePanel
              title="Override with manual Ahrefs export"
              defaultOpen={!activeArtifact}
              className="mt-4 rounded-xl border border-[#E4E7EC] bg-[#FCFCFD] p-5"
            >
              <div className="mt-3 space-y-4">
                <div className="rounded-lg border border-[#E4E7EC] bg-white p-4">
                  <p className="text-sm font-medium text-[#111827]">How to get the Ahrefs Content Gap export</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#667085]">
                    <li>Open Site Explorer in Ahrefs for <strong>{approvedDirectCompetitors[0]?.domain ?? 'a direct competitor'}</strong> (or the client site).</li>
                    <li>Go to <strong>Content Gap</strong> and add these approved direct competitors:{' '}
                      {approvedDirectCompetitors.map((c) => <strong key={c.domain}>{c.domain}</strong>).reduce<React.ReactNode[]>((acc, el, i) => i === 0 ? [el] : [...acc, ', ', el], [])}
                    </li>
                    <li>Keep the client site in the comparison and filter for keywords competitors rank for but the client does not.</li>
                    <li>Export the filtered CSV or TSV with the header row intact.</li>
                    <li>Paste the full export below — it will replace the API approximation above.</li>
                  </ol>
                </div>

                <form action={approveArtifactAction} className="grid gap-4">
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="workflowId" value={workflowId} />
                  <input type="hidden" name="stepKey" value="method03-content-gap-import" />
                  <input type="hidden" name="decision" value="APPROVE" />

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method03-summary">Summary note</label>
                    <input id="method03-summary" name="summary" type="text" placeholder="Example: Content Gap confirmed missed mid-funnel comparison pages absent from the client site" className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method03-findings">Strategist notes</label>
                    <textarea id="method03-findings" name="keyFindings" rows={4} placeholder="One gap insight per line" className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method03-content-gap-export">Ahrefs Content Gap export (CSV or TSV)</label>
                    <textarea
                      id="method03-content-gap-export"
                      name="contentGapImport"
                      rows={10}
                      placeholder="Paste the exported CSV or TSV, including the header row. This will replace the API approximation."
                      className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 font-mono text-sm text-[#111827]"
                    />
                    <p className="mt-1 text-xs text-[#667085]">Optional. Leave blank to approve the API approximation as-is.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method03-action">Recommended next move</label>
                    <textarea id="method03-action" name="recommendedAction" rows={3} placeholder="Example: consolidate cross-method winners and remove Phase 1 duplicates" className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]" />
                  </div>

                  <div>
                    <button type="submit" className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1F2937]">
                      {activeArtifact ? 'Approve Method 03 checkpoint' : 'Save and approve Method 03'}
                    </button>
                  </div>
                </form>
              </div>
            </CollapsiblePanel>
          ) : null}
        </section>
      );
    }

    if (showConsolidatedKeywordsWorkspace) {
      return (
        <section className="space-y-4 rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-[#111827]">Consolidated keywords</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Generate a first-pass consolidated ledger from the latest approved workflow checkpoints before the topical map review.
              </p>
            </div>

            {lockedStepHeaderIndicator}
          </div>

          {consolidationSourceArtifacts.length === 0 ? (
            <div className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-8 text-center">
              <p className="text-sm text-[#9CA3AF]">Approve Phase 1, Method 01, Method 02, or Method 03 checkpoints before generating consolidated keywords.</p>
            </div>
          ) : !isReadOnlyStepView ? (
            <form action={createConsolidatedKeywordsArtifactAction} className="grid gap-4 rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-4">
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="workflowId" value={workflowId} />

              <div className="rounded-lg border border-[#D0D5DD] bg-white p-4">
                <p className="text-sm font-medium text-[#111827]">Approved consolidation sources</p>
                <p className="mt-1 text-xs text-[#667085]">The generator uses the latest approved checkpoints per step, so pending revisions do not block a first-pass ledger.</p>

                <div className="mt-4 grid gap-3">
                  {consolidationSourceArtifacts.map((artifact) => (
                    <div key={artifact.id} className="rounded-lg border border-[#E4E7EC] p-3">
                      <input
                        type="hidden"
                        name="sourceArtifact"
                        value={JSON.stringify({
                          id: artifact.id,
                          stepKey: artifact.stepKey,
                          payload: artifact.payload,
                        })}
                      />

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-medium text-[#111827]">{artifact.stepKey}</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-[#ECFDF3] px-3 py-1 text-xs font-medium text-[#027A48]">Approved source</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <button type="submit" className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1F2937]">Generate consolidated keyword checkpoint</button>
              </div>
            </form>
          ) : null}

          {activeArtifactPayload?.consolidatedKeywords ? (
            <KeywordLedgerTable
              consolidatedKeywords={
                Array.isArray(activeArtifactPayload.consolidatedKeywords)
                  ? (activeArtifactPayload.consolidatedKeywords as LedgerKeyword[])
                  : []
              }
              duplicateCount={
                Array.isArray(activeArtifactPayload.duplicateExistingKeywords)
                  ? activeArtifactPayload.duplicateExistingKeywords.length
                  : 0
              }
            />
          ) : null}

          {activeCheckpointReview}
        </section>
      );
    }

    if (showTopicalMapWorkspace) {
      return (
        <section className="space-y-4 rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-[#111827]">Topical map</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Generate a first-pass pillar and cluster map from the latest approved consolidated checkpoint before content brief generation.
              </p>
            </div>

            {lockedStepHeaderIndicator}
          </div>

          {!approvedConsolidatedArtifact ? (
            <div className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-8 text-center">
              <p className="text-sm text-[#9CA3AF]">Approve a consolidated keywords checkpoint before generating the topical map.</p>
            </div>
          ) : !isReadOnlyStepView ? (
            <form action={createTopicalMapArtifactAction} className="grid gap-4 rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-4">
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="workflowId" value={workflowId} />
              <input
                type="hidden"
                name="sourceArtifact"
                value={JSON.stringify({
                  id: approvedConsolidatedArtifact.id,
                  stepKey: approvedConsolidatedArtifact.stepKey,
                  payload: approvedConsolidatedArtifact.payload,
                })}
              />

              <div className="rounded-lg border border-[#D0D5DD] bg-white p-4">
                <p className="text-sm font-medium text-[#111827]">Approved topical map source</p>
                <p className="mt-1 text-xs text-[#667085]">The generator groups the approved consolidated ledger into pillar and cluster candidates, then prepares a content-brief queue from the same source.</p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#111827]">{approvedConsolidatedArtifact.stepKey}</p>
                    <p className="mt-1 text-xs text-[#667085]">{readArtifactText(approvedConsolidatedArtifact.summary) ?? 'Latest approved consolidated ledger.'}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#ECFDF3] px-3 py-1 text-xs font-medium text-[#027A48]">Approved source</span>
                  </div>
                </div>
              </div>

              <div>
                <button type="submit" className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1F2937]">Generate topical map checkpoint</button>
              </div>
            </form>
          ) : null}

          {activeArtifactPayload?.primaryTopics ? (
            <TopicalMapView
              primaryTopics={
                Array.isArray(activeArtifactPayload.primaryTopics)
                  ? (activeArtifactPayload.primaryTopics as Array<{
                      pillar: string;
                      clusterKeywords: string[];
                      clusterCount: number;
                      suggestedUrlPath: string | null;
                      sourceMethods: string[];
                    }>)
                  : []
              }
              contentBriefQueue={
                Array.isArray(activeArtifactPayload.contentBriefQueue)
                  ? (activeArtifactPayload.contentBriefQueue as Array<{
                      keyword: string;
                      pillar: string;
                      contentType: 'pillar' | 'cluster';
                      suggestedUrlPath: string | null;
                    }>)
                  : []
              }
            />
          ) : null}

          {activeCheckpointReview}
        </section>
      );
    }

    if (showContentBriefWorkspace) {
      return (
        <section className="space-y-4 rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-[#111827]">Content brief handoff</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Promote an approved topical-map node into a workflow-aware content brief input that can be reviewed before article generation.
              </p>
            </div>

            {lockedStepHeaderIndicator}
          </div>

          {activeCheckpointReview}

          {renderCollapsedInputPanel({
            description:
              'Use this panel to choose the approved topical-map node and editorial notes that should become the next content-brief checkpoint.',
            children:
              !approvedTopicalMapArtifact || approvedContentBriefQueue.length === 0 ? (
                <div className="rounded-lg border border-[#E4E7EC] bg-white p-8 text-center">
                  <p className="text-sm text-[#9CA3AF]">Approve a topical-map checkpoint with queued content nodes before generating a content brief checkpoint.</p>
                </div>
              ) : (
                <form action={createContentBriefArtifactAction} className="grid gap-4 rounded-lg border border-[#E4E7EC] bg-white p-4">
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="workflowId" value={workflowId} />
                  <input type="hidden" name="language" value={workflow.language} />
                  <input type="hidden" name="country" value={workflow.country} />
                  <input
                    type="hidden"
                    name="sourceArtifact"
                    value={JSON.stringify({
                      id: approvedTopicalMapArtifact.id,
                      stepKey: approvedTopicalMapArtifact.stepKey,
                      payload: approvedTopicalMapArtifact.payload,
                    })}
                  />

                  <div className="rounded-lg border border-[#D0D5DD] bg-[#FCFCFD] p-4">
                    <p className="text-sm font-medium text-[#111827]">Approved brief queue</p>
                    <p className="mt-1 text-xs text-[#667085]">Select one approved topical-map node to promote into a structured brief input checkpoint.</p>

                    <div className="mt-4 grid gap-3">
                      {approvedContentBriefQueue.map((queueEntry, index) => (
                        <label key={`${queueEntry.pillar}-${queueEntry.keyword}`} className="flex items-start gap-3 rounded-lg border border-[#E4E7EC] bg-white p-3">
                          <input type="radio" name="selectedQueueKey" value={`${queueEntry.pillar}::${queueEntry.keyword}`} defaultChecked={index === 0} className="mt-1 h-4 w-4 border border-[#D0D5DD]" />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-medium text-[#111827]">{queueEntry.keyword}</p>
                                <p className="mt-1 text-xs text-[#667085]">Pillar: {queueEntry.pillar}</p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <span className="rounded-full bg-[#F4F6FA] px-3 py-1 text-xs font-medium text-[#344054]">{queueEntry.contentType}</span>
                                {queueEntry.suggestedUrlPath ? <span className="rounded-full bg-[#F9FAFB] px-3 py-1 text-xs font-medium text-[#667085]">{queueEntry.suggestedUrlPath}</span> : null}
                              </div>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="content-brief-editorial-notes">Editorial notes</label>
                    <textarea id="content-brief-editorial-notes" name="editorialNotes" rows={4} placeholder="Optional: CTA, internal-link priorities, conversion notes, or editor guidance" className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]" />
                  </div>

                  <div>
                    <button type="submit" className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1F2937]">Generate content brief checkpoint</button>
                  </div>
                </form>
              ),
          })}
        </section>
      );
    }

    if (showContentArticleWorkspace) {
      return (
        <>
        <section className="space-y-4 rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-[#111827]">Content article</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Promote an approved content brief into a workflow-aware article input checkpoint before queue-backed draft generation is wired in.
              </p>
            </div>

            {lockedStepHeaderIndicator}
          </div>

          {activeCheckpointReview}

          {renderCollapsedInputPanel({
            description:
              'Use this panel to choose the approved content-brief source and title direction that should seed the next content-article checkpoint.',
            children:
              !approvedContentBriefArtifact || !approvedContentBrief ? (
                <div className="rounded-lg border border-[#E4E7EC] bg-white p-8 text-center">
                  <p className="text-sm text-[#9CA3AF]">Approve a content-brief checkpoint before generating the content article checkpoint.</p>
                </div>
              ) : (
                <form action={createContentArticleArtifactAction} className="grid gap-4 rounded-lg border border-[#E4E7EC] bg-white p-4">
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="workflowId" value={workflowId} />
                  <input
                    type="hidden"
                    name="sourceArtifact"
                    value={JSON.stringify({
                      id: approvedContentBriefArtifact.id,
                      stepKey: approvedContentBriefArtifact.stepKey,
                      payload: approvedContentBriefArtifact.payload,
                    })}
                  />

                  <div className="rounded-lg border border-[#D0D5DD] bg-[#FCFCFD] p-4">
                    <p className="text-sm font-medium text-[#111827]">Approved article source</p>
                    <p className="mt-1 text-xs text-[#667085]">The article input generator uses the latest approved content brief as the single downstream source of truth.</p>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#111827]">{approvedContentBrief.targetKeyword}</p>
                        <p className="mt-1 text-xs text-[#667085]">Pillar: {approvedContentBrief.pillar}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-[#F4F6FA] px-3 py-1 text-xs font-medium text-[#344054]">{approvedContentBrief.contentType}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#D0D5DD] bg-[#FCFCFD] p-4">
                    <p className="text-sm font-medium text-[#111827]">Title selection</p>
                    <p className="mt-1 text-xs text-[#667085]">Choose the approved article title direction that should anchor the next checkpoint.</p>

                    <div className="mt-4 grid gap-3">
                      {contentArticleTitleOptions.map((title, index) => (
                        <label key={title} className="flex items-start gap-3 rounded-lg border border-[#E4E7EC] bg-white p-3">
                          <input type="radio" name="selectedTitle" value={title} defaultChecked={index === 0} className="mt-1 h-4 w-4 border border-[#D0D5DD]" />

                          <span className="text-sm text-[#111827]">{title}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="content-article-notes">Draft notes</label>
                    <textarea id="content-article-notes" name="articleNotes" rows={4} placeholder="Optional: final angle, CTA emphasis, proof points, or editorial direction for the article draft" className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]" />
                  </div>

                  <div>
                    <button type="submit" className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1F2937]">Generate content article checkpoint</button>
                  </div>
                </form>
              ),
          })}
        </section>

        <section className="space-y-4 rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold text-[#111827]">Persisted content outputs</h2>
            <p className="mt-1 text-sm text-[#667085]">
              Approving a content article checkpoint automatically triggers AI article generation — the card below updates live once the draft is ready.
            </p>
          </div>

          {persistedContentPieces.length === 0 ? (
            <div className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-8 text-center">
              <p className="text-sm text-[#9CA3AF]">
                Approve a content article checkpoint to generate workflow-linked content pieces.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {persistedContentPieces.map((piece) => {
                const persistedKeyword = persistedKeywordsById.get(piece.keywordId);
                const briefRecord = readObjectRecord(piece.brief);
                const reviewNotes = readObjectRecord(piece.reviewNotes);
                const articleInput = readObjectRecord(reviewNotes?.articleInput);
                const pillar =
                  typeof briefRecord?.pillar === 'string' && briefRecord.pillar.trim().length > 0
                    ? briefRecord.pillar.trim()
                    : persistedKeyword?.parentTopic ?? '—';
                const suggestedUrlPath =
                  typeof briefRecord?.suggestedUrlPath === 'string' && briefRecord.suggestedUrlPath.trim().length > 0
                    ? briefRecord.suggestedUrlPath.trim()
                    : null;
                const articleSectionCount = Array.isArray(articleInput?.articleSections)
                  ? articleInput.articleSections.filter(
                      (value): value is string => typeof value === 'string' && value.trim().length > 0,
                    ).length
                  : 0;

                return (
                  <ContentPieceStatusCard
                    key={piece.id}
                    initialPiece={piece}
                    keyword={persistedKeyword?.keyword ?? null}
                    pillar={pillar}
                    suggestedUrlPath={suggestedUrlPath}
                    articleSectionCount={articleSectionCount}
                    workflowCountry={workflow.country}
                    apiUrl={process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002'}
                  />
                );
              })}
            </div>
          )}
        </section>
        </>
      );
    }

    return null;
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/dashboard/keywords" className="text-sm font-medium text-[#475467] hover:text-[#111827]">
            Back to projects
          </Link>
          <h1 className="mt-2 text-[32px] font-bold text-[#111827]">Workflow shell</h1>
          <p className="mt-1 text-sm text-[#667085]">
            Review the current workflow run, add internal checkpoints manually, and record checkpoint decisions.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[#F4F6FA] px-3 py-1 text-xs font-medium text-[#344054]">
            {workflow.language.toUpperCase()}
          </span>
          <span className="rounded-full bg-[#F4F6FA] px-3 py-1 text-xs font-medium text-[#344054]">
            {workflow.country.toUpperCase()}
          </span>
          <span className="rounded-full bg-[#EEF4FF] px-3 py-1 text-xs font-medium text-[#3538CD]">
            {workflow.status.replaceAll('_', ' ')}
          </span>
        </div>
      </div>

      <WorkflowShellLayout rail={workflowWizard} collapsedRail={collapsedWorkflowWizard}>
        {activeWorkspace}
        {/*

      <section className="rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">Current step</p>
            <p className="mt-2 text-sm font-medium text-[#111827]">
              {currentStepKey ? formatWorkflowStepLabel(currentStepKey) : workflow.currentStep ?? 'Not started'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">Current checkpoint</p>
            <p className="mt-2 text-sm font-medium text-[#111827]">
              {currentStepKey ? formatWorkflowStepLabel(currentStepKey) : workflow.currentCheckpoint ?? 'Not set'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">Artifacts captured</p>
            <p className="mt-2 text-sm font-medium text-[#111827]">{workflow.artifacts?.length ?? 0}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold text-[#111827]">Current step workspace</h2>
          <p className="mt-1 text-sm text-[#667085]">
            Draft or revise the current step here, then review and approve the latest saved artifact in the same workspace before moving deeper into the workflow.
          </p>
        </div>

        {['serp-niche-map', 'competitor-buckets', 'competitor-metrics', 'phase1-baseline', 'method01-competitor-pages', 'method02-seed-expansion'].includes(workflow.currentCheckpoint ?? '') && (
          <div className="mt-4 mb-4">
            <GenerateStepButton
              projectId={projectId}
              workflowId={workflowId}
              stepKey={workflow.currentCheckpoint ?? ''}
            />
          </div>
        )}

        <WorkflowArtifactForm
          action={createArtifactAction}
          generateBusinessProfileAction={generateBusinessProfileDraftAction}
          projectId={projectId}
          projectWebsiteUrl={project.websiteUrl}
          workflowId={workflowId}
          defaultStep={workflow.currentCheckpoint ?? 'business-profile'}
          seedKeywordStepSource={seedKeywordStepSource}
          initialValuesByStep={
            businessProfileDraftValues || seedKeywordDraftValues || serpNicheMapDraftValues
              ? {
                  ...(businessProfileDraftValues ? { 'business-profile': businessProfileDraftValues } : {}),
                  ...(seedKeywordDraftValues ? { 'seed-keywords': seedKeywordDraftValues } : {}),
                  ...(serpNicheMapDraftValues ? { 'serp-niche-map': serpNicheMapDraftValues } : {}),
                }
              : undefined
          }
        />

        <div className="mt-6 rounded-xl border border-[#E4E7EC] bg-[#FCFCFD] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-[#111827]">Approve current checkpoint</h3>
              <p className="mt-1 text-sm text-[#667085]">
                Approval is the next step after saving the active checkpoint. Review the latest saved output here before continuing the workflow.
              </p>
            </div>

            {activeArtifact ? (
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#344054]">
                  {isWorkflowStepKey(activeArtifact.stepKey) ? formatWorkflowStepLabel(activeArtifact.stepKey) : activeArtifact.stepKey}
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#344054]">
                  Latest checkpoint
                </span>
                <span className="rounded-full bg-[#EEF4FF] px-3 py-1 text-xs font-medium text-[#3538CD]">
                  {activeArtifact.status.replaceAll('_', ' ')}
                </span>
              </div>
            ) : null}
          </div>

          {!activeArtifact ? (
            <div className="mt-4 rounded-lg border border-[#E4E7EC] bg-white p-4">
              <p className="text-sm text-[#667085]">
                Save a checkpoint for the current step before requesting approval.
              </p>
            </div>
          ) : (
            <>
              {readArtifactText(activeArtifact.summary) ? (
                <div className="mt-4 rounded-lg border border-[#E4E7EC] bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">Latest summary</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[#111827]">
                    {readArtifactText(activeArtifact.summary)}
                  </p>
                </div>
              ) : null}

              {activeArtifact.approvals?.[0] ? (
                <div className="mt-4 rounded-lg border border-[#E4E7EC] bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">Latest decision</p>
                  <p className="mt-2 text-sm font-medium text-[#111827]">
                    {activeArtifact.approvals[0].decision.replaceAll('_', ' ')}
                  </p>
                  {activeArtifact.approvals[0].notes ? (
                    <p className="mt-2 text-sm text-[#667085]">{activeArtifact.approvals[0].notes}</p>
                  ) : null}
                </div>
              ) : null}

              {hasArtifactPayloadContent(activeArtifact.payload) ? (
                <details className="mt-4 rounded-lg border border-[#E4E7EC] bg-white p-4">
                  <summary className="cursor-pointer text-sm font-medium text-[#111827]">Review latest checkpoint details</summary>
                  <div className="mt-3">
                    <ArtifactPayloadView payload={activeArtifact.payload} />
                  </div>
                </details>
              ) : null}

              <form action={reviewCheckpointAction} className="mt-4 grid gap-3 rounded-lg border border-[#E4E7EC] bg-white p-4">
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="workflowId" value={workflowId} />
                <input type="hidden" name="stepKey" value={activeArtifact.stepKey} />

                <div>
                  <label
                    className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]"
                    htmlFor={`active-notes-${activeArtifact.id}`}
                  >
                    Review note
                  </label>
                  <textarea
                    id={`active-notes-${activeArtifact.id}`}
                    name="notes"
                    rows={3}
                    placeholder="Optional checkpoint note"
                    className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    name="decision"
                    value="APPROVED"
                    className="rounded-lg bg-[#101828] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1D2939]"
                  >
                    Approve
                  </button>
                  <button
                    type="submit"
                    name="decision"
                    value="REVISION_REQUESTED"
                    className="rounded-lg border border-[#D0D5DD] bg-white px-4 py-2 text-sm font-medium text-[#344054] transition hover:bg-[#F9FAFB]"
                  >
                    Request revision
                  </button>
                  <button
                    type="submit"
                    name="decision"
                    value="REJECTED"
                    className="rounded-lg border border-[#F04438] bg-white px-4 py-2 text-sm font-medium text-[#B42318] transition hover:bg-[#FFF5F5]"
                  >
                    Reject
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold text-[#111827]">Competitor workspace</h2>
          <p className="mt-1 text-sm text-[#667085]">
            Capture approved direct and organic competitors, then attach the comparable metrics sheet used by the strategist workflow.
          </p>
        </div>

        <form action={createCompetitorAction} className="grid gap-4 rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-4">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="workflowId" value={workflowId} />

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="competitor-domain">
                Competitor domain
              </label>
              <input
                id="competitor-domain"
                name="domain"
                type="text"
                placeholder="example.com"
                className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="competitor-bucket">
                Bucket
              </label>
              <select
                id="competitor-bucket"
                name="bucket"
                defaultValue="DIRECT"
                className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
              >
                <option value="DIRECT">Direct</option>
                <option value="ORGANIC">Organic</option>
                <option value="UNCLASSIFIED">Unclassified</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="competitor-status">
                Status
              </label>
              <select
                id="competitor-status"
                name="status"
                defaultValue="APPROVED"
                className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
              >
                <option value="APPROVED">Approved</option>
                <option value="CANDIDATE">Candidate</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="competitor-rationale">
              Why this competitor belongs in the workflow
            </label>
            <textarea
              id="competitor-rationale"
              name="rationale"
              rows={3}
              placeholder="Example: same commercial offer set in AE with repeated SERP overlap on high-intent categories"
              className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="competitor-notes">
              Notes
            </label>
            <textarea
              id="competitor-notes"
              name="notes"
              rows={2}
              placeholder="Optional: exclusions, edge cases, or follow-up notes"
              className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
            />
          </div>

          <div>
            <button
              type="submit"
              className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1F2937]"
            >
              Save competitor
            </button>
          </div>
        </form>

        {workflow.competitors && workflow.competitors.length > 0 ? (
          <div className="grid gap-4">
            {workflow.competitors.map((competitor) => (
              <article key={competitor.id} className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-[#111827]">{competitor.domain}</h3>
                    {competitor.rationale ? (
                      <p className="mt-1 text-sm text-[#667085]">{competitor.rationale}</p>
                    ) : null}
                    {competitor.notes ? (
                      <p className="mt-2 text-sm text-[#667085]">{competitor.notes}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#EEF4FF] px-3 py-1 text-xs font-medium text-[#3538CD]">
                      {competitor.bucket}
                    </span>
                    <span className="rounded-full bg-[#F4F6FA] px-3 py-1 text-xs font-medium text-[#344054]">
                      {competitor.status}
                    </span>
                  </div>
                </div>

                <form action={saveCompetitorMetricsAction} className="mt-4 grid gap-4 rounded-lg border border-[#D0D5DD] bg-white p-4">
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="workflowId" value={workflowId} />
                  <input type="hidden" name="competitorId" value={competitor.id} />

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#111827]">Comparable metrics</p>
                      <p className="mt-1 text-xs text-[#667085]">
                        Capture the latest DR, traffic, keyword footprint, backlinks, and top pages for this competitor.
                      </p>
                    </div>
                    {competitor.metrics ? (
                      <span className="rounded-full bg-[#F9FAFB] px-3 py-1 text-xs font-medium text-[#667085]">
                        Captured {new Date(competitor.metrics.capturedAt).toLocaleDateString()}
                      </span>
                    ) : null}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor={`dr-${competitor.id}`}>
                        Domain rating
                      </label>
                      <input
                        id={`dr-${competitor.id}`}
                        name="domainRating"
                        type="number"
                        min="0"
                        defaultValue={competitor.metrics?.domainRating ?? ''}
                        className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor={`traffic-${competitor.id}`}>
                        Organic traffic
                      </label>
                      <input
                        id={`traffic-${competitor.id}`}
                        name="organicTraffic"
                        type="number"
                        min="0"
                        defaultValue={competitor.metrics?.organicTraffic ?? ''}
                        className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor={`keywords-${competitor.id}`}>
                        Organic keywords
                      </label>
                      <input
                        id={`keywords-${competitor.id}`}
                        name="organicKeywords"
                        type="number"
                        min="0"
                        defaultValue={competitor.metrics?.organicKeywords ?? ''}
                        className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor={`ref-domains-${competitor.id}`}>
                        Referring domains
                      </label>
                      <input
                        id={`ref-domains-${competitor.id}`}
                        name="referringDomains"
                        type="number"
                        min="0"
                        defaultValue={competitor.metrics?.referringDomains ?? ''}
                        className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor={`backlinks-${competitor.id}`}>
                        Backlinks
                      </label>
                      <input
                        id={`backlinks-${competitor.id}`}
                        name="backlinks"
                        type="number"
                        min="0"
                        defaultValue={competitor.metrics?.backlinks ?? ''}
                        className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor={`captured-at-${competitor.id}`}>
                        Captured at
                      </label>
                      <input
                        id={`captured-at-${competitor.id}`}
                        name="capturedAt"
                        type="date"
                        defaultValue={competitor.metrics?.capturedAt ? competitor.metrics.capturedAt.slice(0, 10) : ''}
                        className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor={`top-pages-${competitor.id}`}>
                      Top pages
                    </label>
                    <textarea
                      id={`top-pages-${competitor.id}`}
                      name="topPages"
                      rows={5}
                      defaultValue={formatCompetitorTopPages(competitor.metrics?.topPages)}
                      placeholder="One page per line: https://example.com/page | 1200 | best keyword | optional note"
                      className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1F2937]"
                    >
                      Save metrics
                    </button>
                    {competitor.metrics ? (
                      <span className="rounded-full bg-[#F9FAFB] px-3 py-2 text-xs font-medium text-[#667085]">
                        DR {competitor.metrics.domainRating ?? 'n/a'} · Traffic {competitor.metrics.organicTraffic ?? 'n/a'}
                      </span>
                    ) : null}
                  </div>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-8 text-center">
            <p className="text-sm text-[#9CA3AF]">No workflow competitors saved yet.</p>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold text-[#111827]">Method 01 source set</h2>
          <p className="mt-1 text-sm text-[#667085]">
            Build the Method 01 artifact from approved direct competitors only. This creates a structured checkpoint artifact tied back to the selected source competitors.
          </p>
        </div>

        {approvedDirectCompetitors.length === 0 ? (
          <div className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-8 text-center">
            <p className="text-sm text-[#9CA3AF]">
              No approved direct competitors yet. Save at least one approved direct competitor above before capturing Method 01.
            </p>
          </div>
        ) : (
          <form action={createMethod01ArtifactAction} className="grid gap-4 rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-4">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="workflowId" value={workflowId} />

            <div className="rounded-lg border border-[#D0D5DD] bg-white p-4">
              <p className="text-sm font-medium text-[#111827]">Approved direct competitors</p>
              <p className="mt-1 text-xs text-[#667085]">
                Only approved direct competitors appear here because Method 01 should mine competitor top pages from the approved direct set.
              </p>
              <p className="mt-2 text-xs text-[#667085]">
                Stored competitor top pages are ingested automatically when you generate the artifact. The fields below are only for extra strategist context.
              </p>

              <div className="mt-4 grid gap-3">
                {approvedDirectCompetitors.map((competitor) => (
                  <label key={competitor.id} className="flex items-start gap-3 rounded-lg border border-[#E4E7EC] p-3">
                    <input
                      type="checkbox"
                      name="sourceCompetitor"
                      value={JSON.stringify({
                        id: competitor.id,
                        domain: competitor.domain,
                        bucket: competitor.bucket,
                        status: competitor.status,
                        metrics: competitor.metrics
                          ? {
                              domainRating: competitor.metrics.domainRating,
                              organicTraffic: competitor.metrics.organicTraffic,
                              organicKeywords: competitor.metrics.organicKeywords,
                              referringDomains: competitor.metrics.referringDomains,
                              backlinks: competitor.metrics.backlinks,
                              capturedAt: competitor.metrics.capturedAt,
                              topPages: competitor.metrics.topPages,
                            }
                          : null,
                      })}
                      defaultChecked
                      className="mt-1 h-4 w-4 rounded border border-[#D0D5DD]"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-medium text-[#111827]">{competitor.domain}</p>
                        <div className="flex flex-wrap gap-2">
                          {competitor.metrics ? (
                            <span className="rounded-full bg-[#F9FAFB] px-3 py-1 text-xs font-medium text-[#667085]">
                              DR {competitor.metrics.domainRating ?? 'n/a'}
                            </span>
                          ) : null}
                          {competitor.metrics ? (
                            <span className="rounded-full bg-[#F9FAFB] px-3 py-1 text-xs font-medium text-[#667085]">
                              Traffic {competitor.metrics.organicTraffic ?? 'n/a'}
                            </span>
                          ) : null}
                          {competitor.metrics ? (
                            <span className="rounded-full bg-[#F9FAFB] px-3 py-1 text-xs font-medium text-[#667085]">
                              Keywords {competitor.metrics.organicKeywords ?? 'n/a'}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {competitor.rationale ? <p className="mt-2 text-sm text-[#667085]">{competitor.rationale}</p> : null}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method01-summary">
                Summary note
              </label>
              <input
                id="method01-summary"
                name="summary"
                type="text"
                placeholder="Example: Direct competitors confirm category and comparison page opportunities worth mining"
                className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method01-findings">
                Additional analyst notes
              </label>
              <textarea
                id="method01-findings"
                name="keyFindings"
                rows={5}
                placeholder="Optional: add extra Method 01 observations per line"
                className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method01-top-pages">
                Additional top page candidates
              </label>
              <textarea
                id="method01-top-pages"
                name="topPageCandidates"
                rows={5}
                placeholder="Optional: add extra pages as https://example.com/page | 1200 | best keyword | optional note"
                className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method01-action">
                Recommended next move
              </label>
              <textarea
                id="method01-action"
                name="recommendedAction"
                rows={3}
                placeholder="Example: merge the strongest competitor-page themes into the consolidation pass"
                className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method01-evidence">
                Evidence or analyst notes
              </label>
              <textarea
                id="method01-evidence"
                name="evidence"
                rows={4}
                placeholder="Top page observations, ranking patterns, or fit notes"
                className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method01-open-questions">
                Open questions or blockers
              </label>
              <textarea
                id="method01-open-questions"
                name="openQuestions"
                rows={3}
                placeholder="Optional: one question or blocker per line"
                className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
              />
            </div>

            <div>
              <button
                type="submit"
                className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1F2937]"
              >
                Generate Method 01 artifact
              </button>
            </div>
              </fieldset>
          </form>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold text-[#111827]">Method 02 seed expansion</h2>
          <p className="mt-1 text-sm text-[#667085]">
            Build the Method 02 artifact from stored project keyword rows when they exist, or fall back to the current project seed keywords until the approved-seed ledger is promoted.
          </p>
        </div>

          {selectedStepNotice}

        {sourceMethod02Keywords.length === 0 ? (
          <div className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-8 text-center">
            <p className="text-sm text-[#9CA3AF]">No seed keywords are stored on this project yet.</p>
          </div>
        ) : (
          <form action={createMethod02ArtifactAction} className="grid gap-4 rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-4">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="workflowId" value={workflowId} />

              <fieldset disabled={isReadOnlyStepView} className="grid gap-4">

            <div className="rounded-lg border border-[#D0D5DD] bg-white p-4">
              <p className="text-sm font-medium text-[#111827]">Method 02 source keywords</p>
              <p className="mt-1 text-xs text-[#667085]">
                Select the stored keywords that should drive matching terms, related terms, and parent-topic grouping in Method 02.
              </p>
              <p className="mt-2 text-xs text-[#667085]">
                {method02UsesDiscoveredKeywords
                  ? 'Stored project keyword rows are grouped automatically into parent topic candidates when you generate the artifact.'
                  : 'No project keyword rows are stored yet, so Method 02 will use the current project seed list as an interim source set.'}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {sourceMethod02Keywords.map((sourceKeyword) => (
                  <label key={sourceKeyword.keyword} className="flex items-start gap-3 rounded-lg border border-[#E4E7EC] p-3">
                    <input
                      type="checkbox"
                      name="sourceSeedKeyword"
                      value={JSON.stringify(sourceKeyword)}
                      defaultChecked
                      className="mt-1 h-4 w-4 rounded border border-[#D0D5DD]"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-sm text-[#111827]">{sourceKeyword.keyword}</span>
                        <div className="flex flex-wrap gap-2">
                          {typeof sourceKeyword.searchVolume === 'number' ? (
                            <span className="rounded-full bg-[#F9FAFB] px-3 py-1 text-xs font-medium text-[#667085]">
                              Volume {sourceKeyword.searchVolume}
                            </span>
                          ) : null}
                          {sourceKeyword.intent ? (
                            <span className="rounded-full bg-[#F9FAFB] px-3 py-1 text-xs font-medium text-[#667085]">
                              {sourceKeyword.intent}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {sourceKeyword.parentTopic ? (
                        <p className="mt-2 text-sm text-[#667085]">Parent topic: {sourceKeyword.parentTopic}</p>
                      ) : null}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method02-summary">
                Summary note
              </label>
              <input
                id="method02-summary"
                name="summary"
                type="text"
                placeholder="Example: Seed expansion widened the service cluster into pricing, package, and comparison variants"
                className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method02-findings">
                Additional analyst notes
              </label>
              <textarea
                id="method02-findings"
                name="keyFindings"
                rows={5}
                placeholder="Optional: add extra Method 02 observations per line"
                className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method02-parent-topics">
                Additional parent topic candidates
              </label>
              <textarea
                id="method02-parent-topics"
                name="parentTopicCandidates"
                rows={5}
                placeholder="Optional: add extra candidates as Parent Topic | Cluster Keyword | optional note"
                className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method02-questions">
                Additional question and related-term opportunities
              </label>
              <textarea
                id="method02-questions"
                name="questionKeywords"
                rows={4}
                placeholder="Optional: add extra question or related-term opportunities per line"
                className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method02-action">
                Recommended next move
              </label>
              <textarea
                id="method02-action"
                name="recommendedAction"
                rows={3}
                placeholder="Example: merge the strongest parent topics into the consolidation pass and compare them against Method 01"
                className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method02-evidence">
                Evidence or analyst notes
              </label>
              <textarea
                id="method02-evidence"
                name="evidence"
                rows={4}
                placeholder="Parent topic observations, questions-tab notes, or related-term evidence"
                className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="method02-open-questions">
                Open questions or blockers
              </label>
              <textarea
                id="method02-open-questions"
                name="openQuestions"
                rows={3}
                placeholder="Optional: one question or blocker per line"
                className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
              />
            </div>

            <div>
              <button
                type="submit"
                className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1F2937]"
              >
                Generate Method 02 artifact
              </button>
            </div>
              </fieldset>
          </form>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold text-[#111827]">Consolidated keywords</h2>
          <p className="mt-1 text-sm text-[#667085]">
            Generate a first-pass consolidated ledger from the latest approved workflow artifacts before the topical map review.
          </p>
        </div>

          {selectedStepNotice}

        {consolidationSourceArtifacts.length === 0 ? (
          <div className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-8 text-center">
            <p className="text-sm text-[#9CA3AF]">
              Approve Phase 1, Method 01, Method 02, or Method 03 artifacts before generating consolidated keywords.
            </p>
          </div>
        ) : (
          <form action={createConsolidatedKeywordsArtifactAction} className="grid gap-4 rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-4">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="workflowId" value={workflowId} />

              <fieldset disabled={isReadOnlyStepView} className="grid gap-4">

            <div className="rounded-lg border border-[#D0D5DD] bg-white p-4">
              <p className="text-sm font-medium text-[#111827]">Approved consolidation sources</p>
              <p className="mt-1 text-xs text-[#667085]">
                The generator uses the latest approved artifacts per step, so pending revisions do not block a first-pass ledger.
              </p>

              <div className="mt-4 grid gap-3">
                {consolidationSourceArtifacts.map((artifact) => (
                  <div key={artifact.id} className="rounded-lg border border-[#E4E7EC] p-3">
                    <input
                      type="hidden"
                      name="sourceArtifact"
                      value={JSON.stringify({
                        id: artifact.id,
                        stepKey: artifact.stepKey,
                        payload: artifact.payload,
                      })}
                    />

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-medium text-[#111827]">{artifact.stepKey}</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-[#ECFDF3] px-3 py-1 text-xs font-medium text-[#027A48]">
                          Approved source
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1F2937]"
              >
                Generate consolidated keyword artifact
              </button>
            </div>
              </fieldset>
          </form>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold text-[#111827]">Topical map</h2>
          <p className="mt-1 text-sm text-[#667085]">
            Generate a first-pass pillar and cluster map from the latest approved consolidated ledger before content brief generation.
          </p>
        </div>

          {selectedStepNotice}

        {!approvedConsolidatedArtifact ? (
          <div className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-8 text-center">
            <p className="text-sm text-[#9CA3AF]">
              Approve a consolidated keywords artifact before generating the topical map.
            </p>
          </div>
        ) : (
          <form action={createTopicalMapArtifactAction} className="grid gap-4 rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-4">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="workflowId" value={workflowId} />
            <input
              type="hidden"
              name="sourceArtifact"
              value={JSON.stringify({
                id: approvedConsolidatedArtifact.id,
                stepKey: approvedConsolidatedArtifact.stepKey,
                payload: approvedConsolidatedArtifact.payload,
              })}
            />

            <fieldset disabled={isReadOnlyStepView} className="grid gap-4">

            <div className="rounded-lg border border-[#D0D5DD] bg-white p-4">
              <p className="text-sm font-medium text-[#111827]">Approved topical map source</p>
              <p className="mt-1 text-xs text-[#667085]">
                The generator groups the approved consolidated ledger into pillar and cluster candidates, then prepares a content-brief queue from the same source.
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[#111827]">{approvedConsolidatedArtifact.stepKey}</p>
                  <p className="mt-1 text-xs text-[#667085]">
                    {readArtifactText(approvedConsolidatedArtifact.summary) ?? 'Latest approved consolidated ledger.'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#ECFDF3] px-3 py-1 text-xs font-medium text-[#027A48]">
                    Approved source
                  </span>
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1F2937]"
              >
                Generate topical map artifact
              </button>
            </div>
            </fieldset>
          </form>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold text-[#111827]">Final research outputs</h2>
          <p className="mt-1 text-sm text-[#667085]">
            These are the workflow-scoped rows promoted into the final research tables from the latest approved consolidation and topical-map checkpoints.
          </p>
        </div>

        {persistedWorkflowKeywords.length === 0 && !persistedTopicalMap ? (
          <div className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-8 text-center">
            <p className="text-sm text-[#9CA3AF]">
              Approve the consolidated keyword ledger and topical map to materialize the final research outputs.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            <article className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[#111827]">Persisted keyword ledger</h3>
                  <p className="mt-1 text-sm text-[#667085]">
                    Approved consolidated keywords are now written into the workflow-scoped `keywords` table and excluded from Method 02 source selection.
                  </p>
                </div>

                {keywordLedgerDownloadHref ? (
                  <a
                    href={keywordLedgerDownloadHref}
                    download={`${toDownloadFileToken(project.name)}-${toDownloadFileToken(workflow.country)}-keyword-ledger.csv`}
                    className="inline-flex rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm font-medium text-[#111827] transition hover:bg-[#F9FAFB]"
                  >
                    Export keyword CSV
                  </a>
                ) : null}
              </div>

              {persistedWorkflowKeywords.length === 0 ? (
                <p className="mt-4 text-sm text-[#9CA3AF]">No persisted workflow keywords yet.</p>
              ) : (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#344054]">
                      {persistedWorkflowKeywords.length} keyword{persistedWorkflowKeywords.length === 1 ? '' : 's'}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#344054]">
                      {persistedWorkflowKeywords.filter((keyword) => Boolean(keyword.notes)).length} inferred classification note{persistedWorkflowKeywords.filter((keyword) => Boolean(keyword.notes)).length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="mt-4 overflow-x-auto rounded-lg border border-[#E4E7EC] bg-white">
                    <table className="min-w-full divide-y divide-[#E4E7EC] text-left text-sm text-[#111827]">
                      <thead className="bg-[#F9FAFB] text-xs uppercase tracking-[0.08em] text-[#667085]">
                        <tr>
                          <th className="px-3 py-2 font-medium">Keyword</th>
                          <th className="px-3 py-2 font-medium">Parent topic</th>
                          <th className="px-3 py-2 font-medium">Intent</th>
                          <th className="px-3 py-2 font-medium">Funnel</th>
                          <th className="px-3 py-2 font-medium">Source methods</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4E7EC]">
                        {persistedWorkflowKeywords.map((keyword) => (
                          <tr key={keyword.id}>
                            <td className="px-3 py-2 align-top">
                              <p className="font-medium text-[#111827]">{keyword.keyword}</p>
                              {keyword.notes ? <p className="mt-1 text-xs text-[#667085]">{keyword.notes}</p> : null}
                            </td>
                            <td className="px-3 py-2 align-top text-[#667085]">{keyword.parentTopic ?? '—'}</td>
                            <td className="px-3 py-2 align-top text-[#667085]">{keyword.intent}</td>
                            <td className="px-3 py-2 align-top text-[#667085]">{keyword.funnel}</td>
                            <td className="px-3 py-2 align-top text-[#667085]">{keyword.sourceMethods?.join(', ') || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </article>

            <article className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[#111827]">Persisted topical map</h3>
                  <p className="mt-1 text-sm text-[#667085]">
                    The approved topical map is now written into the final `topical_maps` table for this workflow run.
                  </p>
                </div>

                {persistedTopicalMapDownloadHref ? (
                  <a
                    href={persistedTopicalMapDownloadHref}
                    download={`${toDownloadFileToken(project.name)}-${toDownloadFileToken(workflow.country)}-topical-map.json`}
                    className="inline-flex rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm font-medium text-[#111827] transition hover:bg-[#F9FAFB]"
                  >
                    Export topical map JSON
                  </a>
                ) : null}
              </div>

              {!persistedTopicalMap ? (
                <p className="mt-4 text-sm text-[#9CA3AF]">No persisted workflow topical map yet.</p>
              ) : (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#344054]">
                      {persistedTopicalMapPrimaryTopics.length} pillar{persistedTopicalMapPrimaryTopics.length === 1 ? '' : 's'}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#344054]">
                      Updated {new Date(persistedTopicalMap.updatedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {persistedTopicalMapPrimaryTopics.map((topic, index) => {
                      const topicRecord = topic as Record<string, unknown>;
                      const clusterCount = typeof topicRecord.clusterCount === 'number' ? topicRecord.clusterCount : 0;
                      const suggestedUrlPath =
                        typeof topicRecord.suggestedUrlPath === 'string' && topicRecord.suggestedUrlPath.trim().length > 0
                          ? topicRecord.suggestedUrlPath.trim()
                          : null;

                      return (
                        <div key={`${String(topicRecord.pillar ?? 'pillar')}-${index}`} className="rounded-lg border border-[#E4E7EC] bg-white p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-medium text-[#111827]">{String(topicRecord.pillar ?? 'Untitled pillar')}</p>
                              {suggestedUrlPath ? <p className="mt-1 text-xs text-[#667085]">{suggestedUrlPath}</p> : null}
                            </div>

                            <span className="rounded-full bg-[#F9FAFB] px-3 py-1 text-xs font-medium text-[#667085]">
                              {clusterCount} keyword{clusterCount === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </article>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold text-[#111827]">Content brief handoff</h2>
          <p className="mt-1 text-sm text-[#667085]">
            Promote an approved topical-map node into a workflow-aware content brief input that can be reviewed before article generation.
          </p>
        </div>

          {selectedStepNotice}

        {!approvedTopicalMapArtifact || approvedContentBriefQueue.length === 0 ? (
          <div className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-8 text-center">
            <p className="text-sm text-[#9CA3AF]">
              Approve a topical-map artifact with queued content nodes before generating a content brief artifact.
            </p>
          </div>
        ) : (
          <form action={createContentBriefArtifactAction} className="grid gap-4 rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-4">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="workflowId" value={workflowId} />
            <input type="hidden" name="language" value={workflow.language} />
            <input type="hidden" name="country" value={workflow.country} />
            <input
              type="hidden"
              name="sourceArtifact"
              value={JSON.stringify({
                id: approvedTopicalMapArtifact.id,
                stepKey: approvedTopicalMapArtifact.stepKey,
                payload: approvedTopicalMapArtifact.payload,
              })}
            />

            <fieldset disabled={isReadOnlyStepView} className="grid gap-4">

            <div className="rounded-lg border border-[#D0D5DD] bg-white p-4">
              <p className="text-sm font-medium text-[#111827]">Approved brief queue</p>
              <p className="mt-1 text-xs text-[#667085]">
                Select one approved topical-map node to promote into a structured brief input artifact.
              </p>

              <div className="mt-4 grid gap-3">
                {approvedContentBriefQueue.map((queueEntry, index) => (
                  <label key={`${queueEntry.pillar}-${queueEntry.keyword}`} className="flex items-start gap-3 rounded-lg border border-[#E4E7EC] p-3">
                    <input
                      type="radio"
                      name="selectedQueueKey"
                      value={`${queueEntry.pillar}::${queueEntry.keyword}`}
                      defaultChecked={index === 0}
                      className="mt-1 h-4 w-4 border border-[#D0D5DD]"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-[#111827]">{queueEntry.keyword}</p>
                          <p className="mt-1 text-xs text-[#667085]">Pillar: {queueEntry.pillar}</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-[#F4F6FA] px-3 py-1 text-xs font-medium text-[#344054]">
                            {queueEntry.contentType}
                          </span>
                          {queueEntry.suggestedUrlPath ? (
                            <span className="rounded-full bg-[#F9FAFB] px-3 py-1 text-xs font-medium text-[#667085]">
                              {queueEntry.suggestedUrlPath}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="content-brief-editorial-notes">
                Editorial notes
              </label>
              <textarea
                id="content-brief-editorial-notes"
                name="editorialNotes"
                rows={4}
                placeholder="Optional: CTA, internal-link priorities, conversion notes, or editor guidance"
                className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
              />
            </div>

            <div>
              <button
                type="submit"
                className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1F2937]"
              >
                Generate content brief artifact
              </button>
            </div>
            </fieldset>
          </form>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold text-[#111827]">Content article</h2>
          <p className="mt-1 text-sm text-[#667085]">
            Promote an approved content brief into a workflow-aware article input artifact before queue-backed draft generation is wired in.
          </p>
        </div>

          {selectedStepNotice}

        {!approvedContentBriefArtifact || !approvedContentBrief ? (
          <div className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-8 text-center">
            <p className="text-sm text-[#9CA3AF]">
              Approve a content-brief artifact before generating the content article artifact.
            </p>
          </div>
        ) : (
          <form action={createContentArticleArtifactAction} className="grid gap-4 rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-4">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="workflowId" value={workflowId} />
            <input
              type="hidden"
              name="sourceArtifact"
              value={JSON.stringify({
                id: approvedContentBriefArtifact.id,
                stepKey: approvedContentBriefArtifact.stepKey,
                payload: approvedContentBriefArtifact.payload,
              })}
            />

            <fieldset disabled={isReadOnlyStepView} className="grid gap-4">

            <div className="rounded-lg border border-[#D0D5DD] bg-white p-4">
              <p className="text-sm font-medium text-[#111827]">Approved article source</p>
              <p className="mt-1 text-xs text-[#667085]">
                The article input generator uses the latest approved content brief as the single downstream source of truth.
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[#111827]">{approvedContentBrief.targetKeyword}</p>
                  <p className="mt-1 text-xs text-[#667085]">Pillar: {approvedContentBrief.pillar}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#F4F6FA] px-3 py-1 text-xs font-medium text-[#344054]">
                    {approvedContentBrief.contentType}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#D0D5DD] bg-white p-4">
              <p className="text-sm font-medium text-[#111827]">Title selection</p>
              <p className="mt-1 text-xs text-[#667085]">
                Choose the approved article title direction that should anchor the next checkpoint.
              </p>

              <div className="mt-4 grid gap-3">
                {contentArticleTitleOptions.map((title, index) => (
                  <label key={title} className="flex items-start gap-3 rounded-lg border border-[#E4E7EC] p-3">
                    <input
                      type="radio"
                      name="selectedTitle"
                      value={title}
                      defaultChecked={index === 0}
                      className="mt-1 h-4 w-4 border border-[#D0D5DD]"
                    />

                    <span className="text-sm text-[#111827]">{title}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="content-article-notes">
                Draft notes
              </label>
              <textarea
                id="content-article-notes"
                name="articleNotes"
                rows={4}
                placeholder="Optional: final angle, CTA emphasis, proof points, or editorial direction for the article draft"
                className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
              />
            </div>

            <div>
              <button
                type="submit"
                className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1F2937]"
              >
                Generate content article artifact
              </button>
            </div>
            </fieldset>
          </form>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold text-[#111827]">Persisted content outputs</h2>
          <p className="mt-1 text-sm text-[#667085]">
            Approved content checkpoints upsert workflow-linked rows into content_pieces. Approving a content article
            checkpoint automatically triggers AI article generation — the card below updates live once the draft is ready.
          </p>
        </div>

        {persistedContentPieces.length === 0 ? (
          <div className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-8 text-center">
            <p className="text-sm text-[#9CA3AF]">
              Approve a content brief or content article artifact to materialize workflow-linked content pieces.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {persistedContentPieces.map((piece) => {
              const persistedKeyword = persistedKeywordsById.get(piece.keywordId);
              const briefRecord = readObjectRecord(piece.brief);
              const reviewNotes = readObjectRecord(piece.reviewNotes);
              const articleInput = readObjectRecord(reviewNotes?.articleInput);
              const pillar =
                typeof briefRecord?.pillar === 'string' && briefRecord.pillar.trim().length > 0
                  ? briefRecord.pillar.trim()
                  : persistedKeyword?.parentTopic ?? '—';
              const suggestedUrlPath =
                typeof briefRecord?.suggestedUrlPath === 'string' && briefRecord.suggestedUrlPath.trim().length > 0
                  ? briefRecord.suggestedUrlPath.trim()
                  : null;
              const articleSectionCount = Array.isArray(articleInput?.articleSections)
                ? articleInput.articleSections.filter(
                    (value): value is string => typeof value === 'string' && value.trim().length > 0,
                  ).length
                : 0;

              return (
                <ContentPieceStatusCard
                  key={piece.id}
                  initialPiece={piece}
                  keyword={persistedKeyword?.keyword ?? null}
                  pillar={pillar}
                  suggestedUrlPath={suggestedUrlPath}
                  articleSectionCount={articleSectionCount}
                  workflowCountry={workflow.country}
                  apiUrl={process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002'}
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[#111827]">Other checkpoint review</h2>
          <p className="mt-1 text-sm text-[#667085]">Latest artifacts for the rest of the workflow, outside the active step workspace.</p>
        </div>

        {secondaryCheckpointArtifacts.length === 0 ? (
          <div className="rounded-xl border border-[#E8EAF0] bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-[#9CA3AF]">No additional checkpoint records to review yet.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {secondaryCheckpointArtifacts.map((artifact) => {
              const summaryText = readArtifactText(artifact.summary);
              const latestDecision = artifact.approvals?.[0] ?? null;

              return (
                <article key={artifact.id} className="rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-[#111827]">
                        {isWorkflowStepKey(artifact.stepKey) ? formatWorkflowStepLabel(artifact.stepKey) : artifact.stepKey}
                      </h3>
                      <p className="mt-1 text-sm text-[#667085]">Saved {new Date(artifact.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#F4F6FA] px-3 py-1 text-xs font-medium text-[#344054]">
                        {artifact.status.replaceAll('_', ' ')}
                      </span>
                      <span className="rounded-full bg-[#F9FAFB] px-3 py-1 text-xs font-medium text-[#667085]">
                        {artifact.approvals?.length ?? 0} decision{artifact.approvals?.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>

                  {summaryText ? (
                    <div className="mt-4">
                      <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">Summary</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-[#111827]">{summaryText}</p>
                    </div>
                  ) : null}

                  {hasArtifactPayloadContent(artifact.payload) ? (
                    <div className="mt-4">
                      <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">Checkpoint details</p>
                      <div className="mt-2 rounded-lg bg-[#F9FAFB] p-3">
                        <ArtifactPayloadView payload={artifact.payload} />
                      </div>
                    </div>
                  ) : null}

                  {latestDecision ? (
                    <div className="mt-4 rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">Latest decision</p>
                      <p className="mt-2 text-sm font-medium text-[#111827]">{latestDecision.decision.replaceAll('_', ' ')}</p>
                      {latestDecision.notes ? <p className="mt-2 text-sm text-[#667085]">{latestDecision.notes}</p> : null}
                    </div>
                  ) : null}

                  <form action={reviewCheckpointAction} className="mt-6 grid gap-3 rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-4">
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="workflowId" value={workflowId} />
                    <input type="hidden" name="stepKey" value={artifact.stepKey} />

                    <div>
                      <label
                        className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]"
                        htmlFor={`notes-${artifact.id}`}
                      >
                        Review note
                      </label>
                      <textarea
                        id={`notes-${artifact.id}`}
                        name="notes"
                        rows={3}
                        placeholder="Optional checkpoint note"
                        className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        name="decision"
                        value="APPROVED"
                        className="rounded-lg bg-[#101828] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1D2939]"
                      >
                        Approve
                      </button>
                      <button
                        type="submit"
                        name="decision"
                        value="REVISION_REQUESTED"
                        className="rounded-lg border border-[#D0D5DD] bg-white px-4 py-2 text-sm font-medium text-[#344054] transition hover:bg-[#F9FAFB]"
                      >
                        Request revision
                      </button>
                      <button
                        type="submit"
                        name="decision"
                        value="REJECTED"
                        className="rounded-lg border border-[#F04438] bg-white px-4 py-2 text-sm font-medium text-[#B42318] transition hover:bg-[#FFF5F5]"
                      >
                        Reject
                      </button>
                    </div>
                  </form>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[#111827]">Checkpoint history</h2>
          <p className="mt-1 text-sm text-[#667085]">
            Full checkpoint history grouped by workflow step so strategists can review prior saved records, not only the latest card.
          </p>
        </div>

        {artifactHistory.length === 0 ? (
          <div className="rounded-xl border border-[#E8EAF0] bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-[#9CA3AF]">No checkpoint history yet for this workflow.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {artifactHistory.map(([stepKey, versions]) => (
              <article key={stepKey} className="rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-[#111827]">{stepKey}</h3>
                    <p className="mt-1 text-sm text-[#667085]">{versions.length} checkpoint record{versions.length === 1 ? '' : 's'}</p>
                  </div>
                  <span className="rounded-full bg-[#F4F6FA] px-3 py-1 text-xs font-medium text-[#344054]">
                    Latest: {versions[0]?.status.replaceAll('_', ' ')}
                  </span>
                </div>

                <div className="mt-4 grid gap-3">
                  {versions.map((artifact) => {
                    const summaryText = readArtifactText(artifact.summary);
                    const latestDecision = artifact.approvals?.[0] ?? null;

                    return (
                      <div key={artifact.id} className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-medium text-[#111827]">Checkpoint record</p>
                            <p className="mt-1 text-xs text-[#667085]">
                              Created {new Date(artifact.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#344054]">
                              {artifact.status.replaceAll('_', ' ')}
                            </span>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#667085]">
                              {artifact.approvals?.length ?? 0} decision{artifact.approvals?.length === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>

                        {summaryText ? (
                          <div className="mt-3">
                            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">Summary</p>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-[#111827]">{summaryText}</p>
                          </div>
                        ) : null}

                        {hasArtifactPayloadContent(artifact.payload) ? (
                          <div className="mt-3">
                            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">Checkpoint details</p>
                            <div className="mt-2 rounded-lg bg-white p-3">
                              <ArtifactPayloadView payload={artifact.payload} />
                            </div>
                          </div>
                        ) : null}

                        {latestDecision ? (
                          <div className="mt-3 rounded-lg border border-[#D0D5DD] bg-white p-3">
                            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">Latest decision</p>
                            <p className="mt-2 text-sm font-medium text-[#111827]">
                              {latestDecision.decision.replaceAll('_', ' ')}
                            </p>
                            {latestDecision.notes ? (
                              <p className="mt-2 text-sm text-[#667085]">{latestDecision.notes}</p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

        */}

      </WorkflowShellLayout>
    </div>
  );
}