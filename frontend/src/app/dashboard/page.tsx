'use client';

import { useEffect, useState } from 'react';
import { StatsCards } from '@/features/dashboard';
import { listAudits } from '@/features/audit/services/audit.service';
import { listLeads } from '@/features/leads/services/leads.service';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalLeads: 0,
    auditsCompleted: 0,
    totalAudits: 0,
    avgSeoScore: null as number | null,
  });

  useEffect(() => {
    Promise.all([listAudits(), listLeads()]).then(([auditRes, leadRes]) => {
      const audits = auditRes.audits;
      const completed = audits.filter((a) => a.status === 'COMPLETE');
      const scores = completed.map((a) => a.seoScore).filter((s): s is number => s !== null);
      const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

      setStats({
        totalLeads: leadRes.leads.length,
        auditsCompleted: completed.length,
        totalAudits: audits.length,
        avgSeoScore: avg,
      });
    });
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[32px] font-bold text-[#111827]">Dashboard</h1>
        <p className="mt-1 text-sm text-[#9CA3AF]">Overview of your organic visibility pipeline.</p>
      </div>
      <StatsCards {...stats} />
    </div>
  );
}
