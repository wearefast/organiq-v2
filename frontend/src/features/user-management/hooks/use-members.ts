'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOrganization } from '@clerk/nextjs';
import {
  listMembers,
  listInvitations,
  createInvitation,
  revokeInvitation,
  removeMember as removeMemberApi,
  type OrgMember,
  type Invitation,
  type InvitePayload,
} from '../services/user-management.service';

export interface EnrichedMember extends OrgMember {
  name: string;
  email: string;
  imageUrl: string | null;
}

export function useMembers(orgId: string | undefined) {
  const { memberships } = useOrganization({ memberships: { pageSize: 100, infinite: true } });

  const [backendMembers, setBackendMembers] = useState<OrgMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  // Start loading=true so the page waits for BOTH the backend fetch AND Clerk memberships.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Exhaust all pages of Clerk memberships when `infinite: true` is used.
  // Without this, orgs with >100 members will have truncated display-name data.
  useEffect(() => {
    if (memberships?.hasNextPage && !memberships.isFetching) {
      memberships.fetchNext();
    }
  }, [memberships?.hasNextPage, memberships?.isFetching, memberships?.fetchNext]);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const [members, invites] = await Promise.all([
        listMembers(orgId),
        listInvitations(orgId),
      ]);
      setBackendMembers(members);
      setInvitations(invites.filter((i) => i.status === 'pending'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh when admin tabs back to the window — picks up acceptances in other browsers
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') refresh();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refresh]);

  const members: EnrichedMember[] = useMemo(() => {
    const clerkMap = new Map<string, { name: string; email: string; imageUrl: string | null }>();
    for (const m of memberships?.data ?? []) {
      const userId = m.publicUserData?.userId;
      if (!userId) continue;
      const firstName = m.publicUserData?.firstName ?? '';
      const lastName = m.publicUserData?.lastName ?? '';
      clerkMap.set(userId, {
        name: [firstName, lastName].filter(Boolean).join(' '),
        email: m.publicUserData?.identifier ?? '',
        imageUrl: m.publicUserData?.imageUrl ?? null,
      });
    }

    return backendMembers.map((bm) => {
      const clerkData = clerkMap.get(bm.clerkUserId);
      return {
        ...bm,
        name: clerkData?.name || bm.clerkUserId,
        email: clerkData?.email || bm.clerkUserId,
        imageUrl: clerkData?.imageUrl ?? null,
      };
    });
  }, [backendMembers, memberships?.data]);

  const invite = useCallback(
    async (payload: InvitePayload) => {
      if (!orgId) return;
      await createInvitation(orgId, payload);
      await refresh();
    },
    [orgId, refresh],
  );

  const revoke = useCallback(
    async (invitationId: string) => {
      if (!orgId) return;
      await revokeInvitation(orgId, invitationId);
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    },
    [orgId],
  );

  const removeMember = useCallback(
    async (memberId: string) => {
      if (!orgId) return;
      await removeMemberApi(orgId, memberId);
      setBackendMembers((prev) => prev.filter((m) => m.id !== memberId));
    },
    [orgId],
  );

  // Combined loading: true while either the backend call OR Clerk memberships is still fetching
  const combinedLoading = loading || (memberships?.isLoading ?? true);

  return { members, invitations, loading: combinedLoading, error, refresh, invite, revoke, removeMember };
}
