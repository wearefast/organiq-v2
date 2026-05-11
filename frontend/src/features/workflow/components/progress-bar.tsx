'use client';

import { cn } from '@/shared/utils/cn';
import type { WorkflowStep } from '../types';

interface ProgressBarProps {
  steps: WorkflowStep[];
  className?: string;
}

const TERMINAL_STATUSES = new Set([
  'completed',
  'approved',
  'rejected',
  'failed',
  'skipped',
]);

export function ProgressBar({ steps, className }: ProgressBarProps) {
  const total = steps.length;
  const done = steps.filter(
    (s) => s.status === 'completed' || s.status === 'approved',
  ).length;
  const running = steps.filter((s) => s.status === 'running').length;
  const failed = steps.filter(
    (s) => s.status === 'failed' || s.status === 'rejected',
  ).length;
  const awaiting = steps.filter(
    (s) => s.status === 'awaiting_approval' || s.status === 'revision_requested',
  ).length;

  const pctDone = total > 0 ? (done / total) * 100 : 0;
  const pctRunning = total > 0 ? (running / total) * 100 : 0;
  const pctAwaiting = total > 0 ? (awaiting / total) * 100 : 0;

  // Elapsed time for running steps
  const firstStarted = steps
    .filter((s) => s.startedAt)
    .map((s) => new Date(s.startedAt!).getTime())
    .sort((a, b) => a - b)[0];

  const lastCompleted = steps
    .filter((s) => s.completedAt && TERMINAL_STATUSES.has(s.status))
    .map((s) => new Date(s.completedAt!).getTime())
    .sort((a, b) => b - a)[0];

  const isRunning = running > 0;
  const elapsed = firstStarted
    ? isRunning
      ? Date.now() - firstStarted
      : lastCompleted
        ? lastCompleted - firstStarted
        : 0
    : 0;

  return (
    <div className={cn('flex items-center gap-4', className)}>
      {/* Progress bar */}
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
        {/* Done segment */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${pctDone}%` }}
        />
        {/* Running segment */}
        <div
          className="absolute inset-y-0 rounded-full bg-blue-500 transition-all duration-500"
          style={{ left: `${pctDone}%`, width: `${pctRunning}%` }}
        />
        {/* Awaiting segment */}
        <div
          className="absolute inset-y-0 rounded-full bg-amber-500 transition-all duration-500"
          style={{
            left: `${pctDone + pctRunning}%`,
            width: `${pctAwaiting}%`,
          }}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-[11px] text-zinc-500">
        <span>
          {done}/{total} done
        </span>
        {running > 0 && <span className="text-blue-400">{running} running</span>}
        {awaiting > 0 && (
          <span className="text-amber-400">{awaiting} awaiting</span>
        )}
        {failed > 0 && <span className="text-red-400">{failed} failed</span>}
        {elapsed > 0 && <span>{formatDuration(elapsed)}</span>}
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remaining}s`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return `${hours}h ${remMin}m`;
}
