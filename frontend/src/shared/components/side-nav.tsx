'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Settings,
  FileText,
  ChevronLeft,
  Bot,
  Eye,
  Activity,
  FlaskConical,
  CreditCard,
  Workflow,
  Users,
  ShieldAlert,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { useBusinessProfileReady } from '@/features/projects/hooks/use-business-profile-ready';
import { useOrganization } from '@clerk/nextjs';
import { useUser } from '@clerk/nextjs';
import { useSuperAdmin } from '@/shared/hooks/use-super-admin';
import { WorkspaceDropdown } from './workspace-dropdown';
import { useTour, PROJECT_NAV_TOUR_SECTIONS } from '@/features/tour';

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

const NAV_ITEMS: NavItem[] = [];

// BOTTOM_ITEMS is now computed inside SideNav to support role-based visibility
const BOTTOM_ITEMS_BASE: NavItem[] = [
  { href: '/billing', icon: CreditCard, label: 'Billing' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

// ─── Project nav ──────────────────────────────────────────────
//
// Architecture mapping:
//   Overview   — project dashboard
//   Workflow   — 18-step strategy pipeline runs
//   AI Search  — prompt visibility + LLM traffic  (sub-nav)
//   Forum Intelligence — Reddit monitoring
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
      icon: Home,
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
        { href: `${base}/ai-search/visibility`,  label: 'Prompt Visibility' },
        { href: `${base}/ai-search/traffic`,     label: 'LLM Traffic' },
        { href: `${base}/ai-search/llm-audit`,   label: 'LLM Audit' },
      ],
    },
    {
      href: `${base}/forums`,
      icon: MessageCircle,
      label: 'Forum Intelligence',
    },
    {
      href: `${base}/analytics`,
      icon: Activity,
      label: 'Analytics',
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
      href: `${base}/content/topical-map`,
      icon: FileText,
      label: 'Content',
      children: [
        { href: `${base}/content/topical-map`, label: 'Topical Map' },
        { href: `${base}/content/brief`,        label: 'Brief' },
        { href: `${base}/content/articles`,    label: 'Articles' },
        { href: `${base}/content/assets`,      label: 'Assets' },
        { href: `${base}/content/calendar`,    label: 'Calendar' },
      ],
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

function NavLink({ item, pathname, disabled, tourDot }: { item: NavItem; pathname: string; disabled?: boolean; tourDot?: boolean }) {
  const childHrefs = item.children?.map((c) => c.href) ?? [];
  // Parent is active when on its own path OR any child's path
  const isActive =
    isAnyActive(childHrefs, pathname) || pathname.startsWith(item.href);

  if (disabled) {
    return (
      <div>
        <span
          className="flex h-10 cursor-not-allowed items-center gap-3 rounded-md px-2 text-sm font-medium text-zinc-700"
          title="Complete the business profile analysis first"
        >
          <item.icon className="h-5 w-5 shrink-0" />
          <span className="truncate opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            {item.label}
          </span>
        </span>
      </div>
    );

  }

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
        <span className="relative">
          <item.icon className="h-5 w-5 shrink-0" />
          {tourDot && (
            <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
            </span>
          )}
        </span>
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
// ─── Module-level constant: nav label → tour section keys it covers ─────────────
// Declared outside SideNav so it is not recreated on every render.
// Keys with multiple values (AI Search, Content, Research) cover their
// full sub-nav group; a dot appears if ANY key in the group is incomplete.
const LABEL_TO_TOUR_KEYS: Record<string, string[]> = {
  Overview:     ['project-overview'],
  Workflow:     ['workflow'],
  'AI Search':  ['prompt-visibility', 'llm-traffic', 'llm-audit'],
  Analytics:    ['analytics'],
  Agents:       ['agents'],
  Content:      ['content'],
  Research:     ['keywords', 'topical-map'],
};
// ─── SideNav ──────────────────────────────────────────────────

export function SideNav() {
  const pathname = usePathname();
  const projectMatch = pathname.match(/\/workspaces\/([^/]+)\/projects\/([^/]+)/);
  const projectItems = projectMatch ? getProjectItems(projectMatch[1], projectMatch[2]) : [];
  const profileReady = useBusinessProfileReady(projectMatch?.[2]);
  const { membership } = useOrganization();
  const { user } = useUser();
  const isAdmin = membership?.role === 'org:admin' || membership?.role === 'org:owner';
  // CVE-005: Use server-side admin check — never rely on NEXT_PUBLIC_SUPER_ADMIN_CLERK_IDS
  const superAdmin = useSuperAdmin();

  // Tour integration — show pulsing dot on unvisited project nav sections
  const { isActive: tourActive, completedSections: tourCompleted } = useTour();

  function hasTourDot(item: NavItem): boolean {
    if (!tourActive) return false;
    const keys = LABEL_TO_TOUR_KEYS[item.label];
    if (!keys) return false;
    // Show dot if ANY key for this group is unvisited and is a project-nav section
    return keys.some(
      (k) => PROJECT_NAV_TOUR_SECTIONS.has(k) && !tourCompleted.has(k),
    );
  }

  return (
    <aside className="group fixed left-0 top-topbar z-40 flex h-[calc(100vh-48px)] w-sidenav flex-col border-r border-zinc-800 bg-sidebar transition-[width] duration-200 hover:w-sidenav-expanded">
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pt-3">
        <WorkspaceDropdown />
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
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                disabled={!profileReady && !item.href.endsWith('/overview')}
                tourDot={hasTourDot(item)}
              />
            ))}
          </>
        )}
      </nav>

      <div className="flex flex-col gap-1 border-t border-zinc-800 px-2 py-3">
        {superAdmin && (
          <NavLink
            item={{ href: '/admin', icon: ShieldAlert, label: 'Platform Admin' }}
            pathname={pathname}
          />
        )}
        {BOTTOM_ITEMS_BASE.map((item) => (
          item.href === '/settings' ? (
            <div key={item.href}>
              {isAdmin && (
                <NavLink
                  item={{ href: '/settings/members', icon: Users, label: 'Members' }}
                  pathname={pathname}
                />
              )}
              <NavLink item={item} pathname={pathname} />
            </div>
          ) : (
            <NavLink key={item.href} item={item} pathname={pathname} />
          )
        ))}
      </div>
    </aside>
  );
}
