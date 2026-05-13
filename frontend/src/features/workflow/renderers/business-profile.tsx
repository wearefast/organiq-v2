'use client';

interface BusinessProfileData {
  domain?: string;
  companyName?: string;
  businessName?: string;
  industry?: string;
  description?: string;
  targetAudience?: string;
  goals?: string[];
  competitors?: Array<string | { name: string; link?: string }>;
  primaryMarket?: string;
  [key: string]: unknown;
}

export function BusinessProfileRenderer({ data }: { data: unknown }) {
  const profile = data as BusinessProfileData;

  if (!profile || typeof profile !== 'object') {
    return <p className="text-sm text-zinc-500">No profile data available.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Domain & Company */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Domain" value={profile.domain} />
        <Field label="Company" value={profile.companyName ?? profile.businessName} />
        <Field label="Industry" value={profile.industry} />
        <Field label="Primary Market" value={profile.primaryMarket} />
      </div>

      {/* Description */}
      {profile.description && (
        <div>
          <Label>Description</Label>
          <p className="mt-1 text-sm text-zinc-300">{profile.description}</p>
        </div>
      )}

      {/* Target Audience */}
      {profile.targetAudience && (
        <div>
          <Label>Target Audience</Label>
          <p className="mt-1 text-sm text-zinc-300">{profile.targetAudience}</p>
        </div>
      )}

      {/* Goals */}
      {profile.goals && profile.goals.length > 0 && (
        <div>
          <Label>Goals</Label>
          <ul className="mt-1 space-y-1">
            {profile.goals.map((goal, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="mt-1 inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                {goal}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Competitors */}
      {profile.competitors && profile.competitors.length > 0 && (
        <div>
          <Label>Known Competitors</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {profile.competitors.map((comp, i) => {
              const label = typeof comp === 'string' ? comp : comp.name;
              return (
                <span
                  key={i}
                  className="rounded-md bg-zinc-800 px-2 py-1 text-[12px] text-zinc-300"
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Additional fields as fallback */}
      <AdditionalFields
        data={profile}
        exclude={[
          'domain',
          'companyName',
          'businessName',
          'industry',
          'description',
          'targetAudience',
          'goals',
          'competitors',
          'primaryMarket',
        ]}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <Label>{label}</Label>
      <p className="mt-0.5 text-sm text-zinc-300">{value}</p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
      {children}
    </p>
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

function AdditionalFields({
  data,
  exclude,
}: {
  data: Record<string, unknown>;
  exclude: string[];
}) {
  const entries = Object.entries(data).filter(
    ([k, v]) => !exclude.includes(k) && v !== null && v !== undefined,
  );
  if (entries.length === 0) return null;

  // Wide fields: arrays or long strings span the full row
  const isWide = (v: unknown) =>
    Array.isArray(v) || (typeof v === 'string' && v.length > 80);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        Additional Details
      </p>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        {entries.map(([key, value]) => (
          <div key={key} className={isWide(value) ? 'col-span-2' : 'col-span-1'}>
            <dt className="text-[11px] font-medium text-zinc-500">{toLabel(key)}</dt>
            <FieldValue value={value} />
          </div>
        ))}
      </dl>
    </div>
  );
}
