'use client';

import { useState } from 'react';
import type {
  AuditDetailResponse,
  KeywordResearchData,
  CompetitorData,
  SerpCandidateData,
  PageSpeedMetricsData,
} from '../services/audit.service';

/* ═══════════════════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════════════════ */

interface Props {
  audit: AuditDetailResponse;
}

type TabKey = 'overview' | 'keywords' | 'competitors' | 'performance';

/* ═══════════════════════════════════════════════════════════
   Root
   ═══════════════════════════════════════════════════════════ */

export function AuditResults({ audit }: Props) {
  const { pipeline } = audit;
  const [tab, setTab] = useState<TabKey>('overview');

  const tabs: Array<{ key: TabKey; label: string; available: boolean }> = [
    { key: 'overview', label: 'Overview', available: true },
    { key: 'keywords', label: 'Keywords & Topics', available: !!pipeline.keywordResearch },
    { key: 'competitors', label: 'Competitors', available: !!pipeline.competitors },
    { key: 'performance', label: 'Performance', available: !!pipeline.pageSpeed },
  ];

  return (
    <div className="space-y-6">
      {/* ── Hero Header ──────────────────────────────── */}
      <HeroHeader audit={audit} />

      {/* ── Quick Stats ──────────────────────────────── */}
      <QuickStats audit={audit} />

      {/* ── Tab Bar ──────────────────────────────────── */}
      <nav className="flex gap-1 rounded-xl border border-[#E8EAF0] bg-white p-1 shadow-sm">
        {tabs.filter(t => t.available).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-[#071932] text-white shadow-sm'
                : 'text-[#6B7280] hover:bg-[#F8F9FC] hover:text-[#111827]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── Tab Content ──────────────────────────────── */}
      {tab === 'overview' && <OverviewTab audit={audit} />}
      {tab === 'keywords' && pipeline.keywordResearch && (
        <KeywordsTab data={pipeline.keywordResearch} seedExpansions={audit.seedExpansions} />
      )}
      {tab === 'competitors' && pipeline.competitors && (
        <CompetitorsTab competitors={pipeline.competitors} serpCandidates={pipeline.serpCandidates} />
      )}
      {tab === 'performance' && pipeline.pageSpeed && (
        <PerformanceTab data={pipeline.pageSpeed} scrape={pipeline.scrape} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Hero Header
   ═══════════════════════════════════════════════════════════ */

function HeroHeader({ audit }: Props) {
  const [emailSent, setEmailSent] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const domain = (() => { try { return new URL(audit.websiteUrl).hostname; } catch { return audit.websiteUrl; } })();
  const statusMap: Record<string, { label: string; className: string }> = {
    COMPLETE: { label: 'Complete', className: 'bg-teal-500/20 text-teal-200 border-teal-400/30' },
    PROCESSING: { label: 'Processing', className: 'bg-blue-500/20 text-blue-200 border-blue-400/30 animate-pulse' },
    PENDING: { label: 'Queued', className: 'bg-amber-500/20 text-amber-200 border-amber-400/30' },
    FAILED: { label: 'Failed', className: 'bg-red-500/20 text-red-200 border-red-400/30' },
  };
  const st = statusMap[audit.status] ?? statusMap.PENDING;

  const handleEmailReport = async () => {
    setEmailSending(true);
    // TODO: wire to real API endpoint when email delivery (Step 10) is implemented
    await new Promise(resolve => setTimeout(resolve, 1200));
    setEmailSent(true);
    setEmailSending(false);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#071932] via-[#AE213E] via-[55%] to-[#DA304F] p-8 text-white shadow-lg">
      {/* Decorative grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {audit.favicon && (
              <img
                src={audit.favicon}
                alt=""
                className="h-10 w-10 shrink-0 rounded-lg bg-white/10 object-contain p-1"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-widest text-white/50">SEO Audit Report</p>
              {audit.siteName && (
                <p className="text-xs font-semibold text-white/70">{audit.siteName}</p>
              )}
              <h1 className="text-[28px] font-bold leading-tight text-white">{domain}</h1>
              <p className="mt-1 text-sm text-white/60">{audit.websiteUrl}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className={`rounded-pill border px-3 py-1 text-xs font-semibold ${st.className}`}>
              {st.label}
            </span>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-6 text-xs text-white/50">
            <span>Generated {new Date(audit.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            {audit.seedKeywords.length > 0 && <span>{audit.seedKeywords.length} seed keywords</span>}
          </div>
          {audit.status === 'COMPLETE' && (
            <button
              onClick={handleEmailReport}
              disabled={emailSending || emailSent}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-all ${
                emailSent
                  ? 'border-teal-400/30 bg-teal-500/20 text-teal-200'
                  : emailSending
                    ? 'border-white/10 bg-white/5 text-white/50'
                    : 'border-white/20 bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {emailSent ? (
                <><IconCheck className="h-3.5 w-3.5" /> Report Sent</>
              ) : emailSending ? (
                <><IconMail className="h-3.5 w-3.5 animate-pulse" /> Sending…</>
              ) : (
                <><IconMail className="h-3.5 w-3.5" /> Email Report</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Quick Stats (horizontal metric cards)
   ═══════════════════════════════════════════════════════════ */

function QuickStats({ audit }: Props) {
  const { pipeline } = audit;
  const kw = pipeline.keywordResearch;
  const ps = pipeline.pageSpeed;
  const comp = pipeline.competitors;

  const stats: Array<{ label: string; value: string; sub?: string; color: string }> = [];

  if (kw) {
    stats.push({ label: 'Core Keywords', value: String(kw.coreKeywords.length), color: 'from-[#DA304F] to-[#E15972]' });
    stats.push({ label: 'Money Keywords', value: String(kw.moneyKeywords.length), color: 'from-[#6366F1] to-[#818CF8]' });
    stats.push({ label: 'Topics', value: String(kw.primaryTopics.length), sub: `${kw.coreTopics?.length ?? 0} core`, color: 'from-[#0891B2] to-[#22D3EE]' });
  }
  if (comp) {
    const total = comp.directCompetitors.length + comp.organicCompetitors.length;
    stats.push({ label: 'Competitors', value: String(total), sub: `${comp.directCompetitors.length} direct`, color: 'from-[#D97706] to-[#FBBF24]' });
  }
  if (ps) {
    stats.push({ label: 'Mobile Perf', value: `${ps.mobile.performanceScore}`, sub: '/100', color: scoreGradient(ps.mobile.performanceScore) });
    stats.push({ label: 'Desktop Perf', value: `${ps.desktop.performanceScore}`, sub: '/100', color: scoreGradient(ps.desktop.performanceScore) });
  }

  if (stats.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map(s => (
        <div key={s.label} className="rounded-xl border border-[#E8EAF0] bg-white p-4 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#9CA3AF]">{s.label}</p>
          <div className="mt-1 flex items-baseline gap-1">
            <span className={`bg-gradient-to-r ${s.color} bg-clip-text text-[26px] font-bold leading-none text-transparent`}>
              {s.value}
            </span>
            {s.sub && <span className="text-xs text-[#9CA3AF]">{s.sub}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   OVERVIEW TAB
   ═══════════════════════════════════════════════════════════ */

function OverviewTab({ audit }: Props) {
  const { pipeline } = audit;
  return (
    <div className="space-y-5">
      {/* Business Profile + Deep Read side-by-side on desktop */}
      {(pipeline.businessProfile || pipeline.deepRead) && (
        <div className="grid gap-5 lg:grid-cols-2">
          {pipeline.businessProfile && (
            <Card title="Business Profile" icon={IconBuilding}>
              <dl className="space-y-3 text-sm">
                <DtBlock label="Brand identity" value={pipeline.businessProfile.brandIdentity} />
                <DtBlock label="Target market" value={pipeline.businessProfile.targetMarket} />
                <DtBlock label="Geography" value={pipeline.businessProfile.geography} />
                <DtBlock label="Tone" value={pipeline.businessProfile.toneOfVoice} />
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Services</dt>
                  <dd className="mt-1.5 flex flex-wrap gap-1.5">
                    {pipeline.businessProfile.services.map(s => (
                      <span key={s} className="rounded-pill bg-[#F8F9FC] px-2.5 py-0.5 text-xs font-medium text-[#4B5563]">{s}</span>
                    ))}
                  </dd>
                </div>
                {pipeline.businessProfile.serviceAreas && pipeline.businessProfile.serviceAreas.length > 0 && (
                  <ServiceAreasBlock areas={pipeline.businessProfile.serviceAreas} />
                )}
              </dl>
            </Card>
          )}
          {pipeline.deepRead && (
            <Card title="Deep Read Analysis" icon={IconBrain}>
              <div className="space-y-4">
                <InsightRow icon="$" label="What they sell" value={pipeline.deepRead.whatTheySell} />
                <InsightRow icon="@" label="Who they serve" value={pipeline.deepRead.whoTheyServe} />
                <InsightRow icon="#" label="How they position" value={pipeline.deepRead.howTheyPosition} />
                <InsightRow icon="*" label="What makes them different" value={pipeline.deepRead.whatMakesThemDifferent} />
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Seed Keywords */}
      {audit.seedKeywords.length > 0 && (
        <Card title="Seed Keywords" icon={IconKey}>
          <div className="flex flex-wrap gap-2">
            {audit.seedKeywords.map(kw => (
              <span key={kw} className="rounded-pill border border-[#DA304F]/20 bg-[#FCF4F6] px-3 py-1 text-sm font-medium text-[#DA304F]">{kw}</span>
            ))}
          </div>
        </Card>
      )}

      {/* Website Scrape */}
      {pipeline.scrape && (
        <Card title="Website Crawl" icon={IconGlobe}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <MiniStat label="Page Title" value={pipeline.scrape.title || '—'} wide />
            <MiniStat label="H1 Tags" value={String(pipeline.scrape.h1s.length)} />
            <MiniStat label="Internal Links" value={String(pipeline.scrape.internalLinkCount)} />
            <MiniStat label="Image Alt Coverage" value={`${pipeline.scrape.imageAltCoverage}%`} />
            <MiniStat label="Schema Markup" value={pipeline.scrape.schemaMarkupPresent ? 'Detected' : 'Missing'} accent={!pipeline.scrape.schemaMarkupPresent ? 'warn' : 'ok'} />
            <MiniStat label="Meta Description" value={pipeline.scrape.metaDescription ? 'Present' : 'Missing'} accent={!pipeline.scrape.metaDescription ? 'warn' : 'ok'} />
          </div>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   KEYWORDS TAB
   ═══════════════════════════════════════════════════════════ */

function KeywordsTab({ data, seedExpansions }: { data: KeywordResearchData; seedExpansions: string[] }) {
  return (
    <div className="space-y-5">
      {/* Core Keywords */}
      {data.coreKeywords.length > 0 && (
        <Card title={`Core Keywords (${data.coreKeywords.length})`} icon={IconTarget}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8EAF0]">
                  <Th>Keyword</Th><Th align="right">Volume</Th><Th align="right">KD</Th><Th>Confidence</Th><Th>Reason</Th>
                </tr>
              </thead>
              <tbody>
                {data.coreKeywords.map(kw => (
                  <tr key={kw.keyword} className="border-b border-[#F3F4F6] transition-colors hover:bg-[#FAFAFB]">
                    <td className="py-2.5 pr-4 font-medium text-[#111827]">{kw.keyword}</td>
                    <td className="py-2.5 pr-4 text-right font-mono text-[#4B5563]">{kw.volume?.toLocaleString() ?? '—'}</td>
                    <td className="py-2.5 pr-4 text-right"><KdBadge value={kw.difficulty} /></td>
                    <td className="py-2.5 pr-4">
                      <span className={`rounded-pill px-2 py-0.5 text-xs font-medium ${kw.confidence === 'high' ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700'}`}>
                        {kw.confidence}
                      </span>
                    </td>
                    <td className="py-2.5 text-xs text-[#6B7280]">{kw.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Money Keywords */}
      {data.moneyKeywords.length > 0 && (
        <Card title={`Money Keywords (${data.moneyKeywords.length})`} icon={IconDollar}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8EAF0]">
                  <Th>Keyword</Th><Th align="right">Volume</Th><Th align="right">KD</Th><Th>Intent</Th><Th>Mapped Service</Th>
                </tr>
              </thead>
              <tbody>
                {data.moneyKeywords.map(kw => (
                  <tr key={kw.keyword} className="border-b border-[#F3F4F6] transition-colors hover:bg-[#FAFAFB]">
                    <td className="py-2.5 pr-4 font-medium text-[#111827]">{kw.keyword}</td>
                    <td className="py-2.5 pr-4 text-right font-mono text-[#4B5563]">{kw.volume?.toLocaleString() ?? '—'}</td>
                    <td className="py-2.5 pr-4 text-right"><KdBadge value={kw.difficulty} /></td>
                    <td className="py-2.5 pr-4">
                      <span className="rounded-pill bg-[#EEF2FF] px-2 py-0.5 text-xs font-medium text-[#6366F1]">{kw.intent}</span>
                    </td>
                    <td className="py-2.5 text-xs text-[#6B7280]">{kw.mappedService}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Topics & Entities side-by-side */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Primary Topics */}
        {data.primaryTopics.length > 0 && (
          <Card title={`Topic Clusters (${data.primaryTopics.length})`} icon={IconCluster}>
            <div className="space-y-3">
              {data.primaryTopics.map(topic => (
                <div key={topic.pillar} className="rounded-lg border border-[#E8EAF0] bg-[#FAFAFB] p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#111827]">{topic.pillar}</span>
                    <span className="rounded-pill bg-[#EEF2FF] px-2 py-0.5 text-xs font-mono text-[#6366F1]">~{topic.estimatedTotalVolume.toLocaleString()} vol</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {topic.clusterKeywords.map(ck => (
                      <span key={ck} className="rounded-pill border border-[#E8EAF0] bg-white px-2.5 py-0.5 text-xs text-[#4B5563]">{ck}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Niche Entities */}
        {data.nicheEntities.length > 0 && (
          <Card title={`Niche Entities (${data.nicheEntities.length})`} icon={IconEntity}>
            <div className="space-y-2">
              {data.nicheEntities.map(ent => (
                <div key={ent.entity} className="flex items-start gap-3 rounded-lg border border-[#E8EAF0] bg-[#FAFAFB] p-3 text-sm">
                  <span className="mt-0.5 shrink-0 rounded-pill bg-[#FCF4F6] px-2 py-0.5 text-[10px] font-bold uppercase text-[#DA304F]">
                    {ent.type}
                  </span>
                  <div>
                    <span className="font-medium text-[#111827]">{ent.entity}</span>
                    <p className="mt-0.5 text-xs text-[#6B7280]">{ent.relevance}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Core Topics */}
      {data.coreTopics && data.coreTopics.length > 0 && (
        <Card title={`Core Topics (${data.coreTopics.length})`} icon={IconLayers}>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.coreTopics.map(ct => (
              <div key={ct.topicName} className="rounded-lg border border-[#E8EAF0] bg-[#FAFAFB] p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-[#111827]">{ct.topicName}</span>
                  <span className="rounded-pill bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#6366F1]">{ct.type}</span>
                  <span className="rounded-pill bg-[#FCF4F6] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#DA304F]">{ct.intent}</span>
                </div>
                {ct.mappedTo && <p className="mt-1 text-xs text-[#6B7280]">Mapped to: {ct.mappedTo}</p>}
                {ct.relatedTerms.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {ct.relatedTerms.map(term => (
                      <span key={term} className="rounded-pill border border-[#E8EAF0] bg-white px-2 py-0.5 text-[11px] text-[#4B5563]">{term}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Seed Expansions */}
      {seedExpansions.length > 0 && (
        <Card title={`Seed Expansions (${seedExpansions.length})`} icon={IconExpand}>
          <div className="flex flex-wrap gap-2">
            {seedExpansions.map(kw => (
              <span key={kw} className="rounded-pill border border-[#6366F1]/20 bg-[#EEF2FF] px-3 py-1 text-xs font-medium text-[#6366F1]">{kw}</span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   COMPETITORS TAB
   ═══════════════════════════════════════════════════════════ */

function CompetitorsTab({ competitors, serpCandidates }: { competitors: CompetitorData; serpCandidates: SerpCandidateData[] | null }) {
  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#DA304F]/20 bg-gradient-to-br from-[#FCF4F6] to-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#DA304F]/70">Direct Competitors</p>
          <p className="mt-1 text-[32px] font-bold text-[#DA304F]">{competitors.directCompetitors.length}</p>
          <p className="mt-0.5 text-xs text-[#9CA3AF]">Same service, same market</p>
        </div>
        <div className="rounded-xl border border-[#6366F1]/20 bg-gradient-to-br from-[#EEF2FF] to-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#6366F1]/70">Organic Competitors</p>
          <p className="mt-1 text-[32px] font-bold text-[#6366F1]">{competitors.organicCompetitors.length}</p>
          <p className="mt-0.5 text-xs text-[#9CA3AF]">Authority & related content</p>
        </div>
      </div>

      {/* Direct Competitors */}
      {competitors.directCompetitors.length > 0 && (
        <Card title="Direct Competitors" icon={IconTarget}>
          <div className="space-y-3">
            {competitors.directCompetitors.map(c => (
              <div key={c.domain} className="flex items-start gap-4 rounded-lg border border-[#DA304F]/10 bg-[#FCF4F6]/50 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#DA304F]/10 text-sm font-bold text-[#DA304F]">
                  {c.domain.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#111827]">{c.domain}</p>
                  <p className="mt-0.5 text-sm text-[#6B7280]">{c.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Organic Competitors */}
      {competitors.organicCompetitors.length > 0 && (
        <Card title="Organic Competitors" icon={IconCluster}>
          <div className="space-y-3">
            {competitors.organicCompetitors.map(c => (
              <div key={c.domain} className="flex items-start gap-4 rounded-lg border border-[#6366F1]/10 bg-[#EEF2FF]/50 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#6366F1]/10 text-sm font-bold text-[#6366F1]">
                  {c.domain.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#111827]">{c.domain}</p>
                  <p className="mt-0.5 text-sm text-[#6B7280]">{c.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* SERP Candidates raw data */}
      {serpCandidates && serpCandidates.length > 0 && (
        <Card title={`SERP Discovery (${serpCandidates.length} domains)`} icon={IconGlobe}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8EAF0]">
                  <Th>Domain</Th><Th align="right">Appearances</Th><Th align="right">Avg Position</Th><Th>Sample URLs</Th>
                </tr>
              </thead>
              <tbody>
                {serpCandidates.map(c => (
                  <tr key={c.domain} className="border-b border-[#F3F4F6] transition-colors hover:bg-[#FAFAFB]">
                    <td className="py-2.5 pr-4 font-medium text-[#111827]">{c.domain}</td>
                    <td className="py-2.5 pr-4 text-right font-mono text-[#4B5563]">{c.occurrences}</td>
                    <td className="py-2.5 pr-4 text-right">
                      <span className={`rounded-pill px-2 py-0.5 text-xs font-medium ${c.avgPosition <= 3 ? 'bg-teal-50 text-teal-700' : c.avgPosition <= 7 ? 'bg-amber-50 text-amber-700' : 'bg-[#F8F9FC] text-[#6B7280]'}`}>
                        #{c.avgPosition}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate py-2.5 text-xs text-[#9CA3AF]">{c.sampleUrls[0] || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PERFORMANCE TAB
   ═══════════════════════════════════════════════════════════ */

function PerformanceTab({ data, scrape }: { data: { mobile: PageSpeedMetricsData; desktop: PageSpeedMetricsData }; scrape: Props['audit']['pipeline']['scrape'] }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <ScoreRingCard label="Mobile" metrics={data.mobile} />
        <ScoreRingCard label="Desktop" metrics={data.desktop} />
      </div>

      {/* Core Web Vitals */}
      <Card title="Core Web Vitals" icon={IconChart}>
        <div className="grid gap-4 sm:grid-cols-3">
          <CwvCard label="LCP" desc="Largest Contentful Paint" value={`${(data.mobile.lcp / 1000).toFixed(2)}s`} status={data.mobile.lcp <= 2500 ? 'good' : data.mobile.lcp <= 4000 ? 'needs-improvement' : 'poor'} />
          <CwvCard label="CLS" desc="Cumulative Layout Shift" value={data.mobile.cls.toFixed(3)} status={data.mobile.cls <= 0.1 ? 'good' : data.mobile.cls <= 0.25 ? 'needs-improvement' : 'poor'} />
          <CwvCard label="TBT" desc="Total Blocking Time" value={`${data.mobile.fid}ms`} status={data.mobile.fid <= 200 ? 'good' : data.mobile.fid <= 600 ? 'needs-improvement' : 'poor'} />
        </div>
      </Card>

      {/* On-Page SEO Signals */}
      {scrape && (
        <Card title="On-Page SEO Signals" icon={IconGlobe}>
          <div className="grid gap-3 sm:grid-cols-2">
            <SeoSignal label="Meta Description" present={!!scrape.metaDescription} detail={scrape.metaDescription || 'Not found'} />
            <SeoSignal label="Schema Markup" present={scrape.schemaMarkupPresent} detail={scrape.schemaMarkupPresent ? 'Structured data detected' : 'No structured data found'} />
            <SeoSignal label="H1 Tag" present={scrape.h1s.length > 0} detail={scrape.h1s.length > 0 ? scrape.h1s[0] : 'No H1 tag found'} />
            <SeoSignal label="Image Alt Tags" present={scrape.imageAltCoverage >= 80} detail={`${scrape.imageAltCoverage}% coverage`} />
          </div>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Shared Components
   ═══════════════════════════════════════════════════════════ */

function Card({ title, icon: Icon, children }: { title: string; icon?: React.FC<{ className?: string }>; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2.5">
        {Icon && <Icon className="h-4 w-4 text-[#9CA3AF]" />}
        <h2 className="text-[15px] font-semibold text-[#111827]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <th className={`pb-2.5 pr-4 text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] ${align === 'right' ? 'text-right' : 'text-left'}`}>{children}</th>;
}

function DtBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">{label}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-[#4B5563]">{value}</dd>
    </div>
  );
}

function InsightRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F8F9FC] font-mono text-sm font-bold text-[#9CA3AF]">{icon}</div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">{label}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-[#4B5563]">{value}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value, wide, accent }: { label: string; value: string; wide?: boolean; accent?: 'ok' | 'warn' }) {
  const accentStyle = accent === 'warn' ? 'text-amber-600' : accent === 'ok' ? 'text-teal-600' : 'text-[#111827]';
  return (
    <div className={`rounded-lg bg-[#F8F9FC] p-3 ${wide ? 'col-span-2 sm:col-span-3' : ''}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-medium ${accentStyle}`}>{value}</p>
    </div>
  );
}

function ServiceAreasBlock({ areas }: { areas: Array<{ area: string; region: string; country: string }> }) {
  const grouped = areas.reduce<Record<string, Array<{ area: string; region: string }>>>((acc, sa) => {
    if (!acc[sa.country]) acc[sa.country] = [];
    acc[sa.country].push({ area: sa.area, region: sa.region });
    return acc;
  }, {});

  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Service areas</dt>
      <dd className="mt-1.5 space-y-2">
        {Object.entries(grouped).map(([country, items]) => (
          <div key={country}>
            <span className="text-xs font-medium text-[#111827]">{country}</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {items.map(a => (
                <span key={`${a.area}-${a.region}`} className="rounded-pill bg-[#EEF2FF] px-2.5 py-0.5 text-xs font-medium text-[#6366F1]">
                  {a.area}{a.region !== a.area && a.region !== country ? `, ${a.region}` : ''}
                </span>
              ))}
            </div>
          </div>
        ))}
      </dd>
    </div>
  );
}

function KdBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[#9CA3AF]">—</span>;
  const color = value <= 30 ? 'bg-teal-50 text-teal-700' : value <= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700';
  return <span className={`rounded-pill px-2 py-0.5 text-xs font-medium ${color}`}>{value}</span>;
}

function ScoreRingCard({ label, metrics }: { label: string; metrics: PageSpeedMetricsData }) {
  const scores = [
    { name: 'Performance', value: metrics.performanceScore },
    { name: 'SEO', value: metrics.seoScore },
    { name: 'Accessibility', value: metrics.accessibilityScore },
  ];
  return (
    <Card title={label}>
      <div className="flex items-center justify-around gap-4">
        {scores.map(s => (
          <div key={s.name} className="flex flex-col items-center gap-2">
            <ScoreRing value={s.value} size={72} />
            <span className="text-xs text-[#6B7280]">{s.name}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ScoreRing({ value, size = 72 }: { value: number; size?: number }) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 90 ? '#10B981' : value >= 50 ? '#F59E0B' : '#EF4444';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[15px] font-bold text-[#111827]">{value}</span>
      </div>
    </div>
  );
}

function CwvCard({ label, desc, value, status }: { label: string; desc: string; value: string; status: 'good' | 'needs-improvement' | 'poor' }) {
  const styles = {
    good: { bg: 'bg-teal-50', border: 'border-teal-200', dot: 'bg-teal-500', text: 'text-teal-700' },
    'needs-improvement': { bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', text: 'text-amber-700' },
    poor: { bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500', text: 'text-red-700' },
  };
  const s = styles[status];
  return (
    <div className={`rounded-xl border ${s.border} ${s.bg} p-4`}>
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${s.dot}`} />
        <span className="text-xs font-bold uppercase tracking-wider text-[#4B5563]">{label}</span>
      </div>
      <p className={`mt-2 text-[24px] font-bold ${s.text}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-[#6B7280]">{desc}</p>
    </div>
  );
}

function SeoSignal({ label, present, detail }: { label: string; present: boolean; detail: string }) {
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${present ? 'border-teal-200 bg-teal-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
      <span className={`mt-0.5 text-sm ${present ? 'text-teal-600' : 'text-amber-600'}`}>{present ? '✓' : '!'}</span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${present ? 'text-teal-800' : 'text-amber-800'}`}>{label}</p>
        <p className="mt-0.5 truncate text-xs text-[#6B7280]">{detail}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Icons (inline SVG — no dependency)
   ═══════════════════════════════════════════════════════════ */

function IconBuilding({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>;
}
function IconBrain({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>;
}
function IconKey({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>;
}
function IconGlobe({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>;
}
function IconTarget({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>;
}
function IconDollar({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
function IconCluster({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" /></svg>;
}
function IconEntity({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>;
}
function IconLayers({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L12 12.75 6.429 9.75m11.142 0l4.179 2.25L12 17.25 2.25 12l4.179-2.25m11.142 0l4.179 2.25L12 22.5l-9.75-5.25 4.179-2.25" /></svg>;
}
function IconExpand({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>;
}
function IconChart({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>;
}
function IconMail({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>;
}
function IconCheck({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>;
}

/* ── Utility ── */

function scoreGradient(score: number): string {
  if (score >= 90) return 'from-[#10B981] to-[#34D399]';
  if (score >= 50) return 'from-[#F59E0B] to-[#FBBF24]';
  return 'from-[#EF4444] to-[#F87171]';
}
