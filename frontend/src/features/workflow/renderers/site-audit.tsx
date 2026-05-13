'use client';

import { InfoTip } from '@/shared/components';

interface SiteAuditData {
  overallScore?: number;
  scores?: Record<string, unknown>;
  coreWebVitals?: Record<string, unknown>;
  issues?: Array<{
    severity: string;
    category?: string;
    title?: string;
    description: string;
    recommendation?: string;
    evidence?: string;
  }>;
  siteStats?: Record<string, unknown>;
  topPages?: unknown[];
  summary?: string;
  [key: string]: unknown;
}

interface NormalizedScore {
  score: number;
  weight: number;
}

interface NormalizedCwv {
  value: string;
  rating: string;
}

/** Normalize a score that may be a flat number or { score, weight, weighted } */
function normalizeScore(val: unknown, defaultWeight: number): NormalizedScore | null {
  if (val == null) return null;
  if (typeof val === 'number') return { score: val, weight: defaultWeight };
  if (typeof val === 'object' && val !== null && 'score' in val) {
    const obj = val as { score: number; weight?: number };
    return { score: obj.score, weight: obj.weight ?? defaultWeight };
  }
  return null;
}

/** Normalize CWV data — handles { value, rating }, flat string, or uppercase keys */
function normalizeCwv(val: unknown): NormalizedCwv | null {
  if (val == null) return null;
  if (typeof val === 'string') return { value: val, rating: guessRating(val) };
  if (typeof val === 'object' && val !== null && 'value' in val) {
    const obj = val as { value: string; rating?: string };
    return { value: obj.value, rating: obj.rating ?? guessRating(obj.value) };
  }
  return null;
}

function guessRating(value: string): string {
  // Basic heuristic for CWV ratings
  const num = parseFloat(value);
  if (isNaN(num)) return 'unknown';
  // Treat as LCP if has "s", CLS if < 1
  if (value.includes('s') && !value.includes('ms')) return num <= 2.5 ? 'good' : num <= 4 ? 'needs-improvement' : 'poor';
  if (value.includes('ms')) return num <= 100 ? 'good' : num <= 300 ? 'needs-improvement' : 'poor';
  return num <= 0.1 ? 'good' : num <= 0.25 ? 'needs-improvement' : 'poor';
}

export function SiteAuditRenderer({ data }: { data: unknown }) {
  const audit = data as SiteAuditData;

  if (!audit || typeof audit !== 'object') {
    return <p className="text-sm text-zinc-500">No audit data available.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      {audit.overallScore !== undefined && (
        <div className="flex items-center gap-4">
          <ScoreRing score={audit.overallScore} size={72} />
          <div>
            <p className="text-lg font-semibold text-zinc-100"><InfoTip tip="Overall technical/SEO health score (0–100)">Site Audit Score</InfoTip></p>
            <p className="text-sm text-zinc-400">{getScoreLabel(audit.overallScore)}</p>
          </div>
        </div>
      )}

      {/* Dimension Scores */}
      {audit.scores && (
        <div className="grid grid-cols-2 gap-3">
          <DimensionCard label="Technical Health" score={findScore(audit.scores, 'technicalHealth', 30)} tip="Server, crawlability & indexation health" />
          <DimensionCard label="On-Page SEO" score={findScore(audit.scores, 'onPageSeo', 25)} tip="Title tags, meta descriptions & headings" />
          <DimensionCard label="Content Quality" score={findScore(audit.scores, 'contentQuality', 25)} tip="Content depth, freshness & uniqueness" />
          <DimensionCard label="Schema & Structure" score={findScore(audit.scores, 'schemaStructure', 20)} tip="Structured data & site architecture" />
        </div>
      )}

      {/* Core Web Vitals */}
      {audit.coreWebVitals && (
        <div>
          <SectionLabel>Core Web Vitals</SectionLabel>
          <div className="mt-2 grid grid-cols-4 gap-2">
            <CwvCard label="LCP" data={findCwv(audit.coreWebVitals, 'lcp')} tip="Largest Contentful Paint (<2.5s = good)" />
            <CwvCard label="FID" data={findCwv(audit.coreWebVitals, 'fid')} tip="First Input Delay (<100ms = good)" />
            <CwvCard label="CLS" data={findCwv(audit.coreWebVitals, 'cls')} tip="Cumulative Layout Shift (<0.1 = good)" />
            <CwvCard label="INP" data={findCwv(audit.coreWebVitals, 'inp')} tip="Interaction to Next Paint (<200ms = good)" />
          </div>
        </div>
      )}

      {/* Issues */}
      {audit.issues && audit.issues.length > 0 && (
        <div>
          <SectionLabel>Issues ({audit.issues.length})</SectionLabel>
          <div className="mt-2 space-y-2">
            {audit.issues.slice(0, 10).map((issue, i) => (
              <div
                key={i}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
              >
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={issue.severity} />
                  <span className="text-sm font-medium text-zinc-200">{issue.title ?? issue.description}</span>
                </div>
                {issue.title && issue.description && (
                  <p className="mt-1 text-xs text-zinc-400">{issue.description}</p>
                )}
                {!issue.title && issue.evidence && (
                  <p className="mt-1 text-xs text-zinc-400">{issue.evidence}</p>
                )}
                {issue.recommendation && (
                  <p className="mt-1 text-xs text-violet-400">→ {issue.recommendation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {audit.summary && (
        <div>
          <SectionLabel>Summary</SectionLabel>
          <p className="mt-1 text-sm leading-relaxed text-zinc-300">{audit.summary}</p>
        </div>
      )}
    </div>
  );
}

function ScoreRing({ score, size }: { score: number; size: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';

  return (
    <svg width={size} height={size}>
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="#27272a" strokeWidth={6}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%" y="50%"
        textAnchor="middle" dominantBaseline="central"
        className="fill-zinc-100 text-lg font-bold"
      >
        {score}
      </text>
    </svg>
  );
}

function DimensionCard({ label, score, tip }: { label: string; score: NormalizedScore | null; tip?: string }) {
  if (!score) return null;
  const color = score.score >= 80 ? 'text-green-400' : score.score >= 50 ? 'text-yellow-400' : 'text-red-400';
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">{tip ? <InfoTip tip={tip}>{label}</InfoTip> : label}</p>
      <p className={`mt-1 text-sm font-semibold ${color}`}>{score.score}</p>
      <p className="text-[10px] text-zinc-600">Weight: {score.weight}%</p>
    </div>
  );
}

function CwvCard({ label, data, tip }: { label: string; data: NormalizedCwv | null; tip?: string }) {
  if (!data) return null;
  const color = data.rating === 'good' ? 'text-green-400' : data.rating === 'needs-improvement' ? 'text-yellow-400' : 'text-red-400';
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/50 p-2 text-center">
      <p className="text-[10px] uppercase text-zinc-500">{tip ? <InfoTip tip={tip}>{label}</InfoTip> : label}</p>
      <p className={`text-sm font-semibold ${color}`}>{data.value}</p>
    </div>
  );
}

/** Case-insensitive key lookup + normalize score */
function findScore(scores: Record<string, unknown>, key: string, defaultWeight: number): NormalizedScore | null {
  const lk = key.toLowerCase();
  for (const [k, v] of Object.entries(scores)) {
    if (k.toLowerCase() === lk) return normalizeScore(v, defaultWeight);
  }
  return null;
}

/** Case-insensitive key lookup + normalize CWV */
function findCwv(cwv: Record<string, unknown>, key: string): NormalizedCwv | null {
  const lk = key.toLowerCase();
  for (const [k, v] of Object.entries(cwv)) {
    if (k.toLowerCase() === lk) return normalizeCwv(v);
  }
  return null;
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400',
    high: 'bg-orange-500/20 text-orange-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    low: 'bg-blue-500/20 text-blue-400',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${colors[severity] ?? 'bg-zinc-700 text-zinc-300'}`}>
      {severity}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{children}</p>;
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs Improvement';
  if (score >= 30) return 'Poor';
  return 'Critical';
}
