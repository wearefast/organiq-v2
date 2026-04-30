interface AuditScoreCardsProps {
  scores: {
    technicalSeo: number;
    contentCoverage: number;
    backlinkAuthority: number;
    aeoGeoReadiness: number;
  };
}

const SCORE_ITEMS = [
  { key: 'technicalSeo', label: 'Technical SEO' },
  { key: 'contentCoverage', label: 'Content coverage' },
  { key: 'backlinkAuthority', label: 'Backlink authority' },
  { key: 'aeoGeoReadiness', label: 'AEO + GEO readiness' },
] as const;

function scoreColor(score: number) {
  if (score >= 70) return 'text-teal-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-[#DA304F]';
}

export function AuditScoreCards({ scores }: AuditScoreCardsProps) {
  return (
    <div className="rounded-xl border border-[#E8EAF0] bg-white p-8 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50 text-lg">
          ✓
        </div>
        <div>
          <h2 className="text-[20px] font-semibold text-[#111827]">Your audit is ready</h2>
          <p className="text-sm text-[#9CA3AF]">Check your email for the full report.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {SCORE_ITEMS.map(({ key, label }) => {
          const score = scores[key];
          return (
            <div key={key} className="rounded-xl border border-[#E8EAF0] bg-[#F8F9FC] p-4">
              <div className="text-xs font-medium text-[#9CA3AF]">{label}</div>
              <div className={`mt-1 text-[28px] font-bold ${scoreColor(score)}`}>
                {score}<span className="text-sm font-normal text-[#9CA3AF]">/100</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
