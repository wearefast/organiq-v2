'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/shared/utils/cn';
import { apiFetch } from '@/shared/utils/api';
import type { StepToolCall } from '../types';

interface ToolCallTrailProps {
  stepId: string;
}

export function ToolCallTrail({ stepId }: ToolCallTrailProps) {
  const [expanded, setExpanded] = useState(false);
  const [toolCalls, setToolCalls] = useState<StepToolCall[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!expanded || loaded) return;

    let cancelled = false;
    apiFetch<StepToolCall[]>(`/workflows/steps/${stepId}/tool-calls`)
      .then((data) => {
        if (!cancelled) {
          setToolCalls(data);
          setLoaded(true);
        }
      })
      .catch(() => {
        // Tool calls endpoint may not exist yet — gracefully degrade
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [stepId, expanded, loaded]);

  // Reset when step changes
  useEffect(() => {
    setLoaded(false);
    setToolCalls([]);
    setExpanded(false);
  }, [stepId]);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-zinc-800/40"
      >
        <div className="flex items-center gap-2">
          <svg
            className="h-3.5 w-3.5 text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.049.58.025 1.193-.14 1.743"
            />
          </svg>
          <span className="text-[12px] font-medium text-zinc-300">
            Tool Calls
          </span>
          {toolCalls.length > 0 && (
            <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
              {toolCalls.length}
            </span>
          )}
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
        <div className="border-t border-zinc-800">
          {!loaded ? (
            <div className="px-4 py-3 text-[12px] text-zinc-500">
              Loading tool calls...
            </div>
          ) : toolCalls.length === 0 ? (
            <div className="px-4 py-3 text-[12px] text-zinc-500">
              No tool calls recorded for this step.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {toolCalls.map((tc) => (
                <ToolCallRow key={tc.id} toolCall={tc} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToolCallRow({ toolCall }: { toolCall: StepToolCall }) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setShowDetail((prev) => !prev)}
        className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-zinc-800/30"
      >
        <span
          className={cn(
            'inline-flex h-1.5 w-1.5 rounded-full',
            toolCall.error ? 'bg-red-500' : 'bg-emerald-500',
          )}
        />
        <span className="flex-1 truncate font-mono text-[11px] text-zinc-300">
          {toolCall.toolName}
        </span>
        {toolCall.durationMs != null && (
          <span className="text-[10px] text-zinc-600">
            {toolCall.durationMs}ms
          </span>
        )}
      </button>

      {showDetail && (
        <div className="space-y-2 bg-zinc-900 px-4 py-2">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase text-zinc-600">
              Input
            </p>
            <pre className="overflow-x-auto font-mono text-[10px] text-zinc-400">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
          {toolCall.output != null && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase text-zinc-600">
                Output
              </p>
              <pre className="max-h-40 overflow-auto font-mono text-[10px] text-zinc-400">
                {JSON.stringify(toolCall.output, null, 2)}
              </pre>
            </div>
          )}
          {toolCall.error && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase text-red-500">
                Error
              </p>
              <pre className="font-mono text-[10px] text-red-400">
                {toolCall.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
