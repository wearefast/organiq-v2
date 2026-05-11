'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/shared/utils/cn';
import * as workflowApi from '../services/workflow.service';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setLoading(true);
    setError(null);

    try {
      const run = await workflowApi.createRun(projectId, organizationId);
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
    <div>
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
