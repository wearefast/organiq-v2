'use client';

import { useState, useEffect, useCallback } from 'react';
import { Edit2, Trash2, Save, X, Loader2, CreditCard } from 'lucide-react';
import {
  getWorkspacesForOrg,
  getWorkspaceCreditLimit,
  setWorkspaceCreditLimit,
  removeWorkspaceCreditLimit,
  type WorkspaceBasic,
  type CreditLimitResult,
} from '../services/user-management.service';

interface WorkspaceRow {
  workspace: WorkspaceBasic;
  limit: CreditLimitResult | null;
  rowLoading: boolean;
}

interface WorkspaceLimitsSectionProps {
  orgId: string;
}

export function WorkspaceLimitsSection({ orgId }: WorkspaceLimitsSectionProps) {
  const [rows, setRows] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const workspaces = await getWorkspacesForOrg(orgId);
      const limitEntries = await Promise.all(
        workspaces.map(async (ws): Promise<WorkspaceRow> => {
          try {
            const limit = await getWorkspaceCreditLimit(orgId, ws.id);
            return { workspace: ws, limit, rowLoading: false };
          } catch {
            return { workspace: ws, limit: null, rowLoading: false };
          }
        }),
      );
      setRows(limitEntries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(wsId: string, currentLimit: CreditLimitResult | null) {
    setEditing(wsId);
    setEditValue(currentLimit?.hasLimit ? String(currentLimit.monthlyLimit ?? '') : '');
    setSaveError(null);
  }

  async function handleSave(wsId: string) {
    const val = parseInt(editValue, 10);
    if (isNaN(val) || val < 0) {
      setSaveError('Enter a valid number ≥ 0');
      return;
    }
    setSaveError(null);
    setRows((prev) =>
      prev.map((r) => (r.workspace.id === wsId ? { ...r, rowLoading: true } : r)),
    );
    try {
      const limit = await setWorkspaceCreditLimit(orgId, wsId, val);
      setRows((prev) =>
        prev.map((r) => (r.workspace.id === wsId ? { ...r, limit, rowLoading: false } : r)),
      );
      setEditing(null);
    } catch {
      setRows((prev) =>
        prev.map((r) => (r.workspace.id === wsId ? { ...r, rowLoading: false } : r)),
      );
      setSaveError('Failed to save. Try again.');
    }
  }

  async function handleRemove(wsId: string) {
    setRows((prev) =>
      prev.map((r) => (r.workspace.id === wsId ? { ...r, rowLoading: true } : r)),
    );
    try {
      await removeWorkspaceCreditLimit(orgId, wsId);
      setRows((prev) =>
        prev.map((r) =>
          r.workspace.id === wsId
            ? { ...r, limit: { workspaceId: wsId, hasLimit: false }, rowLoading: false }
            : r,
        ),
      );
    } catch {
      setRows((prev) =>
        prev.map((r) => (r.workspace.id === wsId ? { ...r, rowLoading: false } : r)),
      );
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading workspaces…
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">No workspaces found.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Set a monthly credit cap per workspace. Workflows will stop running once the limit is
        reached. Resets on the 1st of each month.
      </p>

      <div className="overflow-hidden rounded-xl border border-zinc-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700 bg-zinc-800/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Workspace</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                Monthly Limit
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                Used This Month
              </th>
              <th className="w-28 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ workspace: ws, limit, rowLoading }) => {
              const isEditing = editing === ws.id;
              const hasLimit = limit?.hasLimit === true;

              return (
                <tr key={ws.id} className="border-b border-zinc-800 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-3.5 w-3.5 text-zinc-500" />
                      <span className="font-medium text-zinc-200">{ws.name}</span>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    {isEditing ? (
                      <div className="flex flex-col gap-1">
                        <input
                          type="number"
                          min={0}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          autoFocus
                          placeholder="e.g. 500"
                          className="w-32 rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-sm text-white outline-none focus:border-zinc-400"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave(ws.id);
                            if (e.key === 'Escape') setEditing(null);
                          }}
                        />
                        {saveError && (
                          <span className="text-[10px] text-red-400">{saveError}</span>
                        )}
                      </div>
                    ) : (
                      <span className={hasLimit ? 'text-zinc-200' : 'text-zinc-500'}>
                        {hasLimit
                          ? `${(limit.monthlyLimit ?? 0).toLocaleString()} credits`
                          : 'No limit'}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-zinc-400">
                    {hasLimit
                      ? `${(limit.currentMonthUsage ?? 0).toLocaleString()} / ${(limit.monthlyLimit ?? 0).toLocaleString()}`
                      : '—'}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {rowLoading ? (
                      <Loader2 className="ml-auto h-4 w-4 animate-spin text-zinc-500" />
                    ) : isEditing ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleSave(ws.id)}
                          className="rounded p-1.5 text-zinc-400 hover:text-green-400"
                          title="Save"
                        >
                          <Save className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="rounded p-1.5 text-zinc-500 hover:text-zinc-300"
                          title="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => startEdit(ws.id, limit)}
                          className="rounded p-1.5 text-zinc-500 hover:text-zinc-300"
                          title={hasLimit ? 'Edit limit' : 'Set limit'}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        {hasLimit && (
                          <button
                            onClick={() => handleRemove(ws.id)}
                            className="rounded p-1.5 text-zinc-500 hover:text-red-400"
                            title="Remove limit"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
