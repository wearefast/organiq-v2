'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

const LABEL_MAP: Record<string, string> = {
  dashboard: 'Dashboard',
  audits: 'Audits',
  keywords: 'Keywords',
  content: 'Content',
  leads: 'Leads',
  new: 'New',
  pipeline: 'Pipeline',
  workflows: 'Workflows',
  overview: 'Overview',
  'ai-search': 'AI Search',
  analytics: 'Analytics',
  technical: 'Technical',
  agents: 'Agents',
  research: 'Research',
  settings: 'Settings',
  'scheduled-workflows': 'Scheduled Workflows',
};

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatSegmentLabel(segment: string, previousSegment?: string, isLast?: boolean) {
  if (LABEL_MAP[segment]) {
    return LABEL_MAP[segment];
  }

  const decoded = decodeURIComponent(segment);

  if (!UUID_SEGMENT.test(decoded)) {
    return decoded;
  }

  switch (previousSegment) {
    case 'audits':
      return 'Audit';
    case 'keywords':
      return 'Project';
    case 'workflows':
      return isLast ? 'Current run' : 'Run';
    default:
      return 'Detail';
  }
}

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbs = segments.map((segment, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/');
    const isLast = i === segments.length - 1;
    const label = formatSegmentLabel(segment, segments[i - 1], isLast);
    return { href, label, isLast };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      {crumbs.map(({ href, label, isLast }, i) => (
        <span key={href} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-[var(--border)]" />}
          {isLast ? (
            <span className="font-medium text-[var(--text-primary)]">{label}</span>
          ) : (
            <Link href={href} className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-body)]">
              {label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
