'use client';

import { useState } from 'react';
import { useAuth } from '@/shared/hooks/use-auth';
import Link from 'next/link';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('maya@acmeshoes.com');
  const [password, setPassword] = useState('password');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    signIn(email, password);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-hero px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-sm font-bold text-white">
              C
            </span>
            <span className="text-lg font-semibold text-white">Calibrate Commerce</span>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[#E8EAF0] bg-white p-8 shadow-xl">
          <h1 className="text-[24px] font-bold text-[#111827]">Welcome back</h1>
          <p className="mt-1 text-sm text-[#9CA3AF]">Sign in to your strategist workspace</p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div>
              <label htmlFor="email" className="text-sm font-medium text-[#344054]">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-lg border border-[#D7DCE5] bg-white px-3.5 text-sm text-[#111827] transition-colors placeholder:text-[#9CA3AF] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
              />
            </div>
            <div>
              <label htmlFor="password" className="text-sm font-medium text-[#344054]">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-lg border border-[#D7DCE5] bg-white px-3.5 text-sm text-[#111827] transition-colors placeholder:text-[#9CA3AF] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
              />
            </div>
            <button
              type="submit"
              className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#111827] text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1F2937]"
            >
              Sign in
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-[#9CA3AF]">Demo login</p>
        </div>

        <p className="mt-6 text-center text-sm text-white/50">
          New here?{' '}
          <Link href="/audit" className="font-medium text-white/80 underline underline-offset-2 transition-colors hover:text-white">
            Get a free audit instead
          </Link>
        </p>
      </div>
    </div>
  );
}
