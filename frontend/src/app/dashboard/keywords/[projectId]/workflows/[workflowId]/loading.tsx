export default function WorkflowLoading() {
  return (
    <div className="flex h-full flex-col">
      {/* Header skeleton */}
      <div className="border-b border-[#E8EAF0] bg-white px-6 py-4">
        <div className="h-3.5 w-28 animate-pulse rounded bg-[#E8EAF0]" />
        <div className="mt-2 h-7 w-48 animate-pulse rounded bg-[#E8EAF0]" />
        <div className="mt-1 h-3.5 w-80 animate-pulse rounded bg-[#E8EAF0]" />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Rail skeleton */}
        <aside className="flex w-[260px] shrink-0 flex-col border-r border-[#E8EAF0] bg-white p-4">
          <div className="mb-4 h-14 animate-pulse rounded-xl bg-[#F3F4F6]" />
          <div className="grid gap-2">
            {Array.from({ length: 13 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-2">
                <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-[#E8EAF0]" />
                <div
                  className="h-3.5 animate-pulse rounded bg-[#E8EAF0]"
                  style={{ width: `${60 + (i % 5) * 12}%` }}
                />
              </div>
            ))}
          </div>
        </aside>

        {/* Content skeleton */}
        <main className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-2xl">
            {/* Step header */}
            <div className="mb-6">
              <div className="h-5 w-24 animate-pulse rounded bg-[#E8EAF0]" />
              <div className="mt-2 h-7 w-56 animate-pulse rounded bg-[#E8EAF0]" />
              <div className="mt-1.5 h-4 w-[480px] max-w-full animate-pulse rounded bg-[#E8EAF0]" />
            </div>

            {/* Card skeleton */}
            <div className="rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
              <div className="mb-4 h-5 w-40 animate-pulse rounded bg-[#E8EAF0]" />
              <div className="grid gap-4">
                <div className="h-32 animate-pulse rounded-lg bg-[#F3F4F6]" />
                <div className="h-24 animate-pulse rounded-lg bg-[#F3F4F6]" />
                <div className="h-24 animate-pulse rounded-lg bg-[#F3F4F6]" />
              </div>
              <div className="mt-6 h-10 w-44 animate-pulse rounded-lg bg-[#E8EAF0]" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
