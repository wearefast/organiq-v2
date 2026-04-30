import { Card, CardHeader, CardTitle, CardContent } from '@/shared/components';

const STATS = [
  { label: 'Total leads', value: '—', delta: null },
  { label: 'Audits completed', value: '—', delta: null },
  { label: 'Keyword projects', value: '—', delta: null },
  { label: 'Content pieces', value: '—', delta: null },
];

export function StatsCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {STATS.map(({ label, value }) => (
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
