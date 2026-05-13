'use client';

import { useEffect, useCallback } from 'react';

interface ShortcutMap {
  [key: string]: (e: KeyboardEvent) => void;
}

/**
 * Register keyboard shortcuts for a component.
 * - Ignores shortcuts when user is typing in an input/textarea/select
 * - Supports modifier keys via prefixes: "ctrl+k", "meta+k", "shift+?"
 *
 * @param shortcuts - Map of key identifiers to handlers
 * @param enabled - Whether shortcuts are active (default: true)
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap, enabled = true) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger in form fields
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      // Build key identifier matching the shortcut map
      const parts: string[] = [];
      if (e.ctrlKey) parts.push('ctrl');
      if (e.metaKey) parts.push('meta');
      if (e.shiftKey) parts.push('shift');
      if (e.altKey) parts.push('alt');
      parts.push(e.key.toLowerCase());
      const combo = parts.join('+');

      // Try the full combo first, then just the key (for non-modifier shortcuts)
      const handler = shortcuts[combo] ?? (!e.ctrlKey && !e.metaKey && !e.altKey ? shortcuts[e.key.toLowerCase()] : undefined);
      if (handler) {
        handler(e);
      }
    },
    [shortcuts],
  );

  useEffect(() => {
    if (!enabled) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}
