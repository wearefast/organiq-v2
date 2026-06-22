'use client';

import { useState, useEffect } from 'react';

/**
 * Returns whether the current user is a platform super-admin.
 *
 * Fetches /api/me/admin-status which reads SUPER_ADMIN_CLERK_IDS from the
 * server-side environment (NOT NEXT_PUBLIC_*) so admin user IDs are never
 * bundled into the client JS bundle.
 *
 * Returns false while loading and on errors (fail-closed).
 */
export function useSuperAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/admin-status')
      .then((r) => r.json())
      .then((data: { isAdmin: boolean }) => {
        if (!cancelled) setIsAdmin(data.isAdmin === true);
      })
      .catch(() => {
        // Fail closed — treat fetch errors as non-admin
      });
    return () => { cancelled = true; };
  }, []);

  return isAdmin;
}
