'use client';

interface SiteAuditData {
  overallScore?: number;
  scores?: {
    technicalHealth?: { score: number; weight: number; weighted: number };
    onPageSeo?: { score: number; weight: number; weighted: number };
    contentQuality?: { score: number; weight: number; weighted: number };
    schemaStructure?: { score: number; weight: number; weighted: number };
  };
  coreWebVitals?: {
    lcp?: { value: string; rating: string };
    fid?: { value: string; rating: string };
    cls?: { value: string; rating: string };
    inp?: { value: string; rating: string };
  };
  issues?: Array<{
    severity: string;
    category: string;
    title: string;
    description: string;
    recommendation?: string;
  }>;
  siteStats?: {
    totalPages?: number;
    indexablePages?: number;
    mobileReady?: boolean;
    httpsEnabled?: boolean;
    sitemapFound?: boolean;
  };
  summary?: string;
  [key: string]: unknown;
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
            <p className="text-lg font-semibold text-zinc-100">Site Audit Score</p>
            <p className="text-sm text-zinc-400">{getScoreLabel(audit.overallScore)}</p>
          </div>
        </div>
      )}

      {/* Dimension Scores */}
      {audit.scores && (
        <div className="grid grid-cols-2 gap-3">
          <DimensionCard label="Technical Health" score={audit.scores.technicalHealth} />
          <DimensionCard label="On-Page SEO" score={audit.scores.onPageSeo} />
          <DimensionCard label="Content Quality" score={audit.scores.contentQuality} />
          <DimensionCard label="Schema & Structure" score={audit.scores.schemaStructure} />
        </div>
      )}

      {/* Core Web Vitals */}
      {audit.coreWebVitals && (
        <div>
          <SectionLabel>Core Web Vitals</SectionLabel>
          <div className="mt-2 grid grid-cols-4 gap-2">
            <CwvCard label="LCP" data={audit.coreWebVitals.lcp} />
            <CwvCard label="FID" data={audit.coreWebVitals.fid} />
            <CwvCard label="CLS" data={audit.coreWebVitals.cls} />
            <CwvCard label="INP" data={audit.coreWebVitals.inp} />
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
                  <span className="text-sm font-medium text-zinc-200">{issue.title}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">{issue.description}</p>
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

function DimensionCard({ label, score }: { label: string; score?: { score: number; weight: number; weighted: number } }) {
  if (!score) return null;
  const color = score.score >= 80 ? 'text-green-400' : score.score >= 50 ? 'text-yellow-400' : 'text-red-400';
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{score.score}</p>
      <p className="text-[10px] text-zinc-600">Weight: {score.weight}%</p>
    </div>
  );
}

function CwvCard({ label, data }: { label: string; data?: { value: string; rating: string } }) {
  if (!data) return null;
  const color = data.rating === 'good' ? 'text-green-400' : data.rating === 'needs-improvement' ? 'text-yellow-400' : 'text-red-400';
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/50 p-2 text-center">
      <p className="text-[10px] uppercase text-zinc-500">{label}</p>
      <p className={`text-sm font-semibold ${color}`}>{data.value}</p>
    </div>
  );
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
