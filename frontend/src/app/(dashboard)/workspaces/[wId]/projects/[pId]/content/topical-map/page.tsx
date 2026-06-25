'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/shared/utils/api';
import { useContentStep } from '@/features/content/hooks/use-content-step';
import { TopicalMapRenderer, type PageStatusMap } from '@/features/workflow/renderers/topical-map';
import { PageDetailPanel } from '@/features/content/components/page-detail-panel';
import {
  fetchTopicalMapPages,
  syncTopicalMapPages,
} from '@/features/content/services/content.service';
import type { TopicalMapPage } from '@/features/content/services/content.service';

interface TopicalMap {
  id: string;
  name: string;
  pillars: unknown;
  calendar?: unknown;
  [key: string]: unknown;
}

export default function ContentStrategyPage() {
  const params = useParams();
  const projectId = params.pId as string;
  const { stepStatus, artifactData, loading, approving, approve } = useContentStep(
    projectId,
    'topical-map',
  );

  const [maps, setMaps] = useState<TopicalMap[]>([]);
  const [mapsLoading, setMapsLoading] = useState(true);
  const [pageStatusMap, setPageStatusMap] = useState<PageStatusMap>({});
  const [pagesLoading, setPagesLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<TopicalMap[]>(`/projects/${projectId}/topical-maps`)
      .then(setMaps)
      .catch(console.error)
      .finally(() => setMapsLoading(false));
  }, [projectId]);

  // Once maps are loaded, fetch page statuses (auto-sync once if empty)
  useEffect(() => {
    if (maps.length === 0) return;
    const mapId = maps[0].id;
    setPagesLoading(true);
    setSyncError(null);
    fetchTopicalMapPages(projectId, mapId)
      .then(async (pages: TopicalMapPage[]) => {
        if (pages.length === 0) {
          // Auto-sync pages from JSONB on first load — only attempt once per mount
          await syncTopicalMapPages(projectId, mapId);
          return fetchTopicalMapPages(projectId, mapId);
        }
        return pages;
      })
      .then((pages: TopicalMapPage[]) => {
        const map: PageStatusMap = {};
        for (const page of pages) {
          map[page.title] = page;
        }
        setPageStatusMap(map);
      })
      .catch((err: unknown) => {
        setSyncError(err instanceof Error ? err.message : 'Failed to load page statuses');
      })
      .finally(() => setPagesLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maps[0]?.id, projectId]);

  const refreshPageStatuses = useCallback(async (mapId: string) => {
    const pages = await fetchTopicalMapPages(projectId, mapId);
    const map: PageStatusMap = {};
    for (const page of pages) {
      map[page.title] = page;
    }
    setPageStatusMap(map);
  }, [projectId]);

  const handlePageClick = useCallback((pageId: string) => {
    setSelectedPageId(pageId);
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
      </div>
    );
  }

  // Awaiting approval: show artifact for review with approve CTA
  if (stepStatus === 'awaiting_approval') {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-300">
                Your topical map is ready for review
              </p>
              <p className="text-xs text-zinc-500">
                Review the structure below, then approve to lock it in and unlock Brief generation.
              </p>
            </div>
          </div>
          <button
            onClick={approve}
            disabled={approving}
            className="shrink-0 rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {approving ? 'Approving…' : 'Approve & Continue →'}
          </button>
        </div>
        <TopicalMapRenderer data={artifactData} />
      </div>
    );
  }

  // Running: show progress indicator
  if (stepStatus === 'running') {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <div>
            <p className="text-sm font-medium text-blue-300">Generating your topical map…</p>
            <p className="text-xs text-zinc-500">
              This usually takes 1–2 minutes. This page will update automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Default: approved / completed / pending — render domain data with the same
  // TopicalMapRenderer used in the workflow view
  if (mapsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
      </div>
    );
  }

  if (maps.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-zinc-500">No topical map yet.</p>
        <p className="text-xs text-zinc-600">
          Run the workflow through Step 15 to generate a topical map.
        </p>
      </div>
    );
  }

  return (
    <div className="relative p-6">
      {maps.length > 1 && (
        <p className="mb-4 text-xs text-zinc-500">{maps.length} maps available — showing latest</p>
      )}
      {syncError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          Failed to load page statuses: {syncError}
        </div>
      )}
      <div className="relative">
        {pagesLoading && (
          <div className="absolute inset-0 z-10 flex items-start justify-end p-2">
            <div className="flex items-center gap-1.5 rounded bg-zinc-900/80 px-2 py-1 text-xs text-zinc-500">
              <div className="h-3 w-3 animate-spin rounded-full border border-zinc-600 border-t-zinc-400" />
              Loading page statuses…
            </div>
          </div>
        )}
        <TopicalMapRenderer
          data={maps[0]}
          pageStatusMap={pageStatusMap}
          onPageClick={handlePageClick}
        />
      </div>
      {selectedPageId && (
        <PageDetailPanel
          projectId={projectId}
          mapId={maps[0].id}
          pageId={selectedPageId}
          onClose={() => setSelectedPageId(null)}
          onContentGenerated={() => refreshPageStatuses(maps[0].id).catch(console.error)}
        />
      )}
    </div>
  );
}

