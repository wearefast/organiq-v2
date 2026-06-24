'use client';

import { useState, useCallback, useEffect } from 'react';
import { TopBar } from '@/shared/components/top-bar';
import { SideNav } from '@/shared/components/side-nav';
import { CommandPalette } from '@/shared/components/command-palette';
import { AuthSync } from '@/shared/components/auth-sync';
import { PageBreadcrumbs } from '@/shared/components/page-breadcrumbs';
import { ThemeProvider } from '@/shared/hooks/use-theme';
import { TourProvider, TourProgress } from '@/features/tour';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const openPalette = useCallback(() => setCommandPaletteOpen(true), []);
  const closePalette = useCallback(() => setCommandPaletteOpen(false), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <ThemeProvider>
      <TourProvider>
        <AuthSync />
        <TopBar onCommandPalette={openPalette} />
        <SideNav />
        <main className="ml-sidenav mt-topbar min-h-[calc(100vh-48px)] bg-content p-6">
          <PageBreadcrumbs />
          {children}
        </main>
        <CommandPalette open={commandPaletteOpen} onClose={closePalette} />
        <TourProgress />
      </TourProvider>
    </ThemeProvider>
  );
}
