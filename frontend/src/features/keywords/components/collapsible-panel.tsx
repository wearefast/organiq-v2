'use client';

import { type ReactNode, useId, useState } from 'react';

interface CollapsiblePanelProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function CollapsiblePanel({
  title,
  children,
  defaultOpen = false,
  className = '',
}: CollapsiblePanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className={className}>
      <button
        type="button"
        aria-controls={panelId}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 text-left text-sm font-medium text-[#111827]"
      >
        <span>{title}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-[#667085] transition-transform ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div id={panelId} hidden={!isOpen} className="mt-4">
        {children}
      </div>
    </div>
  );
}