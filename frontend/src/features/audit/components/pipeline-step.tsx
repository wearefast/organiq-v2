'use client';

import { useState, useEffect } from 'react';

/* ─── Types ───────────────────────────────────────────────── */

export interface CompletedStep {
  key: string;
  label: string;
  summary: Record<string, unknown>;
}

export type StepStatus = 'pending' | 'running' | 'complete';

interface PipelineStepProps {
  stepKey: string;
  label: string;
  status: StepStatus;
  icon: React.ReactNode;
  runningMessages: string[];
  summary: Record<string, unknown> | null;
  compact?: boolean;
  animationDelay?: number;
}

const STEP_CODES: Record<string, string> = {
  SCRAPE: '00',
  PROFILE: '01',
  DEEPREAD: '02',
  PAGESPEED: '02A',
  KW_AHREFS: '03',
  KW_STEP_31: '03.1',
  KW_STEP_32: '03.2',
  KW_STEP_33: '03.3',
  KW_STEP_34: '03.4',
  KW_STEP_35: '03.5',
};

/* ─── Rotating Messages Hook ──────────────────────────────── */

function useRotatingMessage(messages: string[], active: boolean): string {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active || messages.length === 0) return;
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [active, messages]);
  return messages[index] || '';
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/Count$/, '')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function formatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string') return value.length > 60 ? value.slice(0, 57) + '…' : value;
  return String(value);
}

/* ─── Summary Renderer ────────────────────────────────────── */

function summarizeEntries(data: Record<string, unknown>): string {
  return Object.entries(data)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 2)
    .map(([key, value]) => `${formatLabel(key)} ${formatValue(value)}`)
    .join(' • ');
}

function StepSummary({ data }: { data: Record<string, unknown> }) {
  const summary = summarizeEntries(data);
  if (!summary) return null;

  return <p className="mt-1.5 truncate text-[11px] text-[#AFC3DE]">{summary}</p>;
}

/* ─── Typing Indicator ────────────────────────────────────── */

function TypingDots() {
  return (
    <span className="ml-1.5 inline-flex gap-0.5">
      <span className="pipeline-typing-dot inline-block h-1 w-1 rounded-full bg-[#DA304F]" />
      <span className="pipeline-typing-dot inline-block h-1 w-1 rounded-full bg-[#DA304F]" />
      <span className="pipeline-typing-dot inline-block h-1 w-1 rounded-full bg-[#DA304F]" />
    </span>
  );
}

/* ─── Step Icons ──────────────────────────────────────────── */

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

/* ─── Main Component ──────────────────────────────────────── */

export function PipelineStep({
  stepKey,
  label,
  status,
  icon,
  runningMessages,
  summary,
  compact = false,
  animationDelay = 0,
}: PipelineStepProps) {
  const rotatingMsg = useRotatingMessage(runningMessages, status === 'running');
  const code = STEP_CODES[stepKey] || stepKey;

  return (
    <div
      className="animate-pipeline-fade-in-up relative pl-7"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div
        className={[
          'absolute left-[9px] top-6 z-10 h-3 w-3 -translate-x-1/2 rounded-full border-2',
          status === 'running'
            ? 'border-[#F6A6B4] bg-[#DA304F] shadow-[0_0_14px_rgba(218,48,79,0.8)]'
            : status === 'complete'
              ? 'border-[#A7F3D0] bg-[#74E2C0] shadow-[0_0_12px_rgba(116,226,192,0.65)]'
              : 'border-[#2C4668] bg-[#08182E]',
        ].join(' ')}
      />
      <div
        className={[
          'relative overflow-hidden rounded-[22px] border transition-all duration-300',
          compact ? 'px-3.5 py-2.5' : 'px-4 py-3',
          status === 'running'
            ? 'animate-pipeline-glow border-[#2D507E] bg-[linear-gradient(180deg,rgba(10,25,45,0.98),rgba(6,15,28,0.98))]'
            : status === 'complete'
              ? 'border-[#244566] bg-[linear-gradient(180deg,rgba(8,20,38,0.98),rgba(6,15,28,0.96))]'
              : 'border-[#17304D] bg-[rgba(7,18,33,0.78)]',
        ].join(' ')}
      >
        <div
          className={[
            'absolute inset-y-0 left-0 w-1',
            status === 'running'
              ? 'bg-[linear-gradient(180deg,#F6A6B4_0%,#DA304F_60%,#7BC3FF_100%)]'
              : status === 'complete'
                ? 'bg-[linear-gradient(180deg,#74E2C0_0%,#7BC3FF_100%)]'
                : 'bg-[#112540]',
          ].join(' ')}
        />
        <div className="flex items-center gap-3">
          <div
            className={[
              'flex shrink-0 items-center justify-center rounded-[16px] border',
              compact ? 'h-7.5 w-7.5' : 'h-9 w-9',
              status === 'running'
                ? 'border-[#345A88] bg-[radial-gradient(circle_at_top,rgba(246,166,180,0.2),rgba(11,26,46,0.95))] text-[#F6A6B4]'
                : status === 'complete'
                  ? 'border-[#2A4A6A] bg-[radial-gradient(circle_at_top,rgba(116,226,192,0.16),rgba(8,20,36,0.95))] text-[#74E2C0]'
                  : 'border-[#1C3552] bg-[rgba(8,19,36,0.95)] text-[#6E89AD]',
            ].join(' ')}
          >
            {status === 'complete' ? (
              <CheckIcon />
            ) : status === 'running' ? (
              <div className="animate-pipeline-spin-slow">{icon}</div>
            ) : (
              <div className="opacity-40">{icon}</div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-pill border border-[#1F3959] bg-[rgba(7,18,33,0.9)] px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-[#7BC3FF]">
                {code}
              </span>
              <span
                className={[
                  'font-semibold',
                  compact ? 'text-[11px]' : 'text-[12px]',
                  status === 'pending' ? 'text-[#8096B7]' : 'text-white',
                ].join(' ')}
              >
                {label}
              </span>
              {status === 'running' && <TypingDots />}
            </div>
            {status === 'running' && rotatingMsg && (
              <p className="mt-0.5 text-[11px] text-[#AFC3DE] transition-all duration-300">
                {rotatingMsg}
              </p>
            )}
            {status === 'pending' && (
              <p className="mt-0.5 text-[10px] text-[#5E7598]">Queued in sequence</p>
            )}
            {status === 'complete' && summary && Object.keys(summary).length > 0 && (
              <StepSummary data={summary} />
            )}
          </div>

          {status === 'complete' && (
            <span className="shrink-0 rounded-pill border border-[#24556A] bg-[rgba(10,35,39,0.8)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#74E2C0]">
              Done
            </span>
          )}
          {status === 'running' && (
            <span className="shrink-0 rounded-pill border border-[#4E3153] bg-[rgba(39,11,25,0.76)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#F6A6B4]">
              Running
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
