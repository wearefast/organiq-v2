'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { setAuthToken, apiFetch } from '@/shared/utils/api';
import { ChevronRight } from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

export function PageBreadcrumbs() {
  const pathname = usePathname();
  const params = useParams<{ wId?: string; pId?: string }>();
  const { getToken } = useAuth();
  
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);

  const wId = params?.wId as string | undefined;
  const pId = params?.pId as string | undefined;

  // Fetch workspace and project names when IDs change
  useEffect(() => {
    if (!wId && !pId) return;

    let active = true;
    setLoading(true);

    (async () => {
      try {
        setAuthToken(await getToken());
        
        // Fetch workspace if wId exists
        if (wId) {
          const ws = await apiFetch<Workspace>(`/workspaces/${wId}`);
          if (active) setWorkspace(ws);
        }

        // Fetch project if both wId and pId exist
        if (wId && pId) {
          const proj = await apiFetch<Project>(`/workspaces/${wId}/projects/${pId}`);
          if (active) setProject(proj);
        }
      } catch (err) {
        // Silently fail if we can't fetch data
        if (active) {
          console.error('Failed to fetch breadcrumb data:', err);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [wId, pId, getToken]);

  // Don't show breadcrumbs for non-workspace pages
  if (!wId) return null;

  return (
    <div className="mb-4 flex items-center gap-2 text-sm">
      <Link 
        href={`/workspaces/${wId}/projects`}
        className="text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        {loading && !workspace ? 'Loading...' : workspace?.name || `Workspace`}
      </Link>
      
      {pId && (
        <>
          <ChevronRight className="h-4 w-4 text-zinc-600" />
          <Link 
            href={`/workspaces/${wId}/projects/${pId}/overview`}
            className="text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {loading && !project ? 'Loading...' : project?.name || `Project`}
          </Link>
        </>
      )}
    </div>
  );
}
