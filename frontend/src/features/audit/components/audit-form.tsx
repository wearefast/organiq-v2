'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { submitAudit } from '../services/audit.service';
import { useAuditPolling } from '../hooks/use-audit-polling';
import { AuditPipeline } from './audit-pipeline';
import { CountrySelect } from './country-select';

export function AuditForm() {
  const router = useRouter();
  const [formState, setFormState] = useState<'idle' | 'submitting' | 'polling' | 'error'>('idle');
  const [auditId, setAuditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCountries, setSelectedCountries] = useState<string[]>(['us']);

  const { progress, scores, status } = useAuditPolling(auditId);

  useEffect(() => {
    if (status === 'complete' && auditId) {
      router.push(`/audit/${auditId}`);
    }
  }, [status, auditId, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormState('submitting');
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      const result = await submitAudit({
        websiteUrl: formData.get('websiteUrl') as string,
        name: formData.get('name') as string,
        email: formData.get('email') as string,
        businessDescription: formData.get('businessDescription') as string,
        countries: selectedCountries,
      });
      setAuditId(result.auditId);
      setFormState('polling');
    } catch {
      setError('Something went wrong. Please try again.');
      setFormState('error');
    }
  }

  if (status === 'failed') {
    const lastStep = progress?.completedSteps?.[progress.completedSteps.length - 1];
    return (
      <div className="flex flex-1 flex-col items-center bg-[#F8F9FC] px-4 py-16 sm:px-8">
        <div className="mx-auto w-full max-w-lg text-center">
          <div className="rounded-xl border border-[#FECDD3] bg-[#FFF1F2] p-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FEE2E2]">
              <svg className="h-6 w-6 text-[#DA304F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#111827]">Audit could not be completed</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">
              Your audit encountered an error. Our system retried automatically but was unable to complete this step.
            </p>
            {lastStep && (
              <p className="mt-3 text-xs text-[#6B7280]">
                Last completed: <span className="font-medium text-[#111827]">{lastStep.label}</span>
              </p>
            )}
            <button
              onClick={() => { setAuditId(null); setFormState('idle'); setError(null); }}
              className="mt-6 inline-flex items-center rounded-[10px] bg-[#DA304F] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#C02844]"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if ((formState === 'polling' || status === 'polling') && progress) {
    return (
      <div className="flex flex-1 flex-col bg-[#04111f]">
        <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4">
          <div className="min-h-0 flex-1">
            <AuditPipeline
              currentStep={progress.currentStep}
              progress={progress.progress}
              message={progress.message}
              completedSteps={progress.completedSteps}
            />
          </div>
          {auditId && (
            <div className="flex justify-center pt-3">
              <Link
                href={`/audit/${auditId}`}
                className="inline-flex items-center rounded-pill border border-[#17304D] bg-[rgba(5,16,32,0.92)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#9FB6D8] transition-colors hover:border-[#2E537D] hover:text-white"
              >
                View pipeline results
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-[#F8F9FC] px-4 py-16 sm:px-8">
      <div className="w-full max-w-7xl">
        <div className="mx-auto mb-8 max-w-lg text-center">
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

        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-lg rounded-xl border border-[#E8EAF0] bg-white p-8 shadow-sm">
          <div className="space-y-5">
            <div>
              <label htmlFor="websiteUrl" className="text-sm font-semibold text-[#111827]">Website URL</label>
              <input
                id="websiteUrl" name="websiteUrl" type="url" required placeholder="https://yourwebsite.com"
                defaultValue="https://www.platformance.io/"
                className="mt-1.5 h-11 w-full rounded-[10px] border border-[#D7DCE5] bg-white px-3 text-sm text-[#111827] transition-colors placeholder:text-[#9CA3AF] focus:border-[#DA304F] focus:outline-none focus:ring-1 focus:ring-[#DA304F]"
              />
            </div>
            <div>
              <label htmlFor="name" className="text-sm font-semibold text-[#111827]">Your name</label>
              <input
                id="name" name="name" type="text" required placeholder="Jane Smith"
                defaultValue="Vaibhav"
                className="mt-1.5 h-11 w-full rounded-[10px] border border-[#D7DCE5] bg-white px-3 text-sm text-[#111827] transition-colors placeholder:text-[#9CA3AF] focus:border-[#DA304F] focus:outline-none focus:ring-1 focus:ring-[#DA304F]"
              />
            </div>
            <div>
              <label htmlFor="email" className="text-sm font-semibold text-[#111827]">Work email</label>
              <input
                id="email" name="email" type="email" required placeholder="jane@company.com"
                defaultValue="vaibhav@platformance.io"
                className="mt-1.5 h-11 w-full rounded-[10px] border border-[#D7DCE5] bg-white px-3 text-sm text-[#111827] transition-colors placeholder:text-[#9CA3AF] focus:border-[#DA304F] focus:outline-none focus:ring-1 focus:ring-[#DA304F]"
              />
            </div>
            <div>
              <label htmlFor="businessDescription" className="text-sm font-semibold text-[#111827]">What does your business do?</label>
              <textarea
                id="businessDescription" name="businessDescription" required rows={3}
                placeholder="Briefly describe your products/services and target market"
                defaultValue="Digital advertising, Performance marketing"
                className="mt-1.5 w-full rounded-[10px] border border-[#D7DCE5] bg-white px-3 py-2.5 text-sm text-[#111827] transition-colors placeholder:text-[#9CA3AF] focus:border-[#DA304F] focus:outline-none focus:ring-1 focus:ring-[#DA304F] resize-none"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-[#111827]">Target countries</label>
              <p className="mt-0.5 text-xs text-[#9CA3AF]">Select the countries for keyword &amp; competitor research</p>
              <div className="mt-1.5">
                <CountrySelect selected={selectedCountries} onChange={setSelectedCountries} />
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-lg border border-[#F8D6DC] bg-[#FCF4F6] p-3 text-sm text-[#AE213E]">{error}</div>
          )}

          <button
            type="submit"
            disabled={formState === 'submitting'}
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-pill bg-gradient-cta text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {formState === 'submitting' ? 'Submitting...' : 'Get my free audit report'}
          </button>

          <p className="mt-3 text-center text-xs text-[#9CA3AF]">
            No login required. Your personalised report will be ready within minutes.
          </p>
        </form>
      </div>
    </div>
  );
}
