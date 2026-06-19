'use client';

/**
 * TourProgress — Floating bottom-right badge showing tour completion status.
 *
 * - Shows only while tour is active (not dismissed, not all sections done).
 * - Displays "Tour · X / N" with a small ring progress indicator.
 * - Expand to see a checklist of all sections.
 * - "Skip tour" and "Restart" actions.
 */

import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, RotateCcw, X } from 'lucide-react';
import { useTour } from './TourProvider';
import { TOUR_SECTIONS } from './tour.config';

export function TourProgress() {
  const { isActive, completedSections, totalSections, startTour, dismissTour } =
    useTour();
  const [expanded, setExpanded] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  // Show a "Tour complete!" flash for 3 s when all sections are finished
  useEffect(() => {
    if (!isActive) return;
    if (completedSections.size >= totalSections && totalSections > 0) {
      setJustCompleted(true);
      const t = setTimeout(() => setJustCompleted(false), 3000);
      return () => clearTimeout(t);
    }
  }, [isActive, completedSections.size, totalSections]);

  if (!isActive) return null;

  // Show completion toast while justCompleted is true
  if (justCompleted) {
    return (
      <div className="fixed bottom-5 right-5 z-[9999] flex items-center gap-2 rounded-full border border-emerald-600 bg-zinc-900 py-2 pl-3 pr-4 shadow-lg">
        <span className="text-emerald-400">&#10003;</span>
        <span className="text-xs font-medium text-zinc-200">Tour complete!</span>
      </div>
    );
  }

  const doneCount = completedSections.size;
  const allDone = doneCount >= totalSections;

  // Hide automatically when every section is done (and toast has cleared)
  if (allDone) return null;

  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const progress = totalSections > 0 ? doneCount / totalSections : 0;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col items-end gap-2">
      {/* Expanded checklist */}
      {expanded && (
        <div className="w-56 rounded-xl border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Product Tour
          </p>
          <ul className="space-y-1">
            {TOUR_SECTIONS.map((section) => {
              const done = completedSections.has(section.key);
              return (
                <li
                  key={section.key}
                  className="flex items-center gap-2 text-xs"
                >
                  <span
                    className={
                      done
                        ? 'text-emerald-400'
                        : 'text-zinc-600'
                    }
                  >
                    {done ? '✓' : '○'}
                  </span>
                  <span className={done ? 'text-zinc-400' : 'text-zinc-300'}>
                    {section.label}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-center gap-2 border-t border-zinc-800 pt-3">
            <button
              onClick={startTour}
              className="flex flex-1 items-center justify-center gap-1 rounded-md border border-zinc-700 py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
            >
              <RotateCcw className="h-3 w-3" />
              Restart
            </button>
            <button
              onClick={dismissTour}
              className="flex flex-1 items-center justify-center gap-1 rounded-md border border-zinc-700 py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-red-700 hover:text-red-400"
            >
              <X className="h-3 w-3" />
              Skip tour
            </button>
          </div>
        </div>
      )}

      {/* Badge pill */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 py-1.5 pl-2.5 pr-3 shadow-lg transition-colors hover:border-zinc-500"
      >
        {/* SVG progress ring */}
        <svg width="36" height="36" className="-rotate-90">
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke="#3f3f46"
            strokeWidth="3"
          />
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke="#6366f1"
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.4s ease' }}
          />
        </svg>
        <span className="text-xs font-medium text-zinc-300">
          Tour&nbsp;·&nbsp;{doneCount}&nbsp;/&nbsp;{totalSections}
        </span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 text-zinc-500" />
        )}
      </button>
    </div>
  );
}
