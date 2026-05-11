'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  FolderKanban,
  Search,
  FileText,
  BarChart3,
  Coins,
  Settings,
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';

const NAV_ITEMS = [
  { href: '/workspaces', icon: LayoutGrid, label: 'Workspaces' },
  { href: '/projects', icon: FolderKanban, label: 'Projects' },
  { href: '/keywords', icon: Search, label: 'Keywords' },
  { href: '/content', icon: FileText, label: 'Content' },
  { href: '/reports', icon: BarChart3, label: 'Reports' },
  { href: '/credits', icon: Coins, label: 'Credits' },
] as const;

const BOTTOM_ITEMS = [
  { href: '/settings', icon: Settings, label: 'Settings' },
] as const;

export function SideNav() {
  const pathname = usePathname();

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
