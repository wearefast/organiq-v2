'use client';

import { useState } from 'react';

interface KeywordUsage {
  keyword: string;
  count: number;
  density: string;
}

interface ImageAltSuggestion {
  placement: string;
  altText: string;
  description?: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

interface Scores {
  estimatedReadability?: number;
  estimatedSeoQuality?: number;
  estimatedCitability?: number;
  estimatedContentLength?: number;
}

interface ContentArticleData {
  title?: string;
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  content?: string;
  wordCount?: number;
  readabilityGrade?: string;
  keywordUsage?: {
    primary?: KeywordUsage;
    secondary?: KeywordUsage[];
  };
  schemaMarkup?: unknown;
  imageAltSuggestions?: ImageAltSuggestion[];
  internalLinksUsed?: { anchorText: string; targetUrl: string }[];
  faqSection?: FaqItem[];
  keyTakeaways?: string[];
  scores?: Scores;
  summary?: string;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color =
    value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-xs text-zinc-400">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-zinc-700">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs text-zinc-300">{value}</span>
    </div>
  );
}

export function ContentArticleRenderer({ data }: { data: unknown }) {
  const d = data as ContentArticleData;
  const [tab, setTab] = useState<'preview' | 'scores' | 'seo'>('preview');

  if (!d) return <p className="text-zinc-400">No article data available.</p>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <h3 className="text-lg font-semibold text-white">{d.title}</h3>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {d.wordCount && (
            <span className="rounded-full bg-zinc-700 px-3 py-1 text-zinc-300">
              {d.wordCount.toLocaleString()} words
            </span>
          )}
          {d.readabilityGrade && (
            <span className="rounded-full bg-blue-900/40 px-3 py-1 text-blue-300">
              {d.readabilityGrade}
            </span>
          )}
          {d.slug && (
            <span className="rounded-full bg-zinc-700 px-3 py-1 text-zinc-500">
              /{d.slug}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-zinc-800 p-1">
        {(['preview', 'scores', 'seo'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              tab === t
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
          >
            {t === 'preview' ? 'Preview' : t === 'scores' ? 'Scores' : 'SEO Details'}
          </button>
        ))}
      </div>

      {/* Preview Tab */}
      {tab === 'preview' && (
        <div className="space-y-4">
          {/* Key Takeaways */}
          {d.keyTakeaways && d.keyTakeaways.length > 0 && (
            <div className="rounded border border-zinc-700 bg-zinc-800/30 p-4">
              <h4 className="mb-2 text-sm font-medium text-zinc-400">Key Takeaways</h4>
              <ul className="space-y-1">
                {d.keyTakeaways.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <span className="mt-0.5 text-blue-400">•</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Article Content (markdown preview) */}
          {d.content && (
            <div className="rounded border border-zinc-700 bg-zinc-800/30 p-4">
              <h4 className="mb-2 text-sm font-medium text-zinc-400">Article Content</h4>
              <div className="prose prose-invert prose-sm max-h-96 overflow-y-auto text-zinc-300">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed">{d.content}</pre>
              </div>
            </div>
          )}

          {/* FAQ Section */}
          {d.faqSection && d.faqSection.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-zinc-400">FAQ Section</h4>
              <div className="space-y-2">
                {d.faqSection.map((faq, i) => (
                  <div key={i} className="rounded border border-zinc-700 bg-zinc-800/30 p-3">
                    <p className="text-sm font-medium text-white">{faq.question}</p>
                    <p className="mt-1 text-xs text-zinc-400">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scores Tab */}
      {tab === 'scores' && d.scores && (
        <div className="rounded border border-zinc-700 bg-zinc-800/30 p-4 space-y-3">
          <h4 className="text-sm font-medium text-zinc-400">Content Scores</h4>
          <ScoreBar label="Readability" value={d.scores.estimatedReadability ?? 0} />
          <ScoreBar label="SEO Quality" value={d.scores.estimatedSeoQuality ?? 0} />
          <ScoreBar label="AI Citability" value={d.scores.estimatedCitability ?? 0} />
          <ScoreBar label="Content Length" value={d.scores.estimatedContentLength ?? 0} />
        </div>
      )}

      {/* SEO Details Tab */}
      {tab === 'seo' && (
        <div className="space-y-4">
          {/* Meta Tags */}
          <div className="rounded border border-zinc-700 bg-zinc-800/30 p-4 space-y-2">
            <h4 className="text-sm font-medium text-zinc-400">Meta Tags</h4>
            {d.metaTitle && (
              <p className="text-sm text-zinc-300">
                <span className="text-zinc-500">Title: </span>{d.metaTitle}
                <span className="ml-2 text-xs text-zinc-500">({d.metaTitle.length} chars)</span>
              </p>
            )}
            {d.metaDescription && (
              <p className="text-sm text-zinc-300">
                <span className="text-zinc-500">Description: </span>{d.metaDescription}
                <span className="ml-2 text-xs text-zinc-500">({d.metaDescription.length} chars)</span>
              </p>
            )}
          </div>

          {/* Keyword Usage */}
          {d.keywordUsage && (
            <div className="rounded border border-zinc-700 bg-zinc-800/30 p-4">
              <h4 className="mb-2 text-sm font-medium text-zinc-400">Keyword Usage</h4>
              {d.keywordUsage.primary && (
                <div className="flex items-center gap-4 text-sm">
                  <span className="rounded bg-blue-900/40 px-2 py-0.5 text-xs text-blue-300">Primary</span>
                  <span className="text-zinc-300">{d.keywordUsage.primary.keyword}</span>
                  <span className="text-zinc-500">×{d.keywordUsage.primary.count}</span>
                  <span className="text-zinc-500">{d.keywordUsage.primary.density}</span>
                </div>
              )}
              {d.keywordUsage.secondary && d.keywordUsage.secondary.length > 0 && (
                <div className="mt-2 space-y-1">
                  {d.keywordUsage.secondary.map((kw, i) => (
                    <div key={i} className="flex items-center gap-4 text-sm">
                      <span className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-400">Secondary</span>
                      <span className="text-zinc-300">{kw.keyword}</span>
                      <span className="text-zinc-500">×{kw.count}</span>
                      <span className="text-zinc-500">{kw.density}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Internal Links */}
          {d.internalLinksUsed && d.internalLinksUsed.length > 0 && (
            <div className="rounded border border-zinc-700 bg-zinc-800/30 p-4">
              <h4 className="mb-2 text-sm font-medium text-zinc-400">Internal Links Used</h4>
              <div className="space-y-1">
                {d.internalLinksUsed.map((link, i) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <span className="text-blue-400">{link.anchorText}</span>
                    <span className="text-zinc-500">→</span>
                    <span className="text-zinc-400 truncate">{link.targetUrl}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Image Alt Suggestions */}
          {d.imageAltSuggestions && d.imageAltSuggestions.length > 0 && (
            <div className="rounded border border-zinc-700 bg-zinc-800/30 p-4">
              <h4 className="mb-2 text-sm font-medium text-zinc-400">Image Suggestions</h4>
              <div className="space-y-2">
                {d.imageAltSuggestions.map((img, i) => (
                  <div key={i} className="text-sm">
                    <span className="text-zinc-500">{img.placement}: </span>
                    <span className="text-zinc-300">{img.altText}</span>
                    {img.description && (
                      <p className="text-xs text-zinc-500">{img.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      {d.summary && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-zinc-400">Summary</h4>
          <p className="text-sm leading-relaxed text-zinc-300">{d.summary}</p>
        </div>
      )}
    </div>
  );
}
