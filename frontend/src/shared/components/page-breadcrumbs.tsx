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

interface WorkspaceWithProjects {
  id: string;
  name: string;
  projects?: Project[];
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
    if (!wId) return;

    let active = true;
    setLoading(true);

    (async () => {
      try {
        setAuthToken(await getToken());
        
        // Fetch workspace with projects
        const ws = await apiFetch<WorkspaceWithProjects>(`/workspaces/${wId}`);
        if (active) {
          setWorkspace({ id: ws.id, name: ws.name });
          
          // If pId exists, find the matching project
          if (pId && ws.projects) {
            const matchingProject = ws.projects.find((p) => p.id === pId);
            if (matchingProject) {
              setProject(matchingProject);
            }
          }
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
