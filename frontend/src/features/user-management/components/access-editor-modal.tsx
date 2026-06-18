'use client';

import { useState, useEffect } from 'react';
import { X, Check, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import {
  getWorkspacesForOrg,
  getProjectsForWorkspace,
  updateMemberAccess,
  type AccessGrant,
  type WorkspaceBasic,
  type ProjectBasic,
  type InvitePayload,
} from '../services/user-management.service';

interface AccessEditorModalProps {
  orgId: string;
  memberId: string;
  memberName: string;
  currentGrants: AccessGrant[];
  onClose: () => void;
  onSaved: () => void;
}

export function AccessEditorModal({
  orgId,
  memberId,
  memberName,
  currentGrants,
  onClose,
  onSaved,
}: AccessEditorModalProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceBasic[]>([]);
  const [projectsByWs, setProjectsByWs] = useState<Record<string, ProjectBasic[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [orgWide, setOrgWide] = useState(() => currentGrants.some((g) => g.grantType === 'org'));
  const [selectedWs, setSelectedWs] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const g of currentGrants) {
      if (g.grantType === 'workspace' && g.workspaceId) s.add(g.workspaceId);
    }
    return s;
  });
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const g of currentGrants) {
      if (g.grantType === 'project' && g.projectId) s.add(g.projectId);
    }
    return s;
  });

  useEffect(() => {
    let active = true;

    async function load() {
      setLoadingData(true);
      try {
        const wsList = await getWorkspacesForOrg(orgId);
        if (!active) return;
        setWorkspaces(wsList);

        // Pre-load projects for workspaces already in the member's grants
        const grantedWsIds = new Set(
          currentGrants
            .filter((g) => g.grantType === 'workspace' || g.grantType === 'project')
            .map((g) => g.workspaceId)
            .filter(Boolean) as string[],
        );
        const toLoad = wsList.filter((ws) => grantedWsIds.has(ws.id));
        const entries = await Promise.all(
          toLoad.map(async (ws) => {
            const ps = await getProjectsForWorkspace(ws.id);
            return [ws.id, ps] as [string, ProjectBasic[]];
          }),
        );
        if (!active) return;
        setProjectsByWs(Object.fromEntries(entries));
        setExpanded(new Set(toLoad.map((ws) => ws.id)));
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load workspaces');
      } finally {
        if (active) setLoadingData(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [orgId, currentGrants]);

  async function handleToggleExpand(wsId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(wsId)) {
        next.delete(wsId);
      } else {
        next.add(wsId);
      }
      return next;
    });
    // Lazy-load projects on first expand
    if (!projectsByWs[wsId]) {
      try {
        const ps = await getProjectsForWorkspace(wsId);
        setProjectsByWs((prev) => ({ ...prev, [wsId]: ps }));
      } catch {
        setProjectsByWs((prev) => ({ ...prev, [wsId]: [] }));
      }
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const grants: InvitePayload['accessGrants'] = [];
      if (orgWide) {
        grants.push({ type: 'org' });
      } else {
        for (const wsId of selectedWs) {
          grants.push({ type: 'workspace', workspaceId: wsId });
        }
        for (const pId of selectedProjects) {
          grants.push({ type: 'project', projectId: pId });
        }
      }
      await updateMemberAccess(orgId, memberId, grants);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save access');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Edit Access</h2>
            <p className="text-xs text-zinc-500">{memberName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        {loadingData ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          </div>
        ) : (
          <div className="mb-5 max-h-80 overflow-y-auto space-y-1 pr-1">
            {/* Org-wide option */}
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 hover:bg-zinc-800">
              <input
                type="checkbox"
                checked={orgWide}
                onChange={(e) => setOrgWide(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-violet-500"
              />
              <span className="text-sm font-medium text-zinc-200">Org-wide access</span>
              <span className="ml-auto text-xs text-zinc-500">All workspaces &amp; projects</span>
            </label>

            {/* Per-workspace tree */}
            {!orgWide && (
              <div className="mt-1 space-y-0.5 border-t border-zinc-800 pt-2">
                {workspaces.length === 0 && (
                  <p className="px-3 py-2 text-xs text-zinc-500">No workspaces found</p>
                )}
                {workspaces.map((ws) => {
                  const isExpanded = expanded.has(ws.id);
                  const wsProjects = projectsByWs[ws.id] ?? null;
                  const wsSelected = selectedWs.has(ws.id);

                  return (
                    <div key={ws.id}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleExpand(ws.id)}
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-zinc-500 hover:text-zinc-300"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-zinc-800">
                          <input
                            type="checkbox"
                            checked={wsSelected}
                            onChange={(e) => {
                              setSelectedWs((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(ws.id);
                                else next.delete(ws.id);
                                return next;
                              });
                            }}
                            className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-violet-500"
                          />
                          <span className="text-sm text-zinc-200">{ws.name}</span>
                          {wsSelected && (
                            <span className="ml-auto text-xs text-zinc-500">All projects</span>
                          )}
                        </label>
                      </div>

                      {isExpanded && (
                        <div className="ml-8 space-y-0.5">
                          {wsProjects === null ? (
                            <div className="flex items-center gap-1.5 px-3 py-1.5">
                              <Loader2 className="h-3 w-3 animate-spin text-zinc-600" />
                              <span className="text-xs text-zinc-600">Loading…</span>
                            </div>
                          ) : wsProjects.length === 0 ? (
                            <p className="px-3 py-1.5 text-xs text-zinc-600">No projects</p>
                          ) : (
                            wsProjects.map((p) => (
                              <label
                                key={p.id}
                                className={cn(
                                  'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-zinc-800',
                                  wsSelected && 'cursor-default opacity-40',
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={wsSelected || selectedProjects.has(p.id)}
                                  disabled={wsSelected}
                                  onChange={(e) => {
                                    setSelectedProjects((prev) => {
                                      const next = new Set(prev);
                                      if (e.target.checked) next.add(p.id);
                                      else next.delete(p.id);
                                      return next;
                                    });
                                  }}
                                  className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-800 accent-violet-500 disabled:opacity-40"
                                />
                                <span className="text-xs text-zinc-300">{p.name}</span>
                              </label>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-zinc-800 pt-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loadingData}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Save Access
          </button>
        </div>
      </div>
    </div>
  );
}
