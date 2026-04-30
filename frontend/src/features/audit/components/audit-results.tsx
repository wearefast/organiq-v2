import type { AuditDetailResponse } from '../services/audit.service';

interface Props {
  audit: AuditDetailResponse;
}

const STATUS_STYLES: Record<string, string> = {
  complete: 'bg-teal-50 text-teal-700',
  polling: 'bg-blue-50 text-blue-700',
  pending: 'bg-amber-50 text-amber-700',
  error: 'bg-red-50 text-red-700',
};

export function AuditResults({ audit }: Props) {
  const { pipeline } = audit;
  const statusStyle = STATUS_STYLES[audit.status] ?? 'bg-[#F8F9FC] text-[#4B5563]';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-bold text-[#111827]">{audit.websiteUrl}</h1>
            <p className="mt-1 text-sm text-[#9CA3AF]">
              Started {new Date(audit.createdAt).toLocaleString()}
            </p>
          </div>
          <span className={`inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold capitalize ${statusStyle}`}>
            {audit.status}
          </span>
        </div>
      </div>

      {/* Card 1: Website Scrape (Cheerio) */}
      {pipeline.scrape && <ScrapeCard data={pipeline.scrape} />}

      {/* Card 2: Business Profile (OpenAI) */}
      {pipeline.businessProfile && (
        <ProfileCard data={pipeline.businessProfile} seedKeywords={audit.seedKeywords} />
      )}

      {/* Card 3: Deep Read (OpenAI) */}
      {pipeline.deepRead && <DeepReadCard data={pipeline.deepRead} />}

      {/* Card 4: Keyword Research (Ahrefs + OpenAI) */}
      {pipeline.keywordResearch !== undefined && (
        <KeywordResearchCard data={pipeline.keywordResearch} seedExpansions={audit.seedExpansions} />
      )}

      {/* Card 5: PageSpeed (Google PSI) */}
      {pipeline.pageSpeed !== undefined && <PageSpeedCard data={pipeline.pageSpeed} />}
    </div>
  );
}

/* ── Section card wrapper ────────────────────────────────── */

function SectionCard({ title, badge, children }: { title: string; badge: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-[16px] font-semibold text-[#111827]">{title}</h2>
        <span className="rounded-pill bg-[#F8F9FC] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-[#9CA3AF]">{badge}</span>
      </div>
      {children}
    </section>
  );
}

/* ── Scrape Card ─────────────────────────────────────────── */

function ScrapeCard({ data }: { data: NonNullable<Props['audit']['pipeline']['scrape']> }) {
  return (
    <SectionCard title="Website scrape" badge="Cheerio">
      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
        <Dt label="Title" value={data.title} />
        <Dt label="Meta description" value={data.metaDescription || '—'} />
        <Dt label="H1 tags" value={data.h1s.length > 0 ? data.h1s.join(', ') : '—'} />
        <Dt label="Internal links" value={String(data.internalLinkCount)} />
        <Dt label="Image alt coverage" value={`${data.imageAltCoverage}%`} />
        <Dt label="Schema markup" value={data.schemaMarkupPresent ? 'Yes' : 'No'} />
      </dl>
      <details className="mt-5">
        <summary className="cursor-pointer text-xs font-medium text-[#9CA3AF] hover:text-[#4B5563]">
          Show body text snippet
        </summary>
        <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-[#F8F9FC] p-3 font-mono text-xs leading-relaxed text-[#4B5563]">
          {data.bodyText}
        </p>
      </details>
    </SectionCard>
  );
}

/* ── Business Profile Card ───────────────────────────────── */

function ProfileCard({
  data,
  seedKeywords,
}: {
  data: NonNullable<Props['audit']['pipeline']['businessProfile']>;
  seedKeywords: string[];
}) {
  return (
    <SectionCard title="Business profile" badge="OpenAI">
      <dl className="space-y-4 text-sm">
        <DtBlock label="Brand identity" value={data.brandIdentity} />
        <DtBlock label="Target market" value={data.targetMarket} />
        <DtBlock label="Geography" value={data.geography} />
        {data.serviceAreas && data.serviceAreas.length > 0 && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF]">Service areas</dt>
            <dd className="mt-1.5 space-y-2">
              {Object.entries(
                data.serviceAreas.reduce<Record<string, Array<{ area: string; region: string }>>>((acc, sa) => {
                  if (!acc[sa.country]) acc[sa.country] = [];
                  acc[sa.country].push({ area: sa.area, region: sa.region });
                  return acc;
                }, {}),
              ).map(([country, areas]) => (
                <div key={country}>
                  <span className="text-xs font-medium text-[#111827]">{country}</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {areas.map((a) => (
                      <span key={`${a.area}-${a.region}`} className="rounded-pill bg-[#EEF2FF] px-2.5 py-0.5 text-xs font-medium text-[#6366F1]">
                        {a.area}{a.region !== a.area && a.region !== country ? `, ${a.region}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </dd>
          </div>
        )}
        <DtBlock label="Tone of voice" value={data.toneOfVoice} />
        <DtBlock label="Operational model" value={data.operationalModel} />
        <div>
          <dt className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF]">Services</dt>
          <dd className="mt-1.5">
            <ul className="list-inside list-disc space-y-0.5 text-[#4B5563]">
              {data.services.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF]">Seed keywords</dt>
          <dd className="mt-1.5 flex flex-wrap gap-1.5">
            {seedKeywords.map((kw) => (
              <span key={kw} className="rounded-pill bg-[#FCF4F6] px-2.5 py-0.5 text-xs font-medium text-[#DA304F]">
                {kw}
              </span>
            ))}
          </dd>
        </div>
      </dl>
    </SectionCard>
  );
}

/* ── Deep Read Card ──────────────────────────────────────── */

function DeepReadCard({ data }: { data: NonNullable<Props['audit']['pipeline']['deepRead']> }) {
  return (
    <SectionCard title="Deep read" badge="OpenAI">
      <dl className="space-y-4 text-sm">
        <DtBlock label="What they sell" value={data.whatTheySell} />
        <DtBlock label="Who they serve" value={data.whoTheyServe} />
        <DtBlock label="How they position" value={data.howTheyPosition} />
        <DtBlock label="What makes them different" value={data.whatMakesThemDifferent} />
      </dl>
    </SectionCard>
  );
}

/* ── Keyword Research Card ────────────────────────────────── */

import type { KeywordResearchData } from '../services/audit.service';

function KeywordResearchCard({
  data,
  seedExpansions,
}: {
  data: KeywordResearchData | null;
  seedExpansions: string[];
}) {
  if (!data) {
    return (
      <SectionCard title="Keyword research" badge="Ahrefs + OpenAI">
        <p className="text-sm text-[#9CA3AF]">Skipped — no Ahrefs API key. Classification pending.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Keyword research" badge="Ahrefs + OpenAI">
      <div className="space-y-6">
        {/* Core Keywords */}
        {data.coreKeywords.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#9CA3AF]">Core Keywords</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E8EAF0] text-left text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                    <th className="pb-2 pr-4">Keyword</th>
                    <th className="pb-2 pr-4">Volume</th>
                    <th className="pb-2 pr-4">KD</th>
                    <th className="pb-2 pr-4">Confidence</th>
                    <th className="pb-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {data.coreKeywords.map((kw) => (
                    <tr key={kw.keyword} className="border-b border-[#F3F4F6]">
                      <td className="py-2 pr-4 font-medium text-[#111827]">{kw.keyword}</td>
                      <td className="py-2 pr-4 text-[#4B5563]">{kw.volume ?? '—'}</td>
                      <td className="py-2 pr-4 text-[#4B5563]">{kw.difficulty ?? '—'}</td>
                      <td className="py-2 pr-4">
                        <span className={`rounded-pill px-2 py-0.5 text-xs font-medium ${kw.confidence === 'high' ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700'}`}>
                          {kw.confidence}
                        </span>
                      </td>
                      <td className="py-2 text-[#6B7280]">{kw.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Money Keywords */}
        {data.moneyKeywords.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#9CA3AF]">Money Keywords</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E8EAF0] text-left text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                    <th className="pb-2 pr-4">Keyword</th>
                    <th className="pb-2 pr-4">Volume</th>
                    <th className="pb-2 pr-4">KD</th>
                    <th className="pb-2 pr-4">Intent</th>
                    <th className="pb-2">Mapped Service</th>
                  </tr>
                </thead>
                <tbody>
                  {data.moneyKeywords.map((kw) => (
                    <tr key={kw.keyword} className="border-b border-[#F3F4F6]">
                      <td className="py-2 pr-4 font-medium text-[#111827]">{kw.keyword}</td>
                      <td className="py-2 pr-4 text-[#4B5563]">{kw.volume ?? '—'}</td>
                      <td className="py-2 pr-4 text-[#4B5563]">{kw.difficulty ?? '—'}</td>
                      <td className="py-2 pr-4">
                        <span className="rounded-pill bg-[#EEF2FF] px-2 py-0.5 text-xs font-medium text-[#6366F1]">
                          {kw.intent}
                        </span>
                      </td>
                      <td className="py-2 text-[#6B7280]">{kw.mappedService}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Primary Topics */}
        {data.primaryTopics.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#9CA3AF]">Primary Topics</h3>
            <div className="space-y-3">
              {data.primaryTopics.map((topic) => (
                <div key={topic.pillar} className="rounded-lg bg-[#F8F9FC] p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#111827]">{topic.pillar}</span>
                    <span className="text-xs text-[#9CA3AF]">~{topic.estimatedTotalVolume.toLocaleString()} vol</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {topic.clusterKeywords.map((ck) => (
                      <span key={ck} className="rounded-pill bg-white px-2.5 py-0.5 text-xs font-medium text-[#4B5563] shadow-sm">
                        {ck}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Niche Entities */}
        {data.nicheEntities.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#9CA3AF]">Niche Entities</h3>
            <div className="space-y-2">
              {data.nicheEntities.map((ent) => (
                <div key={ent.entity} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 shrink-0 rounded-pill bg-[#FCF4F6] px-2 py-0.5 text-[11px] font-semibold uppercase text-[#DA304F]">
                    {ent.type}
                  </span>
                  <div>
                    <span className="font-medium text-[#111827]">{ent.entity}</span>
                    <span className="ml-2 text-[#6B7280]">— {ent.relevance}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Seed Expansions */}
        {seedExpansions.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#9CA3AF]">Seed Expansions (for next steps)</h3>
            <div className="flex flex-wrap gap-1.5">
              {seedExpansions.map((kw) => (
                <span key={kw} className="rounded-pill bg-[#EEF2FF] px-2.5 py-0.5 text-xs font-medium text-[#6366F1]">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Core Topics */}
        {data.coreTopics && data.coreTopics.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#9CA3AF]">Core Topics</h3>
            <div className="space-y-3">
              {data.coreTopics.map((ct) => (
                <div key={ct.topicName} className="rounded-lg bg-[#F8F9FC] p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#111827]">{ct.topicName}</span>
                    <span className="rounded-pill bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-medium text-[#6366F1]">{ct.type}</span>
                    <span className="rounded-pill bg-[#FCF4F6] px-2 py-0.5 text-[11px] font-medium text-[#DA304F]">{ct.intent}</span>
                    {ct.mappedTo && (
                      <span className="text-xs text-[#6B7280]">→ {ct.mappedTo}</span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ct.relatedTerms.map((term) => (
                      <span key={term} className="rounded-pill bg-white px-2.5 py-0.5 text-xs font-medium text-[#4B5563] shadow-sm">
                        {term}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

/* ── PageSpeed Card ──────────────────────────────────────── */

function PageSpeedCard({ data }: { data: Props['audit']['pipeline']['pageSpeed'] }) {
  if (!data) {
    return (
      <SectionCard title="PageSpeed insights" badge="Google PSI">
        <p className="text-sm text-[#9CA3AF]">Skipped — rate limited or unavailable.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="PageSpeed insights" badge="Google PSI">
      <div className="grid grid-cols-2 gap-8">
        <MetricsColumn label="Mobile" m={data.mobile} />
        <MetricsColumn label="Desktop" m={data.desktop} />
      </div>
    </SectionCard>
  );
}

function MetricsColumn({ label, m }: { label: string; m: Props['audit']['pipeline']['pageSpeed'] extends infer T ? T extends { mobile: infer M } ? M : never : never }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#9CA3AF]">{label}</h3>
      <dl className="space-y-2 text-sm">
        <Dt label="Performance" value={`${m.performanceScore}/100`} />
        <Dt label="SEO" value={`${m.seoScore}/100`} />
        <Dt label="Accessibility" value={`${m.accessibilityScore}/100`} />
        <Dt label="LCP" value={`${(m.lcp / 1000).toFixed(2)}s`} />
        <Dt label="CLS" value={m.cls.toFixed(3)} />
        <Dt label="TBT (FID proxy)" value={`${m.fid}ms`} />
      </dl>
    </div>
  );
}

/* ── Shared helpers ──────────────────────────────────────── */

function Dt({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[#9CA3AF]">{label}</dt>
      <dd className="font-medium text-[#111827]">{value}</dd>
    </div>
  );
}

function DtBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF]">{label}</dt>
      <dd className="mt-1 leading-relaxed text-[#4B5563]">{value}</dd>
    </div>
  );
}
