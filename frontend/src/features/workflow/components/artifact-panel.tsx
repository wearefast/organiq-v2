'use client';

import { useState } from 'react';
import { cn } from '@/shared/utils/cn';
import { StatusBadge } from '@/shared/components/status-badge';
import {
  STEP_DEFINITIONS,
  type WorkflowStep,
  type StepArtifact,
} from '../types';
import { ReasoningPanel } from './reasoning-panel';
import { ToolCallTrail } from './tool-call-trail';

interface ArtifactPanelProps {
  step: WorkflowStep | null;
  onApprove: (stepKey: string, notes?: string) => void;
  onRevise: (stepKey: string, notes: string) => void;
  onReject: (stepKey: string, notes: string) => void;
  renderArtifact?: (stepKey: string, data: unknown) => React.ReactNode;
}

export function ArtifactPanel({
  step,
  onApprove,
  onRevise,
  onReject,
  renderArtifact,
}: ArtifactPanelProps) {
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

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
            <StatusBadge status={step.status} pulse={step.status === 'running'} />
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
        {step.status === 'running' && (
          <div className="flex items-center gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
            <svg
              className="h-4 w-4 animate-spin text-blue-400"
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
            <span className="text-sm text-blue-300">
              Agent is executing this step...
            </span>
          </div>
        )}

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
                renderArtifact(step.stepKey, latestArtifact.data)
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
      {showApprovalBar && (
        <footer className="border-t border-zinc-800 bg-[var(--bg-elevated)] px-6 py-3">
          {showNotes && (
            <div className="mb-3">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes for this decision..."
                className="input min-h-[60px] resize-y"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowNotes((prev) => !prev)}
              className="btn-ghost text-[12px]"
            >
              {showNotes ? 'Hide notes' : 'Add notes'}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!notes.trim()) {
                    setShowNotes(true);
                    return;
                  }
                  onReject(step.stepKey, notes);
                  setNotes('');
                  setShowNotes(false);
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                  'border border-red-500/30 text-red-400 hover:bg-red-500/10',
                )}
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!notes.trim()) {
                    setShowNotes(true);
                    return;
                  }
                  onRevise(step.stepKey, notes);
                  setNotes('');
                  setShowNotes(false);
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                  'border border-orange-500/30 text-orange-400 hover:bg-orange-500/10',
                )}
              >
                Revise
              </button>
              <button
                type="button"
                onClick={() => {
                  onApprove(step.stepKey, notes || undefined);
                  setNotes('');
                  setShowNotes(false);
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                  'bg-emerald-600 text-white hover:bg-emerald-700',
                )}
              >
                Approve
              </button>
            </div>
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
