'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { setAuthToken, apiFetch } from '@/shared/utils/api';
import { BusinessProfileRenderer } from '@/features/workflow/renderers/business-profile';
import {
  getBusinessProfile,
  refreshBusinessProfile,
  updateBusinessProfile,
  updateProject,
} from '@/features/projects/services/project.service';
import type { BusinessProfile } from '@/features/projects/services/project.service';
import { RefreshSuggestionsCard } from '@/features/projects/components/refresh-suggestions-card';

export default function OverviewPage() {
  const params = useParams<{ wId: string; pId: string }>();
  const { isSignedIn, getToken } = useAuth();

  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftJson, setDraftJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sitemap URL override state
  const [customSitemapUrl, setCustomSitemapUrl] = useState('');
  const [sitemapUrlDraft, setSitemapUrlDraft] = useState('');
  const [sitemapUrlSaving, setSitemapUrlSaving] = useState(false);
  const [sitemapUrlError, setSitemapUrlError] = useState<string | null>(null);
  const [sitemapUrlSaved, setSitemapUrlSaved] = useState(false);
  const [editingSitemapUrl, setEditingSitemapUrl] = useState(false);

  // Stop polling helper
  const stopPolling = () => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    if (!params.pId || !isSignedIn) return;
    (async () => {
      try {
        setAuthToken(await getToken());
        const [profileData, projectData] = await Promise.all([
          getBusinessProfile(params.pId),
          apiFetch<{ customSitemapUrl: string | null }>(`/projects/${params.pId}`),
        ]);
        setProfile(profileData.profile);
        setUpdatedAt(profileData.updatedAt);
        const saved = projectData.customSitemapUrl ?? '';
        setCustomSitemapUrl(saved);
        setSitemapUrlDraft(saved);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load business profile');
      } finally {
        setLoading(false);
      }
    })();
    return stopPolling;
  }, [params.pId, isSignedIn, getToken]);

  // When profile is still null after initial load, poll every 5s for the
  // background-generated profile (triggered automatically on project creation
  // or after a manual refresh which queues a background job).
  useEffect(() => {
    if (loading || profile !== null || !params.pId || !isSignedIn) return;

    const MAX_POLLS = 36; // 3 minutes max (background refresh can take ~120s)
    let count = 0;

    pollRef.current = setInterval(async () => {
      count += 1;
      if (count > MAX_POLLS) {
        stopPolling();
        setRefreshing(false);
        return;
      }
      try {
        const data = await getBusinessProfile(params.pId);
        if (data.profile) {
          setProfile(data.profile);
          setUpdatedAt(data.updatedAt);
          setRefreshing(false);
          stopPolling();
        }
      } catch {
        // silently ignore poll errors
      }
    }, 5000);

    return stopPolling;
  }, [loading, profile, params.pId, isSignedIn]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      setAuthToken(await getToken());
      // Refresh is queued server-side and returns immediately with the current profile.
      // Clear the local profile so the polling effect re-activates and picks up the
      // new profile once the background job completes (~60-120s).
      await refreshBusinessProfile(params.pId);
      setProfile(null);
      setUpdatedAt(null);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Business profile refresh failed');
      setRefreshing(false);
    }
    // Note: setRefreshing(false) is intentionally omitted here — the spinner stays
    // active ("Generating…") until the polling effect finds the new profile below.
  };

  const handleSitemapUrlSave = async () => {
    const trimmed = sitemapUrlDraft.trim();
    if (trimmed && !/^https?:\/\/.+/.test(trimmed)) {
      setSitemapUrlError('Must be a full URL starting with https://');
      return;
    }
    setSitemapUrlSaving(true);
    setSitemapUrlError(null);
    setSitemapUrlSaved(false);
    try {
      setAuthToken(await getToken());
      await updateProject(params.pId, { customSitemapUrl: trimmed || null });
      setCustomSitemapUrl(trimmed);
      setSitemapUrlSaved(true);
      setEditingSitemapUrl(false);
      setTimeout(() => setSitemapUrlSaved(false), 3000);
    } catch (err) {
      setSitemapUrlError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSitemapUrlSaving(false);
    }
  };

  const handleEdit = () => {
    setDraftJson(JSON.stringify(profile, null, 2));
    setJsonError(null);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setJsonError(null);
  };

  const handleSave = async () => {
    let parsed: BusinessProfile;
    try {
      parsed = JSON.parse(draftJson);
    } catch {
      setJsonError('Invalid JSON — fix the syntax before saving.');
      return;
    }
    setSaving(true);
    setJsonError(null);
    try {
      setAuthToken(await getToken());
      const data = await updateBusinessProfile(params.pId, parsed);
      setProfile(data.profile);
      setUpdatedAt(data.updatedAt);
      setEditing(false);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">Project Overview</h1>
        {updatedAt && !editing && (
          <span className="text-xs text-zinc-500">
            Last analyzed {new Date(updatedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-800/40 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div data-tour="refresh-card">
        <RefreshSuggestionsCard projectId={params.pId} />
      </div>

      <div data-tour="business-profile" className="rounded-[24px] border border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Business Profile</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              AI-synthesized analysis of your domain, positioning, and market
            </p>
          </div>
          <div className="flex items-center gap-2">
            {profile && !editing && (
              <button
                onClick={handleEdit}
                className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
              >
                Edit
              </button>
            )}
            {!editing && (
              <button
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="flex items-center gap-2 rounded-lg bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-400 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refreshing ? (
                  <>
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border border-sky-400 border-t-transparent" />
                    Analyzing…
                  </>
                ) : !profile && pollRef.current !== null ? (
                  <>
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border border-sky-400 border-t-transparent" />
                    Generating…
                  </>
                ) : profile ? (
                  'Refresh'
                ) : (
                  'Analyze Business'
                )}
              </button>
            )}
            {editing && (
              <>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border border-white/60 border-t-transparent" />
                      Saving…
                    </>
                  ) : (
                    'Save changes'
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center gap-3 text-sm text-zinc-500">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border border-zinc-600 border-t-transparent" />
              Loading…
            </div>
          ) : editing ? (
            <div className="space-y-2">
              {jsonError && (
                <p className="text-xs text-red-400">{jsonError}</p>
              )}
              <textarea
                value={draftJson}
                onChange={(e) => setDraftJson(e.target.value)}
                spellCheck={false}
                className="h-[500px] w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-mono text-xs leading-relaxed text-zinc-200 outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20"
              />
            </div>
          ) : profile ? (
            <BusinessProfileRenderer
              data={profile}
              customSitemapUrl={customSitemapUrl}
              editingSitemapUrl={editingSitemapUrl}
              sitemapUrlDraft={sitemapUrlDraft}
              sitemapUrlSaving={sitemapUrlSaving}
              sitemapUrlError={sitemapUrlError}
              sitemapUrlSaved={sitemapUrlSaved}
              onEditSitemapUrl={() => { setSitemapUrlDraft(customSitemapUrl); setSitemapUrlError(null); setEditingSitemapUrl(true); }}
              onSaveSitemapUrl={handleSitemapUrlSave}
              onCancelEditSitemapUrl={() => { setEditingSitemapUrl(false); setSitemapUrlError(null); }}
              onChangeSitemapUrlDraft={(val) => { setSitemapUrlDraft(val); setSitemapUrlError(null); }}
              onClearSitemapUrl={() => { setSitemapUrlDraft(''); setCustomSitemapUrl(''); setEditingSitemapUrl(false); updateProject(params.pId, { customSitemapUrl: null }).catch(() => {}); }}
            />
          ) : (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="rounded-full bg-zinc-800 p-4">
                <svg className="h-8 w-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-300">No business profile yet</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Run an analysis to generate your business profile. This is required before starting a workflow.
                </p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="mt-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refreshing ? 'Analyzing…' : 'Analyze Business — 30 credits'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
