'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

interface HelpSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function HelpSearch({
  value,
  onChange,
  placeholder = 'Search help articles…',
  autoFocus = false,
}: HelpSearchProps) {
  const [internal, setInternal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes (e.g. clear from parent)
  useEffect(() => {
    setInternal(value);
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setInternal(v);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onChange(v), 200);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    setInternal('');
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="relative flex items-center">
      <Search className="pointer-events-none absolute left-3 h-4 w-4 text-zinc-500" />
      <input
        ref={inputRef}
        type="text"
        value={internal}
        onChange={handleChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 pl-9 pr-9 text-sm text-zinc-200 placeholder-zinc-500 transition-colors focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      />
      {internal && (
        <button
          onClick={handleClear}
          className="absolute right-3 flex h-4 w-4 items-center justify-center rounded text-zinc-500 transition-colors hover:text-zinc-300"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
