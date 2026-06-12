'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { setAuthToken, apiFetch } from '@/shared/utils/api';
import { cn } from '@/shared/utils/cn';
import * as workflowApi from '../services/workflow.service';

interface Target {
  key: string;
  domain: string;
  country: string;
  language: string;
}

interface StartRunProps {
  projectId: string;
  organizationId: string;
  workspaceId: string;
}

export function StartRun({
  projectId,
  organizationId,
  workspaceId,
}: StartRunProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        setAuthToken(await getToken());
        const data = await apiFetch<Target[]>(`/projects/${projectId}/targets`);
        setTargets(data);
      } catch {
        // Non-critical — targets are optional
      }
    })();
  }, [projectId, getToken]);

  async function handleStart() {
    setLoading(true);
    setError(null);

    try {
      setAuthToken(await getToken());
      const run = await workflowApi.createRun(
        projectId,
        organizationId,
        selectedTarget || undefined,
      );
      await workflowApi.startRun(run.id);
      router.push(
        `/workspaces/${workspaceId}/projects/${projectId}/workflows/${run.id}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start workflow');
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {targets.length > 0 && (
        <select
          value={selectedTarget}
          onChange={(e) => setSelectedTarget(e.target.value)}
          disabled={loading}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/50"
        >
          <option value="">All targets (default)</option>
          {targets.map((t) => (
            <option key={t.key} value={t.key}>
              {t.key} — {t.domain} ({t.country})
            </option>
          ))}
        </select>
      )}

      <button
        type="button"
        onClick={handleStart}
        disabled={loading}
        className={cn(
          'btn-primary',
          loading && 'opacity-50 cursor-not-allowed',
        )}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg
              className="h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Starting...
          </span>
        ) : (
          'Start New Run'
        )}
      </button>

      {error && (
        <p className="mt-2 text-[12px] text-red-400">{error}</p>
      )}
    </div>
  );
}
