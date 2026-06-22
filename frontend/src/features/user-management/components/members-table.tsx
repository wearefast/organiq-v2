'use client';

import { useState } from 'react';
import { Trash2, ShieldCheck, UserCheck, Pencil } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import type { EnrichedMember } from '../hooks/use-members';
import type { AccessGrant } from '../services/user-management.service';

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === 'admin' || role === 'owner';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        isAdmin ? 'bg-violet-500/20 text-violet-300' : 'bg-zinc-700 text-zinc-400',
      )}
    >
      {isAdmin ? <ShieldCheck className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
      {isAdmin ? 'Admin' : 'User'}
    </span>
  );
}

function AccessSummary({ grants }: { grants: AccessGrant[] }) {
  const hasOrg = grants.some((g) => g.grantType === 'org');
  if (hasOrg) return <span className="text-xs text-zinc-400">Org-wide access</span>;

  if (grants.length === 0) return <span className="text-xs text-zinc-500">No access</span>;

  // Group by type
  const wsGrants = grants.filter((g) => g.grantType === 'workspace');
  const pGrants = grants.filter((g) => g.grantType === 'project');

  // Build display items
  const items: string[] = [];
  for (const grant of wsGrants) {
    items.push(`📁 ${grant.workspaceName || 'Unknown'}`);
  }
  for (const grant of pGrants) {
    const ws = grant.workspaceName || 'Unknown';
    const proj = grant.projectName || 'Unknown';
    items.push(`📊 ${ws} / ${proj}`);
  }

  if (items.length === 0) return <span className="text-xs text-zinc-500">No access</span>;

  if (items.length <= 2) {
    return <span className="text-xs text-zinc-400">{items.join(', ')}</span>;
  }

  // For many grants, show count with tooltip
  return (
    <div className="group relative inline-block">
      <span className="text-xs text-zinc-400 cursor-help">
        {items.length} access items
      </span>
      <div className="absolute bottom-full left-0 mb-2 hidden w-max rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-200 group-hover:block border border-zinc-700 z-10">
        {items.map((item, i) => (
          <div key={i}>{item}</div>
        ))}
      </div>
    </div>
  );
}

interface MembersTableProps {
  members: EnrichedMember[];
  currentClerkUserId: string | undefined;
  isAdmin: boolean;
  onRemove: (memberId: string) => Promise<void>;
  onEditAccess?: (member: EnrichedMember) => void;
}

export function MembersTable({ members, currentClerkUserId, isAdmin, onRemove, onEditAccess }: MembersTableProps) {
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function handleRemove(memberId: string) {
    setRemoving(memberId);
    setRemoveError(null);
    try {
      await onRemove(memberId);
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-2">
      {removeError && (
        <p className="text-xs text-red-400">{removeError}</p>
      )}
      <div className="overflow-hidden rounded-xl border border-zinc-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700 bg-zinc-800/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Member</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Access</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Joined</th>
              {isAdmin && <th className="w-24 px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isSelf = m.clerkUserId === currentClerkUserId;
              return (
                <tr key={m.id} className="border-b border-zinc-800 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {m.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.imageUrl}
                          alt={m.name}
                          className="h-7 w-7 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-700 text-xs font-medium text-zinc-300">
                          {m.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-zinc-200">
                          {m.name}
                          {isSelf && (
                            <span className="ml-1.5 text-[10px] text-zinc-500">(you)</span>
                          )}
                        </p>
                        <p className="text-xs text-zinc-500">{m.email !== m.name ? m.email : ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={m.role} />
                  </td>
                  <td className="px-4 py-3">
                    <AccessSummary grants={m.grants} />
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Edit access — only relevant for 'user' role members */}
                        {!isSelf && (m.role === 'user' || m.role === 'member') && onEditAccess && (
                          <button
                            onClick={() => onEditAccess(m)}
                            className="rounded p-1.5 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-200"
                            title="Edit workspace access"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {!isSelf && (
                          <button
                            onClick={() => handleRemove(m.id)}
                            disabled={removing === m.id}
                            className="rounded p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                            title="Remove member"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
