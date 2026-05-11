import { cn } from '@/shared/utils/cn';

type StatusVariant =
  | 'live'
  | 'complete'
  | 'strategy'
  | 'processing'
  | 'pending'
  | 'failed'
  | 'neutral'
  | 'overdue'
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'converted'
  | 'lost'
  | 'brief'
  | 'draft'
  | 'review'
  | 'approved'
  | 'published'
  | 'running'
  | 'rejected'
  | 'awaiting_approval'
  | 'awaiting_review'
  | 'completed'
  | 'in_progress'
  | 'revision_requested';

const VARIANT_STYLES: Record<StatusVariant, string> = {
  live: 'status-live',
  complete: 'status-complete',
  completed: 'status-complete',
  strategy: 'status-strategy',
  processing: 'status-progress',
  running: 'status-progress',
  in_progress: 'status-progress',
  pending: 'status-pending',
  failed: 'status-overdue',
  neutral: 'status-lost',
  overdue: 'status-overdue',
  new: 'status-new',
  contacted: 'status-contacted',
  qualified: 'status-qualified',
  converted: 'status-converted',
  lost: 'status-lost',
  brief: 'status-brief',
  draft: 'status-draft',
  review: 'status-review',
  approved: 'status-approved',
  published: 'status-published',
  rejected: 'status-overdue',
  awaiting_approval: 'status-pending',
  awaiting_review: 'status-pending',
  revision_requested: 'status-review',
};

const LABELS: Partial<Record<StatusVariant, string>> = {
  awaiting_approval: 'Awaiting review',
  awaiting_review: 'Awaiting review',
  revision_requested: 'Revision requested',
  in_progress: 'In progress',
  live: 'Live',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
  pulse?: boolean;
}

export function StatusBadge({ status, className, pulse }: StatusBadgeProps) {
  const key = status.toLowerCase().replace(/ /g, '_') as StatusVariant;
  const styles = VARIANT_STYLES[key] ?? 'status-neutral';
  const label = LABELS[key] ?? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, ' ');

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap',
        styles,
        className,
      )}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
        </span>
      )}
      {label}
    </span>
  );
}
