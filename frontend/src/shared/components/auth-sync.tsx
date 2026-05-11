'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';
import { setAuthToken } from '@/shared/utils/api';

/**
 * Syncs the Clerk session token into the apiFetch module-level store.
 * Place inside ClerkProvider + inside a client component tree.
 */
export function AuthSync() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isSignedIn) {
      setAuthToken(null);
      return;
    }

    let cancelled = false;

    async function sync() {
      const token = await getToken();
      if (!cancelled) {
        setAuthToken(token);
      }
    }

    sync();

    // Refresh token every 50 seconds (Clerk tokens last ~60s)
    const interval = setInterval(sync, 50_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      setAuthToken(null);
    };
  }, [getToken, isSignedIn]);

  return null;
}
