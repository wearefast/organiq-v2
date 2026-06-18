'use client';

import { useState } from 'react';
import { Mail, Clock, ShieldCheck, UserCheck } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import type { Invitation } from '../services/user-management.service';

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

interface InvitationsTableProps {
  invitations: Invitation[];
  onRevoke: (invitationId: string) => Promise<void>;
}

export function InvitationsTable({ invitations, onRevoke }: InvitationsTableProps) {
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  async function handleRevoke(id: string) {
    setRevoking(id);
    setRevokeError(null);
    try {
      await onRevoke(id);
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : 'Failed to revoke invitation');
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="space-y-2">
      {revokeError && <p className="text-xs text-red-400">{revokeError}</p>}
      <div className="overflow-hidden rounded-xl border border-zinc-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700 bg-zinc-800/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Sent</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Expires</th>
              <th className="w-20 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {invitations.map((inv) => (
              <tr key={inv.id} className="border-b border-zinc-800 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                    <span className="text-zinc-300">{inv.email}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <RoleBadge role={inv.role} />
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {new Date(inv.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-xs text-zinc-500">
                    <Clock className="h-3 w-3" />
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleRevoke(inv.id)}
                    disabled={revoking === inv.id}
                    className="rounded px-2.5 py-1 text-xs text-zinc-500 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                  >
                    {revoking === inv.id ? 'Revoking…' : 'Revoke'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
