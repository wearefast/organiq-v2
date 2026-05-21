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
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';

// ─── Types ────────────────────────────────────────────────────

interface NavChild {
  href: string;
  label: string;
}

interface NavItem {
  /** Where the icon/parent link navigates to (first child if has children). */
  href: string;
  icon: LucideIcon;
  label: string;
  /** Sub-items. When present, active state derives from children matches. */
  children?: NavChild[];
}

// ─── Top-level nav ────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { href: '/workspaces', icon: LayoutGrid, label: 'Workspaces' },
];

const BOTTOM_ITEMS: NavItem[] = [
  { href: '/billing', icon: CreditCard, label: 'Billing' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

// ─── Project nav ──────────────────────────────────────────────
//
// Architecture mapping:
//   Overview   — project dashboard
//   Workflow   — 18-step strategy pipeline runs
//   AI Search  — prompt visibility + LLM traffic  (sub-nav)
//   Analytics  — GSC keyword/page performance
//   Technical  — LLM crawlability audit           (sub-nav)
//   Agents     — on-demand chat + scheduled runs   (sub-nav)
//   Content    — generated content pieces
//   Research   — keywords, decay alerts, topical map (sub-nav)
//   Settings   — project settings

function getProjectItems(wId: string, pId: string): NavItem[] {
  const base = `/workspaces/${wId}/projects/${pId}`;
  return [
    {
      href: `${base}/overview`,
      icon: LayoutGrid,
      label: 'Overview',
    },
    {
      href: `${base}/workflows`,
      icon: Workflow,
      label: 'Workflow',
    },
    {
      href: `${base}/ai-search/visibility`,
      icon: Eye,
      label: 'AI Search',
      children: [
        { href: `${base}/ai-search/visibility`, label: 'Prompt Visibility' },
        { href: `${base}/ai-search/traffic`,    label: 'LLM Traffic' },
      ],
    },
    {
      href: `${base}/analytics`,
      icon: Activity,
      label: 'Analytics',
    },
    {
      href: `${base}/technical/llm-audit`,
      icon: Wrench,
      label: 'Technical',
      children: [
        { href: `${base}/technical/llm-audit`, label: 'LLM Audit' },
      ],
    },
    {
      href: `${base}/agents`,
      icon: Bot,
      label: 'Agents',
      children: [
        { href: `${base}/agents`,           label: 'Chat' },
        { href: `${base}/agents/scheduled`, label: 'Scheduled' },
      ],
    },
    {
      href: `${base}/content`,
      icon: FileText,
      label: 'Content',
    },
    {
      href: `${base}/keywords`,
      icon: FlaskConical,
      label: 'Research',
      children: [
        { href: `${base}/keywords`,         label: 'Keywords' },
        { href: `${base}/keywords/decay`,   label: 'Decay Alerts' },
        { href: `${base}/topical-map`,      label: 'Topical Map' },
      ],
    },
    {
      href: `${base}/settings`,
      icon: Settings,
      label: 'Settings',
    },
  ];
}

// ─── Helper: is any href in list active for current path ──────

function isAnyActive(hrefs: string[], pathname: string): boolean {
  return hrefs.some((h) => pathname.startsWith(h));
}

// ─── NavLink component ────────────────────────────────────────

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const childHrefs = item.children?.map((c) => c.href) ?? [];
  // Parent is active when on its own path OR any child's path
  const isActive =
    isAnyActive(childHrefs, pathname) || pathname.startsWith(item.href);

  return (
    <div>
      <Link
        href={item.href}
        className={cn(
          'flex h-10 items-center gap-3 rounded-md px-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-zinc-800 text-zinc-100'
            : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300',
        )}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        <span className="truncate opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          {item.label}
        </span>
      </Link>

      {/* Sub-items: always in DOM so CSS hover can reveal them; CSS hides when sidebar is collapsed */}
      {item.children && (
        <div className="hidden group-hover:block">
          {item.children.map((child) => {
            const childActive = pathname.startsWith(child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  'flex h-8 items-center rounded-md pl-10 pr-2 text-[12px] font-medium transition-colors',
                  childActive
                    ? 'text-zinc-100'
                    : 'text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300',
                )}
              >
                <span className="truncate">{child.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SideNav ──────────────────────────────────────────────────

export function SideNav() {
  const pathname = usePathname();
  const projectMatch = pathname.match(/\/workspaces\/([^/]+)\/projects\/([^/]+)/);
  const projectItems = projectMatch ? getProjectItems(projectMatch[1], projectMatch[2]) : [];

  return (
    <aside className="group fixed left-0 top-topbar z-40 flex h-[calc(100vh-48px)] w-sidenav flex-col border-r border-zinc-800 bg-sidebar transition-[width] duration-200 hover:w-sidenav-expanded">
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pt-3">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

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
            {projectItems.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </>
        )}
      </nav>

      <div className="flex flex-col gap-1 border-t border-zinc-800 px-2 py-3">
        {BOTTOM_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </div>
    </aside>
  );
}
