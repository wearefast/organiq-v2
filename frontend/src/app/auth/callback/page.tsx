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
  const { organizationList, setActive, isLoaded } = useOrganizationList();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    async function activate() {
      if (organizationList && organizationList.length > 0 && setActive) {
        await setActive({ organization: organizationList[0].organization.id });
      }
      router.replace('/workspaces');
    }

    activate();
  }, [isLoaded, organizationList, setActive, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero">
      <p className="text-sm text-zinc-400">Setting up your workspace…</p>
    </div>
  );
}
