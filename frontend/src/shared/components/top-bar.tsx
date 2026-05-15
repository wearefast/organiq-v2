'use client';

import { UserButton } from '@clerk/nextjs';
import { Command, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/shared/hooks/use-theme';

interface TopBarProps {
  onCommandPalette?: () => void;
}

export function TopBar({ onCommandPalette }: TopBarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="fixed top-0 z-50 flex h-topbar w-full items-center border-b border-zinc-800 bg-shell px-4">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600 text-xs font-bold text-white">
          O
        </span>
        <span className="text-sm font-semibold text-zinc-100">ORGANIQ</span>
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

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="mr-3 flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
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
