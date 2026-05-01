'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAudit } from '@/features/audit/services/audit.service';
import { CountrySelect } from '@/features/audit/components/country-select';

export default function NewAuditPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCountries, setSelectedCountries] = useState<string[]>(['us']);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      const result = await createAudit({
        websiteUrl: formData.get('websiteUrl') as string,
        businessDescription: formData.get('businessDescription') as string,
        countries: selectedCountries,
      });
      router.push(`/dashboard/audits/${result.auditId}/pipeline`);
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] font-bold text-[#111827]">New Audit</h1>
        <p className="mt-1 text-sm text-[#9CA3AF]">
          Run an SEO, GEO &amp; AEO audit on any website.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="max-w-lg rounded-xl border border-[#E8EAF0] bg-white p-8 shadow-sm"
      >
        <div className="space-y-5">
          <div>
            <label htmlFor="websiteUrl" className="text-sm font-semibold text-[#111827]">
              Website URL
            </label>
            <input
              id="websiteUrl"
              name="websiteUrl"
              type="url"
              required
              placeholder="https://example.com"
              className="mt-1.5 h-11 w-full rounded-[10px] border border-[#D7DCE5] bg-white px-3 text-sm text-[#111827] transition-colors placeholder:text-[#9CA3AF] focus:border-[#DA304F] focus:outline-none focus:ring-1 focus:ring-[#DA304F]"
            />
          </div>
          <div>
            <label htmlFor="businessDescription" className="text-sm font-semibold text-[#111827]">
              What does this business do?
            </label>
            <textarea
              id="businessDescription"
              name="businessDescription"
              required
              rows={3}
              placeholder="Briefly describe the products/services and target market"
              className="mt-1.5 w-full resize-none rounded-[10px] border border-[#D7DCE5] bg-white px-3 py-2.5 text-sm text-[#111827] transition-colors placeholder:text-[#9CA3AF] focus:border-[#DA304F] focus:outline-none focus:ring-1 focus:ring-[#DA304F]"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-[#111827]">Target countries</label>
            <p className="mt-0.5 text-xs text-[#9CA3AF]">
              Select countries for keyword &amp; competitor research
            </p>
            <div className="mt-1.5">
              <CountrySelect selected={selectedCountries} onChange={setSelectedCountries} />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-lg border border-[#F8D6DC] bg-[#FCF4F6] p-3 text-sm text-[#AE213E]">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-pill bg-gradient-cta text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Starting audit...' : 'Start audit'}
        </button>
      </form>
    </div>
  );
}
