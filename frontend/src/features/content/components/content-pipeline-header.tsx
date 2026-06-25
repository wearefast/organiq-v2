'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { CheckCircle2, Clock, AlertCircle, Loader2, Lock } from 'lucide-react';
import { useContentPipeline, type PipelineStep } from '@/features/content/hooks/use-content-pipeline';
import type { StepStatus } from '@/features/workflow/types';

function isComplete(status: StepStatus | null): boolean {
  return status === 'approved' || status === 'completed';
}

interface StepStyle {
  icon: React.ReactNode;
  textColor: string;
  borderColor: string;
  bgColor: string;
  sublabel: string;
  pulsing: boolean;
}

function getStepStyle(status: StepStatus | null, locked: boolean): StepStyle {
  if (locked) {
    return {
      icon: <Lock className="h-3 w-3" />,
      textColor: 'text-zinc-600',
      borderColor: 'border-zinc-800',
      bgColor: 'bg-zinc-900',
      sublabel: 'Locked',
      pulsing: false,
    };
  }
  if (status === 'running') {
    return {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      textColor: 'text-blue-400',
      borderColor: 'border-blue-800',
      bgColor: 'bg-blue-950/40',
      sublabel: 'Generating…',
      pulsing: false,
    };
  }
  if (status === 'awaiting_approval') {
    return {
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      textColor: 'text-amber-400',
      borderColor: 'border-amber-600',
      bgColor: 'bg-amber-950/40',
      sublabel: 'Review & approve →',
      pulsing: true,
    };
  }
  if (isComplete(status)) {
    return {
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      textColor: 'text-emerald-400',
      borderColor: 'border-emerald-800',
      bgColor: 'bg-emerald-950/30',
      sublabel: 'Complete',
      pulsing: false,
    };
  }
  if (status === 'failed') {
    return {
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      textColor: 'text-red-400',
      borderColor: 'border-red-800',
      bgColor: 'bg-red-950/30',
      sublabel: 'Failed',
      pulsing: false,
    };
  }
  // pending / null
  return {
    icon: <Clock className="h-3 w-3" />,
    textColor: 'text-zinc-500',
    borderColor: 'border-zinc-800',
    bgColor: 'bg-zinc-900',
    sublabel: 'Pending',
    pulsing: false,
  };
}

export function ContentPipelineHeader() {
  const params = useParams();
  const pathname = usePathname();
  const projectId = params.pId as string;
  const wId = params.wId as string;
  const base = `/workspaces/${wId}/projects/${projectId}/content`;

  const { steps, loading } = useContentPipeline(projectId);

  // Don't render until we have data — avoids layout shift
  if (loading) return null;

  // Only show the header if the workflow has been run at least once
  const hasAnyStatus = steps.some((s) => s.status !== null);
  if (!hasAnyStatus) return null;

  return (
    <div className="border-b border-zinc-800 bg-zinc-950 px-6 py-3">
      <div className="flex items-center gap-1">
        <span className="mr-3 text-xs font-medium text-zinc-500">Content pipeline:</span>
        <div className="flex items-center gap-1">
          {steps.map((step: PipelineStep, i: number) => {
            const prevComplete = i === 0 || isComplete(steps[i - 1].status);
            // Lock if previous isn't done AND this step has no recorded status yet
            const locked = !prevComplete && step.status === null;
            const style = getStepStyle(step.status, locked);
            const href = `${base}/${step.tabPath}`;
            const isActive =
              pathname === href || pathname?.startsWith(`${href}/`);
            const isClickable = !locked && (isComplete(step.status) || step.status === 'awaiting_approval' || step.status === 'running');

            const pill = (
              <div
                className={[
                  'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 transition-opacity',
                  style.bgColor,
                  style.borderColor,
                  isActive ? 'ring-1 ring-zinc-500' : '',
                  style.pulsing ? 'animate-pulse' : '',
                  locked ? 'opacity-40' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className={style.textColor}>{style.icon}</span>
                <div>
                  <p className={`text-[11px] font-medium leading-none ${style.textColor}`}>
                    {step.label}
                  </p>
                  <p
                    className={`mt-0.5 text-[9px] leading-none ${
                      step.status === 'awaiting_approval'
                        ? 'font-semibold text-amber-500'
                        : 'text-zinc-600'
                    }`}
                  >
                    {style.sublabel}
                  </p>
                </div>
              </div>
            );

            return (
              <div key={step.key} className="flex items-center gap-1">
                {isClickable ? (
                  <Link href={href} className="hover:opacity-80">
                    {pill}
                  </Link>
                ) : (
                  pill
                )}
                {/* Connector line between steps */}
                {i < steps.length - 1 && (
                  <div
                    className={`h-px w-5 ${
                      isComplete(step.status) ? 'bg-emerald-800' : 'bg-zinc-800'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
