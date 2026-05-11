'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuditPipeline } from '@/features/audit/components/audit-pipeline';
import { useAuditPolling } from '@/features/audit/hooks/use-audit-polling';
import { ArrowLeft } from 'lucide-react';

export default function DashboardAuditPipelinePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { progress, status } = useAuditPolling(id ?? null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status === 'polling') {
      const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [status]);

  useEffect(() => {
    if (status === 'complete' && id) {
      router.push(`/dashboard/audits/${id}`);
    }
  }, [status, id, router]);

  if (status === 'failed') {
    return (
      <div className="-mx-8 -my-8 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#04111f]">
        <div className="rounded-xl border border-[#FECDD3] bg-[#FFF1F2] p-8 text-center">
          <h2 className="text-lg font-bold text-[#111827]">Audit could not be completed</h2>
          <p className="mt-2 text-sm text-[#4B5563]">
            The audit encountered an error during processing.
          </p>
          <button
            onClick={() => router.push('/dashboard/audits')}
            className="mt-4 inline-flex items-center rounded-lg bg-[#DA304F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#C02844]"
          >
            Back to audits
          </button>
        </div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="-mx-8 -my-8 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#04111f]">
        <div className="flex items-center gap-3 text-white/50">
          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-medium">Connecting to audit pipeline...</span>
        </div>
      </div>
    );
  }

  const completedCount = progress.completedSteps?.length ?? 0;
  const elapsedMin = Math.floor(elapsed / 60);
  const elapsedSec = elapsed % 60;

  return (
    <div className="-mx-8 -my-8 flex min-h-[calc(100vh-3.5rem)] flex-col bg-[#04111f]">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-white/5 px-6 py-3">
        <Link
          href={`/dashboard/audits/${id}`}
          className="flex items-center gap-2 text-sm text-white/40 transition-colors hover:text-white/70"
        >
          <ArrowLeft className="h-4 w-4" />
          Exit
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-xs text-white/30">Live analysis</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-400" />
            </span>
            PROCESSING
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-4">
        <div className="min-h-0 flex-1">
          <AuditPipeline
            currentStep={progress.currentStep}
            progress={progress.progress}
            message={progress.message}
            completedSteps={progress.completedSteps}
          />
        </div>

        {/* Telemetry footer */}
        <div className="mt-4 flex items-center justify-center gap-8 rounded-lg border border-white/5 bg-white/[0.02] px-6 py-3">
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Elapsed</p>
            <p className="mt-0.5 font-mono text-sm font-bold text-white/70">
              {elapsedMin}m {String(elapsedSec).padStart(2, '0')}s
            </p>
          </div>
          <div className="h-6 w-px bg-white/10" />
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Steps complete</p>
            <p className="mt-0.5 font-mono text-sm font-bold text-white/70">{completedCount}/15</p>
          </div>
          <div className="h-6 w-px bg-white/10" />
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Phase</p>
            <p className="mt-0.5 text-sm font-medium text-white/70">{progress.message || 'Initializing...'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
