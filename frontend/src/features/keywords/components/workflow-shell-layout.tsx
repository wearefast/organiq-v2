'use client';

import { type ReactNode, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/shared/components/button';

type CollapsedRailStep = {
  index: number;
  stepKey: string;
  title: string;
  visualStatus: string;
  markerTone: string;
};

type TooltipState = { label: string; x: number; y: number } | null;

export function CollapsedWorkflowRail({
  steps,
  projectId,
  workflowId,
}: {
  steps: CollapsedRailStep[];
  projectId: string;
  workflowId: string;
}) {
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  return (
    <section className="relative overflow-visible rounded-xl border border-[#E8EAF0] bg-white px-3 pb-4 pt-12 shadow-sm">
      <div className="flex flex-col items-center">
        {steps.map((step) => (
          <div key={step.stepKey} className="flex flex-col items-center">
            <Link
              href={`/dashboard/keywords/${projectId}/workflows/${workflowId}?step=${step.stepKey}`}
              aria-label={step.title}
              className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold outline-none transition hover:scale-105 focus-visible:scale-105 focus-visible:ring-2 focus-visible:ring-[#DA304F]/25 ${step.markerTone}`}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltip({ label: step.title, x: rect.right + 8, y: rect.top + rect.height / 2 });
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              {step.index + 1}
            </Link>
            {step.index < steps.length - 1 ? (
              <div className={`min-h-[22px] w-px ${step.visualStatus === 'complete' ? 'bg-[#12B76A]' : 'bg-[#E4E7EC]'}`} />
            ) : null}
          </div>
        ))}
      </div>

      {tooltip ? (
        <div
          className="pointer-events-none fixed z-50 w-40 -translate-y-1/2 rounded-lg border border-[#E8EAF0] bg-white px-3 py-2 text-left text-[11px] font-medium leading-4 text-[#111827] shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.label}
        </div>
      ) : null}
    </section>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
    </svg>
  );
}

type WorkflowShellLayoutProps = {
  rail: ReactNode;
  collapsedRail: ReactNode;
  children: ReactNode;
};

export function WorkflowShellLayout({ rail, collapsedRail, children }: WorkflowShellLayoutProps) {
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside className={`lg:sticky lg:top-8 lg:self-start lg:shrink-0 ${isRailCollapsed ? 'lg:w-[112px]' : 'lg:w-[300px]'}`}>
        <div className="relative lg:max-h-[calc(100vh-4rem)] lg:overflow-x-visible lg:overflow-y-auto lg:pr-1">
          <div className={`pointer-events-none absolute top-3 z-10 flex ${isRailCollapsed ? 'left-1/2 -translate-x-1/2' : 'right-3'}`}>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="pointer-events-auto bg-white/95 backdrop-blur-sm"
              aria-label={isRailCollapsed ? 'Expand workflow steps' : 'Collapse workflow steps'}
              title={isRailCollapsed ? 'Expand workflow steps' : 'Collapse workflow steps'}
              onClick={() => setIsRailCollapsed((current) => !current)}
            >
              {isRailCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </Button>
          </div>

          <div>
            {isRailCollapsed ? collapsedRail : rail}
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-6">{children}</div>
    </div>
  );
}