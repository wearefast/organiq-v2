'use client';

import { cn } from '@/shared/utils/cn';
import {
  STEP_DEFINITIONS,
  PHASE_LABELS,
  type WorkflowStep,
  type StepStatus,
} from '../types';

const STATUS_COLORS: Record<StepStatus, string> = {
  pending: 'bg-zinc-600',
  running: 'bg-blue-500',
  completed: 'bg-green-500',
  awaiting_approval: 'bg-amber-500',
  approved: 'bg-emerald-500',
  revision_requested: 'bg-orange-500',
  rejected: 'bg-red-500',
  failed: 'bg-red-500',
  skipped: 'bg-zinc-500',
};

const STATUS_LABELS: Partial<Record<StepStatus, string>> = {
  awaiting_approval: 'Awaiting review',
  revision_requested: 'Revision needed',
};

const PHASE_COLORS: Record<number, string> = {
  1: 'text-violet-400 border-violet-500/30',
  2: 'text-blue-400 border-blue-500/30',
  3: 'text-amber-400 border-amber-500/30',
  4: 'text-emerald-400 border-emerald-500/30',
};

interface StepRailProps {
  steps: WorkflowStep[];
  activeStepKey: string | null;
  onStepClick: (stepKey: string) => void;
}

export function StepRail({ steps, activeStepKey, onStepClick }: StepRailProps) {
  const stepsByKey = new Map(steps.map((s) => [s.stepKey, s]));

  // Group definitions by phase
  const phases = new Map<number, typeof STEP_DEFINITIONS>();
  for (const def of STEP_DEFINITIONS) {
    const group = phases.get(def.phase) ?? [];
    group.push(def);
    phases.set(def.phase, group);
  }

  return (
    <aside className="flex h-full w-step-rail flex-col overflow-y-auto border-r border-zinc-800 bg-[var(--bg-sidebar)]">
      <div className="px-4 pb-2 pt-4">
        <h2 className="text-header uppercase tracking-widest text-zinc-500">
          Workflow Steps
        </h2>
      </div>

      <nav className="flex-1 space-y-1 px-2 pb-4">
        {Array.from(phases.entries()).map(([phase, defs]) => (
          <div key={phase}>
            {/* Phase divider */}
            <div
              className={cn(
                'mb-1 mt-3 flex items-center gap-2 px-2 first:mt-0',
                PHASE_COLORS[phase],
              )}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider">
                Phase {phase}
              </span>
              <span className="text-[10px] font-normal opacity-60">
                {PHASE_LABELS[phase]}
              </span>
            </div>

            {/* Steps */}
            {defs.map((def) => {
              const step = stepsByKey.get(def.key);
              const status: StepStatus = step?.status ?? 'pending';
              const isActive = activeStepKey === def.key;
              const isClickable = status !== 'pending';

              return (
                <button
                  key={def.key}
                  type="button"
                  onClick={() => isClickable && onStepClick(def.key)}
                  disabled={!isClickable}
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors',
                    isActive
                      ? 'bg-zinc-800 text-zinc-100'
                      : isClickable
                        ? 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                        : 'cursor-default text-zinc-600',
                  )}
                >
                  {/* Status dot */}
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    {status === 'running' ? (
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-40" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
                      </span>
                    ) : (
                      <span
                        className={cn(
                          'inline-flex h-2 w-2 rounded-full',
                          STATUS_COLORS[status],
                        )}
                      />
                    )}
                  </span>

                  {/* Step info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-zinc-500">
                        {String(def.number).padStart(2, '0')}
                      </span>
                      <span className="truncate text-[12px] font-medium">
                        {def.label}
                      </span>
                    </div>
                    {status !== 'pending' && (
                      <span
                        className={cn(
                          'text-[10px]',
                          status === 'failed' || status === 'rejected'
                            ? 'text-red-400'
                            : status === 'running'
                              ? 'text-blue-400'
                              : status === 'awaiting_approval'
                                ? 'text-amber-400'
                                : status === 'approved' || status === 'completed'
                                  ? 'text-emerald-400'
                                  : 'text-zinc-500',
                        )}
                      >
                        {STATUS_LABELS[status] ??
                          status.charAt(0).toUpperCase() +
                            status.slice(1).replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
