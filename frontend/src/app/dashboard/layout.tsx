'use client';

import { useAuth } from '@/shared/hooks/use-auth';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: GridIcon },
  { label: 'Audits', href: '/dashboard/audits', icon: SearchIcon },
  { label: 'Keywords', href: '/dashboard/keywords', icon: KeyIcon },
  { label: 'Content', href: '/dashboard/content', icon: FileIcon },
  { label: 'Leads', href: '/dashboard/leads', icon: UsersIcon },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoaded, signOut } = useAuth();
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const activeNavItem =
    NAV_ITEMS.find((item) => pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))) ??
    NAV_ITEMS[0];

  useEffect(() => {
    if (isLoaded && !user) {
      window.location.replace('/login');
    }
  }, [isLoaded, user]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FC]">
        <div className="flex items-center gap-3 text-[#9CA3AF]">
          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FC] px-6">
        <div className="text-center text-[#6B7280]">
          <p className="text-sm font-medium">Redirecting to sign in...</p>
          <Link href="/login" className="mt-3 inline-block text-sm font-semibold text-[#DA304F] hover:opacity-80">
            Continue to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8F9FC]">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-gradient-sidebar transition-all duration-200 ease-out ${
          isSidebarCollapsed ? 'w-[88px]' : 'w-60'
        }`}
      >
        <button
          type="button"
          onClick={() => setIsSidebarCollapsed((current) => !current)}
          className={`absolute top-5 z-10 rounded-md p-1.5 text-white/35 transition-colors hover:bg-white/10 hover:text-white/75 ${
            isSidebarCollapsed ? 'right-2.5' : 'right-3'
          }`}
          aria-label={isSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          title={isSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isSidebarCollapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m9 5 7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m15 19-7-7 7-7" />
            )}
          </svg>
        </button>

        {/* Logo */}
        <div
          className={`flex h-16 shrink-0 items-center border-b border-white/10 ${
            isSidebarCollapsed ? 'justify-center px-3' : 'px-5'
          }`}
        >
          <Link href="/dashboard" className="flex items-center">
            {isSidebarCollapsed ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-bold tracking-[0.12em] text-white">
                CC
              </span>
            ) : (
              <img
                src="/calibrate-commerce-logo.svg"
                alt="Calibrate Commerce"
                className="h-6 w-auto"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            )}
          </Link>
        </div>

        {/* Nav */}
        <nav className={`flex-1 py-4 ${isSidebarCollapsed ? 'px-2' : 'px-3'}`}>
          {isSidebarCollapsed ? null : (
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-white/30">
              Main menu
            </p>
          )}
          <div className="space-y-0.5">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                title={isSidebarCollapsed ? label : undefined}
                className={`group flex items-center rounded-lg text-sm font-medium transition-colors ${
                  isSidebarCollapsed ? 'justify-center px-3 py-3' : 'gap-3 px-3 py-2'
                } ${
                  isActive
                    ? 'bg-[#DA304F]/20 text-white'
                    : 'text-white/55 hover:bg-white/5 hover:text-white/85'
                }`}
              >
                <span className={`shrink-0 transition-colors ${isActive ? 'text-[#E98395]' : 'text-white/40 group-hover:text-white/60'}`}>
                  <Icon className="h-4 w-4" />
                </span>
                {isSidebarCollapsed ? <span className="sr-only">{label}</span> : <span className="flex-1">{label}</span>}
                {!isSidebarCollapsed && isActive && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#DA304F]" />
                )}
              </Link>
            );
          })}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 p-4">
          {isSidebarCollapsed ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#DA304F] text-xs font-bold text-white">
                {user.email.charAt(0).toUpperCase()}
              </div>
              <button
                onClick={signOut}
                className="shrink-0 rounded-md p-1 text-white/30 transition-colors hover:bg-white/10 hover:text-white/70"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOutIcon className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#DA304F] text-xs font-bold text-white">
                {user.email.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-white/70">{user.email}</p>
                <p className="text-[11px] text-white/30">Admin</p>
              </div>
              <button
                onClick={signOut}
                className="shrink-0 rounded-md p-1 text-white/30 transition-colors hover:bg-white/10 hover:text-white/70"
                title="Sign out"
              >
                <LogOutIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div
        className={`flex flex-1 flex-col transition-all duration-200 ease-out ${
          isSidebarCollapsed ? 'pl-[88px]' : 'pl-60'
        }`}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-[#E8EAF0] bg-white/80 backdrop-blur-sm">
          <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="text-sm font-medium text-[#9CA3AF]">
              {activeNavItem.label}
            </div>
            <Link
              href="/dashboard/audits/new"
              className="inline-flex items-center gap-1.5 rounded-pill bg-gradient-cta px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition-opacity hover:opacity-90"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New audit
            </Link>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1280px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

/* ── Inline icons ─────────────────────────────────────────── */

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={1.5} />
      <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={1.5} />
      <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={1.5} />
      <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth={1.5} />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8" strokeWidth={1.5} />
      <path strokeLinecap="round" strokeWidth={1.5} d="m21 21-4.35-4.35" />
    </svg>
  );
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}
