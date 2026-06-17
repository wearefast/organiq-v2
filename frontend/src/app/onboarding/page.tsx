'use client';

import { useOrganizationList, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function OnboardingPage() {
  const { createOrganization } = useOrganizationList();
  const { user } = useUser();
  const router = useRouter();

  const [orgName, setOrgName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim()) {
      setError('Organisation name is required');
      return;
    }
    setLoading(true);
    setError('');

    try {
      // Update user phone number via Clerk
      if (phone.trim() && user) {
        await user.update({ unsafeMetadata: { phone } });
      }

      // Create Clerk organization — triggers organization.created webhook → backend saves it
      await createOrganization?.({ name: orgName.trim() });

      router.push('/workspaces');
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? err?.message ?? 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-100">Set up your account</h1>
          <p className="mt-1 text-sm text-zinc-400">Tell us a bit about your organisation</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name (pre-filled from Clerk) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Your name</label>
            <input
              type="text"
              value={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()}
              disabled
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-400 cursor-not-allowed"
            />
          </div>

          {/* Email (pre-filled from Clerk) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Email</label>
            <input
              type="email"
              value={user?.primaryEmailAddress?.emailAddress ?? ''}
              disabled
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-400 cursor-not-allowed"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Phone number</label>
            <input
              type="tel"
              placeholder="+1 555 000 0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          {/* Organisation name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              Organisation name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="Acme Inc."
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Setting up…' : 'Continue to dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}
