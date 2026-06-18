'use client';

import { useOrganizationList } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Post-sign-in callback page.
 * Activates the user's first organization (if any) then redirects to /workspaces.
 * This bypasses Clerk's built-in choose-organization task which renders blank.
 */
export default function AuthCallbackPage() {
  const { userMemberships, setActive, isLoaded } = useOrganizationList({ userMemberships: { pageSize: 1 } });
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    async function activate() {
      const first = userMemberships.data?.[0];
      if (first && setActive) {
        await setActive({ organization: first.organization.id });
      }
      router.replace('/workspaces');
    }

    activate();
  }, [isLoaded, userMemberships.data, setActive, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero">
      <p className="text-sm text-zinc-400">Setting up your workspace…</p>
    </div>
  );
}
