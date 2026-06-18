'use client';

import { useState } from 'react';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import { Users, UserPlus, CreditCard, RefreshCw } from 'lucide-react';
import { useMembers } from '@/features/user-management/hooks/use-members';
import { MembersTable } from '@/features/user-management/components/members-table';
import { InvitationsTable } from '@/features/user-management/components/invitations-table';
import { InviteModal } from '@/features/user-management/components/invite-modal';
import { AccessEditorModal } from '@/features/user-management/components/access-editor-modal';
import { WorkspaceLimitsSection } from '@/features/user-management/components/workspace-limits-section';
import type { EnrichedMember } from '@/features/user-management/hooks/use-members';

export default function MembersPage() {
  const { userId: currentClerkUserId, orgId } = useAuth();
  const { membership } = useOrganization();
  // Include org:owner so org creators are not locked out of their own Members page
  const isAdmin = membership?.role === 'org:admin' || membership?.role === 'org:owner';

  // Redirect non-admin members away once their membership role is resolved
  if (membership && !isAdmin) {
    redirect('/settings');
  }
  const [showInvite, setShowInvite] = useState(false);
  const [editingMember, setEditingMember] = useState<EnrichedMember | null>(null);

  const { members, invitations, loading, error, invite, revoke, removeMember, refresh } = useMembers(
    orgId ?? undefined,
  );

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-zinc-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Team Members</h1>
            <p className="text-sm text-zinc-500">
              Manage who has access to your organization
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
            title="Refresh members"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
            >
              <UserPlus className="h-4 w-4" />
              Invite Member
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && members.length === 0 ? (
        <div className="py-12 text-center text-sm text-zinc-500">Loading members…</div>
      ) : (
        <>
          {/* Members section */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-zinc-300">
              Members{' '}
              <span className="font-normal text-zinc-500">({members.length})</span>
            </h2>
            {members.length > 0 ? (
              <MembersTable
                members={members}
                currentClerkUserId={currentClerkUserId ?? undefined}
                isAdmin={isAdmin ?? false}
                onRemove={removeMember}
                onEditAccess={setEditingMember}
              />
            ) : (
              <p className="text-sm text-zinc-500">No members found.</p>
            )}
          </section>

          {/* Pending invitations — admin only */}
          {isAdmin && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-zinc-300">
                Pending Invitations{' '}
                <span className="font-normal text-zinc-500">({invitations.length})</span>
              </h2>
              {invitations.length > 0 ? (
                <InvitationsTable invitations={invitations} onRevoke={revoke} />
              ) : (
                <p className="text-sm text-zinc-500">No pending invitations.</p>
              )}
            </section>
          )}

          {/* Workspace Credit Limits — admin only */}
          {isAdmin && orgId && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-zinc-400" />
                <h2 className="text-sm font-semibold text-zinc-300">Workspace Credit Limits</h2>
              </div>
              <WorkspaceLimitsSection orgId={orgId} />
            </section>
          )}
        </>
      )}

      {/* Invite modal */}
      {showInvite && orgId && (
        <InviteModal
          orgId={orgId}
          onClose={() => setShowInvite(false)}
          onSubmit={invite}
        />
      )}

      {/* Access editor modal */}
      {editingMember && orgId && (
        <AccessEditorModal
          orgId={orgId}
          memberId={editingMember.id}
          memberName={editingMember.name}
          currentGrants={editingMember.grants}
          onClose={() => setEditingMember(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
