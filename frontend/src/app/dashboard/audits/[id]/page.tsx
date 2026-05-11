'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AuditResults } from '@/features/audit/components/audit-results';
import { getAuditDetail, type AuditDetailResponse } from '@/features/audit/services/audit.service';

export default function DashboardAuditDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [audit, setAudit] = useState<AuditDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getAuditDetail(id)
      .then(setAudit)
      .catch(() => setError('Failed to load audit.'));
  }, [id]);

  if (error) {
    return (
      <div className="rounded-xl border border-[#F3D0D0] bg-[#FFF6F6] p-6 shadow-sm">
        <p className="text-sm text-[#B42318]">{error}</p>
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex items-center gap-3 text-[#9CA3AF]">
          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-medium">Loading audit data...</span>
        </div>
      </div>
    );
  }

  return <AuditResults audit={audit} variant="dashboard" />;
}
