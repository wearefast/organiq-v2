'use client';

import { type ReactNode, useState } from 'react';
import { Button } from '@/shared/components/button';

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