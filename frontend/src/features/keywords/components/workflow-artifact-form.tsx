'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';

const STEP_TEMPLATES = {
  'business-profile': {
    title: 'Business profile',
    guidance: 'Generate a draft from the project website, then edit the business model, buyer, offer positioning, and any constraints before seed approval.',
    summaryPlaceholder: 'Example: Positioned as a premium UAE ecommerce appliance brand with B2C focus',
    headlineLabel: 'Core positioning',
    findingsLabel: 'Business profile details',
    findingsPlaceholder: 'One generated business profile detail per line',
    actionLabel: 'Recommended next move',
    actionPlaceholder: 'Example: confirm service categories before finalizing seed keywords',
    evidenceLabel: 'Evidence or source notes',
    evidencePlaceholder: 'Paste excerpts, URLs, or analyst notes',
  },
  'seed-keywords': {
    title: 'Seed keywords',
    guidance: 'Review the generated Step 1 seed list, remove weak terms, add missing commercial terms, and confirm the final set.',
    summaryPlaceholder: 'Example: Seed list reduced from 12 to 8 after removing non-commercial topics',
    headlineLabel: 'Seed keyword source and decision',
    findingsLabel: 'Confirmed seed keywords',
    findingsPlaceholder: 'One confirmed seed keyword per line',
    actionLabel: 'Recommended next move',
    actionPlaceholder: 'Example: proceed to SERP validation on approved commercial seeds',
    evidenceLabel: 'Evidence or source notes',
    evidencePlaceholder: 'Intent conflicts, business constraints, or SERP notes',
  },
  'serp-niche-map': {
    title: 'SERP niche map',
    guidance: 'Capture the ranking page types, core topics, and cluster structure emerging from the SERP.',
    summaryPlaceholder: 'Example: SERP shows pillar opportunities around product categories and buying guides',
    headlineLabel: 'Niche structure takeaway',
    findingsLabel: 'Core topics and sub-topics',
    findingsPlaceholder: 'One topic or structure note per line',
    actionLabel: 'Recommended next move',
    actionPlaceholder: 'Example: validate the top 5 recurring domains as competitor candidates',
    evidenceLabel: 'Evidence or source notes',
    evidencePlaceholder: 'Top-ranking URLs, page types, and SERP observations',
  },
  'competitor-buckets': {
    title: 'Competitor buckets',
    guidance: 'Separate direct and organic competitors and capture why each domain belongs in the bucket.',
    summaryPlaceholder: 'Example: Approved 3 direct competitors and 2 organic competitors for AE research',
    headlineLabel: 'Competitor bucketing decision',
    findingsLabel: 'Approved or rejected competitor notes',
    findingsPlaceholder: 'One competitor note per line',
    actionLabel: 'Recommended next move',
    actionPlaceholder: 'Example: pull metrics for approved direct and organic competitors',
    evidenceLabel: 'Evidence or source notes',
    evidencePlaceholder: 'Service overlap, geography match, or SERP relevance notes',
  },
  'competitor-metrics': {
    title: 'Competitor metrics',
    guidance: 'Summarize the usable competitor footprint and key differences in authority, traffic, and top pages.',
    summaryPlaceholder: 'Example: Two direct competitors dominate category traffic but weak editorial coverage remains',
    headlineLabel: 'Metrics takeaway',
    findingsLabel: 'Metrics findings',
    findingsPlaceholder: 'One metrics finding per line',
    actionLabel: 'Recommended next move',
    actionPlaceholder: 'Example: continue into Phase 1 baseline and direct competitor mining',
    evidenceLabel: 'Evidence or source notes',
    evidencePlaceholder: 'Traffic, DR, top pages, or blog observations',
  },
  'phase1-baseline': {
    title: 'Phase 1 baseline',
    guidance: 'Document existing winning URLs, dedupe coverage, and priority verticals from the client site.',
    summaryPlaceholder: 'Example: Existing traction concentrated in product-category pages; how-to content remains thin',
    headlineLabel: 'Baseline coverage takeaway',
    findingsLabel: 'Existing coverage findings',
    findingsPlaceholder: 'One baseline finding per line',
    actionLabel: 'Recommended next move',
    actionPlaceholder: 'Example: use these URLs as the dedupe guardrail for Methods 01 to 03',
    evidenceLabel: 'Evidence or source notes',
    evidencePlaceholder: 'Top pages, existing keywords, or priority vertical notes',
  },
  'method01-competitor-pages': {
    title: 'Method 01',
    guidance: 'Capture the high-signal competitor pages and the candidate keywords they contribute.',
    summaryPlaceholder: 'Example: Competitor page mining surfaced BOFU cluster opportunities around category + use case pages',
    headlineLabel: 'Competitor page takeaway',
    findingsLabel: 'Method 01 findings',
    findingsPlaceholder: 'One keyword/page finding per line',
    actionLabel: 'Recommended next move',
    actionPlaceholder: 'Example: compare these clusters against seed expansion output',
    evidenceLabel: 'Evidence or source notes',
    evidencePlaceholder: 'Competitor URLs, top keywords, and fit notes',
  },
  'method02-seed-expansion': {
    title: 'Method 02',
    guidance: 'Capture matching terms, related terms, and parent-topic groupings from the approved seed set.',
    summaryPlaceholder: 'Example: Matching terms expanded the appliance pillar into installation, maintenance, and brand-intent clusters',
    headlineLabel: 'Seed expansion takeaway',
    findingsLabel: 'Method 02 findings',
    findingsPlaceholder: 'One parent topic or cluster note per line',
    actionLabel: 'Recommended next move',
    actionPlaceholder: 'Example: merge with competitor-page gaps and prepare for Content Gap import',
    evidenceLabel: 'Evidence or source notes',
    evidencePlaceholder: 'Parent topics, intent spread, or questions-tab notes',
  },
  'method03-content-gap-import': {
    title: 'Method 03',
    guidance: 'Capture the strategist-reviewed takeaways from the manual Ahrefs Content Gap export.',
    summaryPlaceholder: 'Example: Content Gap confirmed missed mid-funnel comparison pages absent from the client site',
    headlineLabel: 'Content Gap takeaway',
    findingsLabel: 'Method 03 findings',
    findingsPlaceholder: 'One imported gap insight per line',
    actionLabel: 'Recommended next move',
    actionPlaceholder: 'Example: consolidate cross-method winners and remove Phase 1 duplicates',
    evidenceLabel: 'Evidence or source notes',
    evidencePlaceholder: 'Export notes, competitor overlap rules, or manual cleanup notes',
  },
  'consolidated-keywords': {
    title: 'Consolidation',
    guidance: 'Record the final keep/remove logic after dedupe, irrelevance filtering, and source consolidation.',
    summaryPlaceholder: 'Example: Final ledger retained 84 keywords after dedupe and removed 17 irrelevant variants',
    headlineLabel: 'Consolidation takeaway',
    findingsLabel: 'Ledger decisions',
    findingsPlaceholder: 'One keep/remove decision per line',
    actionLabel: 'Recommended next move',
    actionPlaceholder: 'Example: promote the retained set into pillar and cluster mapping',
    evidenceLabel: 'Evidence or source notes',
    evidencePlaceholder: 'Dedupe rules, removals, or editorial notes',
  },
  'topical-map': {
    title: 'Topical map',
    guidance: 'Capture the final pillar/cluster structure, mapped URLs, and any rollout priorities.',
    summaryPlaceholder: 'Example: Approved 5 pillars with rollout priority on transactional category and comparison clusters',
    headlineLabel: 'Topical map takeaway',
    findingsLabel: 'Pillar and cluster decisions',
    findingsPlaceholder: 'One map decision per line',
    actionLabel: 'Recommended next move',
    actionPlaceholder: 'Example: move approved clusters into brief generation order',
    evidenceLabel: 'Evidence or source notes',
    evidencePlaceholder: 'Pillar priority, target URLs, or existing coverage mapping',
  },
  'content-brief': {
    title: 'Content brief',
    guidance: 'Capture the target keyword, outline, internal-link plan, and editorial direction before article generation.',
    summaryPlaceholder: 'Example: Approved brief input for the transactional pillar with pricing CTA and internal-link targets',
    headlineLabel: 'Brief takeaway',
    findingsLabel: 'Brief decisions',
    findingsPlaceholder: 'One approved brief decision per line',
    actionLabel: 'Recommended next move',
    actionPlaceholder: 'Example: send the approved brief into article generation',
    evidenceLabel: 'Evidence or source notes',
    evidencePlaceholder: 'Topical-map source, SERP notes, CTA guidance, or internal-link priorities',
  },
  'content-article': {
    title: 'Content article',
    guidance: 'Capture the selected title, section plan, and draft requirements after the brief has been approved.',
    summaryPlaceholder: 'Example: Approved article input with final title, section plan, and internal-link requirements',
    headlineLabel: 'Article takeaway',
    findingsLabel: 'Article input decisions',
    findingsPlaceholder: 'One approved article-input decision per line',
    actionLabel: 'Recommended next move',
    actionPlaceholder: 'Example: send the approved article input into queue-backed draft generation',
    evidenceLabel: 'Evidence or source notes',
    evidencePlaceholder: 'Approved brief source, title choice, or final editorial direction',
  },
} as const;

type StepKey = keyof typeof STEP_TEMPLATES;

type ArtifactFormInitialValues = {
  summary: string;
  headline: string;
  keyFindings: string;
  recommendedAction: string;
  evidence: string;
  openQuestions: string;
};

type SeedKeywordStepSource = {
  sourceArtifactId: string | null;
  keywords: string[];
};

interface WorkflowArtifactFormProps {
  action: (formData: FormData) => void | Promise<void>;
  projectId: string;
  workflowId: string;
  defaultStep: string;
  lockedStep?: boolean;
  readOnly?: boolean;
  initialValuesByStep?: Partial<Record<StepKey, ArtifactFormInitialValues>>;
  seedKeywordStepSource?: SeedKeywordStepSource;
}

function ApproveArtifactButton({ isPending }: { isPending: boolean }) {
  return (
    <button
      type="submit"
      disabled={isPending}
      className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1F2937] disabled:cursor-wait disabled:bg-[#667085]"
    >
      {isPending ? (
        <span className="flex items-center gap-2">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          Approving and continuing…
        </span>
      ) : (
        'Approve and continue'
      )}
    </button>
  );
}

export function WorkflowArtifactForm({
  action,
  projectId,
  workflowId,
  defaultStep,
  lockedStep = false,
  readOnly = false,
  initialValuesByStep,
  seedKeywordStepSource,
}: WorkflowArtifactFormProps) {
  const initialStep = (defaultStep in STEP_TEMPLATES ? defaultStep : 'business-profile') as StepKey;
  const [stepKey, setStepKey] = useState<StepKey>(initialStep);
  const [isPending, setIsPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const isContentGapStep = stepKey === 'method03-content-gap-import';
  const isPhase1BaselineStep = stepKey === 'phase1-baseline';
  const isSeedKeywordStep = stepKey === 'seed-keywords';

  useEffect(() => {
    setStepKey(initialStep);
    setActionError(null);
  }, [initialStep]);

  const template = useMemo(() => STEP_TEMPLATES[stepKey], [stepKey]);
  const initialValues = initialValuesByStep?.[stepKey];

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;
    const formData = new FormData(event.currentTarget);
    setActionError(null);
    setIsPending(true);
    startTransition(async () => {
      try {
        await action(formData);
      } catch (err: unknown) {
        // Re-throw Next.js redirect/notFound signals so the router can handle them
        if (err && typeof err === 'object' && 'digest' in err) throw err;
        setActionError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
      } finally {
        setIsPending(false);
      }
    });
  };

  if (readOnly) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="workflowId" value={workflowId} />
      <input type="hidden" name="stepKey" value={stepKey} />

      {!lockedStep ? (
        <div>
          <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="stepKeySelect">
            Workflow step
          </label>
          <select
            id="stepKeySelect"
            value={stepKey}
            onChange={(event) => setStepKey(event.target.value as StepKey)}
            className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
          >
            {(Object.keys(STEP_TEMPLATES) as StepKey[]).map((step) => (
              <option key={step} value={step}>
                {step}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {isSeedKeywordStep ? (
        <div className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-4">
          <p className="text-sm font-medium text-[#111827]">Step 1 seed keyword handoff</p>
          {seedKeywordStepSource ? (
            <>
              <p className="mt-1 text-sm text-[#667085]">
                Loaded {seedKeywordStepSource.keywords.length} generated seed keyword{seedKeywordStepSource.keywords.length === 1 ? '' : 's'} from the latest business-profile checkpoint. Edit the confirmed list below before approving Step 2.
              </p>
              <p className="mt-2 text-xs text-[#667085]">Source checkpoint: business-profile</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {seedKeywordStepSource.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full border border-[#D0D5DD] bg-white px-3 py-1 text-xs text-[#344054]"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-1 text-sm text-[#667085]">
              Generate or approve the business-profile step first so Step 2 can load the seed keywords for confirmation.
            </p>
          )}
        </div>
      ) : null}

      <div key={stepKey} className="contents">
      {isContentGapStep ? (
        <div className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-4">
          <p className="text-sm font-medium text-[#111827]">Manual Ahrefs Content Gap import</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#667085]">
            <li>Open Site Explorer for the client website in Ahrefs.</li>
            <li>Go to Content Gap and add 3 to 5 approved direct competitors.</li>
            <li>Keep the client site in the comparison and filter for keywords competitors rank for while the client does not.</li>
            <li>Export the filtered CSV or TSV with the header row intact.</li>
            <li>Paste the export below so the workflow can store a normalized import artifact.</li>
          </ol>
        </div>
      ) : null}

      {isPhase1BaselineStep ? (
        <div className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-4">
          <p className="text-sm font-medium text-[#111827]">Phase 1 baseline capture</p>
          <p className="mt-1 text-sm text-[#667085]">
            Capture the client site's current winners, core topics, and dedupe guardrails before the workflow moves into Methods 01 to 03.
          </p>
        </div>
      ) : null}

      <div>
        <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="summary">
          Summary note
        </label>
        <input
          id="summary"
          name="summary"
          type="text"
          defaultValue={initialValues?.summary ?? ''}
          placeholder={template.summaryPlaceholder}
          className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
        />
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="headline">
          {template.headlineLabel}
        </label>
        <textarea
          id="headline"
          name="headline"
          rows={2}
          defaultValue={initialValues?.headline ?? ''}
          placeholder={template.summaryPlaceholder}
          className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
        />
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="keyFindings">
          {template.findingsLabel}
        </label>
        <textarea
          id="keyFindings"
          name="keyFindings"
          rows={5}
          required
          defaultValue={initialValues?.keyFindings ?? ''}
          placeholder={template.findingsPlaceholder}
          className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
        />
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="recommendedAction">
          {template.actionLabel}
        </label>
        <textarea
          id="recommendedAction"
          name="recommendedAction"
          rows={3}
          defaultValue={initialValues?.recommendedAction ?? ''}
          placeholder={template.actionPlaceholder}
          className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
        />
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="evidence">
          {template.evidenceLabel}
        </label>
        <textarea
          id="evidence"
          name="evidence"
          rows={4}
          defaultValue={initialValues?.evidence ?? ''}
          placeholder={template.evidencePlaceholder}
          className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
        />
      </div>

      {isContentGapStep ? (
        <div>
          <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="contentGapImport">
            Content Gap export
          </label>
          <textarea
            id="contentGapImport"
            name="contentGapImport"
            rows={10}
            required
            placeholder="Paste the exported CSV or TSV, including the header row"
            className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 font-mono text-sm text-[#111827]"
          />
          <p className="mt-2 text-xs text-[#667085]">
            The workflow stores parsed headers and imported rows inside the artifact payload so reviewers can audit the manual import before consolidation.
          </p>
        </div>
      ) : null}

      {isPhase1BaselineStep ? (
        <>
          <div>
            <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="baselineWinningUrls">
              Existing winning URLs
            </label>
            <textarea
              id="baselineWinningUrls"
              name="baselineWinningUrls"
              rows={6}
              placeholder="One page per line: https://example.com/page | top keyword | traffic or note"
              className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="baselineCoreTopics">
              Core topics already established
            </label>
            <textarea
              id="baselineCoreTopics"
              name="baselineCoreTopics"
              rows={4}
              placeholder="One core topic per line"
              className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="baselineExistingKeywords">
              Existing keywords to deduplicate later
            </label>
            <textarea
              id="baselineExistingKeywords"
              name="baselineExistingKeywords"
              rows={5}
              placeholder="One existing keyword per line"
              className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="baselinePriorityVerticals">
              Priority verticals and budget signals
            </label>
            <textarea
              id="baselinePriorityVerticals"
              name="baselinePriorityVerticals"
              rows={4}
              placeholder="One priority vertical or budget signal per line"
              className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
            />
          </div>
        </>
      ) : null}

      <div>
        <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor="openQuestions">
          Open questions or blockers
        </label>
        <textarea
          id="openQuestions"
          name="openQuestions"
          rows={3}
          defaultValue={initialValues?.openQuestions ?? ''}
          placeholder="Optional: one open question or blocker per line"
          className="mt-2 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
        />
      </div>
      </div>

      {actionError ? (
        <div className="rounded-xl border border-[#F3D0D0] bg-[#FFF6F6] p-4" role="alert">
          <p className="text-sm font-medium text-[#DA304F]">Action failed</p>
          <p className="mt-1 text-sm text-[#DA304F]">{actionError}</p>
        </div>
      ) : null}

      <div>
        <ApproveArtifactButton isPending={isPending} />
      </div>
    </form>
  );
}