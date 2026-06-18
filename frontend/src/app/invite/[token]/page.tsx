'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { ShieldCheck, UserCheck, Mail, Building2, CheckCircle2, AlertCircle } from 'lucide-react';
import { API_URL } from '@/shared/utils/api';

interface InvitePreview {
  id: string;
  email: string;
  role: 'admin' | 'user';
  expiresAt: string;
  organizationName: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
}

function RolePill({ role }: { role: 'admin' | 'user' }) {
  const isAdmin = role === 'admin';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1 text-sm font-medium text-zinc-300">
      {isAdmin ? <ShieldCheck className="h-4 w-4 text-violet-400" /> : <UserCheck className="h-4 w-4 text-zinc-400" />}
      {isAdmin ? 'Admin' : 'Member'}
    </span>
  );
}

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { isLoaded: authLoaded, isSignedIn, signOut, getToken } = useAuth();
  const { user } = useUser();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  // Fetch invitation preview (public — no auth required)
  useEffect(() => {
    if (!params.token) return;
    const controller = new AbortController();
    fetch(`${API_URL}/invitations/${params.token}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`Invitation not found or expired (${r.status})`);
        return r.json() as Promise<InvitePreview>;
      })
      .then(setPreview)
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setLoadError(err.message);
      });
    return () => controller.abort();
  }, [params.token]);

  async function handleAccept() {
    if (!user) return;
    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) {
      setAcceptError('Your account has no verified email address.');
      return;
    }

    setAccepting(true);
    setAcceptError(null);
    try {
      // Get token directly — AuthSync doesn't run outside the dashboard layout
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`${API_URL}/invitations/${params.token}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `Request failed (${res.status})`);
      }
      setAccepted(true);
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  }

  // Redirect after successful accept — cleanup on unmount
  useEffect(() => {
    if (!accepted) return;
    const id = setTimeout(() => router.push('/workspaces'), 1500);
    return () => clearTimeout(id);
  }, [accepted, router]);

  const isExpiredOrRevoked =
    preview && (preview.status === 'expired' || preview.status === 'revoked');
  const isAlreadyAccepted = preview?.status === 'accepted';

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
        {/* Logo / Brand */}
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">ORGANIQ</p>
        </div>

        {/* Loading */}
        {!preview && !loadError && (
          <p className="text-center text-sm text-zinc-500">Loading invitation…</p>
        )}

        {/* Error loading */}
        {loadError && (
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-10 w-10 text-red-400" />
            <p className="text-sm text-red-300">{loadError}</p>
          </div>
        )}

        {/* Expired / Revoked */}
        {isExpiredOrRevoked && (
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-10 w-10 text-yellow-400" />
            <h1 className="text-lg font-semibold text-white">Invitation {preview.status}</h1>
            <p className="text-sm text-zinc-400">
              This invitation is no longer valid. Ask your admin to send a new one.
            </p>
          </div>
        )}

        {/* Already accepted */}
        {isAlreadyAccepted && (
          <div className="flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-400" />
            <h1 className="text-lg font-semibold text-white">Already Accepted</h1>
            <p className="text-sm text-zinc-400">
              This invitation has already been used.{' '}
              <button
                onClick={() => router.push('/workspaces')}
                className="text-zinc-300 underline underline-offset-2 hover:text-white"
              >
                Go to workspaces
              </button>
            </p>
          </div>
        )}

        {/* Accepted success */}
        {accepted && (
          <div className="flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-400" />
            <h1 className="text-lg font-semibold text-white">Welcome aboard!</h1>
            <p className="text-sm text-zinc-400">Taking you to your workspaces…</p>
          </div>
        )}

        {/* Pending invitation view */}
        {preview && preview.status === 'pending' && !accepted && (
          <>
            <div className="mb-6 space-y-4 text-center">
              <h1 className="text-xl font-bold text-white">You&apos;re invited</h1>

              <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium text-zinc-200">{preview.organizationName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Mail className="h-4 w-4" />
                  <span>{preview.email}</span>
                </div>
                <RolePill role={preview.role} />
              </div>

              <p className="text-xs text-zinc-500">
                Expires {new Date(preview.expiresAt).toLocaleDateString()}
              </p>
            </div>

            {acceptError && (
              <div className="mb-3 space-y-2 rounded-lg border border-red-800 bg-red-900/20 px-3 py-2">
                <p className="text-sm text-red-300">{acceptError}</p>
                {acceptError.includes('403') && (
                  <button
                    onClick={() => signOut({ redirectUrl: `/invite/${params.token}` })}
                    className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-200"
                  >
                    Sign out and try a different account
                  </button>
                )}
              </div>
            )}

            {!authLoaded ? (
              <p className="text-center text-sm text-zinc-500">Loading…</p>
            ) : !isSignedIn ? (
              <div className="space-y-3">
                <p className="text-center text-sm text-zinc-400">
                  Sign in to accept this invitation
                </p>
                <button
                  onClick={() =>
                    router.push(`/login?redirect_url=/invite/${params.token}`)
                  }
                  className="w-full rounded-lg bg-zinc-100 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-white"
                >
                  Sign In
                </button>
                <button
                  onClick={() =>
                    router.push(`/sign-up?redirect_url=/invite/${params.token}`)
                  }
                  className="w-full rounded-lg border border-zinc-700 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
                >
                  Create Account
                </button>
              </div>
            ) : (
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full rounded-lg bg-zinc-100 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
              >
                {accepting ? 'Accepting…' : 'Accept Invitation'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
