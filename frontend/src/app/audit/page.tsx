import { AuditForm } from '@/features/audit';
import Link from 'next/link';

export default function AuditPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center border-b border-[#E8EAF0] bg-white px-8">
        <Link href="/">
          <img
            src="/calibrate-commerce-logo.svg"
            alt="Calibrate Commerce"
            className="h-5 w-auto"
          />
        </Link>
      </header>

      <AuditForm />
    </div>
  );
}
