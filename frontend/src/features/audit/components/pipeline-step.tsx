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

const STEP_THEME = {
  accent: 'var(--cc-red)',
  signal: 'color-mix(in srgb, var(--ring) 76%, white)',
  success: 'color-mix(in srgb, var(--status-complete) 82%, white)',
  line: 'color-mix(in srgb, var(--border) 68%, rgba(123, 195, 255, 0.2))',
  lineStrong: 'color-mix(in srgb, var(--ring) 26%, var(--border))',
  panel: 'color-mix(in srgb, var(--surface) 14%, #07111f)',
  panelMuted: 'color-mix(in srgb, var(--canvas) 20%, #08111d)',
  ink: 'color-mix(in srgb, white 94%, var(--canvas))',
  muted: 'color-mix(in srgb, white 74%, var(--canvas))',
  subtle: 'color-mix(in srgb, white 54%, var(--canvas))',
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

  return <p className="mt-1.5 truncate text-[11px]" style={{ color: STEP_THEME.muted }}>{summary}</p>;
}

/* ─── Typing Indicator ────────────────────────────────────── */

function TypingDots() {
  return (
    <span className="ml-1.5 inline-flex gap-0.5">
      <span className="pipeline-typing-dot inline-block h-1 w-1 rounded-full" style={{ backgroundColor: STEP_THEME.accent }} />
      <span className="pipeline-typing-dot inline-block h-1 w-1 rounded-full" style={{ backgroundColor: STEP_THEME.accent }} />
      <span className="pipeline-typing-dot inline-block h-1 w-1 rounded-full" style={{ backgroundColor: STEP_THEME.accent }} />
    </span>
  );
}

/* ─── Step Icons ──────────────────────────────────────────── */

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" style={{ color: STEP_THEME.success }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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

  const isRunning = status === 'running';
  const markerStyle = isRunning
    ? {
        borderColor: 'color-mix(in srgb, var(--cc-red) 42%, white)',
        backgroundColor: STEP_THEME.accent,
        boxShadow: '0 0 14px color-mix(in srgb, var(--cc-red) 72%, transparent)',
      }
    : status === 'complete'
      ? {
          borderColor: 'color-mix(in srgb, var(--status-complete) 36%, white)',
          backgroundColor: STEP_THEME.success,
          boxShadow: '0 0 12px color-mix(in srgb, var(--status-complete) 62%, transparent)',
        }
      : {
          borderColor: STEP_THEME.line,
          backgroundColor: 'color-mix(in srgb, var(--canvas) 18%, #08182e)',
        };
  const cardStyle = isRunning
    ? {
        borderColor: STEP_THEME.lineStrong,
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--surface) 16%, #0a192d), color-mix(in srgb, var(--canvas) 18%, #060f1c))',
      }
    : status === 'complete'
      ? {
          borderColor: STEP_THEME.line,
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--surface) 12%, #081426), color-mix(in srgb, var(--canvas) 16%, #060f1c))',
        }
      : {
          borderColor: STEP_THEME.line,
          background: STEP_THEME.panelMuted,
        };
  const accentBarStyle = isRunning
    ? { background: `linear-gradient(180deg, color-mix(in srgb, var(--cc-red) 48%, white) 0%, ${STEP_THEME.accent} 60%, ${STEP_THEME.signal} 100%)` }
    : status === 'complete'
      ? { background: `linear-gradient(180deg, ${STEP_THEME.success} 0%, ${STEP_THEME.signal} 100%)` }
      : { backgroundColor: 'color-mix(in srgb, var(--border) 42%, #112540)' };
  const iconShellStyle = isRunning
    ? {
        borderColor: STEP_THEME.lineStrong,
        background: 'radial-gradient(circle at top, color-mix(in srgb, var(--cc-red) 18%, white), color-mix(in srgb, var(--surface) 12%, #0b1a2e))',
        color: 'color-mix(in srgb, var(--cc-red) 32%, white)',
      }
    : status === 'complete'
      ? {
          borderColor: STEP_THEME.line,
          background: 'radial-gradient(circle at top, color-mix(in srgb, var(--status-complete) 16%, white), color-mix(in srgb, var(--surface) 10%, #081424))',
          color: STEP_THEME.success,
        }
      : {
          borderColor: STEP_THEME.line,
          background: STEP_THEME.panel,
          color: STEP_THEME.subtle,
        };

  return (
    <div
      className="animate-pipeline-fade-in-up relative pl-7"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div
        className={[
          'absolute left-[9px] z-10 -translate-x-1/2 rounded-full border-2 transition-all duration-500',
          isRunning ? 'top-7 h-3.5 w-3.5' : 'top-6 h-3 w-3',
        ].join(' ')}
        style={markerStyle}
      />
      <div
        className={[
          'relative overflow-hidden rounded-[22px] border transition-all duration-500',
          isRunning ? 'px-5 py-4' : compact ? 'px-3.5 py-2.5' : 'px-4 py-3',
          isRunning ? 'animate-pipeline-glow' : '',
        ].join(' ')}
        style={cardStyle}
      >
        <div
          className={[
            'absolute inset-y-0 left-0 transition-all duration-500',
            isRunning ? 'w-1.5' : 'w-1',
          ].join(' ')}
          style={accentBarStyle}
        />
        <div className="flex items-center gap-3">
          <div
            className={[
              'flex shrink-0 items-center justify-center rounded-[16px] border transition-all duration-500',
              isRunning ? 'h-11 w-11' : compact ? 'h-7.5 w-7.5' : 'h-9 w-9',
            ].join(' ')}
            style={iconShellStyle}
          >
            {status === 'complete' ? (
              <CheckIcon />
            ) : isRunning ? (
              <div className="animate-pipeline-spin-slow [&>svg]:h-4.5 [&>svg]:w-4.5">{icon}</div>
            ) : (
              <div className="opacity-40">{icon}</div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-pill border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em]" style={{ borderColor: STEP_THEME.line, background: STEP_THEME.panel, color: STEP_THEME.signal }}>
                {code}
              </span>
              <span
                className={[
                  'font-semibold transition-all duration-500',
                  isRunning ? 'text-[14px]' : compact ? 'text-[11px]' : 'text-[12px]',
                ].join(' ')}
                style={{ color: status === 'pending' ? STEP_THEME.subtle : STEP_THEME.ink }}
              >
                {label}
              </span>
              {isRunning && <TypingDots />}
            </div>
            {isRunning && rotatingMsg && (
              <p className="mt-1 text-[12px] transition-all duration-300" style={{ color: STEP_THEME.muted }}>
                {rotatingMsg}
              </p>
            )}
            {status === 'pending' && (
              <p className="mt-0.5 text-[10px]" style={{ color: STEP_THEME.subtle }}>Queued in sequence</p>
            )}
            {status === 'complete' && summary && Object.keys(summary).length > 0 && (
              <StepSummary data={summary} />
            )}
          </div>

          {status === 'complete' && (
            <span className="shrink-0 rounded-pill border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em]" style={{ borderColor: STEP_THEME.line, background: 'color-mix(in srgb, var(--status-complete) 12%, #0a2327)', color: STEP_THEME.success }}>
              Done
            </span>
          )}
          {isRunning && (
            <span className="shrink-0 rounded-pill border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ borderColor: 'color-mix(in srgb, var(--cc-red) 24%, var(--border))', background: 'color-mix(in srgb, var(--cc-red) 10%, #270b19)', color: 'color-mix(in srgb, var(--cc-red) 32%, white)' }}>
              Running
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
