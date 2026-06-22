'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { setAuthToken, apiFetch } from '@/shared/utils/api';

// ─── Types ───────────────────────────────────────────────────

interface ForumTopic {
  id: string;
  topic: string;
  source: string;
  status: string;
  lastScannedAt: string | null;
}

interface ForumOpportunity {
  id: string;
  url: string;
  title: string;
  snippet: string | null;
  subreddit: string | null;
  publishedDate: string | null;
  isQuestion: boolean;
  score: number;
  status: string;
  discoveredAt: string;
  topic: { topic: string } | null;
}

interface ForumStats {
  total: number;
  new: number;
  questions: number;
  avgScore: number;
}

// ─── Helpers ─────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-green-400 bg-green-900/30';
  if (score >= 40) return 'text-yellow-400 bg-yellow-900/30';
  return 'text-zinc-400 bg-zinc-700/50';
}

function RedditLogo() {
  return (
    <svg className="h-5 w-5 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm0 1c6.066 0 11 4.934 11 11s-4.934 11-11 11S1 18.066 1 12 5.934 1 12 1zm0 3c-4.418 0-8 3.582-8 8s3.582 8 8 8 8-3.582 8-8-3.582-8-8-8zm0 1c3.866 0 7 3.134 7 7s-3.134 7-7 7-7-3.134-7-7 3.134-7 7-7z" />
    </svg>
  );
}

// ─── Page ────────────────────────────────────────────────────

export default function ForumsPage() {
  const params = useParams();
  const projectId = params.pId as string;
  const { getToken } = useAuth();

  const [opportunities, setOpportunities] = useState<ForumOpportunity[]>([]);
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [stats, setStats] = useState<ForumStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('new');
  const [newTopic, setNewTopic] = useState('');

  const base = `/projects/${projectId}/content`;

  const ensureAuth = useCallback(async () => {
    setAuthToken(await getToken());
  }, [getToken]);

  // ─── Load data ──────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      await ensureAuth();
      const [opps, topicList, statsData] = await Promise.all([
        apiFetch<ForumOpportunity[]>(`${base}/forums/opportunities?status=${filterStatus}`),
        apiFetch<ForumTopic[]>(`${base}/forums/topics`),
        apiFetch<ForumStats>(`${base}/forums/stats`),
      ]);
      setOpportunities(opps);
      setTopics(topicList);
      setStats(statsData);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load forum intelligence data');
    } finally {
      setLoading(false);
    }
  }, [base, filterStatus, ensureAuth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Actions ────────────────────────────────────────────────

  async function handleScan() {
    setScanning(true);
    try {
      await ensureAuth();
      await apiFetch(`${base}/forums/scan`, { method: 'POST' });
      await loadData();
    } catch (err: any) {
      setError(err?.message ?? 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  async function handleAddTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!newTopic.trim()) return;
    try {
      await ensureAuth();
      await apiFetch(`${base}/forums/topics`, {
        method: 'POST',
        body: JSON.stringify({ topic: newTopic.trim() }),
      });
      setNewTopic('');
      await loadData();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to add topic');
    }
  }

  async function handleRemoveTopic(topicId: string) {
    try {
      await ensureAuth();
      await apiFetch(`${base}/forums/topics/${topicId}`, { method: 'DELETE' });
      await loadData();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to remove topic');
    }
  }

  async function handleStatusUpdate(oppId: string, status: 'seen' | 'replied' | 'dismissed') {
    try {
      await ensureAuth();
      await apiFetch(`${base}/forums/opportunities/${oppId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setOpportunities((prev) => prev.filter((o) => o.id !== oppId));
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update status');
    }
  }

  // ─── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">Forum Intelligence</h1>
              <div className="h-6 w-6 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                <RedditLogo />
              </div>
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Automated Reddit monitoring — find and engage with discussions in your niche.
            </p>
          </div>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 shrink-0"
        >
          {scanning ? 'Scanning…' : '🔄 Scan Now'}
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Total Found</p>
            <p className="mt-1 text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">New Opportunities</p>
            <p className="mt-1 text-2xl font-bold text-blue-400">{stats.new}</p>
          </div>
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Questions</p>
            <p className="mt-1 text-2xl font-bold text-yellow-400">{stats.questions}</p>
          </div>
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Avg Score</p>
            <p className="mt-1 text-2xl font-bold text-green-400">{stats.avgScore}</p>
          </div>
        </div>
      )}

      {/* Monitored Topics */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Monitored Topics ({topics.length})
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-600 bg-zinc-800 px-3 py-1 text-xs text-zinc-300"
            >
              {t.topic}
              {t.source === 'manual' && (
                <span className="text-[9px] text-indigo-400">manual</span>
              )}
              <button
                onClick={() => handleRemoveTopic(t.id)}
                className="ml-0.5 text-zinc-500 hover:text-red-400 transition"
                title="Remove topic"
              >
                ×
              </button>
            </span>
          ))}
          {topics.length === 0 && (
            <p className="text-xs text-zinc-500">No topics yet. Click &ldquo;Scan Now&rdquo; to auto-generate from your keywords.</p>
          )}
        </div>
        <form onSubmit={handleAddTopic} className="flex gap-2 mt-2">
          <input
            type="text"
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            placeholder="Add a custom topic to monitor…"
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-500"
          />
          <button
            type="submit"
            disabled={!newTopic.trim()}
            className="rounded-lg bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-600 disabled:opacity-40"
          >
            + Add
          </button>
        </form>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error}</div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-700 pb-2">
        {['new', 'seen', 'replied', 'dismissed'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
              filterStatus === s
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Opportunities List */}
      {opportunities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 p-12 text-center">
          <p className="text-zinc-500 text-sm">
            {filterStatus === 'new'
              ? 'No new opportunities. Click "Scan Now" to search for fresh Reddit threads.'
              : `No ${filterStatus} opportunities.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {opportunities.map((opp) => (
            <div
              key={opp.id}
              className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 hover:border-zinc-600 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Score badge */}
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${scoreColor(opp.score)}`}>
                      {opp.score}
                    </span>
                    {opp.subreddit && (
                      <span className="text-[11px] font-semibold text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded-full">
                        r/{opp.subreddit}
                      </span>
                    )}
                    {opp.isQuestion && (
                      <span className="text-[11px] text-yellow-400 bg-yellow-900/30 px-2 py-0.5 rounded-full">
                        ❓ Question
                      </span>
                    )}
                    {opp.topic && (
                      <span className="text-[11px] text-zinc-500 bg-zinc-700/50 px-2 py-0.5 rounded-full">
                        {opp.topic.topic}
                      </span>
                    )}
                  </div>
                  <a
                    href={opp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 block text-sm font-medium text-zinc-100 leading-snug hover:text-indigo-300 transition"
                  >
                    {opp.title}
                  </a>
                  {opp.snippet && (
                    <p className="mt-1 text-xs text-zinc-400 leading-relaxed line-clamp-2">{opp.snippet}</p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  {formatDate(opp.publishedDate) && (
                    <span className="text-[11px] text-zinc-500 whitespace-nowrap">
                      {formatDate(opp.publishedDate)}
                    </span>
                  )}
                  {/* Action buttons */}
                  <div className="flex gap-1">
                    {(opp.status === 'new' || opp.status === 'seen') && (
                      <>
                        <button
                          onClick={() => handleStatusUpdate(opp.id, 'replied')}
                          className="rounded px-2 py-0.5 text-[10px] font-medium bg-green-900/30 text-green-400 hover:bg-green-900/50 transition"
                          title="Mark as replied"
                        >
                          ✓ Replied
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(opp.id, 'dismissed')}
                          className="rounded px-2 py-0.5 text-[10px] font-medium bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700 transition"
                          title="Dismiss"
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
