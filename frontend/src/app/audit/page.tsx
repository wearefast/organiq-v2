import { AuditForm } from '@/features/audit';
import Link from 'next/link';

export default function AuditPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center border-b border-[#E8EAF0] bg-white px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#DA304F]">
            <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-[#111827]">Calibrate Commerce</span>
        </Link>
      </header>

      <AuditForm />
    </div>
  );
}
