'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  Settings,
  FileText,
  ChevronLeft,
  Bot,
  Eye,
  Activity,
  Wrench,
  FlaskConical,
  CreditCard,
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';

const NAV_ITEMS = [
  { href: '/workspaces', icon: LayoutGrid, label: 'Workspaces' },
] as const;

const BOTTOM_ITEMS = [
  { href: '/billing', icon: CreditCard, label: 'Billing' },
  { href: '/settings', icon: Settings, label: 'Settings' },
] as const;

function getProjectItems(wId: string, pId: string) {
  const base = `/workspaces/${wId}/projects/${pId}`;
  return [
    { href: `${base}/overview`, icon: LayoutGrid, label: 'Overview' },
    { href: `${base}/ai-search`, icon: Eye, label: 'AI Search' },
    { href: `${base}/analytics`, icon: Activity, label: 'Analytics' },
    { href: `${base}/technical`, icon: Wrench, label: 'Technical' },
    { href: `${base}/agents`, icon: Bot, label: 'Agents' },
    { href: `${base}/content`, icon: FileText, label: 'Content' },
    { href: `${base}/research`, icon: FlaskConical, label: 'Research' },
    { href: `${base}/settings`, icon: Settings, label: 'Settings' },
  ];
}

export function SideNav() {
  const pathname = usePathname();
  const projectMatch = pathname.match(/\/workspaces\/([^/]+)\/projects\/([^/]+)/);
  const projectItems = projectMatch ? getProjectItems(projectMatch[1], projectMatch[2]) : [];

  return (
    <aside className="group fixed left-0 top-topbar z-40 flex h-[calc(100vh-48px)] w-sidenav flex-col border-r border-zinc-800 bg-sidebar transition-[width] duration-200 hover:w-sidenav-expanded">
      <nav className="flex flex-1 flex-col gap-1 px-2 pt-3">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex h-10 items-center gap-3 rounded-md px-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {label}
              </span>
            </Link>
          );
        })}

        {projectItems.length > 0 && (
          <>
            <Link
              href={`/workspaces/${projectMatch![1]}/projects`}
              className="mt-2 flex h-8 items-center gap-3 rounded-md px-2 text-[11px] font-medium text-zinc-600 transition-colors hover:text-zinc-400"
            >
              <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                Back to Projects
              </span>
            </Link>
            <div className="my-1 border-t border-zinc-800/60" />
            {projectItems.map(({ href, icon: Icon, label }) => {
              const isActive = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex h-10 items-center gap-3 rounded-md px-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300',
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="truncate opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    {label}
                  </span>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="flex flex-col gap-1 border-t border-zinc-800 px-2 py-3">
        {BOTTOM_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex h-10 items-center gap-3 rounded-md px-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
