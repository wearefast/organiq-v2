import { StatsCards } from '@/features/dashboard';

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[32px] font-bold text-[#111827]">Dashboard</h1>
        <p className="mt-1 text-sm text-[#9CA3AF]">Overview of your organic visibility pipeline.</p>
      </div>
      <StatsCards />
    </div>
  );
}
