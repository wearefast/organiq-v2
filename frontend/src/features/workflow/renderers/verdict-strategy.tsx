'use client';

/* ══════════════════════════════════════════════════════════════════
   VERDICT & STRATEGY RENDERER  —  Step 14
   ──────────────────────────────────────────────────────────────────
   Two-panel layout:
     • VERDICT  — Executive Summary, SWOT, Strategic Verdict, Risks
     • STRATEGY — Priority Matrix (quadrant chart), 90-Day Plan,
                  KPI delta cards, Budget stacked bar
   ──────────────────────────────────────────────────────────────────
   Includes a normalisation layer so both the old (current DB)
   shape AND the new prompt-compliant shape render correctly.
   ════════════════════════════════════════════════════════════════ */

/* ── Canonical Interfaces ─────────────────────── */

interface SwotItem {
  factor: string;
  evidence: string;
  impact: string;
}

interface VerdictCluster {
  cluster: string;
  rationale: string;
  estimatedTraffic?: number;
  keywordCount?: number;
  avgDifficulty?: number;
  confidence?: string;
  difficulty?: string;
  timeToResult?: string;
}

interface DifferentiationAngle {
  angle: string;
  rationale: string;
  uniqueAdvantage?: string;
  contentGap?: string;
}

interface AvoidCluster {
  cluster: string;
  rationale: string;
  alternativeApproach?: string | null;
}

interface RiskItem {
  risk: string;
  probability: string;
  impact: string;
  mitigation: string;
}

interface PriorityItem {
  cluster: string;
  effortScore: number;
  impactScore: number;
  quadrant: string;
  keywordCount?: number;
  totalVolume?: number;
  avgDifficulty?: number;
}

interface Milestone {
  task: string;
  priority: string;
  expectedOutcome?: string;
}

interface MonthPlan {
  theme: string;
  milestones: Milestone[];
}

interface KpiMetric {
  current: number;
  target: number;
  changePercent: number;
}

interface BudgetItem {
  category: string;
  percentOfBudget: number;
  rationale?: string;
}

interface AiGeoOpportunity {
  title: string;
  description: string;
  impact: string;
  effort: string;
}

interface AiGeoReadiness {
  aiReadinessScore: number;
  verdict: string;
  aeoOpportunities: AiGeoOpportunity[];
  geoOpportunities: AiGeoOpportunity[];
  competitorGap: string;
  quickWins: string[];
}

interface NormalizedData {
  executiveSummary: string | null;
  keyFindings: Record<string, string> | null;
  industryTemplate: string | null;
  swot: {
    strengths: SwotItem[];
    weaknesses: SwotItem[];
    opportunities: SwotItem[];
    threats: SwotItem[];
  } | null;
  verdict: {
    competeIn: VerdictCluster[];
    differentiateWith: DifferentiationAngle[];
    avoid: AvoidCluster[];
  } | null;
  riskAssessment: RiskItem[];
  priorityMatrix: PriorityItem[];
  actionPlan: { month1?: MonthPlan; month2?: MonthPlan; month3?: MonthPlan } | null;
  kpis: { ninetyDay: Record<string, KpiMetric>; sixMonth: Record<string, KpiMetric> } | null;
  budgetAllocation: BudgetItem[];
  summary: string | null;
  aiGeoReadiness: AiGeoReadiness | null;
}

/* ── Normalisation ────────────────────────────── */

function get(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  return undefined;
}

function toSwotItems(raw: unknown): SwotItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === 'string') return { factor: item, evidence: '', impact: 'medium' };
    const o = item as Record<string, unknown>;
    return {
      factor: String(o.factor ?? o.title ?? item ?? ''),
      evidence: String(o.evidence ?? o.detail ?? ''),
      impact: String(o.impact ?? 'medium'),
    };
  });
}

const EFFORT_MAP: Record<string, number> = { low: 3, medium: 5, high: 8 };
const IMPACT_MAP: Record<string, number> = { low: 3, medium: 5, high: 8 };

function normalise(data: unknown): NormalizedData {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;

  // --- Executive Summary ---
  let executiveSummary: string | null = null;
  let keyFindings: Record<string, string> | null = null;
  const rawExec = d.executiveSummary;
  if (typeof rawExec === 'string') {
    executiveSummary = rawExec;
  } else if (rawExec && typeof rawExec === 'object') {
    const e = rawExec as Record<string, unknown>;
    executiveSummary = typeof e.overview === 'string' ? e.overview : null;
    if (e.keyFindings && typeof e.keyFindings === 'object') {
      keyFindings = {} as Record<string, string>;
      for (const [k, v] of Object.entries(e.keyFindings as Record<string, unknown>)) {
        keyFindings[k] = String(v);
      }
    }
  }

  // --- SWOT ---
  const rawSwot = (get(d, 'swot', 'swotAnalysis') ?? null) as Record<string, unknown> | null;
  const swot = rawSwot
    ? {
        strengths: toSwotItems(rawSwot.strengths),
        weaknesses: toSwotItems(rawSwot.weaknesses),
        opportunities: toSwotItems(rawSwot.opportunities),
        threats: toSwotItems(rawSwot.threats),
      }
    : null;

  // --- Verdict ---
  const rawVerdict = (get(d, 'verdict', 'strategicVerdict') ?? null) as Record<string, unknown> | null;
  let verdict: NormalizedData['verdict'] = null;
  if (rawVerdict) {
    // competeIn — can be array of objects OR a single string
    let competeIn: VerdictCluster[] = [];
    const rawCompete = rawVerdict.competeIn ?? rawVerdict.compete;
    if (Array.isArray(rawCompete)) {
      competeIn = rawCompete.map((c: Record<string, unknown>) => ({
        cluster: String(c.cluster ?? c.name ?? ''),
        rationale: String(c.rationale ?? c.reason ?? ''),
        estimatedTraffic: Number(c.estimatedTraffic) || undefined,
        keywordCount: Number(c.keywordCount) || undefined,
        avgDifficulty: Number(c.avgDifficulty) || undefined,
        confidence: c.confidence ? String(c.confidence) : undefined,
        difficulty: c.difficulty ? String(c.difficulty) : undefined,
        timeToResult: c.timeToResult ? String(c.timeToResult) : undefined,
      }));
    } else if (typeof rawCompete === 'string') {
      competeIn = [{ cluster: 'Primary Focus', rationale: rawCompete }];
    }

    // differentiateWith
    let differentiateWith: DifferentiationAngle[] = [];
    const rawDiff = rawVerdict.differentiateWith ?? rawVerdict.differentiate;
    if (Array.isArray(rawDiff)) {
      differentiateWith = rawDiff.map((a: Record<string, unknown>) => ({
        angle: String(a.angle ?? a.name ?? ''),
        rationale: String(a.rationale ?? ''),
        uniqueAdvantage: a.uniqueAdvantage ? String(a.uniqueAdvantage) : undefined,
        contentGap: a.contentGap ? String(a.contentGap) : undefined,
      }));
    } else if (typeof rawDiff === 'string') {
      differentiateWith = [{ angle: 'Key Differentiator', rationale: rawDiff }];
    }

    // avoid
    let avoid: AvoidCluster[] = [];
    const rawAvoid = rawVerdict.avoid;
    if (Array.isArray(rawAvoid)) {
      avoid = rawAvoid.map((a: Record<string, unknown>) => ({
        cluster: String(a.cluster ?? a.name ?? ''),
        rationale: String(a.rationale ?? ''),
        alternativeApproach: a.alternativeApproach ? String(a.alternativeApproach) : null,
      }));
    }

    verdict = { competeIn, differentiateWith, avoid };
  }

  // --- Risk Assessment ---
  const rawRisks = d.riskAssessment;
  const riskAssessment: RiskItem[] = Array.isArray(rawRisks)
    ? rawRisks.map((r: Record<string, unknown>) => ({
        risk: String(r.risk ?? ''),
        probability: String(r.probability ?? 'medium'),
        impact: String(r.impact ?? 'medium'),
        mitigation: String(r.mitigation ?? ''),
      }))
    : [];

  // --- Priority Matrix ---
  const rawMatrix = get(d, 'priorityMatrix');
  let priorityMatrix: PriorityItem[] = [];
  if (Array.isArray(rawMatrix)) {
    priorityMatrix = rawMatrix.map((p: Record<string, unknown>) => ({
      cluster: String(p.cluster ?? ''),
      effortScore: Number(p.effortScore) || EFFORT_MAP[String(p.effort ?? '')] || 5,
      impactScore: Number(p.impactScore) || IMPACT_MAP[String(p.impact ?? '')] || 5,
      quadrant: String(p.quadrant ?? 'fill-in'),
      keywordCount: Number(p.keywordCount) || undefined,
      totalVolume: Number(p.totalVolume) || undefined,
      avgDifficulty: Number(p.avgDifficulty) || undefined,
    }));
  } else if (rawMatrix && typeof rawMatrix === 'object') {
    // Old shape: { lowEffortHighImpact: string[], highEffortHighImpact: string[], ... }
    const qMap: Record<string, { quadrant: string; effort: number; impact: number }> = {
      lowEffortHighImpact: { quadrant: 'quick-win', effort: 3, impact: 8 },
      highEffortHighImpact: { quadrant: 'strategic-bet', effort: 8, impact: 8 },
      lowEffortLowImpact: { quadrant: 'fill-in', effort: 3, impact: 3 },
      highEffortLowImpact: { quadrant: 'deprioritize', effort: 8, impact: 3 },
    };
    for (const [key, items] of Object.entries(rawMatrix as Record<string, unknown>)) {
      const mapping = qMap[key];
      if (mapping && Array.isArray(items)) {
        for (const item of items) {
          priorityMatrix.push({
            cluster: String(item),
            effortScore: mapping.effort,
            impactScore: mapping.impact,
            quadrant: mapping.quadrant,
          });
        }
      }
    }
  }

  // --- Action Plan ---
  const rawPlan = get(d, 'actionPlan', '90DayActionPlan') as Record<string, unknown> | undefined;
  let actionPlan: NormalizedData['actionPlan'] = null;
  if (rawPlan) {
    if (rawPlan.month1) {
      // New shape: { month1: { theme, milestones }, ... }
      actionPlan = {
        month1: rawPlan.month1 as MonthPlan | undefined,
        month2: rawPlan.month2 as MonthPlan | undefined,
        month3: rawPlan.month3 as MonthPlan | undefined,
      };
    } else if (Array.isArray(rawPlan.milestones)) {
      // Old shape: { milestones: [{ month: 1, tasks: string[] }] }
      const months: Record<string, MonthPlan> = {};
      for (const ms of rawPlan.milestones as Array<Record<string, unknown>>) {
        const monthNum = Number(ms.month ?? 0);
        const key = `month${monthNum}`;
        const tasks = Array.isArray(ms.tasks) ? ms.tasks : [];
        months[key] = {
          theme: String(ms.theme ?? `Month ${monthNum}`),
          milestones: tasks.map((t: unknown) => ({
            task: String(t),
            priority: 'medium',
            expectedOutcome: '',
          })),
        };
      }
      actionPlan = {
        month1: months.month1,
        month2: months.month2,
        month3: months.month3,
      };
    }
  }

  // --- KPIs ---
  const rawKpis = get(d, 'kpis', 'kpiTargets') as Record<string, unknown> | undefined;
  let kpis: NormalizedData['kpis'] = null;
  if (rawKpis) {
    if (rawKpis.ninetyDay) {
      // New shape
      kpis = {
        ninetyDay: rawKpis.ninetyDay as Record<string, KpiMetric>,
        sixMonth: (rawKpis.sixMonth as Record<string, KpiMetric>) ?? {},
      };
    } else {
      // Old shape: { seoScores: { onPageSEO: "80+" }, coreWebVitals: { LCP: "<2.5s" }, domainMetrics: { ... } }
      const flat: Record<string, KpiMetric> = {};
      for (const [, metrics] of Object.entries(rawKpis)) {
        if (metrics && typeof metrics === 'object') {
          for (const [key, val] of Object.entries(metrics as Record<string, unknown>)) {
            if (typeof val === 'object' && val !== null && 'current' in (val as Record<string, unknown>)) {
              flat[key] = val as KpiMetric;
            } else {
              flat[key] = { current: 0, target: 0, changePercent: 0 };
              // Store the target string as a label
              (flat[key] as unknown as Record<string, unknown>)._label = String(val);
            }
          }
        }
      }
      if (Object.keys(flat).length > 0) {
        kpis = { ninetyDay: flat, sixMonth: {} };
      }
    }
  }

  // --- Budget ---
  const rawBudget = d.budgetAllocation;
  let budgetAllocation: BudgetItem[] = [];
  if (Array.isArray(rawBudget)) {
    budgetAllocation = rawBudget.map((b: Record<string, unknown>) => ({
      category: String(b.category ?? ''),
      percentOfBudget: Number(b.percentOfBudget) || 0,
      rationale: b.rationale ? String(b.rationale) : undefined,
    }));
  } else if (rawBudget && typeof rawBudget === 'object') {
    // Old shape: { technicalSEO: 30, contentDevelopment: 25 }
    for (const [key, val] of Object.entries(rawBudget as Record<string, unknown>)) {
      budgetAllocation.push({
        category: key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (s) => s.toUpperCase()),
        percentOfBudget: Number(val) || 0,
      });
    }
  }

  // --- AEO/GEO Readiness ---
  let aiGeoReadiness: AiGeoReadiness | null = null;
  const rawAgi = d.aiGeoReadiness as Record<string, unknown> | undefined;
  if (rawAgi && typeof rawAgi === 'object') {
    const toOpps = (raw: unknown): AiGeoOpportunity[] => {
      if (!Array.isArray(raw)) return [];
      return raw.map((item: Record<string, unknown>) => ({
        title: String(item.title ?? ''),
        description: String(item.description ?? ''),
        impact: String(item.impact ?? 'medium'),
        effort: String(item.effort ?? 'medium'),
      }));
    };
    aiGeoReadiness = {
      aiReadinessScore: Number(rawAgi.aiReadinessScore) || 0,
      verdict: String(rawAgi.verdict ?? ''),
      aeoOpportunities: toOpps(rawAgi.aeoOpportunities),
      geoOpportunities: toOpps(rawAgi.geoOpportunities),
      competitorGap: String(rawAgi.competitorGap ?? ''),
      quickWins: Array.isArray(rawAgi.quickWins) ? rawAgi.quickWins.map(String) : [],
    };
  }

  return {
    executiveSummary,
    keyFindings,
    industryTemplate: d.industryTemplate ? String(d.industryTemplate) : null,
    swot,
    verdict,
    riskAssessment,
    priorityMatrix,
    actionPlan,
    kpis,
    budgetAllocation,
    summary: typeof d.summary === 'string' ? d.summary : null,
    aiGeoReadiness,
  };
}

/* ── Main Renderer ────────────────────────────── */

export function VerdictStrategyRenderer({ data }: { data: unknown }) {
  const d = normalise(data);

  if (!data || typeof data !== 'object') {
    return <p className="text-sm text-zinc-500">No strategy data available.</p>;
  }

  const hasVerdict = d.executiveSummary || d.swot || d.verdict || d.riskAssessment.length > 0;
  const hasStrategy = d.priorityMatrix.length > 0 || d.actionPlan || d.kpis || d.budgetAllocation.length > 0;

  return (
    <div className="space-y-0">
      {/* ═══════════ VERDICT PANEL ═══════════ */}
      {hasVerdict && (
        <div className="space-y-6">
          <PanelHeader label="Verdict" subtitle="Assessment & Diagnosis" accent="violet" />

          {/* Industry Badge */}
          {d.industryTemplate && (
            <span className="inline-block rounded-full bg-violet-500/10 px-3 py-1 text-[11px] font-medium text-violet-400">
              {d.industryTemplate.toUpperCase()} Strategy
            </span>
          )}

          {/* Executive Summary */}
          {d.executiveSummary && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
              <SectionLabel>Executive Summary</SectionLabel>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-300">
                {d.executiveSummary}
              </p>
              {d.keyFindings && Object.keys(d.keyFindings).length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {Object.entries(d.keyFindings).map(([key, value]) => (
                    <div key={key} className="rounded border border-zinc-800 bg-zinc-900/50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-400/80">
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                      </p>
                      <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SWOT Analysis */}
          {d.swot && (
            <div>
              <SectionLabel>SWOT Analysis</SectionLabel>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <SwotQuadrant label="Strengths" items={d.swot.strengths} color="emerald" icon="↑" />
                <SwotQuadrant label="Weaknesses" items={d.swot.weaknesses} color="red" icon="↓" />
                <SwotQuadrant label="Opportunities" items={d.swot.opportunities} color="blue" icon="★" />
                <SwotQuadrant label="Threats" items={d.swot.threats} color="amber" icon="⚠" />
              </div>
            </div>
          )}

          {/* Strategic Verdict */}
          {d.verdict && (
            <div>
              <SectionLabel>Strategic Verdict</SectionLabel>
              <div className="mt-2 grid grid-cols-3 gap-3">
                {d.verdict.competeIn.length > 0 && (
                  <VerdictCard
                    title="Compete In"
                    accent="emerald"
                    items={d.verdict.competeIn.map((c) => ({
                      label: c.cluster,
                      detail: c.rationale,
                      stats: [
                        c.estimatedTraffic ? `~${fmtNum(c.estimatedTraffic)} traffic` : null,
                        c.difficulty ? `${c.difficulty} difficulty` : null,
                        c.timeToResult ?? null,
                        c.confidence ? `${c.confidence} confidence` : null,
                      ].filter(Boolean) as string[],
                    }))}
                  />
                )}
                {d.verdict.differentiateWith.length > 0 && (
                  <VerdictCard
                    title="Differentiate With"
                    accent="violet"
                    items={d.verdict.differentiateWith.map((a) => ({
                      label: a.angle,
                      detail: a.rationale,
                      stats: [
                        a.uniqueAdvantage ? `Advantage: ${a.uniqueAdvantage}` : null,
                        a.contentGap ? `Gap: ${a.contentGap}` : null,
                      ].filter(Boolean) as string[],
                    }))}
                  />
                )}
                {d.verdict.avoid.length > 0 && (
                  <VerdictCard
                    title="Avoid"
                    accent="red"
                    items={d.verdict.avoid.map((a) => ({
                      label: a.cluster,
                      detail: a.rationale,
                      stats: a.alternativeApproach ? [`Instead: ${a.alternativeApproach}`] : [],
                    }))}
                  />
                )}
              </div>
            </div>
          )}

          {/* Risk Assessment */}
          {d.riskAssessment.length > 0 && (
            <div>
              <SectionLabel>Risk Assessment</SectionLabel>
              <div className="mt-2 space-y-2">
                {d.riskAssessment.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 rounded border border-zinc-800 bg-zinc-900/30 p-3">
                    <RiskBadge probability={r.probability} />
                    <div className="flex-1">
                      <p className="text-[12px] font-medium text-zinc-200">{r.risk}</p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">{r.mitigation}</p>
                    </div>
                    <ImpactTag impact={r.impact} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ DIVIDER ═══════════ */}
      {hasVerdict && hasStrategy && (
        <div className="pt-16 pb-2">
          <PanelHeader label="Strategy" subtitle="Execution Plan" accent="blue" />
        </div>
      )}

      {/* ═══════════ STRATEGY PANEL ═══════════ */}
      {hasStrategy && (
        <div className="space-y-6">
          {!hasVerdict && <PanelHeader label="Strategy" subtitle="Execution Plan" accent="blue" />}

          {/* Priority Matrix — Quadrant Chart */}
          {d.priorityMatrix.length > 0 && <PriorityQuadrantChart items={d.priorityMatrix} />}

          {/* 90-Day Action Plan Timeline */}
          {d.actionPlan && <ActionPlanTimeline actionPlan={d.actionPlan} />}

          {/* KPI Targets */}
          {d.kpis && Object.keys(d.kpis.ninetyDay).length > 0 && (
            <KpiDeltaCards kpis={d.kpis} />
          )}

          {/* Budget Allocation */}
          {d.budgetAllocation.length > 0 && <BudgetBar items={d.budgetAllocation} />}
        </div>
      )}

      {/* AEO / GEO Readiness */}
      {d.aiGeoReadiness && <AiGeoReadinessPanel data={d.aiGeoReadiness} />}

      {/* Summary */}
      {d.summary && (
        <div className="mt-6 rounded border border-zinc-800 bg-zinc-900/30 p-4">
          <SectionLabel>Summary</SectionLabel>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">{d.summary}</p>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PANEL COMPONENTS
   ════════════════════════════════════════════════════════════════ */

function PanelHeader({ label, subtitle, accent }: { label: string; subtitle: string; accent: string }) {
  const colors: Record<string, string> = { violet: 'text-violet-400', blue: 'text-blue-400' };
  return (
    <div className="flex items-baseline gap-3 pb-1">
      <h3 className={`text-sm font-semibold uppercase tracking-wider ${colors[accent] ?? 'text-zinc-300'}`}>{label}</h3>
      <span className="text-[11px] text-zinc-600">{subtitle}</span>
    </div>
  );
}

/* ── AEO / GEO Readiness Panel ─────────────── */

function AiGeoReadinessPanel({ data }: { data: AiGeoReadiness }) {
  const score = data.aiReadinessScore;
  const scoreColor = score >= 70 ? 'text-emerald-400' : score >= 45 ? 'text-amber-400' : 'text-red-400';
  const barColor = score >= 70 ? 'bg-emerald-500' : score >= 45 ? 'bg-amber-500' : 'bg-red-500';

  const impactColors: Record<string, string> = {
    high: 'bg-red-500/20 text-red-400',
    medium: 'bg-amber-500/20 text-amber-400',
    low: 'bg-zinc-700 text-zinc-400',
  };
  const effortColors: Record<string, string> = {
    low: 'bg-emerald-500/20 text-emerald-400',
    medium: 'bg-amber-500/20 text-amber-400',
    high: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="pt-16 pb-2">
      <PanelHeader label="AEO / GEO" subtitle="AI & Answer Engine Readiness" accent="blue" />
      <div className="mt-4 space-y-6">

        {/* Score bar */}
        <div className="flex items-center gap-4">
          <span className={`text-3xl font-bold tabular-nums ${scoreColor}`}>{score}</span>
          <div className="flex-1">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">AI Readiness Score</span>
              <span className="text-[10px] text-zinc-500">/ 100</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(score, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Verdict */}
        {data.verdict && (
          <p className="text-sm leading-relaxed text-zinc-300">{data.verdict}</p>
        )}

        {/* Opportunities grid */}
        {(data.aeoOpportunities.length > 0 || data.geoOpportunities.length > 0) && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* AEO */}
            {data.aeoOpportunities.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">AEO — Answer Engines</p>
                <div className="space-y-2">
                  {data.aeoOpportunities.map((opp, i) => (
                    <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] font-semibold text-zinc-200">{opp.title}</p>
                        <div className="flex shrink-0 gap-1">
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${impactColors[opp.impact] ?? impactColors.medium}`}>
                            {opp.impact}
                          </span>
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${effortColors[opp.effort] ?? effortColors.medium}`}>
                            {opp.effort} effort
                          </span>
                        </div>
                      </div>
                      {opp.description && <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">{opp.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* GEO */}
            {data.geoOpportunities.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">GEO — Generative Engines</p>
                <div className="space-y-2">
                  {data.geoOpportunities.map((opp, i) => (
                    <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] font-semibold text-zinc-200">{opp.title}</p>
                        <div className="flex shrink-0 gap-1">
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${impactColors[opp.impact] ?? impactColors.medium}`}>
                            {opp.impact}
                          </span>
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${effortColors[opp.effort] ?? effortColors.medium}`}>
                            {opp.effort} effort
                          </span>
                        </div>
                      </div>
                      {opp.description && <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">{opp.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Competitor gap */}
        {data.competitorGap && (
          <div className="rounded-lg border border-amber-900/40 bg-amber-500/5 p-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-500">Competitor AI Gap</p>
            <p className="text-[11px] leading-relaxed text-zinc-300">{data.competitorGap}</p>
          </div>
        )}

        {/* Quick wins */}
        {data.quickWins.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Quick Wins</p>
            <ul className="space-y-1.5">
              {data.quickWins.map((win, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-zinc-300">
                  <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  {win}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{children}</p>;
}

/* ── SWOT ──────────────────────────────────── */

function SwotQuadrant({ label, items, color, icon }: { label: string; items: SwotItem[]; color: string; icon: string }) {
  if (items.length === 0) return null;
  const border: Record<string, string> = {
    emerald: 'border-emerald-900/50 bg-emerald-500/5',
    red: 'border-red-900/50 bg-red-500/5',
    blue: 'border-blue-900/50 bg-blue-500/5',
    amber: 'border-amber-900/50 bg-amber-500/5',
  };
  const impactColors: Record<string, string> = {
    high: 'bg-red-500/20 text-red-400',
    medium: 'bg-amber-500/20 text-amber-400',
    low: 'bg-zinc-700 text-zinc-400',
  };
  return (
    <div className={`rounded-lg border p-3 ${border[color] ?? ''}`}>
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-zinc-500">
        <span>{icon}</span> {label} <span className="ml-auto text-zinc-600">{items.length}</span>
      </p>
      <ul className="mt-2 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="text-[11px]">
            <div className="flex items-start justify-between gap-2">
              <span className="text-zinc-200">{item.factor}</span>
              {item.impact && (
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${impactColors[item.impact] ?? impactColors.medium}`}>
                  {item.impact}
                </span>
              )}
            </div>
            {item.evidence && <p className="mt-0.5 text-[10px] text-zinc-500">{item.evidence}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Verdict Cards ─────────────────────────── */

interface VerdictCardItem {
  label: string;
  detail: string;
  stats: string[];
}

function VerdictCard({ title, accent, items }: { title: string; accent: string; items: VerdictCardItem[] }) {
  const accents: Record<string, { border: string; title: string; dot: string }> = {
    emerald: { border: 'border-emerald-900/50', title: 'text-emerald-400', dot: 'bg-emerald-400' },
    violet: { border: 'border-violet-900/50', title: 'text-violet-400', dot: 'bg-violet-400' },
    red: { border: 'border-red-900/50', title: 'text-red-400', dot: 'bg-red-400' },
  };
  const a = accents[accent] ?? accents.violet;
  return (
    <div className={`rounded-lg border bg-zinc-900/30 p-3 ${a.border}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-wider ${a.title}`}>{title}</p>
      <div className="mt-2 space-y-3">
        {items.map((item, i) => (
          <div key={i}>
            <div className="flex items-center gap-1.5">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${a.dot}`} />
              <span className="text-[12px] font-medium text-zinc-200">{item.label}</span>
            </div>
            <p className="mt-0.5 pl-3 text-[11px] text-zinc-500">{item.detail}</p>
            {item.stats.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5 pl-3">
                {item.stats.map((s, j) => (
                  <span key={j} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-400">{s}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Risk Assessment ───────────────────────── */

function RiskBadge({ probability }: { probability: string }) {
  const c: Record<string, string> = {
    high: 'bg-red-500/20 text-red-400',
    medium: 'bg-amber-500/20 text-amber-400',
    low: 'bg-zinc-700 text-zinc-400',
  };
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase ${c[probability] ?? c.medium}`}>
      {probability}
    </span>
  );
}

function ImpactTag({ impact }: { impact: string }) {
  const c: Record<string, string> = {
    high: 'text-red-400',
    medium: 'text-amber-400',
    low: 'text-zinc-500',
  };
  return <span className={`text-[9px] font-medium uppercase ${c[impact] ?? c.medium}`}>Impact: {impact}</span>;
}

/* ══════════════════════════════════════════════════════════════════
   STRATEGY PANEL COMPONENTS
   ════════════════════════════════════════════════════════════════ */

/* ── Priority Quadrant Chart ───────────────── */

const QUADRANT_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  'quick-win': { bg: 'bg-emerald-500/10', border: 'border-emerald-800/50', text: 'text-emerald-400', label: 'Quick Wins' },
  'strategic-bet': { bg: 'bg-blue-500/10', border: 'border-blue-800/50', text: 'text-blue-400', label: 'Strategic Bets' },
  'fill-in': { bg: 'bg-zinc-500/10', border: 'border-zinc-700/50', text: 'text-zinc-400', label: 'Fill-Ins' },
  'deprioritize': { bg: 'bg-red-500/10', border: 'border-red-800/50', text: 'text-red-400', label: 'Deprioritize' },
};

function PriorityQuadrantChart({ items }: { items: PriorityItem[] }) {
  // Group by quadrant for the 2x2 visual
  const quadrants = ['quick-win', 'strategic-bet', 'fill-in', 'deprioritize'] as const;
  const maxVol = Math.max(...items.map((i) => i.totalVolume ?? 0), 1);

  return (
    <div>
      <SectionLabel>Priority Matrix</SectionLabel>
      {/* Axis Labels */}
      <div className="mt-2 flex">
        <div className="flex w-6 items-center justify-center">
          <span className="origin-center -rotate-90 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Impact →
          </span>
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-2 gap-2">
            {/* Top-Left: Quick Wins (low effort, high impact) */}
            <QuadrantCell quadrant="quick-win" items={items.filter((i) => i.quadrant === 'quick-win')} maxVol={maxVol} />
            {/* Top-Right: Strategic Bets (high effort, high impact) */}
            <QuadrantCell quadrant="strategic-bet" items={items.filter((i) => i.quadrant === 'strategic-bet')} maxVol={maxVol} />
            {/* Bottom-Left: Fill-Ins (low effort, low impact) */}
            <QuadrantCell quadrant="fill-in" items={items.filter((i) => i.quadrant === 'fill-in')} maxVol={maxVol} />
            {/* Bottom-Right: Deprioritize (high effort, low impact) */}
            <QuadrantCell quadrant="deprioritize" items={items.filter((i) => i.quadrant === 'deprioritize')} maxVol={maxVol} />
          </div>
          <p className="mt-1 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Effort →</p>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3">
        {quadrants.map((q) => {
          const count = items.filter((i) => i.quadrant === q).length;
          if (count === 0) return null;
          const cfg = QUADRANT_COLORS[q];
          return (
            <span key={q} className="flex items-center gap-1.5 text-[10px]">
              <span className={`inline-block h-2 w-2 rounded-full ${cfg.text.replace('text-', 'bg-')}`} />
              <span className="text-zinc-400">{cfg.label}</span>
              <span className="text-zinc-600">({count})</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function QuadrantCell({ quadrant, items, maxVol }: { quadrant: string; items: PriorityItem[]; maxVol: number }) {
  const cfg = QUADRANT_COLORS[quadrant] ?? QUADRANT_COLORS['fill-in'];
  return (
    <div className={`min-h-[100px] rounded-lg border p-2.5 ${cfg.bg} ${cfg.border}`}>
      <p className={`text-[9px] font-semibold uppercase tracking-wider ${cfg.text}`}>
        {cfg.label} {items.length > 0 && <span className="text-zinc-600">({items.length})</span>}
      </p>
      <div className="mt-2 space-y-1.5">
        {items.map((item, i) => {
          const barW = item.totalVolume ? Math.max(15, (item.totalVolume / maxVol) * 100) : 40;
          return (
            <div key={i}>
              <div className="flex items-center justify-between text-[11px]">
                <span className="truncate text-zinc-300">{item.cluster}</span>
                {item.totalVolume ? (
                  <span className="ml-2 shrink-0 text-[10px] text-zinc-500">{fmtNum(item.totalVolume)}</span>
                ) : null}
              </div>
              <div className="mt-0.5 h-1 w-full rounded-full bg-zinc-800">
                <div
                  className={`h-1 rounded-full ${cfg.text.replace('text-', 'bg-')} opacity-50`}
                  style={{ width: `${barW}%` }}
                />
              </div>
            </div>
          );
        })}
        {items.length === 0 && <p className="text-[10px] text-zinc-600">—</p>}
      </div>
    </div>
  );
}

/* ── Action Plan Timeline ──────────────────── */

function ActionPlanTimeline({ actionPlan }: { actionPlan: { month1?: MonthPlan; month2?: MonthPlan; month3?: MonthPlan } }) {
  const months = [
    { key: 'month1', label: 'Month 1', data: actionPlan.month1, color: 'violet' },
    { key: 'month2', label: 'Month 2', data: actionPlan.month2, color: 'blue' },
    { key: 'month3', label: 'Month 3', data: actionPlan.month3, color: 'emerald' },
  ].filter((m) => m.data);

  if (months.length === 0) return null;

  const dotColors: Record<string, Record<string, string>> = {
    violet: { high: 'bg-red-400', medium: 'bg-violet-400', low: 'bg-zinc-500' },
    blue: { high: 'bg-red-400', medium: 'bg-blue-400', low: 'bg-zinc-500' },
    emerald: { high: 'bg-red-400', medium: 'bg-emerald-400', low: 'bg-zinc-500' },
  };

  const headerColors: Record<string, string> = {
    violet: 'text-violet-400 border-violet-800/50',
    blue: 'text-blue-400 border-blue-800/50',
    emerald: 'text-emerald-400 border-emerald-800/50',
  };

  return (
    <div>
      <SectionLabel>90-Day Action Plan</SectionLabel>
      <div className="mt-2 grid grid-cols-3 gap-3">
        {months.map((m) => (
          <div key={m.key} className="rounded-lg border border-zinc-800 bg-zinc-900/30">
            <div className={`border-b px-3 py-2 ${headerColors[m.color]}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${headerColors[m.color].split(' ')[0]}`}>
                {m.label}
              </p>
              {m.data!.theme && m.data!.theme.toLowerCase() !== m.label.toLowerCase() && (
                <p className="mt-0.5 text-[11px] text-zinc-300">{m.data!.theme}</p>
              )}
            </div>
            <ul className="space-y-1.5 p-3">
              {m.data!.milestones.map((ms, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dotColors[m.color][ms.priority] ?? 'bg-zinc-500'}`} />
                  <div>
                    <p className="text-[11px] text-zinc-300">{ms.task}</p>
                    {ms.expectedOutcome && (
                      <p className="text-[10px] text-zinc-600">→ {ms.expectedOutcome}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── KPI Delta Cards ───────────────────────── */

function KpiDeltaCards({ kpis }: { kpis: { ninetyDay: Record<string, KpiMetric>; sixMonth: Record<string, KpiMetric> } }) {
  const entries = Object.entries(kpis.ninetyDay);
  if (entries.length === 0) return null;

  return (
    <div>
      <SectionLabel>KPI Targets</SectionLabel>
      <div className="mt-2 grid grid-cols-2 gap-3">
        {entries.map(([key, metric]) => {
          const sixM = kpis.sixMonth[key];
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
          const hasNumeric = metric.current > 0 || metric.target > 0;
          const pct = metric.changePercent || (metric.current > 0 ? Math.round(((metric.target - metric.current) / metric.current) * 100) : 0);
          const targetLabel = (metric as unknown as Record<string, unknown>)._label;

          return (
            <div key={key} className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
              {hasNumeric ? (
                <>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-xl font-bold text-zinc-100">{fmtNum(metric.target)}</span>
                    {pct !== 0 && (
                      <span className={`mb-0.5 flex items-center text-[11px] font-medium ${pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pct > 0 ? '↑' : '↓'} {Math.abs(pct)}%
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-zinc-500">
                    <span>Current: {fmtNum(metric.current)}</span>
                    <span>→</span>
                    <span className="text-zinc-400">90-Day: {fmtNum(metric.target)}</span>
                    {sixM && <span className="text-zinc-400">· 6-Mo: {fmtNum(sixM.target)}</span>}
                  </div>
                  {/* Progress bar */}
                  {metric.current > 0 && metric.target > 0 && (
                    <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-800">
                      <div
                        className="h-1.5 rounded-full bg-emerald-500/60"
                        style={{ width: `${Math.min(100, (metric.current / metric.target) * 100)}%` }}
                      />
                    </div>
                  )}
                </>
              ) : targetLabel ? (
                <p className="mt-2 text-lg font-bold text-zinc-200">{String(targetLabel)}</p>
              ) : (
                <p className="mt-2 text-sm text-zinc-500">—</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Budget Stacked Bar ────────────────────── */

const BUDGET_COLORS = [
  'bg-violet-500',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-orange-500',
];

function BudgetBar({ items }: { items: BudgetItem[] }) {
  const total = items.reduce((s, b) => s + b.percentOfBudget, 0);
  if (total === 0) return null;

  return (
    <div>
      <SectionLabel>Budget Allocation</SectionLabel>
      {/* Stacked Bar */}
      <div className="mt-2 flex h-6 w-full overflow-hidden rounded-lg">
        {items.map((b, i) => (
          <div
            key={i}
            className={`flex items-center justify-center ${BUDGET_COLORS[i % BUDGET_COLORS.length]} ${i === 0 ? 'rounded-l-lg' : ''} ${i === items.length - 1 ? 'rounded-r-lg' : ''}`}
            style={{ width: `${(b.percentOfBudget / total) * 100}%` }}
            title={`${b.category}: ${b.percentOfBudget}%`}
          >
            {b.percentOfBudget >= 8 && (
              <span className="text-[9px] font-bold text-white/80">{b.percentOfBudget}%</span>
            )}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {items.map((b, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded ${BUDGET_COLORS[i % BUDGET_COLORS.length]}`} />
            <span className="text-[11px] text-zinc-300">{b.category}</span>
            <span className="text-[11px] text-zinc-500">{b.percentOfBudget}%</span>
          </div>
        ))}
      </div>
      {/* Rationale */}
      {items.some((b) => b.rationale) && (
        <div className="mt-3 space-y-1">
          {items
            .filter((b) => b.rationale)
            .map((b, i) => (
              <p key={i} className="text-[10px] text-zinc-500">
                <span className="font-medium text-zinc-400">{b.category}:</span> {b.rationale}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

/* ── Utility ───────────────────────────────── */

function fmtNum(n?: number): string {
  if (n === undefined || n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
