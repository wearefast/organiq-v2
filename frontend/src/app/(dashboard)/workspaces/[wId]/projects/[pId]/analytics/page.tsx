'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useGscStatus, useGscSummary, useGscKeywords } from '@/features/analytics/hooks/useGsc';
import { getGscConnectUrl } from '@/features/analytics/services/gsc.service';

export default function AnalyticsPage() {
  const params = useParams();
  const projectId = params.pId as string;
  const workspaceId = params.wId as string;

  const { status, loading: statusLoading } = useGscStatus(projectId);
  const { summary, loading: summaryLoading } = useGscSummary(projectId);
  const { keywords, loading: keywordsLoading } = useGscKeywords(projectId, { limit: 50 });

  if (statusLoading) {
    return <div className="p-6"><p className="text-gray-500">Loading...</p></div>;
  }

  // Not connected — show connect card
  if (!status?.connected) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Search Analytics</h1>
        <div className="max-w-md mx-auto bg-white rounded-lg border p-8 text-center">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-2.04a4.5 4.5 0 0 0-1.242-7.244l4.5-4.5a4.5 4.5 0 0 1 6.364 6.364l-1.757 1.757" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2">Connect Google Search Console</h2>
          <p className="text-gray-600 mb-6 text-sm">
            Link your GSC account to see keyword performance, impressions, CTR and position data directly in Pulse.
          </p>
          <a
            href={getGscConnectUrl(projectId, workspaceId)}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            Connect GSC
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Search Analytics</h1>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          <span>Connected: {status.siteUrl}</span>
          {status.lastSyncAt && (
            <span className="text-xs text-gray-400 ml-2">
              Last sync: {new Date(status.lastSyncAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <MetricCard label="Total Clicks" value={summary.totalClicks.toLocaleString()} />
          <MetricCard label="Total Impressions" value={summary.totalImpressions.toLocaleString()} />
          <MetricCard label="Avg CTR" value={`${(summary.avgCtr * 100).toFixed(1)}%`} />
          <MetricCard label="Avg Position" value={summary.avgPosition.toFixed(1)} />
        </div>
      ) : null}

      {/* Charts */}
      {summary && summary.topQueries.length > 0 && (
        <div className="grid grid-cols-2 gap-6 mb-8">
          <PositionTierChart queries={summary.topQueries} />
          <ClickTrendChart queries={summary.topQueries.slice(0, 10)} />
        </div>
      )}

      {/* Top Queries Table */}
      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold">Top Keywords</h2>
        </div>
        {keywordsLoading ? (
          <div className="p-4 animate-pulse space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Query</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Clicks</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Impressions</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">CTR</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Position</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {keywords.map((kw) => (
                  <tr key={kw.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{kw.query}</td>
                    <td className="px-4 py-2 text-right">{kw.clicks}</td>
                    <td className="px-4 py-2 text-right">{kw.impressions}</td>
                    <td className="px-4 py-2 text-right">{(Number(kw.ctr) * 100).toFixed(1)}%</td>
                    <td className="px-4 py-2 text-right">{Number(kw.position).toFixed(1)}</td>
                  </tr>
                ))}
                {keywords.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No keyword data yet. Data will appear after the first sync.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Pages */}
      {summary && summary.topPages.length > 0 && (
        <div className="bg-white rounded-lg border mt-6">
          <div className="px-4 py-3 border-b">
            <h2 className="font-semibold">Top Pages</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Page</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Clicks</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Impressions</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">CTR</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Position</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {summary.topPages.slice(0, 20).map((pg) => (
                  <tr key={pg.page} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium truncate max-w-xs" title={pg.page}>
                      {pg.page.replace(/^https?:\/\/[^/]+/, '')}
                    </td>
                    <td className="px-4 py-2 text-right">{pg.clicks}</td>
                    <td className="px-4 py-2 text-right">{pg.impressions}</td>
                    <td className="px-4 py-2 text-right">{(pg.ctr * 100).toFixed(1)}%</td>
                    <td className="px-4 py-2 text-right">{pg.position.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

const TIER_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

function PositionTierChart({ queries }: { queries: Array<{ position: number }> }) {
  const data = useMemo(() => {
    const tiers = [
      { name: 'Top 3', count: 0 },
      { name: '4–10', count: 0 },
      { name: '11–20', count: 0 },
      { name: '21+', count: 0 },
    ];
    for (const q of queries) {
      if (q.position <= 3) tiers[0].count++;
      else if (q.position <= 10) tiers[1].count++;
      else if (q.position <= 20) tiers[2].count++;
      else tiers[3].count++;
    }
    return tiers.filter((t) => t.count > 0);
  }, [queries]);

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="font-semibold text-sm mb-3">Position Distribution</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
            {data.map((_, i) => (
              <Cell key={i} fill={TIER_COLORS[i % TIER_COLORS.length]} />
            ))}
          </Pie>
          <Legend />
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function ClickTrendChart({ queries }: { queries: Array<{ query: string; clicks: number; impressions: number }> }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="font-semibold text-sm mb-3">Top 10 Keywords by Clicks</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={queries} layout="vertical" margin={{ left: 80 }}>
          <XAxis type="number" />
          <YAxis type="category" dataKey="query" width={75} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="clicks" fill="#6366f1" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
