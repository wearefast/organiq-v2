'use client';

/**
 * TourProvider — Guided first-time user tour orchestrator.
 *
 * Behaviour:
 * - Auto-starts for brand-new users who land on /workspaces with 0 workspaces.
 * - Watches pathname changes; when a tour section matches the current page and
 *   hasn't been completed yet, waits 600ms for DOM to settle then runs Driver.js.
 * - Marks each section complete in localStorage on Driver.js destroy.
 * - Exposes useTour() context for TourProgress and TopBar restart.
 *
 * Storage keys (all in localStorage):
 *   pulse_tour_active              — 'true' | 'false'
 *   pulse_tour_completed_sections  — JSON string of string[]
 *   pulse_tour_dismissed           — 'true'
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { driver as createDriver, type Config as DriverConfig } from 'driver.js';
import {
  TOUR_SECTIONS,
  TOUR_STORAGE_KEYS,
  type TourSection,
} from './tour.config';

// ─── Context ─────────────────────────────────────────────────────────────────

interface TourContextValue {
  /** Whether the tour is currently active (not dismissed, not completed). */
  isActive: boolean;
  /** Section keys the user has already seen. */
  completedSections: Set<string>;
  /** Total number of tour sections. */
  totalSections: number;
  /** Start (or restart) the tour from the beginning. */
  startTour: () => void;
  /** Permanently dismiss the tour. */
  dismissTour: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

// ─── No-op fallback (for isolated renders outside TourProvider) ───────────────

const NO_OP_TOUR: TourContextValue = {
  isActive: false,
  completedSections: new Set<string>(),
  totalSections: 0,
  startTour: () => {},
  dismissTour: () => {},
};

export function useTour(): TourContextValue {
  return useContext(TourContext) ?? NO_OP_TOUR;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

function getCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(TOUR_STORAGE_KEYS.completed);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveCompleted(sections: Set<string>): void {
  localStorage.setItem(
    TOUR_STORAGE_KEYS.completed,
    JSON.stringify([...sections]),
  );
}

function isActive(): boolean {
  return localStorage.getItem(TOUR_STORAGE_KEYS.active) === 'true';
}

function isDismissed(): boolean {
  return localStorage.getItem(TOUR_STORAGE_KEYS.dismissed) === 'true';
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const driverRef = useRef<ReturnType<typeof createDriver> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Initialise from localStorage on mount ────────────────────────────────
  useEffect(() => {
    if (isDismissed()) return;
    const completedSections = getCompleted();
    setCompleted(completedSections);
    if (isActive()) setActive(true);
  }, []);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      driverRef.current?.destroy();
    };
  }, []);

  // ── Mark a section complete ──────────────────────────────────────────────
  const markComplete = useCallback((key: string) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      next.add(key);
      saveCompleted(next);
      return next;
    });
  }, []);

  // ── Run Driver.js for a given section ────────────────────────────────────
  const runSection = useCallback(
    (section: TourSection) => {
      // Destroy any currently running driver first
      driverRef.current?.destroy();

      const config: DriverConfig = {
        animate: true,
        showProgress: false,
        allowClose: true,
        overlayOpacity: 0.5,
        stagePadding: 6,
        stageRadius: 8,
        popoverClass: 'pulse-tour-popover',
        nextBtnText: 'Next →',
        prevBtnText: '← Back',
        doneBtnText: 'Got it ✓',
        onDestroyed: () => {
          markComplete(section.key);
        },
        steps: section.steps.map((step) => ({
          ...(step.element ? { element: step.element } : {}),
          popover: step.popover,
        })),
      };

      const d = createDriver(config);
      driverRef.current = d;
      d.drive();
    },
    [markComplete],
  );

  // ── Watch pathname, trigger matching section ──────────────────────────────
  useEffect(() => {
    if (!active) return;
    if (isDismissed()) return;

    // Clear any pending timer from the previous navigation
    if (timerRef.current) clearTimeout(timerRef.current);

    const section = TOUR_SECTIONS.find((s) => s.matchPath(pathname));
    if (!section) return;

    // Use React state as source of truth — avoids stale localStorage reads
    if (completed.has(section.key)) return;

    // Wait for DOM to settle after navigation
    timerRef.current = setTimeout(() => {
      runSection(section);
    }, 600);
  }, [pathname, active, completed, runSection]);

  // ── Auto-start: fire on /workspaces when no prior tour state ─────────────
  // This is called by TourAutoStarter (a child that has access to workspace count).
  const startTour = useCallback(() => {
    if (isDismissed()) {
      // Allow restart even after dismiss — clear dismissed flag
      localStorage.removeItem(TOUR_STORAGE_KEYS.dismissed);
    }
    localStorage.setItem(TOUR_STORAGE_KEYS.active, 'true');
    localStorage.removeItem(TOUR_STORAGE_KEYS.completed);
    setCompleted(new Set());
    setActive(true);
    // Navigate to the beginning of the tour regardless of current page
    router.push('/workspaces');
  }, [router]);

  const dismissTour = useCallback(() => {
    driverRef.current?.destroy();
    localStorage.setItem(TOUR_STORAGE_KEYS.dismissed, 'true');
    localStorage.removeItem(TOUR_STORAGE_KEYS.active);
    setActive(false);
  }, []);

  const value: TourContextValue = {
    isActive: active,
    completedSections: completed,
    totalSections: TOUR_SECTIONS.length,
    startTour,
    dismissTour,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

// ─── Auto-starter: mounts on /workspaces, checks workspace count ─────────────

/**
 * Drop this inside TourProvider wherever you need auto-start logic.
 * It checks if the user has never seen the tour AND has no workspaces,
 * and if so calls startTour().
 */
export function TourAutoStarter({
  workspaceCount,
}: {
  workspaceCount: number | null;
}) {
  const { isActive, startTour } = useTour();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    if (isActive) return; // already running
    if (isDismissed()) return;
    if (localStorage.getItem(TOUR_STORAGE_KEYS.active) !== null) return; // was active before
    if (getCompleted().size > 0) return; // has completed some sections

    // Only auto-start if workspaceCount is 0 (brand new user)
    if (workspaceCount !== 0) return;

    hasRun.current = true;
    startTour();
  }, [workspaceCount, isActive, startTour]);

  return null;
}
