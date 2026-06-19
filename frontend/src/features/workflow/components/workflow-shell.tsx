'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { StepRail } from './step-rail';
import { ArtifactPanel } from './artifact-panel';
import { ProgressBar } from './progress-bar';
import { useWorkflowWs, type StepEvent } from '../hooks/use-workflow-ws';
import * as workflowApi from '../services/workflow.service';
import type { WorkflowRunDetail, WorkflowStep } from '../types';

interface WorkflowShellProps {
  runId: string;
  token: string | null;
  renderArtifact?: (stepKey: string, data: unknown) => React.ReactNode;
}

export function WorkflowShell({
  runId,
  token,
  renderArtifact,
}: WorkflowShellProps) {
  const router = useRouter();
  const [run, setRun] = useState<WorkflowRunDetail | null>(null);
  const [activeStepKey, setActiveStepKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);
  const [stepPhases, setStepPhases] = useState<Record<string, 'pipeline' | 'agent'>>({});
  const initializedRef = useRef(false);

  // Fetch initial run data
  const fetchRun = useCallback(async () => {
    try {
      const data = await workflowApi.getRun(runId);
      setRun(data);
      setError(null);

      // Auto-select the first actionable step only on initial load
      if (!initializedRef.current) {
        initializedRef.current = true;
        const actionable = data.steps.find(
          (s) =>
            s.status === 'awaiting_approval' ||
            s.status === 'running' ||
            s.status === 'revision_requested',
        );
        if (actionable) {
          setActiveStepKey(actionable.stepKey);
        } else {
          // Select the last completed/approved step
          const completedSteps = data.steps.filter(
            (s) => s.status === 'completed' || s.status === 'approved',
          );
          if (completedSteps.length > 0) {
            setActiveStepKey(completedSteps[completedSteps.length - 1].stepKey);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflow');
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  // WebSocket event handler — refetch on meaningful events
  const handleWsEvent = useCallback(
    (event: StepEvent) => {
      if (event.type === 'step:phase') {
        setStepPhases((prev) => ({ ...prev, [event.stepKey]: event.phase }));
        return;
      }
      if (
        event.type === 'step:completed' ||
        event.type === 'step:started' ||
        event.type === 'step:error' ||
        event.type === 'step:approved' ||
        event.type === 'step:rejected' ||
        event.type === 'step:rerun' ||
        event.type === 'workflow:completed'
      ) {
        // Clear phase label when step finishes
        if (event.type === 'step:completed' || event.type === 'step:error') {
          setStepPhases((prev) => {
            const next = { ...prev };
            delete next[(event as { stepKey: string }).stepKey];
            return next;
          });
        }
        fetchRun();
      }
    },
    [fetchRun],
  );

  useWorkflowWs({
    workflowRunId: runId,
    token,
    onEvent: handleWsEvent,
  });

  // Polling fallback — keep UI fresh when WebSocket is unavailable
  useEffect(() => {
    const isActive =
      run?.status === 'running' ||
      run?.steps.some((s) => s.status === 'running' || s.status === 'awaiting_approval');
    if (!isActive) return;

    const id = setInterval(() => fetchRun(), 10_000);
    return () => clearInterval(id);
  }, [run?.status, run?.steps, fetchRun]);

  // Approval handlers
  const handleApprove = useCallback(
    async (stepKey: string) => {
      try {
        await workflowApi.approveStep(runId, stepKey);
        await fetchRun();
      } catch {
        // Error is handled in the API layer
      }
    },
    [runId, fetchRun],
  );

  const handleRerun = useCallback(
    async (stepKey: string) => {
      try {
        await workflowApi.rerunStep(runId, stepKey);
        await fetchRun();
      } catch {
        // Error is handled in the API layer
      }
    },
    [runId, fetchRun],
  );

  // Keyboard shortcuts
  useEffect(() => {
    if (!run) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (!run) return;

      // Ignore when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const currentIndex = run.steps.findIndex(
        (s) => s.stepKey === activeStepKey,
      );

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = run.steps[currentIndex + 1];
        if (next && next.status !== 'pending') {
          setActiveStepKey(next.stepKey);
        }
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = run.steps[currentIndex - 1];
        if (prev && prev.status !== 'pending') {
          setActiveStepKey(prev.stepKey);
        }
      } else if (e.key === 'a') {
        const step = run.steps.find((s) => s.stepKey === activeStepKey);
        if (
          step &&
          (step.status === 'awaiting_approval' || step.status === 'completed')
        ) {
          handleApprove(step.stepKey);
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [run, activeStepKey, handleApprove]);

  // Resume handler for stuck runs
  const handleResume = useCallback(async () => {
    setResuming(true);
    try {
      await workflowApi.resumeRun(runId);
      await fetchRun();
    } catch {
      // Error handled in fetchRun
    } finally {
      setResuming(false);
    }
  }, [runId, fetchRun]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-500">
          <svg
            className="h-5 w-5 animate-spin"
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
          <span className="text-sm font-medium">Loading workflow...</span>
        </div>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-red-400">{error ?? 'Workflow not found'}</p>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-ghost mt-3 text-sm"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  // Detect stuck run: status is running but no steps are genuinely active or completed.
  //
  // Two signals are combined with OR:
  // 1. Individual step staleness: a step in 'running' state for > 35 minutes is orphaned.
  //    (The processor aborts after 30 min, so anything beyond that has no live job.)
  // 2. Run-level staleness: the run has been 'running' for > 35 minutes without any
  //    step producing output. This covers the case where the server restarted and
  //    re-enqueued steps with fresh startedAt values, resetting the per-step clock
  //    while the run itself has been stuck for much longer.
  const STALE_THRESHOLD_MS = 35 * 60 * 1000;
  const hasNoOutput = !run.steps.some(
    (s) => s.status === 'completed' || s.status === 'awaiting_approval' || s.status === 'approved',
  );
  const hasGenuinelyRunningStep = run.steps.some((s) => {
    if (s.status !== 'running') return false;
    const startedMs = s.startedAt ? new Date(s.startedAt).getTime() : 0;
    return Date.now() - startedMs < STALE_THRESHOLD_MS;
  });
  const runElapsedMs = run.startedAt ? Date.now() - new Date(run.startedAt).getTime() : 0;
  const runIsStale = runElapsedMs > STALE_THRESHOLD_MS;

  const isStuck =
    run.status === 'running' &&
    hasNoOutput &&
    (!hasGenuinelyRunningStep || runIsStale);

  const activeStep: WorkflowStep | null =
    run.steps.find((s) => s.stepKey === activeStepKey) ?? null;

  return (
    <div className="flex h-full flex-col">
      {/* Stuck run banner */}
      {isStuck && (
        <div className="flex items-center justify-between border-b border-yellow-800/40 bg-yellow-950/30 px-6 py-3">
          <p className="text-sm text-yellow-300">
            This workflow is stuck — no steps are processing. Click Resume to restart step execution.
          </p>
          <button
            type="button"
            onClick={handleResume}
            disabled={resuming}
            className="rounded-md bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-500 disabled:opacity-50"
          >
            {resuming ? 'Resuming…' : 'Resume'}
          </button>
        </div>
      )}

      {/* Top progress bar */}
      <div className="border-b border-zinc-800 bg-[var(--bg-elevated)] px-6 py-2.5">
        <ProgressBar steps={run.steps} />
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        <StepRail
          steps={run.steps}
          activeStepKey={activeStepKey}
          onStepClick={setActiveStepKey}
          stepPhases={stepPhases}
        />
        <ArtifactPanel
          step={activeStep}
          allSteps={run.steps}
          onApprove={handleApprove}
          onRerun={handleRerun}
          renderArtifact={renderArtifact}
        />
      </div>
    </div>
  );
}
