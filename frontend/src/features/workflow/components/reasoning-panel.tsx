'use client';

import { useState } from 'react';
import { cn } from '@/shared/utils/cn';

interface ReasoningPanelProps {
  reasoning: string;
}

export function ReasoningPanel({ reasoning }: ReasoningPanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-zinc-800/40"
      >
        <div className="flex items-center gap-2">
          <svg
            className="h-3.5 w-3.5 text-violet-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z"
            />
          </svg>
          <span className="text-[12px] font-medium text-zinc-300">
            Agent Reasoning
          </span>
        </div>
        <svg
          className={cn(
            'h-3.5 w-3.5 text-zinc-500 transition-transform',
            expanded && 'rotate-180',
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m19 9-7 7-7-7"
          />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 px-4 py-3">
          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-zinc-400">
            {reasoning}
          </pre>
        </div>
      )}
    </div>
  );
}
