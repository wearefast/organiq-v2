interface AuditProgressProps {
  step: string;
  progress: number;
  message: string;
}

export function AuditProgress({ step, progress, message }: AuditProgressProps) {
  return (
    <div className="rounded-xl border border-[#E8EAF0] bg-white p-8 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FCF4F6]">
          <svg className="h-4 w-4 animate-spin text-[#DA304F]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <div>
          <h2 className="text-[16px] font-semibold text-[#111827]">Analysing your website...</h2>
          <p className="text-sm text-[#9CA3AF]">{message}</p>
        </div>
      </div>
      <div>
        <div className="mb-2 flex justify-between text-xs font-medium">
          <span className="text-[#4B5563]">{step}</span>
          <span className="text-[#DA304F]">{progress}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-pill bg-[#F8D6DC]">
          <div
            className="h-full rounded-pill bg-gradient-cta transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
