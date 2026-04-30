'use client';

import { useState } from 'react';
import Link from 'next/link';
import { submitAudit } from '../services/audit.service';
import { useAuditPolling } from '../hooks/use-audit-polling';
import { AuditProgress } from './audit-progress';
import { AuditScoreCards } from './audit-score-cards';

export function AuditForm() {
  const [formState, setFormState] = useState<'idle' | 'submitting' | 'polling' | 'error'>('idle');
  const [auditId, setAuditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { progress, scores, status } = useAuditPolling(auditId);

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
      });
      setAuditId(result.auditId);
      setFormState('polling');
    } catch {
      setError('Something went wrong. Please try again.');
      setFormState('error');
    }
  }

  if (status === 'complete' && scores) {
    return <AuditScoreCards scores={scores} />;
  }

  if ((formState === 'polling' || status === 'polling') && progress) {
    return (
      <div>
        <AuditProgress step={progress.step} progress={progress.progress} message={progress.message} />
        {auditId && (
          <p className="mt-4 text-center">
            <Link
              href={`/audit/${auditId}`}
              className="text-sm font-medium text-[#DA304F] underline underline-offset-4 hover:opacity-80"
            >
              View pipeline results →
            </Link>
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-[#E8EAF0] bg-white p-8 shadow-sm">
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
  );
}
