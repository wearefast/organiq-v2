'use client';

import Image from 'next/image';
import Link from 'next/link';
import { UserButton, useOrganization } from '@clerk/nextjs';
import { Command, HelpCircle, MapPin } from 'lucide-react';
import { NotificationBell } from '@/shared/components/notification-bell';
import { useTour } from '@/features/tour';

interface TopBarProps {
  onCommandPalette?: () => void;
}

export function TopBar({ onCommandPalette }: TopBarProps) {
  const { organization } = useOrganization();
  const { startTour } = useTour();

  return (
    <header className="fixed top-0 z-50 flex h-topbar w-full items-center border-b border-zinc-800 bg-shell px-4">
      {/* Logo */}
      <div className="flex items-center">
        <Image src="/logo.png" alt="ORGANIQ" width={28} height={28} className="rounded-lg" />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Command palette trigger */}
      <button
        onClick={onCommandPalette}
        className="mr-3 flex h-8 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300"
      >
        <Command className="h-3 w-3" />
        <span>Search…</span>
        <kbd className="ml-2 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
          ⌘K
        </kbd>
      </button>

      {/* Notifications */}
      <NotificationBell organizationId={organization?.id} />

      {/* Help */}
      <Link
        href="/help"
        className="mr-3 flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        title="Help Center"
      >
        <HelpCircle className="h-4 w-4" />
      </Link>

      {/* Take a product tour */}
      <button
        onClick={startTour}
        className="mr-3 flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        title="Take a product tour"
      >
        <MapPin className="h-4 w-4" />
      </button>

      {/* User menu */}
      <UserButton
        appearance={{
          elements: {
            avatarBox: 'h-7 w-7',
          },
        }}
      />
    </header>
  );
}
