'use client';

import { AuditList } from '@/features/audit/components/audit-list';

export default function AuditsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] font-bold text-[#111827]">Audits</h1>
        <p className="mt-1 text-sm text-[#9CA3AF]">Track all audit reports and their status.</p>
      </div>
      <AuditList />
    </div>
  );
}
