'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { setAuthToken, apiFetch } from '@/shared/utils/api';

interface ForumThread {
  title: string;
  url: string;
  snippet: string;
  subreddit: string | null;
  position: number;
  isQuestion: boolean;
}

const PRESET_QUERIES = [
  'best practices tips',
  'beginner questions help',
  'recommendations advice',
  'problems issues struggling',
  'how to guide tutorial',
];

export default function ForumsPage() {
  const params = useParams();
  const projectId = params.pId as string;
  const { getToken } = useAuth();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'questions'>('all');

  async function search(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(false);
    try {
      setAuthToken(await getToken());
      const data = await apiFetch<ForumThread[]>(
        `/projects/${projectId}/content/forums?q=${encodeURIComponent(q.trim())}`,
      );
      setResults(data);
      setSearched(true);
    } catch (err: any) {
      setError(err?.message ?? 'Search failed. Check that the Serper API key is configured.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    search(query);
  }

  const visible = filter === 'questions' ? results.filter((r) => r.isQuestion) : results;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Forum Intelligence</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Discover Reddit threads relevant to your niche. Engage with questions and discussions to build topical authority.
        </p>
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">How to use this</p>
        <ol className="list-decimal list-inside space-y-1 text-xs text-zinc-400">
          <li>Search for topics or keywords related to your project's niche.</li>
          <li>Filter for <span className="text-yellow-400">questions</span> — threads where your expertise adds clear value.</li>
          <li>Click a thread to open it on Reddit and post a genuinely helpful answer (cite your content where relevant).</li>
          <li>Focus on subreddits with high engagement and aligned audience intent.</li>
        </ol>
      </div>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. best SEO tools for small business"
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-500"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 shrink-0"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {/* Preset chips */}
      <div className="flex flex-wrap gap-2">
        {PRESET_QUERIES.map((p) => (
          <button
            key={p}
            onClick={() => { setQuery(p); search(p); }}
            className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition"
          >
            {p}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error}</div>
      )}

      {/* Results */}
      {searched && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">
              {visible.length} thread{visible.length !== 1 ? 's' : ''} found
              {filter === 'questions' && results.length !== visible.length && ` (${results.length} total)`}
            </p>
            <div className="flex gap-1">
              {(['all', 'questions'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                    filter === f ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300'
                  }`}
                >
                  {f === 'all' ? 'All threads' : '❓ Questions only'}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/30 p-8 text-center">
              <p className="text-zinc-400">No threads found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map((thread) => (
                <a
                  key={thread.url}
                  href={thread.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 hover:border-zinc-500 hover:bg-zinc-800 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {thread.subreddit && (
                          <span className="text-[11px] font-semibold text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded-full">
                            r/{thread.subreddit}
                          </span>
                        )}
                        {thread.isQuestion && (
                          <span className="text-[11px] text-yellow-400 bg-yellow-900/30 px-2 py-0.5 rounded-full">
                            ❓ Question
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm font-medium text-zinc-100 leading-snug">{thread.title}</p>
                      <p className="mt-1 text-xs text-zinc-400 leading-relaxed line-clamp-2">{thread.snippet}</p>
                    </div>
                    <svg className="shrink-0 mt-0.5 h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {!searched && !loading && (
        <div className="rounded-xl border border-dashed border-zinc-700 p-12 text-center">
          <p className="text-zinc-500 text-sm">Enter a topic above to find relevant Reddit discussions.</p>
        </div>
      )}
    </div>
  );
}
