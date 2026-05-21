'use client';

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
  primary_services?: string[];
  brand_voice?: string;
  positioning?: string;
  content_gaps?: string[];
  trust_signals?: string[];
  analyst_notes?: string;
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
  const services = toTextList(profile.primary_services);
  const competitors = toCompetitorList(profile.competitors);
  const trustSignals = toTextList(profile.trust_signals);
  const contentGaps = toTextList(profile.content_gaps);
  const icpIndustries = toTextList(profile.icp?.industries);
  const icpPainPoints = toTextList(profile.icp?.pain_points);
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
        'primary_services',
        'brand_voice',
        'positioning',
        'content_gaps',
        'trust_signals',
        'analyst_notes',
        'icp',
        'seo_signals',
      ].includes(key) && value !== null && value !== undefined,
  );

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[24px] border border-zinc-800 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),rgba(24,24,27,0.98)_40%,rgba(9,9,11,0.98)_100%)]">
        <div className="border-b border-zinc-800/80 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-300/80">
                Business profile
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-zinc-50">{businessName}</h3>
              {profile.industry && (
                <p className="mt-1 text-sm text-zinc-300">{profile.industry}</p>
              )}
            </div>
            {website && (
              <a
                href={website.startsWith('http') ? website : `https://${website}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-[11px] font-medium text-sky-200 transition-colors hover:bg-sky-400/15"
              >
                {website}
              </a>
            )}
          </div>
        </div>

        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 xl:grid-cols-4 sm:px-6">
          <MetricCard label="Primary market" value={profile.primaryMarket ?? 'Not specified'} />
          <MetricCard label="Services mapped" value={String(services.length)} />
          <MetricCard label="Competitors identified" value={String(competitors.length)} />
          <MetricCard label="Content gaps found" value={String(contentGaps.length)} />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div className="space-y-5">
          {(profile.positioning || profile.brand_voice || profile.analyst_notes) && (
            <Panel title="Strategic narrative" subtitle="How the agent framed the business from the supplied site evidence.">
              <div className="space-y-4">
                {profile.positioning && <NarrativeBlock label="Positioning" value={profile.positioning} />}
                {profile.brand_voice && <NarrativeBlock label="Brand voice" value={profile.brand_voice} />}
                {profile.analyst_notes && <NarrativeBlock label="Analyst notes" value={profile.analyst_notes} emphasis />}
              </div>
            </Panel>
          )}

          {(profile.icp?.description || icpIndustries.length > 0 || icpPainPoints.length > 0) && (
            <Panel title="Ideal customer profile" subtitle="Demand-side picture inferred from the crawl and prompt context.">
              <div className="space-y-4">
                {profile.icp?.description && (
                  <p className="text-sm leading-7 text-zinc-300">{profile.icp.description}</p>
                )}
                {icpIndustries.length > 0 && <TagSection label="Industries" items={icpIndustries} tone="sky" />}
                {icpPainPoints.length > 0 && <TagSection label="Pain points" items={icpPainPoints} tone="rose" />}
              </div>
            </Panel>
          )}

          {services.length > 0 && (
            <Panel title="Primary services" subtitle="Commercial offer surfaced by the model.">
              <TagSection items={services} tone="emerald" />
            </Panel>
          )}

          {contentGaps.length > 0 && (
            <Panel title="Content gaps" subtitle="Missing coverage or weak discovery paths visible from the current site structure.">
              <StackedList items={contentGaps} tone="amber" />
            </Panel>
          )}
        </div>

        <div className="space-y-5">
          {profile.seo_signals && (
            <Panel title="SEO signal readout" subtitle="Surface-level technical and content posture identified from the crawl.">
              <div className="grid grid-cols-2 gap-3">
                <SignalMetric label="Meta quality" value={profile.seo_signals.meta_quality} />
                <SignalMetric label="Content depth" value={profile.seo_signals.content_depth} />
                <SignalMetric label="Blog present" value={formatBoolean(profile.seo_signals.blog_present)} />
                <SignalMetric label="Local SEO" value={formatBoolean(profile.seo_signals.local_seo)} />
              </div>
              {profile.seo_signals.notes && (
                <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">SEO notes</p>
                  <p className="mt-2 text-sm leading-7 text-zinc-300">{profile.seo_signals.notes}</p>
                </div>
              )}
            </Panel>
          )}

          {competitors.length > 0 && (
            <Panel title="Competitor frame" subtitle="Named alternatives and the differentiators the model surfaced.">
              <div className="space-y-3">
                {competitors.map((competitor, index) => (
                  <div key={`${competitor.name}-${index}`} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">{competitor.name}</p>
                        {competitor.url && (
                          <a
                            href={competitor.url.startsWith('http') ? competitor.url : `https://${competitor.url}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-xs text-sky-300 hover:text-sky-200"
                          >
                            {competitor.url}
                          </a>
                        )}
                      </div>
                    </div>
                    {competitor.differentiator && (
                      <p className="mt-3 text-sm leading-6 text-zinc-300">{competitor.differentiator}</p>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {trustSignals.length > 0 && (
            <Panel title="Trust signals" subtitle="Credibility cues the model found in the supplied material.">
              <TagSection items={trustSignals} tone="violet" />
            </Panel>
          )}
        </div>
      </div>

      {remainingFields.length > 0 && (
        <Panel title="Other extracted fields" subtitle="Fallback view for fields not yet promoted into the main layout.">
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

function toCompetitorList(value: unknown): Array<{ name: string; url?: string; differentiator?: string }> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === 'string') {
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
      };
    })
    .filter((item): item is { name: string; url?: string; differentiator?: string } => Boolean(item));
}

function formatBoolean(value: boolean | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value ? 'Yes' : 'No';
}

function isWide(value: unknown): boolean {
  return Array.isArray(value) || (typeof value === 'string' && value.length > 80);
}

const toneStyles = {
  zinc: 'border-zinc-700 bg-zinc-800/80 text-zinc-200',
  sky: 'border-sky-400/20 bg-sky-400/10 text-sky-100',
  rose: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
  emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
  violet: 'border-violet-400/20 bg-violet-400/10 text-violet-100',
};
