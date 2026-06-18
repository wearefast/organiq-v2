'use client';

import { SignUp } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

/**
 * Clerk routes to [signUpUrl]/continue during multi-step sign-up
 * (e.g. org invitation flow that collects first/last name first).
 * We read the pending invite token from sessionStorage so Clerk
 * redirects back to the invite page once sign-up completes.
 */
export default function SignUpContinuePage() {
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem('pendingInviteToken');
    setRedirectUrl(token ? `/invite/${token}` : null);
    setReady(true);
  }, []);

  // Don't render until we've checked sessionStorage to avoid a redirect flash
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-hero">
        <p className="text-sm text-zinc-400">Loading…</p>
      </div>
    );
  }

  const destination = redirectUrl ?? '/workspaces';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero px-6 py-12">
      <SignUp
        forceRedirectUrl={destination}
        fallbackRedirectUrl={destination}
      />
    </div>
  );
}
