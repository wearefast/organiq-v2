'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { StatusBadge } from '@/shared/components/status-badge';
import { StartRun } from '@/features/workflow/components/start-run';
import * as workflowApi from '@/features/workflow/services/workflow.service';
import { setAuthToken } from '@/shared/utils/api';
import type { WorkflowRun } from '@/features/workflow/types';

export default function WorkflowRunsPage() {
  const params = useParams<{ wId: string; pId: string }>();
  const { orgId, isSignedIn, getToken } = useAuth();
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    if (!params.pId || !isSignedIn) return;
    setError(null);
    try {
      setAuthToken(await getToken());
      const data = await workflowApi.listRuns(params.pId);
      setRuns(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflow runs');
    } finally {
      setLoading(false);
    }
  }, [params.pId, isSignedIn, getToken]);

  useEffect(() => { loadRuns(); }, [loadRuns]);

  async function handleDelete(e: React.MouseEvent, runId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this workflow run? This cannot be undone.')) return;
    setDeleting(runId);
    try {
      setAuthToken(await getToken());
      await workflowApi.deleteRun(runId);
      setRuns((prev) => prev.filter((r) => r.id !== runId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete run');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-page-title text-zinc-100">Workflow Runs</h1>
          <p className="mt-1 text-sm text-zinc-500">
            SEO strategy workflow executions for this project.
          </p>
        </div>
        <div data-tour="start-run-btn">
          <StartRun
            projectId={params.pId}
            organizationId={orgId ?? ''}
            workspaceId={params.wId}
          />
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-zinc-500">
          <svg className="mr-3 h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading runs...</span>
        </div>
      ) : runs.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800">
            <svg className="h-6 w-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-zinc-300">No workflow runs yet</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Start a new run to begin your SEO, AEO and GEO strategy workflow.
          </p>
        </div>
      ) : (
        <div data-tour="runs-table" className="space-y-2">
          {runs.map((run) => (
            <div key={run.id} className="relative">
              <Link
                href={`/workspaces/${params.wId}/projects/${params.pId}/workflows/${run.id}`}
                className="card flex items-center justify-between px-5 py-4 transition-colors hover:bg-zinc-800/50"
              >
                <div className="flex items-center gap-4">
                  <StatusBadge
                    status={run.status}
                    pulse={run.status === 'running'}
                  />
                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      Run {run.id.slice(0, 8)}
                    </p>
                    <p className="text-[12px] text-zinc-500">
                      Started{' '}
                      {run.startedAt
                        ? new Date(run.startedAt).toLocaleDateString()
                        : 'Not started'}
                      {run.completedAt && (
                        <span className="ml-2 text-green-500/70">
                          · Completed {new Date(run.completedAt).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-[12px] text-zinc-500">
                  {run.creditsUsed > 0 && (
                    <span>{run.creditsUsed} credits</span>
                  )}
                  <span>
                    {new Date(run.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </Link>

              {/* Delete button — floats over the card, outside the Link */}
              <button
                type="button"
                onClick={(e) => handleDelete(e, run.id)}
                disabled={deleting === run.id}
                title="Delete this run"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-600 hover:bg-red-950/40 hover:text-red-400 disabled:opacity-40"
              >
                {deleting === run.id ? (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
