'use client';

import { useMemo, useRef, useEffect, useState } from 'react';
import { PipelineStep, type CompletedStep, type StepStatus } from './pipeline-step';

/* ─── Types ───────────────────────────────────────────────── */

interface AuditPipelineProps {
  currentStep: string;
  progress: number;
  message: string;
  completedSteps: CompletedStep[];
}

/* ─── Step Definitions ────────────────────────────────────── */

interface StepDef {
  key: string;
  label: string;
  icon: React.ReactNode;
  messages: string[];
  compact?: boolean;
}

interface TelemetryMetric {
  label: string;
  value: string;
  tone?: 'brand' | 'signal' | 'success';
}

const ICON_CLASS = 'h-3.5 w-3.5 text-[#DA304F]';
const KW_STEP_KEYS = new Set(['KW_AHREFS', 'KW_STEP_31', 'KW_STEP_32', 'KW_STEP_33', 'KW_STEP_34', 'KW_STEP_35']);
const MAX_VISIBLE_STAGES = 5;

function GlobeIcon() {
  return (
    <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zm0-18c2.5 3.5 3 8.5 0 18m0-18c-2.5 3.5-3 8.5 0 18M3 12h18" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3a3.75 3.75 0 00-2.6 6.45A4.5 4.5 0 003 13.5 4.5 4.5 0 007.5 18h.75m6-15a3.75 3.75 0 012.6 6.45A4.5 4.5 0 0021 13.5a4.5 4.5 0 00-4.5 4.5h-.75M9.75 3v15m4.5-15v15" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function GaugeIcon() {
  return (
    <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7c0 1.657-3.582 3-8 3S4 8.657 4 7m16 0c0-1.657-3.582-3-8-3S4 5.343 4 7m16 0v10c0 1.657-3.582 3-8 3s-8-1.343-8-3V7m16 5c0 1.657-3.582 3-8 3s-8-1.343-8-3" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
    </svg>
  );
}

const STEP_DEFS: StepDef[] = [
  {
    key: 'SCRAPE',
    label: 'Crawling your website',
    icon: <GlobeIcon />,
    messages: ['Fetching HTML…', 'Parsing page structure…', 'Extracting metadata…', 'Analyzing links & images…'],
  },
  {
    key: 'PROFILE',
    label: 'Building AI business profile',
    icon: <BrainIcon />,
    messages: ['Feeding content to AI…', 'Identifying brand signals…', 'Mapping service areas…', 'Generating seed keywords…'],
  },
  {
    key: 'DEEPREAD',
    label: 'Deep-reading your content',
    icon: <BookIcon />,
    messages: ['Analyzing value proposition…', 'Understanding positioning…', 'Extracting differentiators…'],
  },
  {
    key: 'PAGESPEED',
    label: 'Analyzing page performance',
    icon: <GaugeIcon />,
    messages: ['Running mobile analysis…', 'Measuring Core Web Vitals…', 'Checking desktop performance…'],
  },
  {
    key: 'KW_AHREFS',
    label: 'Fetching keyword data from Ahrefs',
    icon: <DatabaseIcon />,
    messages: ['Querying organic keywords…', 'Fetching matching terms…', 'Deduplicating keyword pool…'],
    compact: true,
  },
  {
    key: 'KW_STEP_31',
    label: 'Extracting website context',
    icon: <SparklesIcon />,
    messages: ['Identifying offerings…', 'Extracting conversion phrases…', 'Mapping page intent…'],
    compact: true,
  },
  {
    key: 'KW_STEP_32',
    label: 'Classifying core & money keywords',
    icon: <SparklesIcon />,
    messages: ['Classifying seed keywords…', 'Identifying money keywords…', 'Mapping to services…'],
    compact: true,
  },
  {
    key: 'KW_STEP_33',
    label: 'Building topic clusters',
    icon: <SparklesIcon />,
    messages: ['Clustering into pillars…', 'Expanding seed terms…', 'Estimating volumes…'],
    compact: true,
  },
  {
    key: 'KW_STEP_34',
    label: 'Discovering entities',
    icon: <SparklesIcon />,
    messages: ['Identifying niche entities…', 'Classifying entity types…', 'Scoring relevance…'],
    compact: true,
  },
  {
    key: 'KW_STEP_35',
    label: 'Deduplicating & finalizing',
    icon: <SparklesIcon />,
    messages: ['Deduplicating keywords…', 'Building core topics…', 'Mapping intent…'],
    compact: true,
  },
];

/* ─── Step-to-running mapping (which DB currentStep maps to which STEP_DEF) ── */

const RUNNING_MAP: Record<string, string> = {
  SCRAPING: 'SCRAPE',
  SCRAPE_COMPLETE: 'SCRAPE',
  GENERATING_PROFILE: 'PROFILE',
  PROFILE_COMPLETE: 'PROFILE',
  DEEPREAD_RUNNING: 'DEEPREAD',
  DEEPREAD_COMPLETE: 'DEEPREAD',
  PAGESPEED_RUNNING: 'PAGESPEED',
  PAGESPEED_COMPLETE: 'PAGESPEED',
  KEYWORDS_RUNNING: 'KW_AHREFS',
  KW_AHREFS_COMPLETE: 'KW_AHREFS',
  KW_STEP_31: 'KW_STEP_31',
  KW_STEP_32: 'KW_STEP_32',
  KW_STEP_33: 'KW_STEP_33',
  KW_STEP_34: 'KW_STEP_34',
  KW_STEP_35: 'KW_STEP_35',
  KEYWORDS_COMPLETE: 'KW_STEP_35',
};

const STAGE_COPY: Record<string, { eyebrow: string; left: string[]; right: string[] }> = {
  SCRAPE: {
    eyebrow: 'Inspecting site structure',
    left: ['HTML', 'metadata', 'link graph'],
    right: ['content map', 'schema signal', 'crawl summary'],
  },
  PROFILE: {
    eyebrow: 'Constructing business context',
    left: ['body text', 'brand cues', 'lead notes'],
    right: ['service map', 'market profile', 'seed terms'],
  },
  DEEPREAD: {
    eyebrow: 'Distilling positioning',
    left: ['profile', 'site narrative', 'service areas'],
    right: ['what', 'who', 'differentiators'],
  },
  PAGESPEED: {
    eyebrow: 'Measuring site performance',
    left: ['mobile run', 'desktop run', 'web vitals'],
    right: ['perf scores', 'seo checks', 'load issues'],
  },
  KW_AHREFS: {
    eyebrow: 'Collecting market demand signals',
    left: ['domain keywords', 'matching terms', 'country index'],
    right: ['deduped pool', 'volume map', 'intent hints'],
  },
  KW_STEP_31: {
    eyebrow: 'Extracting website context',
    left: ['offerings', 'copy language', 'page intents'],
    right: ['context model', 'offer taxonomy', 'conversion phrases'],
  },
  KW_STEP_32: {
    eyebrow: 'Classifying commercial opportunity',
    left: ['Ahrefs pool', 'site context', 'service map'],
    right: ['core keywords', 'money keywords', 'service matches'],
  },
  KW_STEP_33: {
    eyebrow: 'Clustering topic territory',
    left: ['core terms', 'money terms', 'brand scope'],
    right: ['topic pillars', 'seed expansions', 'coverage map'],
  },
  KW_STEP_34: {
    eyebrow: 'Discovering niche entities',
    left: ['topic graph', 'commercial terms', 'expansion set'],
    right: ['entities', 'entity types', 'relevance'],
  },
  KW_STEP_35: {
    eyebrow: 'Finalizing opportunity model',
    left: ['all prior outputs', 'intent layers', 'entity graph'],
    right: ['core topics', 'deduped themes', 'final structure'],
  },
};

/* ─── Animation Queue Hook ────────────────────────────────── */

function useAnimationQueue(completedSteps: CompletedStep[]): Set<string> {
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const prevCountRef = useRef(0);

  useEffect(() => {
    const currentKeys = completedSteps.map((s) => s.key);
    const newKeys = currentKeys.filter((k) => !visibleKeys.has(k));

    if (newKeys.length === 0) return;

    // Stagger new completions by 600ms each so user sees them animate in
    newKeys.forEach((key, i) => {
      setTimeout(() => {
        setVisibleKeys((prev) => new Set([...prev, key]));
      }, i * 600);
    });

    prevCountRef.current = currentKeys.length;
  }, [completedSteps]); // eslint-disable-line react-hooks/exhaustive-deps

  return visibleKeys;
}

function formatMetricValue(value: unknown): string {
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') return value;
  return '--';
}

function toReadableLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function summarySnippet(summary: Record<string, unknown>): string {
  const entries = Object.entries(summary).filter(([, value]) => value !== null && value !== undefined && value !== '');
  return entries
    .slice(0, 2)
    .map(([key, value]) => `${toReadableLabel(key)}: ${formatMetricValue(value)}`)
    .join(' | ');
}

function metricFromStep(completedMap: Map<string, CompletedStep>, key: string, field: string): unknown {
  return completedMap.get(key)?.summary?.[field];
}

function buildTelemetry(completedMap: Map<string, CompletedStep>): TelemetryMetric[] {
  const serviceCount = metricFromStep(completedMap, 'PROFILE', 'serviceCount');
  const mobilePerformance = metricFromStep(completedMap, 'PAGESPEED', 'mobilePerformance');
  const topicCount = metricFromStep(completedMap, 'KW_STEP_33', 'topicCount');
  const entityCount = metricFromStep(completedMap, 'KW_STEP_34', 'entityCount');
  const poolSize = metricFromStep(completedMap, 'KW_AHREFS', 'poolSize');
  const coreCount = metricFromStep(completedMap, 'KW_STEP_32', 'coreCount');

  const metrics = [
    { label: 'Services mapped', value: formatMetricValue(serviceCount), tone: 'brand' as const },
    { label: 'Mobile perf', value: formatMetricValue(mobilePerformance), tone: 'brand' as const },
    { label: 'Keyword pool', value: formatMetricValue(poolSize), tone: 'signal' as const },
    { label: 'Core terms', value: formatMetricValue(coreCount), tone: 'signal' as const },
    { label: 'Topic pillars', value: formatMetricValue(topicCount), tone: 'success' as const },
    { label: 'Entities', value: formatMetricValue(entityCount), tone: 'success' as const },
  ].filter((metric) => metric.value !== '--');

  if (metrics.length > 0) {
    return metrics.slice(-3);
  }

  return [{ label: 'Completed stages', value: '0', tone: 'brand' }];
}

function buildLogEntries(
  completedSteps: CompletedStep[],
  activeDefKey: string | null,
  activeMessage: string,
): Array<{ tone: 'complete' | 'active'; label: string; detail: string }> {
  const entries: Array<{ tone: 'complete' | 'active'; label: string; detail: string }> = completedSteps.map((step) => ({
    tone: 'complete' as const,
    label: step.label,
    detail: summarySnippet(step.summary) || 'Step completed',
  }));

  if (activeDefKey) {
    const activeStep = STEP_DEFS.find((step) => step.key === activeDefKey);
    entries.push({
      tone: 'active',
      label: activeStep?.label || 'Analysis engine',
      detail: activeMessage,
    });
  }

  return entries.slice(-4).reverse();
}

function EngineBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-pill border border-[#21385a] bg-[rgba(9,20,39,0.8)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9FB6D8]">
      <span className="h-2 w-2 rounded-full bg-[#DA304F] shadow-[0_0_12px_rgba(218,48,79,0.7)]" />
      {label}
    </span>
  );
}

function TelemetryCard({ metric }: { metric: TelemetryMetric }) {
  const toneClass =
    metric.tone === 'signal'
      ? 'text-[#7BC3FF]'
      : metric.tone === 'success'
        ? 'text-[#74E2C0]'
        : 'text-[#F6A6B4]';

  return (
    <div className="rounded-[22px] border border-[#1A314F] bg-[rgba(5,16,32,0.82)] px-4 py-4 backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#6E89AD]">{metric.label}</p>
      <p className={`mt-2 text-[24px] font-semibold ${toneClass}`}>{metric.value}</p>
    </div>
  );
}

function ProgressDial({ progress }: { progress: number }) {
  return (
    <div
      className="relative flex h-28 w-28 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(#DA304F 0deg ${progress * 3.6}deg, rgba(24, 44, 72, 0.95) ${progress * 3.6}deg 360deg)`,
      }}
    >
      <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full border border-[#203652] bg-[#071221] text-center">
        <span className="text-[22px] font-semibold text-white">{progress}%</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6E89AD]">Complete</span>
      </div>
    </div>
  );
}

function PhaseCard({
  activeLabel,
  currentMessage,
  nextOutput,
  completedCount,
}: {
  activeLabel: string;
  currentMessage: string;
  nextOutput: string;
  completedCount: number;
}) {
  return (
    <section className="min-h-0 rounded-[24px] border border-[#163150] bg-[rgba(7,18,33,0.86)] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6E89AD]">Current phase</p>
      <p className="mt-3 text-[16px] font-semibold text-white">{activeLabel}</p>
      <p className="mt-1.5 text-[12px] leading-5 text-[#9FB6D8]">{currentMessage}</p>

      <div className="mt-4 space-y-2">
        <div className="rounded-[18px] border border-[#1A314F] bg-[rgba(5,16,32,0.82)] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E89AD]">Next output</p>
          <p className="mt-1 text-[13px] font-medium text-[#DDE8F5]">{nextOutput}</p>
        </div>
        <div className="rounded-[18px] border border-[#1A314F] bg-[rgba(5,16,32,0.82)] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E89AD]">Completed stages</p>
          <p className="mt-1 text-[13px] font-medium text-[#DDE8F5]">{completedCount} of {STEP_DEFS.length}</p>
        </div>
      </div>
    </section>
  );
}

function SignalPanel({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="w-full rounded-[22px] border border-[#19304A] bg-[rgba(8,19,37,0.88)] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6E89AD]">{label}</p>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <div
            key={item}
            className="pipeline-signal-card rounded-[16px] border border-[#19304A] bg-[rgba(11,25,45,0.82)] px-3 py-2 text-[13px] text-[#D7E2F0]"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function CenterStage({ activeDefKey, progress, message }: { activeDefKey: string | null; progress: number; message: string }) {
  const stage = STAGE_COPY[activeDefKey || 'SCRAPE'] || STAGE_COPY.SCRAPE;

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-[#173154] bg-[radial-gradient(circle_at_top,rgba(225,89,114,0.18),transparent_30%),linear-gradient(180deg,#071221_0%,#040c18_100%)] px-5 py-6 sm:px-6">
      <div className="absolute inset-0 pipeline-grid opacity-30" />
      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7F96B8]">{stage.eyebrow}</p>
            <h3 className="mt-2 text-[24px] font-bold text-white">Live analysis engine</h3>
          </div>
          <EngineBadge label="AI session active" />
        </div>

        <div className="mx-auto mt-6 flex w-full max-w-[312px] flex-col items-center gap-4">
          <SignalPanel label="Inputs" items={stage.left.slice(0, 2)} />

          <div className="relative flex h-[220px] w-full items-center justify-center overflow-hidden rounded-[28px] border border-[#173154] bg-[radial-gradient(circle_at_top,rgba(225,89,114,0.16),transparent_34%),linear-gradient(180deg,rgba(7,18,33,0.86),rgba(4,12,24,0.96))]">
            <div className="absolute inset-x-1/2 top-0 h-full w-px -translate-x-1/2 bg-[linear-gradient(180deg,rgba(123,195,255,0.22)_0%,rgba(123,195,255,0.7)_24%,rgba(218,48,79,0.9)_50%,rgba(123,195,255,0.7)_76%,rgba(123,195,255,0.1)_100%)]" />
            <div className="absolute top-6 h-3 w-3 rounded-full bg-[#7BC3FF] shadow-[0_0_14px_rgba(123,195,255,0.75)]" />
            <div className="absolute bottom-6 h-3 w-3 rounded-full bg-[#74E2C0] shadow-[0_0_14px_rgba(116,226,192,0.75)]" />
            <div className="pipeline-core-ring pipeline-core-ring-outer absolute h-[172px] w-[172px] rounded-full border border-[#1B3457]" />
            <div className="pipeline-core-ring pipeline-core-ring-mid absolute h-[136px] w-[136px] rounded-full border border-[#29466E]" />
            <div className="pipeline-core-ring pipeline-core-ring-inner absolute h-[102px] w-[102px] rounded-full border border-[#3E6296]" />
            <div className="pipeline-core-grid absolute h-[84px] w-[84px] rounded-[24px] border border-[#34527D] bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.18),transparent_35%),radial-gradient(circle_at_70%_70%,rgba(123,195,255,0.18),transparent_30%),linear-gradient(180deg,rgba(15,28,51,0.98),rgba(6,16,30,0.96))] shadow-[0_0_64px_rgba(218,48,79,0.22)]" />
            <div className="pipeline-core-pulse absolute h-[64px] w-[64px] rounded-full bg-[radial-gradient(circle,rgba(233,131,149,0.9),rgba(218,48,79,0.55)_42%,rgba(7,25,50,0)_72%)]" />
            <div className="relative z-10 flex max-w-[210px] flex-col items-center text-center">
              <span className="rounded-pill border border-[#284360] bg-[rgba(7,18,33,0.84)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#9FB6D8]">
                Processing
              </span>
              <p className="mt-4 text-[14px] font-medium leading-6 text-white">{message}</p>
              <div className="mt-5 h-2 w-40 overflow-hidden rounded-pill bg-[#132843]">
                <div className="h-full rounded-pill bg-[linear-gradient(90deg,#AE213E_0%,#DA304F_52%,#7BC3FF_100%)] transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          <SignalPanel label="Outputs" items={stage.right.slice(0, 2)} />
        </div>
      </div>
    </section>
  );
}

function ProcessLog({ entries }: { entries: Array<{ tone: 'complete' | 'active'; label: string; detail: string }> }) {
  return (
    <section className="relative grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[28px] border border-[#16304F] bg-[rgba(5,16,32,0.92)] px-5 py-5">
      <div className="absolute inset-0 pipeline-scan-lines opacity-30" />
      <div className="relative z-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6E89AD]">Process log</p>
            <p className="mt-1 text-sm text-[#9FB6D8]">Recent engine events only</p>
          </div>
          <EngineBadge label="Telemetry stream" />
        </div>
        <div className="min-h-0 space-y-2.5 overflow-y-auto pr-1 font-mono text-[12px]">
          {entries.map((entry, index) => (
            <div
              key={`${entry.label}-${index}`}
              className={[
                'flex flex-col gap-1 rounded-[18px] border px-4 py-3 sm:flex-row sm:items-start sm:justify-between',
                entry.tone === 'active'
                  ? 'border-[#31527D] bg-[rgba(10,24,45,0.94)] text-white'
                  : 'border-[#17304D] bg-[rgba(8,18,35,0.8)] text-[#D6E0EC]',
              ].join(' ')}
            >
              <div className="flex items-center gap-3">
                <span className={[
                  'mt-0.5 h-2 w-2 rounded-full',
                  entry.tone === 'active' ? 'bg-[#7BC3FF] shadow-[0_0_10px_rgba(123,195,255,0.8)]' : 'bg-[#74E2C0]',
                ].join(' ')} />
                <span className="font-semibold">{entry.label}</span>
              </div>
              <span className="text-[#8EA6C8] sm:max-w-[70%]">{entry.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Main Component ──────────────────────────────────────── */

export function AuditPipeline({ currentStep, progress, message, completedSteps }: AuditPipelineProps) {
  const visibleComplete = useAnimationQueue(completedSteps);
  const completedMap = useMemo(() => {
    const map = new Map<string, CompletedStep>();
    for (const s of completedSteps) map.set(s.key, s);
    return map;
  }, [completedSteps]);

  const activeDefKey = RUNNING_MAP[currentStep] || completedSteps[completedSteps.length - 1]?.key || 'SCRAPE';
  const activeStep = STEP_DEFS.find((step) => step.key === activeDefKey) || STEP_DEFS[0];
  const activeStepIndex = STEP_DEFS.findIndex((step) => step.key === activeStep.key);
  const activeStage = STAGE_COPY[activeDefKey] || STAGE_COPY.SCRAPE;
  const telemetry = useMemo(() => buildTelemetry(completedMap), [completedMap]);
  const logEntries = useMemo(() => buildLogEntries(completedSteps, activeDefKey, message), [completedSteps, activeDefKey, message]);

  function getStatus(defKey: string): StepStatus {
    const stepIndex = STEP_DEFS.findIndex((step) => step.key === defKey);

    if (visibleComplete.has(defKey)) return 'complete';
    if (defKey === activeDefKey) return 'running';
    if (completedMap.has(defKey) || (stepIndex !== -1 && stepIndex < activeStepIndex)) return 'complete';
    return 'pending';
  }

  const isInKwSection = activeDefKey ? KW_STEP_KEYS.has(activeDefKey) : completedSteps.some((s) => KW_STEP_KEYS.has(s.key));
  const renderableDefs = STEP_DEFS.filter((def) => {
    const status = getStatus(def.key);
    const isKwStep = KW_STEP_KEYS.has(def.key);

    if (isKwStep && status === 'pending' && !isInKwSection) return false;
    return true;
  });
  const activeRenderableIndex = Math.max(0, renderableDefs.findIndex((def) => def.key === activeStep.key));
  const halfWindow = Math.floor(MAX_VISIBLE_STAGES / 2);
  const visibleStart = Math.max(0, activeRenderableIndex - halfWindow);
  const visibleDefs = renderableDefs.slice(visibleStart, visibleStart + MAX_VISIBLE_STAGES);
  const hiddenAboveCount = visibleStart;
  const hiddenBelowCount = Math.max(0, renderableDefs.length - (visibleStart + visibleDefs.length));
  const visibleStageRows = visibleDefs.map((def, index) => {
    const absoluteIndex = visibleStart + index;
    const distanceFromActive = absoluteIndex - activeRenderableIndex;
    const status = getStatus(def.key);
    const summary = completedMap.get(def.key)?.summary || null;
    const isKwStep = KW_STEP_KEYS.has(def.key);
    const previousDef = visibleDefs[index - 1];
    const shouldShowKwHeader = isKwStep && (!previousDef || !KW_STEP_KEYS.has(previousDef.key));
    const emphasisClass =
      distanceFromActive === 0
        ? 'opacity-100 scale-100'
        : distanceFromActive < 0
          ? absoluteIndex === visibleStart && hiddenAboveCount > 0
            ? 'opacity-35 scale-[0.95]'
            : distanceFromActive === -1
              ? 'opacity-65 scale-[0.98]'
              : 'opacity-48 scale-[0.965]'
          : distanceFromActive === 1
            ? 'opacity-82 scale-[0.99]'
            : 'opacity-58 scale-[0.975]';

    return (
      <div key={def.key} className={[isKwStep ? 'sm:ml-5' : '', 'transition-all duration-500', emphasisClass].join(' ')}>
        {shouldShowKwHeader && isInKwSection && (
          <div className="mb-1 mt-1 pl-8">
            <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7BC3FF]">
              Keyword intelligence chain
            </span>
          </div>
        )}
        <PipelineStep
          stepKey={def.key}
          label={def.label}
          status={status}
          icon={def.icon}
          runningMessages={def.messages}
          summary={status === 'complete' ? summary : null}
          compact={def.compact}
          animationDelay={status === 'pending' ? 0 : index * 90}
        />
      </div>
    );
  });

  return (
    <div
      className="relative h-full min-h-0 overflow-hidden rounded-[30px] border border-[#183353] bg-[linear-gradient(180deg,#06101f_0%,#040b16_100%)] p-3 text-white shadow-[0_40px_120px_rgba(3,10,20,0.45)] sm:p-4 lg:p-5"
      aria-busy={progress < 100}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(225,89,114,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(123,195,255,0.12),transparent_24%)]" />
      <div className="absolute inset-0 pipeline-noise opacity-40" />
      <div className="relative z-10 grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_minmax(0,160px)] gap-3">
        <div className="sr-only" aria-live="polite">
          {`${activeStep.label}. ${message}. ${progress}% complete.`}
        </div>
        <header className="flex flex-col gap-3 border-b border-[#163150] pb-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <EngineBadge label="Organic visibility engine" />
            <h2 className="mt-3 text-[22px] font-bold text-white sm:text-[26px]">Analysing your website live</h2>
            <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-[#9FB6D8] sm:text-[13px]">
              Real services are running in sequence: crawl, interpret, benchmark, classify, and assemble your visibility model.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-[16px] border border-[#1A3558] bg-[rgba(8,18,35,0.84)] px-3 py-2 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#6E89AD]">Completed</p>
              <p className="mt-1 text-[13px] font-medium text-white">{completedSteps.length} of {STEP_DEFS.length} stages</p>
            </div>
            <ProgressDial progress={progress} />
          </div>
        </header>

        <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,3.1fr)_minmax(280px,1.1fr)_220px] xl:grid-cols-[minmax(0,3.35fr)_minmax(300px,1.15fr)_228px]">
          <aside className="min-h-0 overflow-hidden rounded-[24px] border border-[#163150] bg-[rgba(7,18,33,0.86)] p-3">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6E89AD]">Analysis pipeline</p>
                <p className="mt-1 text-[12px] text-[#9FB6D8]">Focused five-stage viewport with live handoff into the engine</p>
              </div>
              <span className="rounded-pill border border-[#234066] bg-[rgba(10,21,40,0.82)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#7BC3FF]">
                {completedSteps.length}/{STEP_DEFS.length}
              </span>
            </div>

            <div className="relative overflow-hidden rounded-[22px] border border-[#122A45] bg-[rgba(4,14,27,0.58)] px-4 py-3">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-14 bg-[linear-gradient(180deg,rgba(4,14,27,0.98)_0%,rgba(4,14,27,0.8)_55%,rgba(4,14,27,0)_100%)]" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-14 bg-[linear-gradient(0deg,rgba(4,14,27,0.98)_0%,rgba(4,14,27,0.8)_55%,rgba(4,14,27,0)_100%)]" />
              {hiddenAboveCount > 0 && (
                <div className="mb-3 flex items-center justify-between gap-2 rounded-pill border border-[#17304D] bg-[rgba(7,18,33,0.82)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E89AD]">
                  <span>{hiddenAboveCount} earlier stages moved above</span>
                  <span className="text-[#74E2C0]">Faded</span>
                </div>
              )}

              <div className="relative space-y-2.5">
                <div className="pipeline-rail absolute bottom-0 left-[15px] top-3 hidden w-px sm:block" />
                {visibleStageRows}

              {hiddenBelowCount > 0 && (
                <div className="mt-3 flex items-center justify-end text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E89AD]">
                  {hiddenBelowCount} upcoming stages below
                </div>
              )}
              </div>
            </div>
          </aside>

          <CenterStage activeDefKey={activeDefKey} progress={progress} message={message} />

          <aside className="grid min-h-0 gap-3 grid-rows-[auto_minmax(0,1fr)]">
            <section className="rounded-[24px] border border-[#163150] bg-[rgba(7,18,33,0.86)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6E89AD]">Live telemetry</p>
              <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-1">
                {telemetry.map((metric) => (
                  <TelemetryCard key={metric.label} metric={metric} />
                ))}
              </div>
            </section>

            <PhaseCard
              activeLabel={activeStep.label}
              currentMessage={message}
              nextOutput={activeStage.right[0]}
              completedCount={completedSteps.length}
            />
          </aside>
        </div>

        <div className="min-h-0 overflow-hidden">
          <ProcessLog entries={logEntries} />
        </div>
      </div>
    </div>
  );
}
