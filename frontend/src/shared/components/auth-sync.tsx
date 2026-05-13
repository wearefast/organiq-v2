'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';
import { setAuthToken, setGetTokenFn } from '@/shared/utils/api';

/**
 * Syncs the Clerk session token into the apiFetch module-level store.
 * Place inside ClerkProvider + inside a client component tree.
 */
export function AuthSync() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isSignedIn) {
      setAuthToken(null);
      setGetTokenFn(null);
      return;
    }

    let cancelled = false;

    // Store getToken so apiFetch can refresh on 401
    setGetTokenFn(() => getToken());

    async function sync() {
      const token = await getToken();
      if (!cancelled) {
        setAuthToken(token);
      }
    }

    sync();

    // Refresh token every 30 seconds (Clerk tokens last ~60s)
    const interval = setInterval(sync, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [getToken, isSignedIn]);

  return null;
}
