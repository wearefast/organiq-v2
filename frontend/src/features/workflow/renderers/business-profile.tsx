'use client';
import { useState } from 'react';

interface BusinessProfileData {
  domain?: string;
  companyName?: string;
  businessName?: string;
  business_name?: string;
  industry?: string;
  website?: string;
  description?: string;
  targetAudience?: string | string[];
  goals?: string[];
  competitors?: Array<string | { name: string; link?: string }>;
  primaryMarket?: string;
  primary_market?: string;
  primary_services?: string[];
  brand_voice?: string;
  positioning?: string;
  content_gaps?: string[];
  trust_signals?: string[];
  analyst_notes?: string;
  logo_url?: string | null;
  social_media?: Array<{ platform: string; url: string; source?: string }>;
  sitemap_urls?: string[];
  icp?: {
    description?: string;
    industries?: string[];
    pain_points?: string[];
  };
  seo_signals?: {
    meta_quality?: string;
    content_depth?: string;
    blog_present?: boolean;
    local_seo?: boolean;
    notes?: string;
  };
  eeat_signals?: {
    about_page_quality?: string;
    team_or_author_pages?: boolean;
    credentials_mentioned?: string[];
    legal_pages_present?: string[];
    awards_certifications?: string[];
    press_mentions_detected?: boolean;
  };
  aeo_readiness?: {
    entity_definition_clarity?: string;
    faq_content_present?: boolean;
    structured_qa_patterns?: string;
    directory_citation_mentions?: string[];
    original_data_or_research?: boolean;
  };
  funnel_coverage?: {
    tofu_present?: string[];
    tofu_missing?: string[];
    mofu_present?: string[];
    mofu_missing?: string[];
    bofu_present?: string[];
    bofu_missing?: string[];
  };
  domain_authority?: {
    domain_rating?: number | null;
    referring_domains?: number | null;
    backlinks?: number | null;
    data_source?: string;
  } | null;
  [key: string]: unknown;
}

export function BusinessProfileRenderer({ data }: { data: unknown }) {
  const profile = data as BusinessProfileData;

  if (!profile || typeof profile !== 'object') {
    return <p className="text-sm text-zinc-500">No profile data available.</p>;
  }

  const businessName =
    profile.business_name ?? profile.businessName ?? profile.companyName ?? 'Unknown company';
  const website = profile.website ?? profile.domain;
  const primaryMarket = profile.primary_market ?? profile.primaryMarket ?? null;
  // Truncate to first clause if agent outputs a paragraph instead of a label
  const primaryMarketLabel = primaryMarket
    ? primaryMarket.split(/[.,(]/)[0].trim().substring(0, 40) || primaryMarket.substring(0, 40)
    : null;
  const services = toTextList(profile.primary_services);
  const competitors = toCompetitorList(profile.competitors);
  const trustSignals = toTextList(profile.trust_signals);
  const contentGaps = toTextList(profile.content_gaps);
  const icpIndustries = toTextList(profile.icp?.industries);
  const icpPainPoints = toTextList(profile.icp?.pain_points);
  const socialMedia = toSocialMediaList(profile.social_media);
  const sitemapUrls = Array.isArray(profile.sitemap_urls) ? profile.sitemap_urls as string[] : [];
  const eatCredentials = toTextList(profile.eeat_signals?.credentials_mentioned);
  const eatLegalPages = toTextList(profile.eeat_signals?.legal_pages_present);
  const eatAwards = toTextList(profile.eeat_signals?.awards_certifications);
  const aeoDirectories = toTextList(profile.aeo_readiness?.directory_citation_mentions);
  const cleanDomain = website
    ? website.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0]
    : null;
  const remainingFields = Object.entries(profile).filter(
    ([key, value]) =>
      ![
        'domain',
        'companyName',
        'businessName',
        'business_name',
        'industry',
        'website',
        'description',
        'targetAudience',
        'goals',
        'competitors',
        'primaryMarket',
        'primary_market',
        'primary_services',
        'brand_voice',
        'positioning',
        'content_gaps',
        'trust_signals',
        'analyst_notes',
        'logo_url',
        'social_media',
        'sitemap_urls',
        'icp',
        'seo_signals',
        'eeat_signals',
        'aeo_readiness',
        'funnel_coverage',
        'domain_authority',
      ].includes(key) && value !== null && value !== undefined,
  );

  return (
    <div className="space-y-5">
      {/* ── Hero card ─────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-[24px] border border-zinc-800 bg-[radial-gradient(ellipse_at_top_left,rgba(56,189,248,0.12),rgba(24,24,27,0.97)_50%,rgba(9,9,11,0.98)_100%)]">
        <div className="px-5 py-5 sm:px-6">
          <div className="flex items-start gap-4">
            {cleanDomain && <CompanyLogo domain={cleanDomain} name={businessName} logoUrl={typeof profile.logo_url === 'string' ? profile.logo_url : undefined} />}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-300/70">Business profile</p>
              <h2 className="mt-1 text-2xl font-semibold leading-tight text-zinc-50">{businessName}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {profile.industry && <span className="text-sm text-zinc-400">{profile.industry}</span>}
                {profile.brand_voice && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-200/90">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-sky-400/60">Tone</span>
                    {profile.brand_voice}
                  </span>
                )}
                {website && (
                  <a
                    href={website.startsWith('http') ? website : `https://${website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-700/60 bg-zinc-800/60 px-2.5 py-0.5 text-[11px] text-zinc-300 transition-colors hover:border-sky-400/30 hover:text-sky-200"
                  >
                    ↗ {cleanDomain}
                  </a>
                )}
              </div>
              {/* Social media inline in hero */}
              {socialMedia.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {socialMedia.map((item) => (
                    <a
                      key={item.url}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      title={item.platform}
                      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700/50 bg-zinc-800/50 px-2.5 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
                    >
                      <SocialIcon platform={item.platform} />
                      <span className="capitalize">{item.platform}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Key metrics strip */}
        <div className="grid gap-px border-t border-zinc-800/60 bg-zinc-800/60 sm:grid-cols-4">
          {[
            ['Primary market', primaryMarketLabel ?? 'Not specified'],
            ['Services', String(services.length)],
            ['Competitors', String(competitors.length)],
            ['Content gaps', String(contentGaps.length)],
          ].map(([label, value]) => (
            <div key={label} className="bg-zinc-950/80 px-5 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{label}</p>
              <p className="mt-1 text-xl font-semibold text-zinc-100">{value}</p>
            </div>
          ))}
        </div>

        {/* Domain authority strip */}
        {profile.domain_authority && (
          <div className="grid gap-px border-t border-zinc-800/40 bg-zinc-800/40 sm:grid-cols-3">
            <div className="flex items-center gap-3 bg-zinc-950/60 px-5 py-4">
              {profile.domain_authority.domain_rating != null && (
                <DRScoreRing score={profile.domain_authority.domain_rating} />
              )}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Domain rating</p>
                <p className="mt-0.5 text-2xl font-bold text-zinc-100">{profile.domain_authority.domain_rating ?? '—'}</p>
              </div>
            </div>
            <div className="bg-zinc-950/60 px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Referring domains</p>
              <p className="mt-1 text-xl font-semibold text-zinc-100">
                {profile.domain_authority.referring_domains != null
                  ? Number(profile.domain_authority.referring_domains).toLocaleString()
                  : '—'}
              </p>
            </div>
            <div className="bg-zinc-950/60 px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Backlinks</p>
              <p className="mt-1 text-xl font-semibold text-zinc-100">
                {profile.domain_authority.backlinks != null
                  ? Number(profile.domain_authority.backlinks).toLocaleString()
                  : '—'}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ── Main two-column grid ─────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        {/* Left: strategy + intelligence */}
        <div className="space-y-5">
          {(profile.positioning || profile.analyst_notes) && (
            <Panel title="Strategic narrative" subtitle="How the agent framed the business from the supplied site evidence.">
              <div className="space-y-4">
                {profile.positioning && <NarrativeBlock label="Positioning" value={profile.positioning} />}
                {profile.analyst_notes && <AnalystNotesBlock value={profile.analyst_notes} />}
              </div>
            </Panel>
          )}

          {(profile.icp?.description || icpIndustries.length > 0 || icpPainPoints.length > 0) && (
            <Panel title="Ideal customer profile" subtitle="Demand-side picture inferred from the crawl and prompt context.">
              {profile.icp?.description && (
                <blockquote className="mb-4 rounded-2xl border-l-2 border-sky-400/40 bg-sky-400/5 py-3 pl-4 pr-4 italic">
                  <p className="text-sm leading-7 text-zinc-300">{profile.icp.description}</p>
                </blockquote>
              )}
              <div className="space-y-4">
                {icpIndustries.length > 0 && <TagSection label="Industries" items={icpIndustries} tone="sky" />}
                {icpPainPoints.length > 0 && (
                  <div>
                    <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Pain points</p>
                    <div className="space-y-2">
                      {icpPainPoints.map((pt, i) => (
                        <div key={i} className="flex gap-3 rounded-xl border border-rose-400/10 bg-rose-400/5 px-4 py-2.5">
                          <span className="mt-0.5 w-5 shrink-0 text-xs font-bold tabular-nums text-rose-400/70">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <p className="text-sm leading-6 text-zinc-300">{pt}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {contentGaps.length > 0 && (
            <Panel
              title={`Content gaps · ${contentGaps.length} opportunities`}
              subtitle="Missing coverage or weak discovery paths visible from the current site structure."
            >
              <div className="space-y-2">
                {contentGaps.map((gap, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-2xl border border-amber-400/15 bg-amber-400/5 px-4 py-3 transition-colors hover:border-amber-400/25"
                  >
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10">
                      <span className="text-[10px] font-bold text-amber-400">+</span>
                    </div>
                    <p className="text-sm leading-6 text-zinc-300">{gap}</p>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {profile.funnel_coverage && (
            <Panel title="Content funnel" subtitle="Awareness, consideration, and decision-stage content found vs. gaps.">
              <div className="grid gap-4 sm:grid-cols-3">
                <FunnelColumn
                  stage="Top of funnel"
                  present={profile.funnel_coverage.tofu_present ?? []}
                  missing={profile.funnel_coverage.tofu_missing ?? []}
                  tone="sky"
                />
                <FunnelColumn
                  stage="Middle of funnel"
                  present={profile.funnel_coverage.mofu_present ?? []}
                  missing={profile.funnel_coverage.mofu_missing ?? []}
                  tone="violet"
                />
                <FunnelColumn
                  stage="Bottom of funnel"
                  present={profile.funnel_coverage.bofu_present ?? []}
                  missing={profile.funnel_coverage.bofu_missing ?? []}
                  tone="emerald"
                />
              </div>
            </Panel>
          )}
        </div>

        {/* Right: competitive intelligence + social */}
        <div className="space-y-5">
          {competitors.length > 0 && (
            <Panel title="Competitor landscape" subtitle="Named alternatives with authority and content signals.">
              <div className="grid grid-cols-2 gap-2">
                {competitors.map((c, i) => (
                  <CompetitorCard key={i} competitor={c} />
                ))}
              </div>
            </Panel>
          )}

          {services.length > 0 && (
            <Panel title="Primary services">
              <TagSection items={services} tone="emerald" />
            </Panel>
          )}
        </div>
      </div>

      {/* ── Signal dashboard ────────────────────────────────────── */}
      {(profile.seo_signals || profile.eeat_signals || profile.aeo_readiness) && (
        <div className="grid gap-5 sm:grid-cols-3">
          {profile.seo_signals && (
            <Panel title="SEO signals">
              <div className="space-y-1.5">
                <SignalRow label="Meta quality" value={profile.seo_signals.meta_quality} />
                <SignalRow label="Content depth" value={profile.seo_signals.content_depth} />
                <SignalRow label="Blog" value={formatBoolean(profile.seo_signals.blog_present)} />
                <SignalRow label="Local SEO" value={formatBoolean(profile.seo_signals.local_seo)} />
              </div>
              {profile.seo_signals.notes && (
                <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                  <CollapsibleText value={profile.seo_signals.notes} className="text-xs leading-6 text-zinc-400" />
                </div>
              )}
            </Panel>
          )}

          {profile.eeat_signals && (
            <Panel title="E-E-A-T signals">
              <div className="space-y-1.5">
                <SignalRow label="About quality" value={profile.eeat_signals.about_page_quality} />
                <SignalRow label="Team pages" value={formatBoolean(profile.eeat_signals.team_or_author_pages)} />
                <SignalRow label="Press mentions" value={formatBoolean(profile.eeat_signals.press_mentions_detected)} />
              </div>
              {eatCredentials.length > 0 && <div className="mt-3"><TagSection label="Credentials" items={eatCredentials} tone="emerald" /></div>}
              {eatLegalPages.length > 0 && <div className="mt-3"><TagSection label="Legal pages" items={eatLegalPages} tone="zinc" /></div>}
              {eatAwards.length > 0 && <div className="mt-3"><TagSection label="Awards" items={eatAwards} tone="violet" /></div>}
            </Panel>
          )}

          {profile.aeo_readiness && (
            <Panel title="AEO readiness">
              <div className="space-y-1.5">
                <SignalRow label="Entity clarity" value={profile.aeo_readiness.entity_definition_clarity} />
                <SignalRow label="FAQ content" value={formatBoolean(profile.aeo_readiness.faq_content_present)} />
                <SignalRow label="Q&A patterns" value={profile.aeo_readiness.structured_qa_patterns} />
                <SignalRow label="Original research" value={formatBoolean(profile.aeo_readiness.original_data_or_research)} />
              </div>
              {aeoDirectories.length > 0 && <div className="mt-3"><TagSection label="Directory citations" items={aeoDirectories} tone="sky" /></div>}
            </Panel>
          )}
        </div>
      )}

      {/* ── Trust signals ───────────────────────────────────────── */}
      {trustSignals.length > 0 && (
        <Panel title="Trust signals" subtitle="Credibility cues the model found in the supplied material.">
          <div className="grid gap-2 sm:grid-cols-2">
            {trustSignals.map((signal, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-violet-400/10 bg-violet-400/5 px-4 py-2.5">
                <span className="mt-0.5 shrink-0 text-sm font-bold text-violet-400">✓</span>
                <p className="text-sm leading-6 text-zinc-300">{signal}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {sitemapUrls.length > 0 && <SitemapSection urls={sitemapUrls} />}

      {remainingFields.length > 0 && (
        <Panel title="Raw extracted signals" subtitle="Fields returned by the agent not yet promoted into the main layout. Trigger a profile refresh to see new sections.">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {remainingFields.map(([key, value]) => (
              <div key={key} className={isWide(value) ? 'sm:col-span-2' : ''}>
                <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">{toLabel(key)}</dt>
                <FieldValue value={value} />
              </div>
            ))}
          </dl>
        </Panel>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/50 p-5 sm:p-6">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">{title}</p>
        {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function NarrativeBlock({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className={[
      'rounded-2xl border p-4',
      emphasis
        ? 'border-sky-400/20 bg-sky-400/5'
        : 'border-zinc-800 bg-zinc-950/60',
    ].join(' ')}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">{label}</p>
      <p className="mt-2 text-sm leading-7 text-zinc-300">{value}</p>
    </div>
  );
}

function SignalMetric({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-zinc-200">{value}</p>
    </div>
  );
}

function TagSection({
  label,
  items,
  tone = 'zinc',
}: {
  label?: string;
  items: string[];
  tone?: 'zinc' | 'sky' | 'rose' | 'emerald' | 'violet';
}) {
  if (items.length === 0) return null;

  return (
    <div>
      {label && (
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className={[
              'rounded-full border px-3 py-1.5 text-[12px] leading-5',
              toneStyles[tone],
            ].join(' ')}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function StackedList({ items, tone }: { items: string[]; tone: 'amber' | 'zinc' }) {
  return (
    <div className="space-y-2.5">
      {items.map((item, index) => (
        <div
          key={`${item}-${index}`}
          className={[
            'flex gap-3 rounded-2xl border px-4 py-3',
            tone === 'amber'
              ? 'border-amber-400/15 bg-amber-400/5'
              : 'border-zinc-800 bg-zinc-950/60',
          ].join(' ')}
        >
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-300" />
          <p className="text-sm leading-6 text-zinc-300">{item}</p>
        </div>
      ))}
    </div>
  );
}

function toLabel(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function FieldValue({ value }: { value: unknown }) {
  // Array of primitives → pill tags
  if (Array.isArray(value)) {
    const items = value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v)));
    return (
      <div className="mt-1 flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className="rounded-md bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300"
          >
            {item}
          </span>
        ))}
      </div>
    );
  }
  // Plain object → key: value list
  if (typeof value === 'object' && value !== null) {
    return (
      <div className="mt-1 space-y-0.5">
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <p key={k} className="text-sm text-zinc-300">
            <span className="text-zinc-500">{toLabel(k)}: </span>
            {String(v)}
          </p>
        ))}
      </div>
    );
  }
  return <p className="mt-0.5 text-sm text-zinc-300">{String(value)}</p>;
}

function toTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item : null))
    .filter((item): item is string => Boolean(item));
}

function toCompetitorList(value: unknown): Array<{ name: string; url?: string; differentiator?: string; type?: string; content_strength?: string }> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === 'string') {
        // Parse "BrandName - domain.com" format produced by discoverCompetitors
        const dashMatch = item.match(/^(.+?)\s*[-–—]\s*([\w.-]+\.[a-z]{2,})$/i);
        if (dashMatch) {
          return { name: dashMatch[1].trim(), url: dashMatch[2].trim() };
        }
        return { name: item };
      }
      if (!item || typeof item !== 'object') {
        return null;
      }

      const record = item as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name : null;
      if (!name) return null;

      return {
        name,
        url: typeof record.url === 'string' ? record.url : typeof record.link === 'string' ? record.link : undefined,
        differentiator:
          typeof record.differentiator === 'string' ? record.differentiator : undefined,
        type: typeof record.type === 'string' ? record.type : undefined,
        content_strength: typeof record.content_strength === 'string' ? record.content_strength : undefined,
      };
    })
    .filter((item): item is { name: string; url?: string; differentiator?: string; type?: string; content_strength?: string } => Boolean(item));
}

function toSocialMediaList(value: unknown): Array<{ platform: string; url: string; inferred: boolean }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const r = item as Record<string, unknown>;
      const platform = typeof r.platform === 'string' ? r.platform : null;
      const url = typeof r.url === 'string' ? r.url : typeof r.link === 'string' ? r.link : null;
      if (!platform || !url) return null;
      const inferred = typeof r.source === 'string' && r.source === 'inferred';
      return { platform, url, inferred };
    })
    .filter((item): item is { platform: string; url: string; inferred: boolean } => Boolean(item));
}

function formatBoolean(value: boolean | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value ? 'Yes' : 'No';
}

function isWide(value: unknown): boolean {
  return Array.isArray(value) || (typeof value === 'string' && value.length > 80);
}

function CollapsibleText({ value, className }: { value: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const PREVIEW = 240;
  const isLong = value.length > PREVIEW;
  return (
    <div>
      <p className={className}>
        {isLong && !expanded ? `${value.slice(0, PREVIEW).trimEnd()}…` : value}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

function AnalystNotesBlock({ value }: { value: string }) {
  // Parse into structured sections by confidence level or sentence boundaries
  const lines = value
    .split(/(?:\.)\s+(?=[A-Z])/)
    .map((s) => s.trim().replace(/\.$/, ''))
    .filter((s) => s.length > 10);

  const highConf: string[] = [];
  const modConf: string[] = [];
  const lowConf: string[] = [];
  const general: string[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('confidence is high') || lower.includes('high for:')) {
      highConf.push(line);
    } else if (lower.includes('confidence is moderate') || lower.includes('moderate for:')) {
      modConf.push(line);
    } else if (lower.includes('confidence is low') || lower.includes('low for:')) {
      lowConf.push(line);
    } else {
      general.push(line);
    }
  };

  return (
    <div className="rounded-2xl border border-sky-400/20 bg-sky-400/5 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Analyst notes</p>
      <div className="mt-3 space-y-3">
        {general.length > 0 && (
          <div className="space-y-1.5">
            {general.map((line, i) => (
              <p key={i} className="text-sm leading-6 text-zinc-300">• {line}.</p>
            ))}
          </div>
        )}
        {highConf.length > 0 && (
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/5 px-3 py-2.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">High confidence</p>
            {highConf.map((line, i) => (
              <p key={i} className="text-xs leading-5 text-zinc-300">{line.replace(/^.*?(?:high for:|confidence is high[^:]*:)\s*/i, '')}.</p>
            ))}
          </div>
        )}
        {modConf.length > 0 && (
          <div className="rounded-xl border border-amber-400/15 bg-amber-400/5 px-3 py-2.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400">Moderate confidence</p>
            {modConf.map((line, i) => (
              <p key={i} className="text-xs leading-5 text-zinc-300">{line.replace(/^.*?(?:moderate for:|confidence is moderate[^:]*:)\s*/i, '')}.</p>
            ))}
          </div>
        )}
        {lowConf.length > 0 && (
          <div className="rounded-xl border border-rose-400/15 bg-rose-400/5 px-3 py-2.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-400">Low confidence</p>
            {lowConf.map((line, i) => (
              <p key={i} className="text-xs leading-5 text-zinc-300">{line.replace(/^.*?(?:low for:|confidence is low[^:]*:)\s*/i, '')}.</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SitemapSection({ urls }: { urls: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const PREVIEW_COUNT = 8;
  const visible = expanded ? urls : urls.slice(0, PREVIEW_COUNT);
  const hiddenCount = urls.length - PREVIEW_COUNT;
  return (
    <Panel
      title={`Sitemap · ${urls.length} pages`}
      subtitle="URL inventory discovered from the site's sitemap — passed to the agent as context."
    >
      <div className="grid gap-1 sm:grid-cols-2">
        {visible.map((url) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="truncate text-xs text-sky-300/80 transition-colors hover:text-sky-200"
          >
            {url}
          </a>
        ))}
      </div>
      {!expanded && hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-3 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
        >
          + {hiddenCount} more pages
        </button>
      )}
      {expanded && urls.length > PREVIEW_COUNT && (
        <button
          onClick={() => setExpanded(false)}
          className="mt-3 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Show less
        </button>
      )}
    </Panel>
  );
}

function FunnelColumn({
  stage,
  present,
  missing,
  tone,
}: {
  stage: string;
  present: string[];
  missing: string[];
  tone: 'sky' | 'violet' | 'emerald';
}) {
  return (
    <div className="space-y-1.5">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">{stage}</p>
      {present.map((item, i) => (
        <div key={`p-${i}`} className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2">
          <span className={['mt-1 h-1.5 w-1.5 shrink-0 rounded-full', tone === 'sky' ? 'bg-sky-400' : tone === 'violet' ? 'bg-violet-400' : 'bg-emerald-400'].join(' ')} />
          <p className="text-xs leading-5 text-zinc-300">{item}</p>
        </div>
      ))}
      {missing.length > 0 && (
        <>
          <p className="pt-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-amber-400/70">Gaps</p>
          {missing.map((item, i) => (
            <div key={`m-${i}`} className="flex items-start gap-2 rounded-xl border border-amber-400/10 bg-amber-400/5 px-3 py-2">
              <span className="mt-0.5 shrink-0 text-[11px] font-bold leading-none text-amber-400/60">+</span>
              <p className="text-xs leading-5 text-amber-200/60">{item}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

const toneStyles = {
  zinc: 'border-zinc-700 bg-zinc-800/80 text-zinc-200',
  sky: 'border-sky-400/20 bg-sky-400/10 text-sky-100',
  rose: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
  emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
  violet: 'border-violet-400/20 bg-violet-400/10 text-violet-100',
};

// ─── Visual components ─────────────────────────────────────────────────────

function CompanyLogo({ domain, name, logoUrl }: { domain: string; name: string; logoUrl?: string }) {
  const [imgError, setImgError] = useState(0);
  const initial = name.charAt(0).toUpperCase();
  const sources = [
    ...(logoUrl ? [logoUrl] : []),
    `https://logo.clearbit.com/${domain}`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    `https://${domain}/favicon.ico`,
  ];
  if (imgError >= sources.length) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-zinc-800 text-xl font-bold text-zinc-300 ring-1 ring-zinc-700">
        {initial}
      </div>
    );
  }
  return (
    <img
      src={sources[imgError]}
      alt={`${name} logo`}
      className="h-14 w-14 shrink-0 rounded-2xl bg-white object-contain p-1 ring-1 ring-zinc-700"
      onError={() => setImgError((prev) => prev + 1)}
    />
  );
}

function DRScoreRing({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const strokeColor = pct >= 70 ? '#34d399' : pct >= 40 ? '#38bdf8' : '#fbbf24';
  return (
    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
      <svg viewBox="0 0 44 44" className="h-12 w-12 -rotate-90" aria-hidden="true">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#27272a" strokeWidth="4" />
        <circle
          cx="22" cy="22" r={r}
          fill="none" stroke={strokeColor} strokeWidth="4"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-sm font-bold text-zinc-100">{score}</span>
    </div>
  );
}

function StrengthBars({ strength }: { strength: string }) {
  const level = strength === 'strong' ? 3 : strength === 'moderate' ? 2 : 1;
  return (
    <div className="flex items-end gap-0.5" title={`${strength} content`}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={[
            'w-1.5 rounded-sm',
            i === 1 ? 'h-2' : i === 2 ? 'h-3' : 'h-4',
            i <= level
              ? level === 3 ? 'bg-emerald-400' : level === 2 ? 'bg-sky-400' : 'bg-zinc-500'
              : 'bg-zinc-800',
          ].join(' ')}
        />
      ))}
    </div>
  );
}

function CompetitorCard({
  competitor,
}: {
  competitor: { name: string; url?: string; differentiator?: string; type?: string; content_strength?: string };
}) {
  const [imgError, setImgError] = useState(false);
  const domain = competitor.url
    ? competitor.url.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0]
    : null;
  const initial = competitor.name.charAt(0).toUpperCase();
  const logoSrc = domain ? `https://logo.clearbit.com/${domain}` : null;
  return (
    <a
      href={domain ? `https://${domain}` : undefined}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5 transition-colors hover:border-zinc-700 hover:bg-zinc-900/80"
    >
      {logoSrc && !imgError ? (
        <img
          src={logoSrc}
          alt={`${competitor.name} logo`}
          className="h-8 w-8 shrink-0 rounded-lg bg-white object-contain p-0.5 ring-1 ring-zinc-700"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xs font-bold text-zinc-400 ring-1 ring-zinc-700">
          {initial}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold leading-tight text-zinc-100">{competitor.name}</p>
        {domain && <p className="truncate text-[10px] text-zinc-500">{domain}</p>}
      </div>
    </a>
  );
}

function SignalRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  const positives = ['good', 'strong', 'clear', 'comprehensive', 'detailed', 'yes'];
  const negatives = ['missing', 'none', 'thin', 'no'];
  const lower = value.toLowerCase();
  const dotColor = positives.some((v) => lower.includes(v))
    ? 'bg-emerald-400'
    : negatives.some((v) => lower === v)
    ? 'bg-rose-400/70'
    : 'bg-amber-400';
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
      <span className="text-xs text-zinc-400">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
        <span className="text-xs font-medium capitalize text-zinc-200">{value}</span>
      </div>
    </div>
  );
}

const PLATFORM_DOMAINS: Record<string, string> = {
  linkedin: 'linkedin.com',
  'twitter/x': 'x.com',
  twitter: 'twitter.com',
  x: 'x.com',
  facebook: 'facebook.com',
  instagram: 'instagram.com',
  youtube: 'youtube.com',
  tiktok: 'tiktok.com',
  github: 'github.com',
};

function SocialLogoTile({ item }: { item: { platform: string; url: string; inferred?: boolean } }) {
  const [imgError, setImgError] = useState(false);
  const domain = PLATFORM_DOMAINS[item.platform.toLowerCase()] ?? `${item.platform.toLowerCase()}.com`;
  const initial = item.platform.charAt(0).toUpperCase();
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      title={item.platform}
      className="group relative flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 transition-colors hover:border-zinc-600 hover:bg-zinc-800"
    >
      {!imgError ? (
        <img
          src={`https://logo.clearbit.com/${domain}`}
          alt={item.platform}
          className="h-6 w-6 rounded-md object-contain"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="text-sm font-bold text-zinc-400">{initial}</span>
      )}
    </a>
  );
}

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: 'bg-[#0A66C2]',
  'twitter/x': 'bg-zinc-200',
  twitter: 'bg-[#1DA1F2]',
  x: 'bg-zinc-200',
  facebook: 'bg-[#1877F2]',
  instagram: 'bg-[#E1306C]',
  youtube: 'bg-[#FF0000]',
  tiktok: 'bg-zinc-900 ring-1 ring-zinc-600',
  github: 'bg-zinc-700',
};

function SocialIcon({ platform }: { platform: string }) {
  const name = platform.toLowerCase().replace('twitter/x', 'x');
  const size = 'h-3.5 w-3.5';
  switch (name) {
    case 'linkedin':
      return <svg className={size} viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>;
    case 'x':
    case 'twitter':
      return <svg className={size} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
    case 'facebook':
      return <svg className={size} viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;
    case 'instagram':
      return <svg className={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 11-2.88 0 1.441 1.441 0 012.88 0z"/></svg>;
    case 'youtube':
      return <svg className={size} viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>;
    case 'tiktok':
      return <svg className={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>;
    default:
      return <span className="text-[10px] font-bold">{platform.charAt(0).toUpperCase()}</span>;
  }
}

function PlatformDot({ platform }: { platform: string }) {
  const color = PLATFORM_COLORS[platform.toLowerCase()] ?? 'bg-zinc-600';
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />;
}
