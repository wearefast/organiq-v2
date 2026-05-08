'use client';

interface BusinessProfileKeyFindingsProps {
  keyFindings: string[];
  openQuestions?: string[];
  seedKeywords?: string[];
}

// Icon map for well-known finding labels
const ICON_MAP: Record<string, string> = {
  'brand identity': '🏷️',
  'target market': '🎯',
  'operational model': '⚙️',
  'services': '📦',
  'products': '📦',
  'services / products': '📦',
  'services/products': '📦',
  'geographic focus': '🌍',
  'geographic': '🌍',
  'suggested seed keywords': '🔑',
  'seed keywords': '🔑',
  'competitive differentiation': '⚡',
  'differentiation': '⚡',
  'pricing': '💰',
  'audience': '👥',
  'tone of voice': '🗣️',
  'unique selling': '✨',
  'usp': '✨',
};

function getIcon(label: string): string {
  const key = label.toLowerCase().trim();
  for (const [pattern, icon] of Object.entries(ICON_MAP)) {
    if (key.includes(pattern)) return icon;
  }
  return '📌';
}

function parseFinding(finding: string): { title: string; description: string } {
  const colonIdx = finding.indexOf(':');
  if (colonIdx > 0 && colonIdx < 60) {
    return {
      title: finding.slice(0, colonIdx).trim(),
      description: finding.slice(colonIdx + 1).trim(),
    };
  }
  return { title: '', description: finding.trim() };
}

export function BusinessProfileKeyFindings({
  keyFindings,
  openQuestions,
  seedKeywords,
}: BusinessProfileKeyFindingsProps) {
  const parsed = keyFindings.map(parseFinding);

  // Separate seed keywords finding from the rest if it's embedded
  const mainFindings = parsed.filter(
    (f) => !f.title.toLowerCase().includes('seed keyword'),
  );
  const seedFinding = parsed.find((f) => f.title.toLowerCase().includes('seed keyword'));
  const allSeedKeywords = seedKeywords?.length
    ? seedKeywords
    : seedFinding?.description
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean) ?? [];

  return (
    <div className="space-y-5">
      {/* Key findings grid */}
      {mainFindings.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#667085]">Key findings</p>
            <span className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[10px] font-semibold text-[#667085]">
              {mainFindings.length}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {mainFindings.map((finding, i) => (
              <div
                key={i}
                className="flex gap-3 rounded-xl border border-[#E8EAF0] bg-white p-4 shadow-sm"
              >
                <span className="mt-0.5 text-lg leading-none">{getIcon(finding.title)}</span>
                <div className="min-w-0">
                  {finding.title ? (
                    <p className="text-sm font-semibold text-[#111827]">{finding.title}</p>
                  ) : null}
                  <p className={`text-sm text-[#344054] ${finding.title ? 'mt-1' : ''}`}>
                    {finding.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seed keywords */}
      {allSeedKeywords.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#667085]">
            Suggested seed keywords
          </p>
          <div className="flex flex-wrap gap-2">
            {allSeedKeywords.map((kw, i) => (
              <span
                key={i}
                className="rounded-full border border-[#E8EAF0] bg-[#F8F9FC] px-3 py-1 text-xs font-medium text-[#344054]"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Open questions */}
      {openQuestions && openQuestions.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#667085]">
            Open questions
          </p>
          <ol className="space-y-2">
            {openQuestions.map((q, i) => (
              <li key={i} className="flex gap-3 rounded-lg border border-[#FEF3C7] bg-[#FFFBEB] px-4 py-3">
                <span className="shrink-0 text-xs font-bold text-[#B45309]">{i + 1}.</span>
                <p className="text-sm text-[#344054]">{q}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
