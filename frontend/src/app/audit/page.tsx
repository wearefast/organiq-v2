import { AuditForm } from '@/features/audit';
import Link from 'next/link';

export default function AuditPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FC]">
      <header className="flex h-14 items-center px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#071932] text-[10px] font-bold text-white">C</span>
          <span className="text-sm font-semibold text-[#111827]">Calibrate Commerce</span>
        </Link>
      </header>

      <AuditForm />
    </div>
  );
}
