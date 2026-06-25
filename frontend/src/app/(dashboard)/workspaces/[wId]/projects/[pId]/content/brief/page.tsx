'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchContent, type ContentPiece } from '@/features/content/services/content.service';
import { ContentBriefRenderer } from '@/features/workflow/renderers/content-brief';
import { useContentStep } from '@/features/content/hooks/use-content-step';

export default function ContentBriefPage() {
  const params = useParams();
  const projectId = params.pId as string;

  const { stepStatus, artifactData, loading: stepLoading, approving, approve } = useContentStep(
    projectId,
    'content-brief',
  );

  const [briefs, setBriefs] = useState<ContentPiece[]>([]);
  const [selected, setSelected] = useState<ContentPiece | null>(null);
  const [domainLoading, setDomainLoading] = useState(true);

  useEffect(() => {
    fetchContent(projectId)
      .then((pieces) => {
        const briefPieces = pieces.filter((p) => p.type === 'brief');
        setBriefs(briefPieces);
        if (briefPieces.length > 0) setSelected(briefPieces[0]);
      })
      .catch(console.error)
      .finally(() => setDomainLoading(false));
  }, [projectId]);

  // Wait for step status to resolve before deciding which view to show
  if (stepLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
      </div>
    );
  }

  // Awaiting approval: show artifact for review with approve CTA
  if (stepStatus === 'awaiting_approval') {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-300">
                Your content brief is ready for review
              </p>
              <p className="text-xs text-zinc-500">
                Review the brief below, then approve to begin article writing.
              </p>
            </div>
          </div>
          <button
            onClick={approve}
            disabled={approving}
            className="shrink-0 rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {approving ? 'Approving…' : 'Approve & Continue →'}
          </button>
        </div>
        <ContentBriefRenderer data={artifactData} />
      </div>
    );
  }

  // Running: show progress indicator
  if (stepStatus === 'running') {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <div>
            <p className="text-sm font-medium text-blue-300">Generating your content brief…</p>
            <p className="text-xs text-zinc-500">
              This usually takes 1–2 minutes. This page will update automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Default: show materialized domain data (post-approval)
  if (domainLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
      </div>
    );
  }

  if (briefs.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-zinc-500">No content brief yet.</p>
        <p className="text-xs text-zinc-600">
          Run the workflow through Step 16 to generate a content brief.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-200">Content Brief</h1>
          <p className="text-xs text-zinc-500">
            SEO brief with keyword targets, outline, and SERP analysis
          </p>
        </div>
        {briefs.length > 1 && (
          <select
            value={selected?.id ?? ''}
            onChange={(e) => {
              const match = briefs.find((b) => b.id === e.target.value);
              if (match) setSelected(match);
            }}
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300"
          >
            {briefs.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        )}
      </div>
      {selected && <ContentBriefRenderer data={selected.briefData} />}
    </div>
  );
}
        <p className="text-xs text-zinc-600">
          Run the workflow through Step 16 to generate a content brief.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-200">Content Brief</h1>
          <p className="text-xs text-zinc-500">
            SEO brief with keyword targets, outline, and SERP analysis
          </p>
        </div>

        {/* Selector if multiple briefs */}
        {briefs.length > 1 && (
          <select
            value={selected?.id ?? ''}
            onChange={(e) => {
              const match = briefs.find((b) => b.id === e.target.value);
              if (match) setSelected(match);
            }}
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300"
          >
            {briefs.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Brief content */}
      {selected && <ContentBriefRenderer data={selected.briefData} />}
    </div>
  );
}
