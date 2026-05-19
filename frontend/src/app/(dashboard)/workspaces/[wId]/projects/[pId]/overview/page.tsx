'use client';

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-100">Project Overview</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-sm font-medium text-zinc-400">AI Visibility</h2>
          <p className="mt-2 text-3xl font-bold text-zinc-100">—</p>
          <p className="mt-1 text-xs text-zinc-500">Citability & AI search presence</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-sm font-medium text-zinc-400">Traffic</h2>
          <p className="mt-2 text-3xl font-bold text-zinc-100">—</p>
          <p className="mt-1 text-xs text-zinc-500">Organic sessions (last 30d)</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-sm font-medium text-zinc-400">Technical</h2>
          <p className="mt-2 text-3xl font-bold text-zinc-100">—</p>
          <p className="mt-1 text-xs text-zinc-500">Core Web Vitals status</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-sm font-medium text-zinc-400">Alerts</h2>
          <p className="mt-2 text-3xl font-bold text-zinc-100">0</p>
          <p className="mt-1 text-xs text-zinc-500">Active issues requiring attention</p>
        </div>
      </div>
    </div>
  );
}
