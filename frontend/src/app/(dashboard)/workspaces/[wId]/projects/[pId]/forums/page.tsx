'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { ExternalLink } from 'lucide-react';
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

// ─── Source detection ─────────────────────────────────────────

type ForumSource = 'all' | 'reddit' | 'quora';

const SOURCES: { key: ForumSource; label: string; domain: string }[] = [
  { key: 'all',    label: 'All',   domain: '' },
  { key: 'reddit', label: 'Reddit', domain: 'reddit.com' },
  { key: 'quora',  label: 'Quora',  domain: 'quora.com' },
];

function detectSource(url: string): ForumSource {
  if (url.includes('reddit.com')) return 'reddit';
  if (url.includes('quora.com'))  return 'quora';
  return 'all';
}

// ─── Helpers ─────────────────────────────────────────────────

function formatRelativeTime(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const secondsAgo = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (secondsAgo < 60) return 'just now';
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
  if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`;
  if (secondsAgo < 604800) return `${Math.floor(secondsAgo / 86400)}d ago`;
  if (secondsAgo < 2592000) return `${Math.floor(secondsAgo / 604800)}w ago`;
  if (secondsAgo < 31536000) return `${Math.floor(secondsAgo / 2592000)}mo ago`;
  return `${Math.floor(secondsAgo / 31536000)}y ago`;
}

// ─── Logo components ─────────────────────────────────────────

function RedditLogo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <img
      src="https://redditinc.com/hs-fs/hubfs/Reddit%20Inc/Content/Brand%20Page/Reddit_Logo.png"
      alt="Reddit"
      className={className}
    />
  );
}

function QuoraLogo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <img
      src="https://upload.wikimedia.org/wikipedia/commons/0/09/Quora_icon.svg"
      alt="Quora"
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}

function SourceBadge({ url, subreddit }: { url: string; subreddit: string | null }) {
  if (url.includes('reddit.com')) {
    return subreddit ? (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-400 bg-orange-900/30 px-2 py-0.5 rounded-full">
        <RedditLogo className="h-3 w-3" />
        r/{subreddit}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-400 bg-orange-900/30 px-2 py-0.5 rounded-full">
        <RedditLogo className="h-3 w-3" />
        Reddit
      </span>
    );
  }
  if (url.includes('quora.com')) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-400 bg-red-900/30 px-2 py-0.5 rounded-full">
        <QuoraLogo className="h-3 w-3" />
        Quora
      </span>
    );
  }
  return null;
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
  const [filterSource, setFilterSource] = useState<ForumSource>('all');
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

  // ─── Source-filtered opportunities ──────────────────────────

  const filteredOpportunities = useMemo(() => {
    if (filterSource === 'all') return opportunities;
    return opportunities.filter((o) => detectSource(o.url) === filterSource);
  }, [opportunities, filterSource]);

  // ─── Source counts for tab badges ───────────────────────────

  const sourceCounts = useMemo(() => {
    const counts: Record<ForumSource, number> = { all: opportunities.length, reddit: 0, quora: 0 };
    for (const o of opportunities) {
      const s = detectSource(o.url);
      if (s === 'reddit') counts.reddit++;
      else if (s === 'quora') counts.quora++;
    }
    return counts;
  }, [opportunities]);

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
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">Forum Intelligence</h1>
            <div className="flex items-center gap-1.5">
              <div className="h-6 w-6 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                <RedditLogo className="h-4 w-4" />
              </div>
              <div className="h-6 w-6 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <QuoraLogo className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Automated forum monitoring — find and engage with discussions across Reddit, Quora, and more.
          </p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 shrink-0"
        >
          {scanning ? 'Scanning…' : 'Scan Now'}
        </button>
      </div>

      {/* KPI Cards — always show totals across all sources */}
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
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Monitored Topics ({topics.length})
        </p>
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

      {/* Status + Source filter row */}
      <div className="flex items-center justify-between border-b border-zinc-700 pb-2">
        {/* Status tabs */}
        <div className="flex items-center gap-1">
          {['new', 'seen', 'replied', 'dismissed'].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                filterStatus === s ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Source tabs */}
        <div className="flex items-center gap-1">
          {SOURCES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterSource(key)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                filterSource === key
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {key === 'reddit' && <RedditLogo className="h-3 w-3" />}
              {key === 'quora'  && <QuoraLogo  className="h-3 w-3" />}
              {label}
              {key !== 'all' && sourceCounts[key] > 0 && (
                <span className="ml-0.5 rounded-full bg-zinc-600 px-1.5 text-[10px] text-zinc-300">
                  {sourceCounts[key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Opportunities List */}
      {filteredOpportunities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 p-12 text-center">
          <p className="text-zinc-500 text-sm">
            {filterStatus === 'new'
              ? 'No new opportunities. Click "Scan Now" to search for fresh threads.'
              : `No ${filterStatus} opportunities${filterSource !== 'all' ? ` from ${filterSource}` : ''}.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOpportunities.map((opp) => (
            <div
              key={opp.id}
              className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 hover:border-zinc-600 transition"
            >
              <div className="flex flex-col gap-2">
                {/* Top row: content + action buttons */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <SourceBadge url={opp.url} subreddit={opp.subreddit} />
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

                  {(opp.status === 'new' || opp.status === 'seen') && (
                    <div className="flex shrink-0 flex-col gap-1.5 items-end">
                      <a
                        href={opp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition"
                      >
                        Reply Now
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <button
                        onClick={() => handleStatusUpdate(opp.id, 'dismissed')}
                        className="rounded px-2 py-0.5 text-[10px] font-medium bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700 transition"
                      >
                        ✕ Dismiss
                      </button>
                    </div>
                  )}
                </div>

                {/* Bottom row: date pinned to the right */}
                {formatRelativeTime(opp.publishedDate) && (
                  <div className="flex justify-end">
                    <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                      {formatRelativeTime(opp.publishedDate)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

  );
}
