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

const ICON_CLASS = 'h-3.5 w-3.5 text-[var(--cc-red)]';
const KW_STEP_KEYS = new Set(['KW_AHREFS', 'KW_STEP_31', 'KW_STEP_32', 'KW_STEP_33', 'KW_STEP_34', 'KW_STEP_35']);
const MAX_VISIBLE_STAGES = 5;
const CONTROL_THEME = {
  accent: 'var(--cc-red)',
  signal: 'color-mix(in srgb, var(--ring) 76%, white)',
  success: 'color-mix(in srgb, var(--status-complete) 82%, white)',
  shell: 'linear-gradient(180deg, color-mix(in srgb, var(--canvas) 18%, #06101c) 0%, #040913 100%)',
  panel: 'color-mix(in srgb, var(--surface) 14%, #07111f)',
  panelStrong: 'color-mix(in srgb, var(--section-tint) 18%, #050d18)',
  panelMuted: 'color-mix(in srgb, var(--canvas) 22%, #08111d)',
  line: 'color-mix(in srgb, var(--border) 68%, rgba(123, 195, 255, 0.22))',
  ink: 'color-mix(in srgb, white 94%, var(--canvas))',
  muted: 'color-mix(in srgb, white 74%, var(--canvas))',
  subtle: 'color-mix(in srgb, white 56%, var(--canvas))',
};

const SHELL_STYLE = {
  background: CONTROL_THEME.shell,
  borderColor: CONTROL_THEME.line,
  boxShadow: '0 40px 120px rgba(3,10,20,0.45)',
};

const PANEL_STYLE = {
  background: CONTROL_THEME.panel,
  borderColor: CONTROL_THEME.line,
};

const PANEL_STRONG_STYLE = {
  background: CONTROL_THEME.panelStrong,
  borderColor: CONTROL_THEME.line,
};

const PANEL_MUTED_STYLE = {
  background: CONTROL_THEME.panelMuted,
  borderColor: CONTROL_THEME.line,
};

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
  {
    key: 'SERP_COMPLETE',
    label: 'Searching Google for competitors',
    icon: <GlobeIcon />,
    messages: ['Expanding keyword probes…', 'Collecting ranking domains…', 'Scoring SERP candidate overlap…'],
  },
  {
    key: 'COMPETITORS_COMPLETE',
    label: 'Classifying competitors',
    icon: <BrainIcon />,
    messages: ['Separating direct competitors…', 'Separating organic competitors…', 'Writing competitor rationale…'],
  },
  {
    key: 'COMPETITOR_METRICS_COMPLETE',
    label: 'Pulling direct competitor metrics',
    icon: <DatabaseIcon />,
    messages: ['Fetching domain overviews…', 'Pulling top pages…', 'Comparing authority signals…'],
  },
  {
    key: 'ORGANIC_COMPETITORS_COMPLETE',
    label: 'Measuring organic overlap',
    icon: <DatabaseIcon />,
    messages: ['Calculating overlap share…', 'Benchmarking coverage…', 'Ranking usable competitors…'],
  },
  {
    key: 'CONTENT_GAP_COMPLETE',
    label: 'Uncovering missed content opportunities',
    icon: <SparklesIcon />,
    messages: ['Comparing competitor keywords…', 'Scoring missed topics…', 'Assembling the content gap…'],
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
  COMPETITORS_RUNNING: 'SERP_COMPLETE',
  SERP_COMPLETE: 'SERP_COMPLETE',
  COMPETITORS_COMPLETE: 'COMPETITORS_COMPLETE',
  COMPETITOR_METRICS_COMPLETE: 'COMPETITOR_METRICS_COMPLETE',
  ORGANIC_COMPETITORS_COMPLETE: 'ORGANIC_COMPETITORS_COMPLETE',
  CONTENT_GAP_COMPLETE: 'CONTENT_GAP_COMPLETE',
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
  SERP_COMPLETE: {
    eyebrow: 'Expanding SERP competitor discovery',
    left: ['seed probes', 'money terms', 'Google rankings'],
    right: ['candidate domains', 'overlap signals', 'SERP evidence'],
  },
  COMPETITORS_COMPLETE: {
    eyebrow: 'Separating direct and organic rivals',
    left: ['candidate pool', 'business context', 'market fit'],
    right: ['direct competitors', 'organic competitors', 'classification notes'],
  },
  COMPETITOR_METRICS_COMPLETE: {
    eyebrow: 'Benchmarking direct competitors',
    left: ['approved direct rivals', 'Ahrefs metrics', 'top pages'],
    right: ['authority gaps', 'traffic signals', 'page leaders'],
  },
  ORGANIC_COMPETITORS_COMPLETE: {
    eyebrow: 'Measuring overlap depth',
    left: ['organic competitor set', 'share metrics', 'content footprint'],
    right: ['overlap scores', 'priority targets', 'usable benchmarks'],
  },
  CONTENT_GAP_COMPLETE: {
    eyebrow: 'Assembling missed content opportunities',
    left: ['keyword pool', 'competitor overlap', 'coverage map'],
    right: ['gap keywords', 'missed traffic', 'topic groups'],
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
    <span
      className="inline-flex items-center gap-2 rounded-pill border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]"
      style={{ ...PANEL_STRONG_STYLE, color: CONTROL_THEME.muted }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{
          backgroundColor: CONTROL_THEME.accent,
          boxShadow: '0 0 12px color-mix(in srgb, var(--cc-red) 70%, transparent)',
        }}
      />
      {label}
    </span>
  );
}

function TelemetryCard({ metric }: { metric: TelemetryMetric }) {
  const toneColor =
    metric.tone === 'signal'
      ? CONTROL_THEME.signal
      : metric.tone === 'success'
        ? CONTROL_THEME.success
        : CONTROL_THEME.accent;

  return (
    <div className="rounded-[22px] border px-4 py-4 backdrop-blur-sm" style={PANEL_STRONG_STYLE}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: CONTROL_THEME.subtle }}>{metric.label}</p>
      <p className="mt-2 text-[24px] font-semibold" style={{ color: toneColor }}>{metric.value}</p>
    </div>
  );
}

function ProgressDial({ progress }: { progress: number }) {
  return (
    <div
      className="relative flex h-28 w-28 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(${CONTROL_THEME.accent} 0deg ${progress * 3.6}deg, color-mix(in srgb, var(--border) 50%, #08111d) ${progress * 3.6}deg 360deg)`,
      }}
    >
      <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full border text-center" style={PANEL_STRONG_STYLE}>
        <span className="text-[22px] font-semibold" style={{ color: CONTROL_THEME.ink }}>{progress}%</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: CONTROL_THEME.subtle }}>Complete</span>
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
    <section className="min-h-0 rounded-[24px] border p-4" style={PANEL_STYLE}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: CONTROL_THEME.subtle }}>Current phase</p>
      <p className="mt-3 text-[16px] font-semibold" style={{ color: CONTROL_THEME.ink }}>{activeLabel}</p>
      <p className="mt-1.5 text-[12px] leading-5" style={{ color: CONTROL_THEME.muted }}>{currentMessage}</p>

      <div className="mt-4 space-y-2">
        <div className="rounded-[18px] border px-3 py-3" style={PANEL_STRONG_STYLE}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: CONTROL_THEME.subtle }}>Next output</p>
          <p className="mt-1 text-[13px] font-medium" style={{ color: CONTROL_THEME.ink }}>{nextOutput}</p>
        </div>
        <div className="rounded-[18px] border px-3 py-3" style={PANEL_STRONG_STYLE}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: CONTROL_THEME.subtle }}>Completed stages</p>
          <p className="mt-1 text-[13px] font-medium" style={{ color: CONTROL_THEME.ink }}>{completedCount} of {STEP_DEFS.length}</p>
        </div>
      </div>
    </section>
  );
}

function SignalPanel({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="w-full rounded-[22px] border p-3" style={PANEL_STYLE}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: CONTROL_THEME.subtle }}>{label}</p>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <div
            key={item}
            className="pipeline-signal-card rounded-[16px] border px-3 py-2 text-[13px]"
            style={{ ...PANEL_MUTED_STYLE, color: CONTROL_THEME.ink }}
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
    <section
      className="relative overflow-hidden rounded-[30px] border px-5 py-6 sm:px-6"
      style={{
        ...PANEL_STRONG_STYLE,
        background:
          'radial-gradient(circle at top, color-mix(in srgb, var(--cc-red) 20%, transparent) 0%, transparent 30%), linear-gradient(180deg, color-mix(in srgb, var(--surface) 12%, #08111f) 0%, #040c18 100%)',
      }}
    >
      <div className="absolute inset-0 pipeline-grid opacity-30" />
      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: CONTROL_THEME.subtle }}>{stage.eyebrow}</p>
            <h3 className="mt-2 text-[24px] font-bold" style={{ color: CONTROL_THEME.ink }}>Live analysis engine</h3>
          </div>
          <EngineBadge label="AI session active" />
        </div>

        <div className="mx-auto mt-6 flex w-full max-w-[312px] flex-col items-center gap-4">
          <SignalPanel label="Inputs" items={stage.left.slice(0, 2)} />

          <div
            className="relative flex h-[220px] w-full items-center justify-center overflow-hidden rounded-[28px] border"
            style={{
              ...PANEL_MUTED_STYLE,
              background:
                'radial-gradient(circle at top, color-mix(in srgb, var(--cc-red) 18%, transparent) 0%, transparent 34%), linear-gradient(180deg, color-mix(in srgb, var(--surface) 12%, #071221) 0%, #040c18 100%)',
            }}
          >
            <div className="absolute inset-x-1/2 top-0 h-full w-px -translate-x-1/2" style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--ring) 24%, transparent) 0%, color-mix(in srgb, var(--ring) 76%, transparent) 24%, color-mix(in srgb, var(--cc-red) 88%, transparent) 50%, color-mix(in srgb, var(--ring) 76%, transparent) 76%, color-mix(in srgb, var(--ring) 12%, transparent) 100%)' }} />
            <div className="absolute top-6 h-3 w-3 rounded-full" style={{ backgroundColor: CONTROL_THEME.signal, boxShadow: '0 0 14px color-mix(in srgb, var(--ring) 70%, transparent)' }} />
            <div className="absolute bottom-6 h-3 w-3 rounded-full" style={{ backgroundColor: CONTROL_THEME.success, boxShadow: '0 0 14px color-mix(in srgb, var(--status-complete) 70%, transparent)' }} />
            <div className="pipeline-core-ring pipeline-core-ring-outer absolute h-[172px] w-[172px] rounded-full border" style={{ borderColor: CONTROL_THEME.line }} />
            <div className="pipeline-core-ring pipeline-core-ring-mid absolute h-[136px] w-[136px] rounded-full border" style={{ borderColor: 'color-mix(in srgb, var(--ring) 32%, var(--border))' }} />
            <div className="pipeline-core-ring pipeline-core-ring-inner absolute h-[102px] w-[102px] rounded-full border" style={{ borderColor: 'color-mix(in srgb, var(--cc-red) 24%, var(--border))' }} />
            <div
              className="pipeline-core-grid absolute h-[84px] w-[84px] rounded-[24px] border shadow-[0_0_64px_rgba(218,48,79,0.22)]"
              style={{
                borderColor: CONTROL_THEME.line,
                background:
                  'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.18), transparent 35%), radial-gradient(circle at 70% 70%, color-mix(in srgb, var(--ring) 18%, transparent), transparent 30%), linear-gradient(180deg, color-mix(in srgb, var(--surface) 20%, #0f1c33), #06101e)',
              }}
            />
            <div className="pipeline-core-pulse absolute h-[64px] w-[64px] rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--cc-red) 82%, white), color-mix(in srgb, var(--cc-red) 55%, transparent) 42%, rgba(7,25,50,0) 72%)' }} />
            <div className="relative z-10 flex max-w-[210px] flex-col items-center text-center">
              <span className="rounded-pill border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ ...PANEL_STYLE, color: CONTROL_THEME.muted }}>
                Processing
              </span>
              <p className="mt-4 text-[14px] font-medium leading-6" style={{ color: CONTROL_THEME.ink }}>{message}</p>
              <div className="mt-5 h-2 w-40 overflow-hidden rounded-pill" style={{ backgroundColor: 'color-mix(in srgb, var(--border) 45%, #08111d)' }}>
                <div className="h-full rounded-pill transition-all duration-700 ease-out" style={{ width: `${progress}%`, background: `linear-gradient(90deg, color-mix(in srgb, var(--cc-red) 72%, black) 0%, ${CONTROL_THEME.accent} 52%, ${CONTROL_THEME.signal} 100%)` }} />
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
    <section className="relative grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[28px] border px-5 py-5" style={PANEL_STRONG_STYLE}>
      <div className="absolute inset-0 pipeline-scan-lines opacity-30" />
      <div className="relative z-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: CONTROL_THEME.subtle }}>Process log</p>
            <p className="mt-1 text-sm" style={{ color: CONTROL_THEME.muted }}>Recent engine events only</p>
          </div>
          <EngineBadge label="Telemetry stream" />
        </div>
        <div className="min-h-0 space-y-2.5 overflow-y-auto pr-1 font-mono text-[12px]">
          {entries.map((entry, index) => (
            <div
              key={`${entry.label}-${index}`}
              className="flex flex-col gap-1 rounded-[18px] border px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
              style={entry.tone === 'active'
                ? { ...PANEL_STYLE, borderColor: 'color-mix(in srgb, var(--ring) 32%, var(--border))', color: CONTROL_THEME.ink }
                : { ...PANEL_MUTED_STYLE, color: CONTROL_THEME.ink }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="mt-0.5 h-2 w-2 rounded-full"
                  style={entry.tone === 'active'
                    ? { backgroundColor: CONTROL_THEME.signal, boxShadow: '0 0 10px color-mix(in srgb, var(--ring) 76%, transparent)' }
                    : { backgroundColor: CONTROL_THEME.success }}
                />
                <span className="font-semibold">{entry.label}</span>
              </div>
              <span className="sm:max-w-[70%]" style={{ color: CONTROL_THEME.muted }}>{entry.detail}</span>
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

  const latestCompletedStepKey = [...completedSteps]
    .reverse()
    .find((step) => STEP_DEFS.some((def) => def.key === step.key))?.key;
  const activeDefKey = progress >= 100
    ? latestCompletedStepKey || RUNNING_MAP[currentStep] || 'SCRAPE'
    : RUNNING_MAP[currentStep] || latestCompletedStepKey || 'SCRAPE';
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
    const absDist = Math.abs(distanceFromActive);
    const emphasisClass =
      distanceFromActive === 0
        ? 'opacity-100 scale-100'
        : absDist === 1
          ? 'opacity-60 scale-[0.92]'
          : 'opacity-30 scale-[0.86]';

    return (
      <div
        key={def.key}
        className={[isKwStep ? 'sm:ml-5' : '', 'pipeline-slot-item', emphasisClass].join(' ')}
        style={{ transitionProperty: 'transform, opacity, filter', transitionDuration: '600ms', transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
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
      className="relative h-full min-h-0 overflow-hidden rounded-[30px] border p-3 text-white sm:p-4 lg:p-5"
      style={SHELL_STYLE}
      aria-busy={progress < 100}
    >
      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at top right, color-mix(in srgb, var(--cc-red) 18%, transparent) 0%, transparent 28%), radial-gradient(circle at bottom left, color-mix(in srgb, var(--ring) 14%, transparent) 0%, transparent 24%)' }} />
      <div className="absolute inset-0 pipeline-noise opacity-40" />
      <div className="relative z-10 grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_minmax(0,160px)] gap-3">
        <div className="sr-only" aria-live="polite">
          {`${activeStep.label}. ${message}. ${progress}% complete.`}
        </div>
        <header className="flex flex-col gap-3 border-b pb-3 lg:flex-row lg:items-end lg:justify-between" style={{ borderColor: CONTROL_THEME.line }}>
          <div>
            <EngineBadge label="Organic visibility engine" />
            <h2 className="mt-3 text-[22px] font-bold sm:text-[26px]" style={{ color: CONTROL_THEME.ink }}>Analysing your website live</h2>
            <p className="mt-1.5 max-w-2xl text-[12px] leading-5 sm:text-[13px]" style={{ color: CONTROL_THEME.muted }}>
              Real services are running in sequence: crawl, interpret, benchmark, classify, and assemble your visibility model.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-[16px] border px-3 py-2 text-right" style={PANEL_STYLE}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: CONTROL_THEME.subtle }}>Completed</p>
              <p className="mt-1 text-[13px] font-medium" style={{ color: CONTROL_THEME.ink }}>{completedSteps.length} of {STEP_DEFS.length} stages</p>
            </div>
            <ProgressDial progress={progress} />
          </div>
        </header>

        <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,3.1fr)_minmax(280px,1.1fr)_220px] xl:grid-cols-[minmax(0,3.35fr)_minmax(300px,1.15fr)_228px]">
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border p-3" style={PANEL_STYLE}>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: CONTROL_THEME.subtle }}>Analysis pipeline</p>
                <p className="mt-1 text-[12px]" style={{ color: CONTROL_THEME.muted }}>Focused five-stage viewport with live handoff into the engine</p>
              </div>
              <span className="rounded-pill border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ ...PANEL_MUTED_STYLE, color: CONTROL_THEME.signal }}>
                {completedSteps.length}/{STEP_DEFS.length}
              </span>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden rounded-[22px] border px-4 py-3" style={PANEL_MUTED_STYLE}>
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-14 bg-[linear-gradient(180deg,rgba(4,14,27,0.98)_0%,rgba(4,14,27,0.8)_55%,rgba(4,14,27,0)_100%)]" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-14 bg-[linear-gradient(0deg,rgba(4,14,27,0.98)_0%,rgba(4,14,27,0.8)_55%,rgba(4,14,27,0)_100%)]" />
              {hiddenAboveCount > 0 && (
                <div className="mb-3 flex items-center justify-between gap-2 rounded-pill border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ ...PANEL_STYLE, color: CONTROL_THEME.subtle }}>
                  <span>{hiddenAboveCount} earlier stages moved above</span>
                  <span style={{ color: CONTROL_THEME.success }}>Faded</span>
                </div>
              )}

              <div className="relative flex min-h-full flex-col justify-center gap-2.5">
                <div className="pipeline-rail absolute bottom-0 left-[15px] top-3 hidden w-px sm:block" />
                {visibleStageRows}

              {hiddenBelowCount > 0 && (
                <div className="mt-3 flex items-center justify-end text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: CONTROL_THEME.subtle }}>
                  {hiddenBelowCount} upcoming stages below
                </div>
              )}
              </div>
            </div>
          </aside>

          <CenterStage activeDefKey={activeDefKey} progress={progress} message={message} />

          <aside className="grid min-h-0 gap-3 grid-rows-[auto_minmax(0,1fr)]">
            <section className="rounded-[24px] border p-3" style={PANEL_STYLE}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: CONTROL_THEME.subtle }}>Live telemetry</p>
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
