'use client';

import { LeadsList } from '@/features/leads/components/leads-list';

export default function LeadsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] font-bold text-[#111827]">Leads</h1>
        <p className="mt-1 text-sm text-[#9CA3AF]">All captured leads from audit submissions.</p>
      </div>
      <LeadsList />
    </div>
  );
}
