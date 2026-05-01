import { Card, CardHeader, CardTitle, CardContent } from '@/shared/components';

interface StatsCardsProps {
  totalLeads: number;
  auditsCompleted: number;
  totalAudits: number;
  avgSeoScore: number | null;
}

export function StatsCards({ totalLeads, auditsCompleted, totalAudits, avgSeoScore }: StatsCardsProps) {
  const stats = [
    { label: 'Total leads', value: totalLeads.toString() },
    { label: 'Audits completed', value: `${auditsCompleted} / ${totalAudits}` },
    { label: 'Total audits', value: totalAudits.toString() },
    { label: 'Avg SEO score', value: avgSeoScore !== null ? avgSeoScore.toString() : '—' },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map(({ label, value }) => (
        <Card key={label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF]">
              {label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[32px] font-bold leading-none text-[#111827]">{value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
