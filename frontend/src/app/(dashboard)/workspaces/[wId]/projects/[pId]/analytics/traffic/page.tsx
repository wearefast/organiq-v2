'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { Bot, TrendingUp, Globe, Code } from 'lucide-react';
import {
  TrafficOverview,
  EngineInfo,
  fetchTrafficOverview,
  fetchEngines,
} from '@/features/analytics/services/traffic.service';

const DEFAULT_COLORS = [
  '#10A37F', '#20B2AA', '#D97706', '#4285F4', '#00BCF2',
  '#6366F1', '#22C55E', '#FBBF24', '#8B5CF6', '#FB542B',
  '#0668E1', '#39594D',
];

export default function TrafficDashboardPage() {
  const params = useParams<{ pId: string }>();
  const projectId = params.pId;

  const [overview, setOverview] = useState<TrafficOverview | null>(null);
  const [engines, setEngines] = useState<EngineInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const [data, engineList] = await Promise.all([
        fetchTrafficOverview(projectId, { startDate }),
        fetchEngines(projectId),
      ]);
      setOverview(data);
      setEngines(engineList);
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [projectId, days]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const engineColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    engines.forEach((e, i) => { map[e.id] = e.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]; });
    return map;
  }, [engines]);

  const engineNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    engines.forEach((e) => { map[e.id] = e.name; });
    return map;
  }, [engines]);

  if (loading) {
    return <div className="py-12 text-center text-sm text-zinc-500">Loading traffic data…</div>;
  }

  if (!overview || overview.totalSessions === 0) {
    return <EmptyState projectId={projectId} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">AI Search Traffic</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Sessions from LLM-powered search engines
          </p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                days === d
                  ? 'bg-rose-600 text-white'
                  : 'border border-zinc-700 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          icon={<Bot className="h-4 w-4" />}
          label="Total AI Sessions"
          value={overview.totalSessions.toLocaleString()}
        />
        <MetricCard
          icon={<Globe className="h-4 w-4" />}
          label="AI Engines"
          value={String(overview.byEngine.length)}
        />
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Top Engine"
          value={
            overview.byEngine[0]
              ? engineNameMap[overview.byEngine[0].engine] ?? overview.byEngine[0].engine
              : '—'
          }
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Daily trend (area chart) */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-3 text-xs font-medium text-zinc-400">Daily Sessions</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={overview.dailyTrend}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#71717a' }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 10, fill: '#71717a' }} width={35} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                labelStyle={{ color: '#d4d4d8' }}
              />
              <Area type="monotone" dataKey="sessions" stroke="#E11D48" fill="#E11D48" fillOpacity={0.1} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Engine breakdown (pie chart) */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-3 text-xs font-medium text-zinc-400">By Engine</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={overview.byEngine}
                dataKey="sessions"
                nameKey="engine"
                cx="50%"
                cy="50%"
                outerRadius={75}
                label={({ name }) => engineNameMap[name as string] ?? name}
                labelLine={false}
              >
                {overview.byEngine.map((entry, i) => (
                  <Cell key={entry.engine} fill={engineColorMap[entry.engine] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]} />
                ))}
              </Pie>
              <Legend
                formatter={(value) => engineNameMap[value as string] ?? value}
                wrapperStyle={{ fontSize: 11 }}
              />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top pages table */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="mb-3 text-xs font-medium text-zinc-400">Top Landing Pages (Last 30d)</h3>
        <ResponsiveContainer width="100%" height={Math.min(overview.topPages.length * 32, 320)}>
          <BarChart data={overview.topPages.slice(0, 10)} layout="vertical">
            <XAxis type="number" tick={{ fontSize: 10, fill: '#71717a' }} />
            <YAxis
              type="category"
              dataKey="page"
              width={200}
              tick={{ fontSize: 10, fill: '#a1a1aa' }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
            />
            <Bar dataKey="sessions" fill="#6366F1" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center gap-2 text-zinc-500">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function EmptyState({ projectId }: { projectId: string }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">AI Search Traffic</h1>
        <p className="mt-1 text-sm text-zinc-400">Track visits from AI-powered search engines</p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center">
        <Code className="mx-auto h-10 w-10 text-zinc-600" />
        <h2 className="mt-4 text-sm font-medium text-zinc-200">Install the tracking script</h2>
        <p className="mt-2 text-xs text-zinc-500">
          Add this snippet before {'</body>'} on your website to start tracking AI search traffic.
        </p>
        <pre className="mt-4 inline-block rounded-md border border-zinc-700 bg-zinc-950 px-4 py-3 text-left text-xs text-zinc-300">
{`<script src="${appUrl}/tracker/pulse-tracker.js"
  data-project="${projectId}"
  data-endpoint="${apiUrl}/traffic/ingest">
</script>`}
        </pre>
        <p className="mt-4 text-[10px] text-zinc-600">
          No cookies • No PII • 1.9KB • Detects 12 AI engines
        </p>
      </div>
    </div>
  );
}
