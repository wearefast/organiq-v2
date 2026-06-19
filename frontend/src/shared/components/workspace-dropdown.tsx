'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { ChevronDown, LayoutGrid, Plus } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { apiFetch, setAuthToken } from '@/shared/utils/api';
import { CreateWorkspaceModal } from './create-workspace-modal';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
}

export function WorkspaceDropdown() {
  const pathname = usePathname();
  const { getToken, orgId } = useAuth();
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract current workspace ID from URL for active highlight
  const wIdMatch = pathname.match(/\/workspaces\/([^/]+)/);
  const currentWId = wIdMatch?.[1];

  // Button is active when anywhere inside /workspaces
  const isActive = pathname.startsWith('/workspaces');

  // Close dropdown on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Reset cached workspaces when org changes (org switching)
  useEffect(() => {
    setFetched(false);
    setFetchError(false);
    setWorkspaces([]);
  }, [orgId]);

  // Fetch workspaces lazily — only on first open
  useEffect(() => {
    if (!open || fetched || !orgId) return;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        setAuthToken(await getToken());
        const data = await apiFetch<Workspace[]>(`/workspaces/org/${orgId}`);
        if (active) {
          setWorkspaces(data);
          setFetched(true);
        }
      } catch {
        if (active) setFetchError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, fetched, orgId, getToken]);

  // Click outside to close
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (open && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  return (
    <div ref={containerRef}>
      {/* Toggle button — mirrors NavLink styling exactly */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Toggle workspaces menu"
        className={cn(
          'flex h-10 w-full items-center gap-3 rounded-md px-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-zinc-800 text-zinc-100'
            : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300',
        )}
      >
        <LayoutGrid className="h-5 w-5 shrink-0" />
        <span className="flex flex-1 items-center justify-between truncate opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="truncate">Workspaces</span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 transition-transform duration-150',
              open && 'rotate-180',
            )}
          />
        </span>
      </button>

      {/* Dropdown list — JS-gated only; no CSS visibility so it stays open while sidebar is hovered */}
      {open && (
        <div className="max-h-52 overflow-y-auto">
          {loading && (
            <p className="px-3 py-2 text-[11px] text-zinc-500">Loading...</p>
          )}

          {!loading && fetchError && (
            <p className="px-3 py-2 text-[11px] text-red-400">Failed to load workspaces</p>
          )}

          {!loading && !fetchError && workspaces.length === 0 && (
            <p className="px-3 py-2 text-[11px] text-zinc-500">No workspaces yet</p>
          )}

          {!loading && !fetchError &&
            workspaces.map((ws) => (
              <Link
                key={ws.id}
                href={`/workspaces/${ws.id}/projects`}
                className={cn(
                  'flex h-8 items-center truncate rounded-md pl-10 pr-2 text-[12px] font-medium transition-colors',
                  currentWId === ws.id
                    ? 'text-zinc-100'
                    : 'text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300',
                )}
              >
                <span className="truncate">{ws.name}</span>
              </Link>
            ))}

          {/* Create New — visually differentiated from workspace list */}
          <div className="mt-1 border-t border-zinc-800/60 pt-1">
            <button
              onClick={() => {
                setShowModal(true);
                setOpen(false);
              }}
              className="flex h-8 w-full items-center gap-2 rounded-md bg-zinc-900 px-3 text-[12px] font-medium text-rose-400 transition-colors hover:bg-zinc-800/60 hover:text-rose-300"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span>Create New</span>
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <CreateWorkspaceModal
          onClose={() => setShowModal(false)}
          onSuccess={(ws) => {
            setWorkspaces((prev) => [ws, ...prev]);
            setFetched(true);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
