'use client';

import { useState, useRef, useEffect } from 'react';
import { LANGUAGES, type Language } from '../utils/countries';

interface LanguageSelectProps {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
}

export function LanguageSelect({ value, onChange, placeholder = 'Select language' }: LanguageSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = LANGUAGES.find((l) => l.code === value.toLowerCase());

  const filtered = search
    ? LANGUAGES.filter(
        (l) =>
          l.name.toLowerCase().includes(search.toLowerCase()) ||
          l.code.toLowerCase().includes(search.toLowerCase()),
      )
    : LANGUAGES;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  function handleSelect(l: Language) {
    onChange(l.code);
    setOpen(false);
    setSearch('');
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-11 w-full items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-left text-sm outline-none transition-colors focus:border-rose-500"
      >
        {selected ? (
          <span className="truncate text-zinc-100">{selected.name}</span>
        ) : (
          <span className="text-zinc-500">{placeholder}</span>
        )}
        <svg className="ml-auto h-4 w-4 shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-zinc-700 bg-zinc-900 shadow-xl">
          <div className="border-b border-zinc-800 p-2">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search languages..."
              className="h-8 w-full rounded border border-zinc-700 bg-zinc-800 px-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-rose-500"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length > 0 ? (
              filtered.map((l) => (
                <li key={l.code}>
                  <button
                    type="button"
                    onClick={() => handleSelect(l)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-800 ${l.code === value.toLowerCase() ? 'bg-zinc-800/60 text-zinc-100' : 'text-zinc-300'}`}
                  >
                    <span className="truncate">{l.name}</span>
                    <span className="ml-auto text-[10px] uppercase text-zinc-600">{l.code}</span>
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-4 text-center text-sm text-zinc-500">No languages found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
