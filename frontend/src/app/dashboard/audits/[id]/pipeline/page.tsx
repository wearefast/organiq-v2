'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AuditPipeline } from '@/features/audit/components/audit-pipeline';
import { useAuditPolling } from '@/features/audit/hooks/use-audit-polling';

export default function DashboardAuditPipelinePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { progress, status } = useAuditPolling(id ?? null);

  useEffect(() => {
    if (status === 'complete' && id) {
      router.push(`/dashboard/audits/${id}`);
    }
  }, [status, id, router]);

  if (status === 'failed') {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="rounded-xl border border-[#FECDD3] bg-[#FFF1F2] p-8 text-center">
          <h2 className="text-lg font-bold text-[#111827]">Audit could not be completed</h2>
          <p className="mt-2 text-sm text-[#4B5563]">
            The audit encountered an error during processing.
          </p>
          <button
            onClick={() => router.push('/dashboard/audits')}
            className="mt-4 inline-flex items-center rounded-[10px] bg-[#DA304F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#C02844]"
          >
            Back to audits
          </button>
        </div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-[#9CA3AF]">Connecting to audit pipeline...</p>
      </div>
    );
  }

  return (
    <div className="-mx-8 -my-8 flex min-h-[calc(100vh-3.5rem)] flex-col bg-[#04111f]">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-4">
        <div className="min-h-0 flex-1">
          <AuditPipeline
            currentStep={progress.currentStep}
            progress={progress.progress}
            message={progress.message}
            completedSteps={progress.completedSteps}
          />
        </div>
      </div>
    </div>
  );
}
