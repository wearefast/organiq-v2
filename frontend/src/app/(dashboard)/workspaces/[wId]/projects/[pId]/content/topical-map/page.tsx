'use client';

import { useParams } from 'next/navigation';
import { useContentStep } from '@/features/content/hooks/use-content-step';
import { TopicalMapRenderer } from '@/features/workflow/renderers/topical-map';
import TopicalMapPage from '../../topical-map/page';

export default function ContentStrategyPage() {
  const params = useParams();
  const projectId = params.pId as string;
  const { stepStatus, artifactData, loading, approving, approve } = useContentStep(
    projectId,
    'topical-map',
  );

  if (loading) {
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
                Your topical map is ready for review
              </p>
              <p className="text-xs text-zinc-500">
                Review the structure below, then approve to lock it in and unlock Brief generation.
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
        <TopicalMapRenderer data={artifactData} />
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
            <p className="text-sm font-medium text-blue-300">Generating your topical map…</p>
            <p className="text-xs text-zinc-500">
              This usually takes 1–2 minutes. This page will update automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Default: approved / completed / pending / no run — show domain data
  return <TopicalMapPage />;
}
