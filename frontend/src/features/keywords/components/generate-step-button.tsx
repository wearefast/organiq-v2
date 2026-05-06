'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  generateWorkflowStep,
  getWorkflowJobStatus,
  type WorkflowJob,
} from '@/features/keywords/services/keywords.service';

const GENERATE_STEPS: Record<string, { label: string; description: string }> = {
  'serp-niche-map': {
    label: 'Generate SERP Niche Map',
    description: 'Searches Google for each approved seed keyword and maps the niche structure.',
  },
  'competitor-buckets': {
    label: 'Discover Competitors',
    description: 'Finds competitors via SERP analysis and Ahrefs organic competitor data.',
  },
  'competitor-metrics': {
    label: 'Pull Competitor Metrics',
    description: 'Fetches domain ratings, traffic, and top pages from Ahrefs for approved competitors.',
  },
  'phase1-baseline': {
    label: 'Generate Phase 1 Baseline',
    description: 'Pulls your site top pages and existing keywords from Ahrefs.',
  },
  'method01-competitor-pages': {
    label: 'Generate Method 01',
    description: 'Pulls top pages and organic keywords for each approved direct competitor.',
  },
  'method02-seed-expansion': {
    label: 'Generate Method 02',
    description: 'Expands approved seed keywords via Ahrefs matching and related terms.',
  },
};

interface GenerateStepButtonProps {
  projectId: string;
  workflowId: string;
  stepKey: string;
}

export function GenerateStepButton({ projectId, workflowId, stepKey }: GenerateStepButtonProps) {
  const router = useRouter();
  const [job, setJob] = useState<WorkflowJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const config = GENERATE_STEPS[stepKey];
  if (!config) return null;

  const isRunning = job?.status === 'PENDING' || job?.status === 'PROCESSING';
  const isDone = job?.status === 'COMPLETED';
  const isFailed = job?.status === 'FAILED';

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const startPolling = useCallback(
    (jobId: string) => {
      cleanup();
      pollRef.current = setInterval(async () => {
        try {
          const status = await getWorkflowJobStatus(projectId, workflowId, jobId);
          setJob(status);
          if (status.status === 'COMPLETED' || status.status === 'FAILED') {
            cleanup();
            if (status.status === 'COMPLETED') {
              router.refresh();
            }
          }
        } catch {
          cleanup();
        }
      }, 3000);
    },
    [projectId, workflowId, cleanup, router],
  );

  const handleGenerate = async () => {
    setError(null);
    setIsTriggering(true);
    try {
      const newJob = await generateWorkflowStep(projectId, workflowId, stepKey);
      setJob(newJob);
      startPolling(newJob.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium text-[#344054]">{config.label}</h4>
          <p className="mt-0.5 text-xs text-[#667085]">{config.description}</p>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isTriggering || isRunning}
          className="shrink-0 rounded-lg bg-[#6366F1] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#4F46E5] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isTriggering ? 'Starting…' : isRunning ? 'Running…' : 'Generate'}
        </button>
      </div>

      {isRunning && job && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-[#667085]">
            <span>Processing…</span>
            <span>{job.progress}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#E4E7EC]">
            <div
              className="h-full rounded-full bg-[#6366F1] transition-all duration-500"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </div>
      )}

      {isDone && (
        <p className="mt-2 text-xs font-medium text-green-600">
          Research complete — artifact created. Page refreshing…
        </p>
      )}

      {isFailed && (
        <p className="mt-2 text-xs font-medium text-red-600">
          {job?.error ?? 'Generation failed. Check server logs.'}
        </p>
      )}

      {error && !isFailed && (
        <p className="mt-2 text-xs font-medium text-red-600">{error}</p>
      )}
    </div>
  );
}
