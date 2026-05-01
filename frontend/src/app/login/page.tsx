'use client';

import { useState } from 'react';
import { useAuth } from '@/shared/hooks/use-auth';
import Link from 'next/link';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('demo@calibrate.dev');
  const [password, setPassword] = useState('password');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    signIn(email, password);
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — brand */}
      <div className="hidden w-[420px] shrink-0 flex-col justify-between bg-gradient-sidebar p-10 lg:flex">
        <Link href="/">
          <img
            src="/calibrate-commerce-logo.svg"
            alt="Calibrate Commerce"
            className="h-6 w-auto"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
        </Link>
        <div>
          <p className="text-[24px] font-bold leading-snug text-white">
            Your organic visibility engine.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            SEO, GEO & AEO auditing powered by Ahrefs, SerpAPI, and OpenAI.
          </p>
        </div>
        <p className="text-xs text-white/30">© {new Date().getFullYear()} Calibrate Commerce</p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#F8F9FC] px-8">
        <div className="w-full max-w-sm">
          <h1 className="text-[32px] font-bold text-[#111827]">Sign in</h1>
          <p className="mt-1 text-sm text-[#9CA3AF]">Demo mode — any credentials work</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="text-sm font-semibold text-[#111827]">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-[10px] border border-[#D7DCE5] bg-white px-3 text-sm text-[#111827] transition-colors placeholder:text-[#9CA3AF] focus:border-[#DA304F] focus:outline-none focus:ring-1 focus:ring-[#DA304F]"
              />
            </div>
            <div>
              <label htmlFor="password" className="text-sm font-semibold text-[#111827]">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-[10px] border border-[#D7DCE5] bg-white px-3 text-sm text-[#111827] transition-colors placeholder:text-[#9CA3AF] focus:border-[#DA304F] focus:outline-none focus:ring-1 focus:ring-[#DA304F]"
              />
            </div>
            <button
              type="submit"
              className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-pill bg-gradient-cta text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              Sign in
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-[#9CA3AF]">
            Development-only login. Clerk auth replaces this in production.
          </p>
        </div>
      </div>
    </div>
  );
}
