'use client';

import { useState, useEffect } from 'react';
import { X, Send, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import {
  getWorkspacesForOrg,
  getProjectsForWorkspace,
  type InvitePayload,
  type WorkspaceBasic,
  type ProjectBasic,
} from '../services/user-management.service';

interface InviteModalProps {
  orgId: string;
  onClose: () => void;
  onSubmit: (payload: InvitePayload) => Promise<void>;
}

export function InviteModal({ orgId, onClose, onSubmit }: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Access selector state (only used when role = 'user')
  const [workspaces, setWorkspaces] = useState<WorkspaceBasic[]>([]);
  const [projectsByWs, setProjectsByWs] = useState<Record<string, ProjectBasic[]>>({});
  // Maps projectId -> workspaceId so project grants can include both IDs
  const [projectWsMap, setProjectWsMap] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [orgWide, setOrgWide] = useState(false);
  const [selectedWs, setSelectedWs] = useState<Set<string>>(new Set());
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [loadingWs, setLoadingWs] = useState(false);

  // Load workspaces when modal opens (needed for user role selector)
  useEffect(() => {
    let active = true;
    async function load() {
      setLoadingWs(true);
      try {
        const wsList = await getWorkspacesForOrg(orgId);
        if (active) setWorkspaces(wsList);
      } catch {
        // Non-fatal: access selector will show empty
      } finally {
        if (active) setLoadingWs(false);
      }
    }
    load();
    return () => { active = false; };
  }, [orgId]);

  async function handleToggleExpand(wsId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(wsId)) { next.delete(wsId); } else { next.add(wsId); }
      return next;
    });
    if (!projectsByWs[wsId]) {
      try {
        const ps = await getProjectsForWorkspace(wsId);
        setProjectsByWs((prev) => ({ ...prev, [wsId]: ps }));
        // Record wsId for every project so grants can include workspaceId
        setProjectWsMap((prev) => {
          const next = { ...prev };
          for (const p of ps) next[p.id] = wsId;
          return next;
        });
      } catch {
        setProjectsByWs((prev) => ({ ...prev, [wsId]: [] }));
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const accessGrants: InvitePayload['accessGrants'] = [];
      if (role === 'user') {
        if (orgWide) {
          accessGrants.push({ type: 'org' });
        } else {
          for (const wsId of selectedWs) {
            accessGrants.push({ type: 'workspace', workspaceId: wsId });
          }
          for (const pId of selectedProjects) {
            const wsId = projectWsMap[pId];
            if (wsId) accessGrants.push({ type: 'project', workspaceId: wsId, projectId: pId });
          }
        }
      }
      await onSubmit({ email: email.trim(), role, accessGrants: role === 'user' ? accessGrants : undefined });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Invite Member</h2>
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:text-zinc-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-zinc-500"
            >
              <option value="user">User — access to assigned workspaces only</option>
              <option value="admin">Admin — full organization access</option>
            </select>
          </div>

          {/* Access assignment — only shown for 'user' role */}
          {role === 'user' && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Assign Access
              </label>
              <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-2">
                {loadingWs ? (
                  <div className="flex items-center gap-2 py-2 pl-1 text-xs text-zinc-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading workspaces…
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {/* Org-wide option */}
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-700/50">
                      <input
                        type="checkbox"
                        checked={orgWide}
                        onChange={(e) => setOrgWide(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-zinc-600 accent-violet-500"
                      />
                      <span className="text-xs font-medium text-zinc-200">Org-wide access</span>
                    </label>

                    {!orgWide && workspaces.length > 0 && (
                      <div className="mt-0.5 space-y-0.5 border-t border-zinc-700 pt-1">
                        {workspaces.map((ws) => {
                          const isExpanded = expanded.has(ws.id);
                          const wsProjects = projectsByWs[ws.id] ?? null;
                          const wsSelected = selectedWs.has(ws.id);
                          return (
                            <div key={ws.id}>
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleExpand(ws.id)}
                                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center text-zinc-500 hover:text-zinc-300"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-3 w-3" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3" />
                                  )}
                                </button>
                                <label className="flex flex-1 cursor-pointer items-center gap-2 rounded px-1.5 py-1.5 hover:bg-zinc-700/50">
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
                                    className="h-3.5 w-3.5 rounded border-zinc-600 accent-violet-500"
                                  />
                                  <span className="text-xs text-zinc-200">{ws.name}</span>
                                </label>
                              </div>

                              {isExpanded && (
                                <div className="ml-7 space-y-0.5">
                                  {wsProjects === null ? (
                                    <div className="flex items-center gap-1.5 px-2 py-1">
                                      <Loader2 className="h-3 w-3 animate-spin text-zinc-600" />
                                      <span className="text-[10px] text-zinc-600">Loading…</span>
                                    </div>
                                  ) : wsProjects.length === 0 ? (
                                    <p className="px-2 py-1 text-[10px] text-zinc-600">No projects</p>
                                  ) : (
                                    wsProjects.map((p) => (
                                      <label
                                        key={p.id}
                                        className={cn(
                                          'flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-zinc-700/50',
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
                                          className="h-3 w-3 rounded border-zinc-600 accent-violet-500 disabled:opacity-40"
                                        />
                                        <span className="text-[11px] text-zinc-300">{p.name}</span>
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

                    {!orgWide && workspaces.length === 0 && !loadingWs && (
                      <p className="px-2 py-1.5 text-xs text-zinc-500">
                        No workspaces yet — you can assign access after the member joins.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {submitting ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
