'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!params.pId || !isSignedIn) return;
    setError(null);
    (async () => {
      try {
        setAuthToken(await getToken());
        const data = await workflowApi.listRuns(params.pId);
        setRuns(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load workflow runs');
      } finally {
        setLoading(false);
      }
    })();
  }, [params.pId, isSignedIn, getToken]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-page-title text-zinc-100">Workflow Runs</h1>
          <p className="mt-1 text-sm text-zinc-500">
            SEO strategy workflow executions for this project.
          </p>
        </div>
        <StartRun
          projectId={params.pId}
          organizationId={orgId ?? ''}
          workspaceId={params.wId}
        />
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
        <div className="space-y-2">
          {runs.map((run) => (
            <Link
              key={run.id}
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
          ))}
        </div>
      )}
    </div>
  );
}
