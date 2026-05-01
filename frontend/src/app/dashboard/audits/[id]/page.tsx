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
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-[#DA304F]">{error}</p>
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-[#9CA3AF]">Loading audit data...</p>
      </div>
    );
  }

  return <AuditResults audit={audit} />;
}
