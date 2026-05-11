'use client';

interface BusinessProfileData {
  domain?: string;
  companyName?: string;
  industry?: string;
  description?: string;
  targetAudience?: string;
  goals?: string[];
  competitors?: string[];
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
        <Field label="Company" value={profile.companyName} />
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
            {profile.competitors.map((comp, i) => (
              <span
                key={i}
                className="rounded-md bg-zinc-800 px-2 py-1 text-[12px] text-zinc-300"
              >
                {comp}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Additional fields as fallback */}
      <AdditionalFields
        data={profile}
        exclude={[
          'domain',
          'companyName',
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

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        Additional Details
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt className="text-[11px] text-zinc-500">
              {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
            </dt>
            <dd className="text-sm text-zinc-300">
              {typeof value === 'object'
                ? JSON.stringify(value)
                : String(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
