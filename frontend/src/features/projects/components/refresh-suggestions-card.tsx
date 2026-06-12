'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { setAuthToken } from '@/shared/utils/api';
import {
  getRefreshSuggestions,
  dismissRefreshSuggestion,
  type RefreshSuggestion,
} from '../services/project.service';

interface RefreshSuggestionsCardProps {
  projectId: string;
}

const DATA_TYPE_LABELS: Record<string, string> = {
  'site-audit': 'Site Audit',
  'competitor-metrics': 'Competitor Metrics',
  rankings: 'Rankings',
  traffic: 'Traffic',
  keywords: 'Keywords',
  'topical-map': 'Topical Map',
  'content-inventory': 'Content Inventory',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 30) return `${Math.floor(days / 30)}mo ago`;
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h ago`;
  return 'just now';
}

export function RefreshSuggestionsCard({ projectId }: RefreshSuggestionsCardProps) {
  const { getToken } = useAuth();
  const [suggestions, setSuggestions] = useState<RefreshSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDismiss, setPendingDismiss] = useState<string | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        setAuthToken(await getToken());
        const data = await getRefreshSuggestions(projectId);
        setSuggestions(data);
      } catch {
        // Silently fail — suggestions are non-critical
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, getToken]);

  const handleDismiss = useCallback((id: string) => {
    setPendingDismiss(id);

    // Clear any existing timer
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);

    // After 5s, commit the dismiss to the backend
    dismissTimerRef.current = setTimeout(async () => {
      try {
        setAuthToken(await getToken());
        await dismissRefreshSuggestion(projectId, id);
      } catch {
        // Ignore — already removed from UI
      }
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      setPendingDismiss(null);
    }, 5000);
  }, [projectId, getToken]);

  const handleUndo = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setPendingDismiss(null);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  if (suggestions.length === 0) return null;

  return (
    <div className="rounded-[24px] border border-amber-800/40 bg-amber-950/20">
      <div className="flex items-center gap-2 border-b border-amber-800/30 px-6 py-4">
        <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <h2 className="text-sm font-semibold text-amber-200">Data Refresh Suggestions</h2>
        <span className="ml-auto rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
          {suggestions.filter((s) => s.id !== pendingDismiss).length}
        </span>
      </div>

      <div className="divide-y divide-amber-800/20 px-6">
        {pendingDismiss && (
          <div className="flex items-center justify-between py-2">
            <span className="text-[11px] text-zinc-400">Suggestion dismissed</span>
            <button
              onClick={handleUndo}
              className="rounded px-2 py-0.5 text-[11px] font-medium text-sky-400 transition-colors hover:bg-sky-500/10"
            >
              Undo
            </button>
          </div>
        )}
        {suggestions
          .filter((s) => s.id !== pendingDismiss)
          .map((s) => (
          <div key={s.id} className="flex items-start gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                  {DATA_TYPE_LABELS[s.dataType] || s.dataType}
                </span>
                {s.targetKey && s.targetKey !== 'latest' && (
                  <span className="truncate text-[10px] text-zinc-500">{s.targetKey}</span>
                )}
              </div>
              <p className="mt-1 text-xs text-zinc-300">{s.reason}</p>
              <p className="mt-0.5 text-[10px] text-zinc-500">
                Flagged {timeAgo(s.suggestedAt)} by {s.suggestedBy} · Data from {timeAgo(s.lastUpdated)}
              </p>
            </div>
            <button
              onClick={() => handleDismiss(s.id)}
              className="shrink-0 rounded-md px-2 py-1 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              title="Dismiss suggestion"
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
