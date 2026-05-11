'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { apiFetch } from '@/shared/utils/api';

interface Keyword {
  id: string;
  keyword: string;
  volume: number | null;
  difficulty: number | null;
  cpc: string | null;
  intent: string | null;
  funnelStage: string | null;
  status: string;
  sourceStep: string | null;
  parentTopic: string | null;
  createdAt: string;
}

interface KeywordStats {
  total: number;
  totalVolume: number;
  byStatus: Record<string, number>;
  byIntent: Record<string, number>;
  byFunnel: Record<string, number>;
}

type StatusFilter = 'all' | 'discovered' | 'approved' | 'brief_ready' | 'written' | 'published';

export default function KeywordsPage() {
  const params = useParams();
  const { getToken } = useAuth();
  const projectId = params.pId as string;

  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [stats, setStats] = useState<KeywordStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [projectId, statusFilter]);

  async function loadData() {
    setLoading(true);
    try {
      const statusQuery = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const [kwData, statsData] = await Promise.all([
        apiFetch(`/projects/${projectId}/keywords${statusQuery}`),
        apiFetch(`/projects/${projectId}/keywords/stats`),
      ]);
      setKeywords(kwData as Keyword[]);
      setStats(statsData as KeywordStats);
    } catch (e) {
      console.error('Failed to load keywords', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (selectedIds.size === 0) return;
    try {
      await apiFetch(`/projects/${projectId}/keywords/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          keywordIds: Array.from(selectedIds),
          status: newStatus,
        }),
      });
      setSelectedIds(new Set());
      loadData();
    } catch (e) {
      console.error('Failed to update status', e);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === keywords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(keywords.map((k) => k.id)));
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Keyword Ledger</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {stats ? `${stats.total} keywords · ${formatNumber(stats.totalVolume)} total volume` : 'Loading...'}
          </p>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-5 gap-3">
          {(['discovered', 'approved', 'brief_ready', 'written', 'published'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
              className={`rounded-lg border p-3 text-center transition-colors ${
                statusFilter === status
                  ? 'border-violet-500/50 bg-violet-500/10'
                  : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
              }`}
            >
              <p className="text-lg font-bold text-zinc-100">{stats.byStatus[status] ?? 0}</p>
              <p className="text-[10px] uppercase text-zinc-500">{status.replace('_', ' ')}</p>
            </button>
          ))}
        </div>
      )}

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/80 px-4 py-2">
          <span className="text-sm text-zinc-300">{selectedIds.size} selected</span>
          <div className="ml-auto flex gap-2">
            {(['approved', 'brief_ready', 'written', 'published'] as const).map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className="rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-700"
              >
                → {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Keywords Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-violet-500" />
        </div>
      ) : keywords.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 py-16 text-center">
          <p className="text-sm text-zinc-500">No keywords yet. Run the workflow to discover keywords.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === keywords.length && keywords.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-zinc-700"
                  />
                </th>
                <th className="px-3 py-2 text-left text-[10px] uppercase text-zinc-500">Keyword</th>
                <th className="px-3 py-2 text-right text-[10px] uppercase text-zinc-500">Volume</th>
                <th className="px-3 py-2 text-right text-[10px] uppercase text-zinc-500">KD</th>
                <th className="px-3 py-2 text-left text-[10px] uppercase text-zinc-500">Intent</th>
                <th className="px-3 py-2 text-left text-[10px] uppercase text-zinc-500">Funnel</th>
                <th className="px-3 py-2 text-left text-[10px] uppercase text-zinc-500">Status</th>
                <th className="px-3 py-2 text-left text-[10px] uppercase text-zinc-500">Topic</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {keywords.map((kw) => (
                <tr key={kw.id} className="hover:bg-zinc-800/30">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(kw.id)}
                      onChange={() => toggleSelect(kw.id)}
                      className="rounded border-zinc-700"
                    />
                  </td>
                  <td className="px-3 py-2 font-medium text-zinc-200">{kw.keyword}</td>
                  <td className="px-3 py-2 text-right text-zinc-400">
                    {kw.volume != null ? kw.volume.toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {kw.difficulty != null ? <DifficultyBadge value={kw.difficulty} /> : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {kw.intent ? <IntentBadge intent={kw.intent} /> : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {kw.funnelStage ? <FunnelBadge stage={kw.funnelStage} /> : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={kw.status} />
                  </td>
                  <td className="px-3 py-2 text-[11px] text-zinc-500">{kw.parentTopic ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DifficultyBadge({ value }: { value: number }) {
  const color = value <= 30 ? 'text-green-400' : value <= 60 ? 'text-yellow-400' : 'text-red-400';
  return <span className={`text-xs font-medium ${color}`}>{value}</span>;
}

function IntentBadge({ intent }: { intent: string }) {
  const colors: Record<string, string> = {
    informational: 'bg-blue-500/10 text-blue-400',
    commercial: 'bg-amber-500/10 text-amber-400',
    transactional: 'bg-emerald-500/10 text-emerald-400',
    navigational: 'bg-zinc-500/10 text-zinc-400',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] ${colors[intent] ?? 'bg-zinc-800 text-zinc-400'}`}>
      {intent}
    </span>
  );
}

function FunnelBadge({ stage }: { stage: string }) {
  const colors: Record<string, string> = {
    tofu: 'bg-blue-500/10 text-blue-400',
    mofu: 'bg-amber-500/10 text-amber-400',
    bofu: 'bg-emerald-500/10 text-emerald-400',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${colors[stage] ?? 'bg-zinc-800 text-zinc-400'}`}>
      {stage}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    discovered: 'bg-zinc-500/10 text-zinc-400',
    approved: 'bg-violet-500/10 text-violet-400',
    brief_ready: 'bg-blue-500/10 text-blue-400',
    written: 'bg-amber-500/10 text-amber-400',
    published: 'bg-emerald-500/10 text-emerald-400',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] ${colors[status] ?? 'bg-zinc-800 text-zinc-400'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
