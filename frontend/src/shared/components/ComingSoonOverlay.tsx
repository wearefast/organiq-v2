'use client';

import { ReactNode } from 'react';
import { Clock } from 'lucide-react';

interface ComingSoonOverlayProps {
  children: ReactNode;
  enabled?: boolean;
}

export function ComingSoonOverlay({ children, enabled = true }: ComingSoonOverlayProps) {
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="grayscale opacity-40 pointer-events-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-700 rounded-xl px-8 py-12 text-center">
          <div className="flex justify-center mb-4">
            <Clock className="w-12 h-12 text-zinc-400" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-100 mb-2">Coming Soon</h2>
          <p className="text-sm text-zinc-400">This feature is being developed and will be available shortly.</p>
        </div>
      </div>
    </div>
  );
}
