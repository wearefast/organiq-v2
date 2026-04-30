import { AuditForm } from '@/features/audit';
import Link from 'next/link';

export default function AuditPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header strip */}
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

      {/* Content */}
      <div className="flex flex-1 flex-col items-center bg-[#F8F9FC] px-8 py-16">
        <div className="w-full max-w-lg">
          <div className="mb-8 text-center">
            <span className="inline-flex items-center rounded-pill bg-[#FCF4F6] px-3 py-1 text-xs font-medium text-[#DA304F]">
              Free · No login required
            </span>
            <h1 className="mt-4 text-[32px] font-bold leading-tight text-[#111827]">
              Free SEO, GEO &amp; AEO Audit
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[#4B5563]">
              Get a personalised report showing your organic visibility gaps, content opportunities, and competitor insights — powered by Ahrefs + AI.
            </p>
          </div>
          <AuditForm />
        </div>
      </div>
    </div>
  );
}
