'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Command,
  X,
  Search,
  Settings,
  LayoutGrid,
  ArrowRight,
  Zap,
  FileText,
  Network,
  BarChart3,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: typeof Command;
  action: () => void;
  category: 'page' | 'action';
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const pathname = usePathname();

  const navigate = useCallback(
    (path: string) => {
      router.push(path);
      onClose();
    },
    [router, onClose],
  );

  const projectMatch = pathname.match(/\/workspaces\/([^/]+)\/projects\/([^/]+)/);

  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      { id: 'workspaces', label: 'Workspaces', description: 'View all workspaces', icon: LayoutGrid, action: () => navigate('/workspaces'), category: 'page' },
      { id: 'settings', label: 'Settings', description: 'Account & organization settings', icon: Settings, action: () => navigate('/settings'), category: 'page' },
    ];

    if (projectMatch) {
      const base = `/workspaces/${projectMatch[1]}/projects/${projectMatch[2]}`;
      items.push(
        { id: 'workflows', label: 'Workflows', description: 'Workflow runs for this project', icon: Zap, action: () => navigate(`${base}/workflows`), category: 'page' },
        { id: 'keywords', label: 'Keywords', description: 'Keyword ledger for this project', icon: Search, action: () => navigate(`${base}/keywords`), category: 'page' },
        { id: 'content', label: 'Content', description: 'Content briefs & articles', icon: FileText, action: () => navigate(`${base}/content`), category: 'page' },
        { id: 'topical-map', label: 'Topical Map', description: 'Topical map for this project', icon: Network, action: () => navigate(`${base}/topical-map`), category: 'page' },
        { id: 'reports', label: 'Reports', description: 'Reports for this project', icon: BarChart3, action: () => navigate(`${base}/reports`), category: 'page' },
      );
    }

    return items;
  }, [navigate, projectMatch?.[1], projectMatch?.[2]]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q),
    );
  }, [query, commands]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length]);

  // Reset query when opening
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filtered.length);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
      }
      if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault();
        filtered[selectedIndex]?.action();
      }
    },
    [onClose, filtered, selectedIndex],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  const pages = filtered.filter((c) => c.category === 'page');
  const actions = filtered.filter((c) => c.category === 'action');
  let runningIndex = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4">
          <Command className="h-4 w-4 text-zinc-500" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, pages, workflows…"
            className="h-12 flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
          <kbd className="hidden rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400 sm:inline">
            ESC
          </kbd>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              No results found
            </div>
          ) : (
            <>
              {pages.length > 0 && (
                <div>
                  <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Pages
                  </p>
                  {pages.map((cmd) => {
                    const idx = runningIndex++;
                    const Icon = cmd.icon;
                    return (
                      <button
                        key={cmd.id}
                        onClick={cmd.action}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`flex w-full items-center gap-3 px-4 py-2 text-left transition ${
                          selectedIndex === idx
                            ? 'bg-zinc-800 text-white'
                            : 'text-zinc-300 hover:bg-zinc-800/50'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-zinc-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{cmd.label}</p>
                          {cmd.description && (
                            <p className="truncate text-xs text-zinc-500">{cmd.description}</p>
                          )}
                        </div>
                        <ArrowRight className="h-3 w-3 shrink-0 text-zinc-600" />
                      </button>
                    );
                  })}
                </div>
              )}

              {actions.length > 0 && (
                <div>
                  <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Actions
                  </p>
                  {actions.map((cmd) => {
                    const idx = runningIndex++;
                    const Icon = cmd.icon;
                    return (
                      <button
                        key={cmd.id}
                        onClick={cmd.action}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`flex w-full items-center gap-3 px-4 py-2 text-left transition ${
                          selectedIndex === idx
                            ? 'bg-zinc-800 text-white'
                            : 'text-zinc-300 hover:bg-zinc-800/50'
                        }`}
                      >
                        <Icon className="h-3 w-3 shrink-0 text-rose-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{cmd.label}</p>
                        </div>
                        <ArrowRight className="h-3 w-3 shrink-0 text-zinc-600" />
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-2">
          <div className="flex gap-3 text-[10px] text-zinc-500">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
