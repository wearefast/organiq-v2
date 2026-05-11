'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { createKeywordProject } from '@/features/keywords/services/keywords.service';

function parseSeedKeywords(rawValue: string) {
  const normalizedKeywords = rawValue
    .split(/[\n,]/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  return Array.from(new Set(normalizedKeywords));
}

export default function NewKeywordProjectPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('name') ?? '').trim();
    const websiteUrl = String(formData.get('websiteUrl') ?? '').trim();
    const seedKeywords = parseSeedKeywords(String(formData.get('seedKeywords') ?? ''));

    try {
      await createKeywordProject({
        name,
        websiteUrl,
        seedKeywords,
      });

      router.push('/dashboard/keywords');
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[32px] font-bold leading-tight text-[var(--text-primary)]">New keyword project</h1>
          <p className="mt-1 text-sm text-[var(--text-body)]">
            Create the project container first, then start the English workflow from the project workspace.
          </p>
        </div>

        <Link
          href="/dashboard/keywords"
          className="btn-secondary gap-2 px-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to projects
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="card-base max-w-2xl p-8">
        <div className="space-y-5">
          <div>
            <label htmlFor="name" className="text-sm font-medium text-[#344054]">
              Project name <span className="text-[#DA304F]">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="Example: Seleo AE Keyword Research"
              className="mt-1.5 h-11 w-full rounded-[10px] border border-[#D7DCE5] bg-white px-3 text-sm text-[#111827] transition-colors placeholder:text-[#9CA3AF] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
            />
          </div>

          <div>
            <label htmlFor="websiteUrl" className="text-sm font-medium text-[#344054]">
              Website URL <span className="text-[#DA304F]">*</span>
            </label>
            <input
              id="websiteUrl"
              name="websiteUrl"
              type="url"
              required
              placeholder="https://example.com"
              className="mt-1.5 h-11 w-full rounded-[10px] border border-[#D7DCE5] bg-white px-3 text-sm text-[#111827] transition-colors placeholder:text-[#9CA3AF] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
            />
          </div>

          <div>
            <label htmlFor="seedKeywords" className="text-sm font-medium text-[#344054]">
              Initial seed keywords
            </label>
            <p className="mt-0.5 text-xs text-[#9CA3AF]">
              Optional. Add one keyword per line or separate them with commas.
            </p>
            <textarea
              id="seedKeywords"
              name="seedKeywords"
              rows={5}
              placeholder="seo agency dubai\ndigital marketing agency dubai"
              className="mt-1.5 w-full resize-none rounded-[10px] border border-[#D7DCE5] bg-white px-3 py-2.5 text-sm text-[#111827] transition-colors placeholder:text-[#9CA3AF] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
            />
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded-lg border border-[#F8D6DC] bg-[#FCF4F6] p-3 text-sm text-[#AE213E]">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#667085]">
            After the project is created, choose the market and start the workflow from the project card.
          </p>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary px-5"
          >
            {submitting ? 'Creating project...' : 'Create project'}
          </button>
        </div>
      </form>
    </div>
  );
}