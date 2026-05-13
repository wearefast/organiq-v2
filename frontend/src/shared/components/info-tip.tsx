'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Hover tooltip rendered via portal — always on top regardless of overflow/transform ancestors.
 *
 * Usage:
 *   <InfoTip tip="Monthly search volume"><span>Volume</span></InfoTip>
 */
export function InfoTip({ tip, children }: { tip: string; children: React.ReactNode }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  function show() {
    if (ref.current) setRect(ref.current.getBoundingClientRect());
  }

  const tooltip = mounted && rect ? (
    <div
      className="pointer-events-none fixed z-[99999] max-w-[240px] rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-[11px] leading-snug text-zinc-200 shadow-xl"
      style={{
        left: rect.left + rect.width / 2,
        top: rect.top - 8,
        transform: 'translate(-50%, -100%)',
      }}
    >
      {tip}
      <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-[5px] border-transparent border-t-zinc-700" />
    </div>
  ) : null;

  return (
    <>
      <span
        ref={ref}
        className="cursor-help"
        onMouseEnter={show}
        onMouseLeave={() => setRect(null)}
      >
        {children}
      </span>
      {tooltip ? createPortal(tooltip, document.body) : null}
    </>
  );
}
