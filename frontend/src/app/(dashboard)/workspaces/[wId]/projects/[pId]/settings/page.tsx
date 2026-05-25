'use client';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-100">Project Settings</h1>
      <div className="space-y-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-sm font-semibold text-zinc-300">Integrations</h2>
          <p className="mt-2 text-sm text-zinc-500">Connect Google Search Console, analytics, and other data sources.</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-sm font-semibold text-zinc-300">Tracking Script</h2>
          <p className="mt-2 text-sm text-zinc-500">Install the OrganiQ tracking snippet to enable real-time monitoring.</p>
        </div>
      </div>
    </div>
  );
}
