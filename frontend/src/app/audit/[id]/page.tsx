'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AuditResults } from '@/features/audit/components/audit-results';
import { getAuditDetail, type AuditDetailResponse } from '@/features/audit/services/audit.service';

export default function AuditDetailPage() {
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
      <div className="flex min-h-screen items-center justify-center p-8">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <p className="text-muted-foreground">Loading audit data...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <AuditResults audit={audit} />
    </div>
  );
}
