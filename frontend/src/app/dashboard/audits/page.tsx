'use client';

import Link from 'next/link';
import { AuditList } from '@/features/audit/components/audit-list';
import { Plus } from 'lucide-react';

export default function AuditsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[32px] font-bold text-[#111827]">Audits</h1>
          <p className="mt-1 text-sm text-[#9CA3AF]">Track all audit reports and their status.</p>
        </div>
        <Link
          href="/dashboard/audits/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#111827] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1F2937]"
        >
          <Plus className="h-4 w-4" />
          New audit
        </Link>
      </div>
      <AuditList />
    </div>
  );
}
