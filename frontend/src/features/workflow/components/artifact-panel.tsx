'use client';

import { useState } from 'react';
import { cn } from '@/shared/utils/cn';
import {
  STEP_DEFINITIONS,
  type WorkflowStep,
  type StepArtifact,
} from '../types';
import { ReasoningPanel } from './reasoning-panel';
import { ToolCallTrail } from './tool-call-trail';

/**
 * Format a duration in milliseconds to a human-readable string.
 * E.g., 65000 → "1m 5s", 5000 → "5s"
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms / 100) * 100}ms`;
  }
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Steps that run a data-fetching pipeline before handing off to the LLM agent.
 * When the step is `running` and no `step:phase` event has arrived yet, these
 * steps default to showing "Fetching data…" instead of "Agent is executing…"
 * because the pipeline phase always comes first.
 */
const PIPELINE_THEN_AGENT_STEPS = new Set([
  'seed-keywords',
  'site-audit',
  'ai-intelligence',
  'serp-niche-map',
  'competitor-buckets',
  'phase1-baseline',
  'method01-competitor-pages',
  'method02-seed-expansion',
  'content-brief',
  'content-article',
]);

interface ArtifactPanelProps {
  step: WorkflowStep | null;
  allSteps?: WorkflowStep[];
  /** Current sub-phase for this step ('pipeline' | 'agent'), from step:phase WS event. */
  stepPhase?: 'pipeline' | 'agent';
  onApprove: (stepKey: string) => void;
  onRerun?: (stepKey: string) => void;
  renderArtifact?: (stepKey: string, data: unknown, allSteps?: WorkflowStep[]) => React.ReactNode;
}

export function ArtifactPanel({
  step,
  allSteps,
  stepPhase,
  onApprove,
  onRerun,
  renderArtifact,
}: ArtifactPanelProps) {
  const [rerunConfirm, setRerunConfirm] = useState(false);

  if (!step) {
    return (
      <div className="flex flex-1 items-center justify-center text-zinc-500">
        <div className="text-center">
          <div className="mb-3 text-3xl">📋</div>
          <p className="text-sm font-medium">Select a step to view its output</p>
          <p className="mt-1 text-[12px] text-zinc-600">
            Click a step in the rail to see artifacts and approvals
          </p>
        </div>
      </div>
    );
  }

  const def = STEP_DEFINITIONS.find((d) => d.key === step.stepKey);
  const latestArtifact: StepArtifact | undefined = step.artifacts?.[0];
  const showApprovalBar =
    step.status === 'awaiting_approval' || step.status === 'completed';
  const showRerunButton =
    onRerun &&
    step.status !== 'approved' &&
    step.status !== 'pending' &&
    step.status !== 'running';

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold text-zinc-500">
              Step {String(step.stepNumber).padStart(2, '0')}
            </span>
            <h2 className="text-section text-zinc-100">
              {def?.label ?? step.stepKey}
            </h2>
          </div>
          {def && (
            <p className="mt-0.5 text-[12px] text-zinc-500">{def.description}</p>
          )}
        </div>

        {step.creditsUsed > 0 && (
          <span className="text-[11px] text-zinc-500">
            {step.creditsUsed} credits
          </span>
        )}
      </header>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {step.status === 'running' && (() => {
          // Determine display message:
          // 1. If a step:phase WS event arrived, use it directly.
          // 2. If no event yet but this step always starts with a pipeline phase, default to 'pipeline'.
          // 3. Otherwise default to 'agent'.
          const effectivePhase =
            stepPhase ??
            (PIPELINE_THEN_AGENT_STEPS.has(step.stepKey) ? 'pipeline' : 'agent');

          const isPipeline = effectivePhase === 'pipeline';

          return (
            <div className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
              isPipeline
                ? 'border-amber-500/20 bg-amber-500/5'
                : 'border-blue-500/20 bg-blue-500/5'
            }`}>
              <div className="flex items-center gap-3">
                <svg
                  className={`h-4 w-4 animate-spin ${isPipeline ? 'text-amber-400' : 'text-blue-400'}`}
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
                <span className={`text-sm ${isPipeline ? 'text-amber-300' : 'text-blue-300'}`}>
                  {isPipeline
                    ? 'Fetching data from external sources…'
                    : 'Agent is analyzing…'}
                </span>
              </div>
              {step.estimatedDurationMs && (
                <span className={`text-[12px] font-medium ${isPipeline ? 'text-amber-400' : 'text-blue-400'}`}>
                  Est. {formatDuration(step.estimatedDurationMs)}
                </span>
              )}
            </div>
          );
        })()}

        {step.status === 'pending' && (
          <div className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3">
            <span className="text-sm text-zinc-400">
              Waiting for dependencies to complete
            </span>
          </div>
        )}

        {step.status === 'failed' && step.error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase text-red-400">
              Error
            </p>
            <p className="mt-1 text-sm text-red-300">{step.error}</p>
          </div>
        )}

        {/* Artifact content */}
        {latestArtifact && (
          <div className="space-y-4">
            {/* Version info */}
            {latestArtifact.version > 1 && (
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <span>Version {latestArtifact.version}</span>
                <span className="text-zinc-700">·</span>
                <span>{step.artifacts.length} total versions</span>
              </div>
            )}

            {/* Rendered artifact */}
            <div>
              {renderArtifact ? (
                renderArtifact(step.stepKey, latestArtifact.data, allSteps)
              ) : (
                <DefaultArtifactView data={latestArtifact.data} />
              )}
            </div>

            {/* Reasoning */}
            {latestArtifact.reasoning && (
              <ReasoningPanel reasoning={latestArtifact.reasoning} />
            )}

            {/* Tool calls */}
            <ToolCallTrail stepId={step.id} />
          </div>
        )}
      </div>

      {/* Approval bar */}
      {(showApprovalBar || showRerunButton) && (
        <footer className="border-t border-zinc-800 bg-[var(--bg-elevated)] px-6 py-3">
          {rerunConfirm && (
            <div className="mb-3 flex items-center justify-between rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2">
              <p className="text-[12px] text-blue-300">
                Re-run this step? Downstream steps will also be reset and re-executed.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRerunConfirm(false)}
                  className="btn-ghost text-[12px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRerun!(step.stepKey);
                    setRerunConfirm(false);
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                    'bg-blue-600 text-white hover:bg-blue-700',
                  )}
                >
                  Confirm Re-run
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            {showRerunButton && (
              <button
                type="button"
                onClick={() => setRerunConfirm(true)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                  'border border-blue-500/30 text-blue-400 hover:bg-blue-500/10',
                )}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Re-run
              </button>
            )}
            <button
              type="button"
              onClick={() => onApprove(step.stepKey)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                'bg-emerald-600 text-white hover:bg-emerald-700',
              )}
            >
              Approve
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

function DefaultArtifactView({ data }: { data: unknown }) {
  if (data === null || data === undefined) {
    return (
      <p className="text-sm text-zinc-500">No output data available.</p>
    );
  }

  return (
    <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 p-4 font-mono text-[12px] text-zinc-300">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
