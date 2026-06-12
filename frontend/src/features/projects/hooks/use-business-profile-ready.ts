'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { setAuthToken } from '@/shared/utils/api';
import { getBusinessProfile } from '@/features/projects/services/project.service';

/**
 * Returns whether the business profile has been generated for a project.
 * Polls until the profile becomes available (for newly created projects).
 */
export function useBusinessProfileReady(projectId: string | undefined) {
  const { isSignedIn, getToken } = useAuth();
  const [ready, setReady] = useState<boolean | null>(null); // null = loading
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    if (!projectId || !isSignedIn) return;

    let cancelled = false;

    (async () => {
      try {
        setAuthToken(await getToken());
        const data = await getBusinessProfile(projectId);
        if (!cancelled) {
          setReady(data.profile !== null);
        }
      } catch {
        if (!cancelled) setReady(false);
      }
    })();

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [projectId, isSignedIn, getToken]);

  // Poll when not ready
  useEffect(() => {
    if (ready !== false || !projectId || !isSignedIn) return;

    const MAX_POLLS = 24; // 2 minutes
    let count = 0;

    pollRef.current = setInterval(async () => {
      count += 1;
      if (count > MAX_POLLS) {
        stopPolling();
        return;
      }
      try {
        const data = await getBusinessProfile(projectId);
        if (data.profile) {
          setReady(true);
          stopPolling();
        }
      } catch {
        // ignore
      }
    }, 5000);

    return stopPolling;
  }, [ready, projectId, isSignedIn]);

  return ready;
}
