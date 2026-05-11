import { cn } from '@/shared/utils/cn';

const TONES = [
  {
    backgroundColor: 'color-mix(in srgb, var(--cc-red) 16%, white)',
    borderColor: 'color-mix(in srgb, var(--cc-red) 28%, white)',
    color: 'var(--cc-red-dark)',
  },
  {
    backgroundColor: 'color-mix(in srgb, var(--cc-navy) 12%, white)',
    borderColor: 'color-mix(in srgb, var(--cc-navy) 22%, white)',
    color: 'var(--cc-navy)',
  },
  {
    backgroundColor: 'color-mix(in srgb, var(--cc-accent-mid) 18%, white)',
    borderColor: 'color-mix(in srgb, var(--cc-accent-mid) 30%, white)',
    color: 'var(--cc-red-dark)',
  },
  {
    backgroundColor: 'color-mix(in srgb, var(--cc-navy-light) 16%, white)',
    borderColor: 'color-mix(in srgb, var(--cc-navy-light) 28%, white)',
    color: 'var(--cc-navy)',
  },
  {
    backgroundColor: 'color-mix(in srgb, var(--text-primary) 8%, white)',
    borderColor: 'color-mix(in srgb, var(--text-primary) 16%, white)',
    color: 'var(--text-primary)',
  },
  {
    backgroundColor: 'color-mix(in srgb, var(--cc-red-dark) 14%, white)',
    borderColor: 'color-mix(in srgb, var(--cc-red-dark) 26%, white)',
    color: 'var(--cc-red-dark)',
  },
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (name[0] ?? '?').toUpperCase();
}

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  const initials = getInitials(name);
  const tone = TONES[hashName(name) % TONES.length];

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border font-bold',
        SIZE_CLASSES[size],
        className,
      )}
      style={tone}
      title={name}
    >
      {initials}
    </div>
  );
}
