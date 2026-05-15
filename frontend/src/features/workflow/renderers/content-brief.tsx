'use client';

interface SerpResult {
  position: number;
  url: string;
  title: string;
  estimatedWordCount?: number;
  contentType?: string;
  strengths?: string[];
  gaps?: string[];
}

interface Section {
  h2: string;
  guidance?: string;
  estimatedWords?: number;
  subsections?: { h3: string; guidance?: string; estimatedWords?: number }[];
}

interface InternalLink {
  targetPage: string;
  anchorText: string;
  context?: string;
}

interface PaaQuestion {
  question: string;
  suggestedAnswer?: string;
}

interface CtaRec {
  placement: string;
  type: string;
  text: string;
}

interface ContentBriefData {
  targetKeyword?: string;
  secondaryKeywords?: string[];
  searchIntent?: string;
  serpAnalysis?: {
    totalResults?: number;
    featuredSnippetType?: string | null;
    paaQuestions?: string[];
    topResults?: SerpResult[];
    averageWordCount?: number;
    dominantContentFormat?: string;
  };
  contentStructure?: {
    h1?: string;
    sections?: Section[];
  };
  wordCountTarget?: { minimum?: number; target?: number; maximum?: number };
  keywordTargets?: {
    primary?: { keyword: string; density: string };
    secondary?: { keyword: string; density: string }[];
  };
  schemaMarkup?: { type?: string; properties?: string[] };
  internalLinks?: InternalLink[];
  competitiveGaps?: string[];
  paaQuestions?: PaaQuestion[];
  ctaRecommendations?: CtaRec[];
  metaTitle?: string;
  metaDescription?: string;
  summary?: string;
}

/** Normalize fields that old agent runs returned as string[] instead of object[] */
function normalizeBrief(raw: ContentBriefData): ContentBriefData {
  const d = { ...raw };

  // paaQuestions: string[] → {question}[]
  if (Array.isArray(d.paaQuestions) && d.paaQuestions.length > 0) {
    if (typeof d.paaQuestions[0] === 'string') {
      d.paaQuestions = (d.paaQuestions as unknown as string[]).map((q) => ({ question: q }));
    }
  }
  // serpAnalysis.paaQuestions: string[] stays as-is (typed differently — displayed elsewhere)

  // internalLinks: string[] → {targetPage, anchorText}[]
  if (Array.isArray(d.internalLinks) && d.internalLinks.length > 0 && typeof d.internalLinks[0] === 'string') {
    d.internalLinks = (d.internalLinks as unknown as string[]).map((s) => ({ targetPage: s, anchorText: s }));
  }

  // ctaRecommendations: string[] → {placement, type, text}[]
  if (Array.isArray(d.ctaRecommendations) && d.ctaRecommendations.length > 0 && typeof d.ctaRecommendations[0] === 'string') {
    d.ctaRecommendations = (d.ctaRecommendations as unknown as string[]).map((s) => ({ placement: 'conclusion', type: 'product', text: s }));
  }

  return d;
}

export function ContentBriefRenderer({ data }: { data: unknown }) {
  const d = data ? normalizeBrief(data as ContentBriefData) : null;
  if (!d) return <p className="text-zinc-400">No brief data available.</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <h3 className="text-lg font-semibold text-white">{d.targetKeyword}</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {d.searchIntent && (
            <span className="rounded-full bg-blue-900/40 px-3 py-1 text-xs text-blue-300">
              {d.searchIntent}
            </span>
          )}
          {d.wordCountTarget?.target && (
            <span className="rounded-full bg-zinc-700 px-3 py-1 text-xs text-zinc-300">
              Target: {d.wordCountTarget.target.toLocaleString()} words
            </span>
          )}
          {d.schemaMarkup?.type && (
            <span className="rounded-full bg-purple-900/40 px-3 py-1 text-xs text-purple-300">
              Schema: {d.schemaMarkup.type}
            </span>
          )}
        </div>
        {d.metaTitle && (
          <div className="mt-3 space-y-1 text-sm">
            <p className="text-zinc-400">
              <span className="text-zinc-500">Meta title:</span> {d.metaTitle}
            </p>
            {d.metaDescription && (
              <p className="text-zinc-400">
                <span className="text-zinc-500">Meta desc:</span> {d.metaDescription}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Secondary Keywords */}
      {d.secondaryKeywords && d.secondaryKeywords.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-zinc-400">Secondary Keywords</h4>
          <div className="flex flex-wrap gap-2">
            {d.secondaryKeywords.map((kw, i) => (
              <span key={i} className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-300">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* SERP Analysis */}
      {d.serpAnalysis?.topResults && d.serpAnalysis.topResults.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-zinc-400">SERP Analysis</h4>
          <div className="space-y-2">
            {d.serpAnalysis.topResults.map((r, i) => (
              <div key={i} className="rounded border border-zinc-700 bg-zinc-800/30 p-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-700 text-xs text-zinc-300">
                    {r.position ?? i + 1}
                  </span>
                  <span className="truncate text-sm text-white">{r.title}</span>
                </div>
                <p className="mt-1 truncate text-xs text-zinc-500">{r.url}</p>
                <div className="mt-2 flex gap-4 text-xs text-zinc-400">
                  {r.estimatedWordCount && <span>{r.estimatedWordCount.toLocaleString()} words</span>}
                  {r.contentType && <span>{r.contentType}</span>}
                </div>
                {r.gaps && r.gaps.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-amber-400">Gaps: </span>
                    <span className="text-xs text-zinc-400">{r.gaps.join('; ')}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Structure */}
      {d.contentStructure?.sections && d.contentStructure.sections.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-zinc-400">Content Outline</h4>
          {d.contentStructure.h1 && (
            <p className="mb-2 text-sm font-semibold text-white">H1: {d.contentStructure.h1}</p>
          )}
          <div className="space-y-2">
            {d.contentStructure.sections.map((sec, i) => (
              <div key={i} className="rounded border border-zinc-700 bg-zinc-800/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">H2: {sec.h2}</span>
                  {sec.estimatedWords && (
                    <span className="text-xs text-zinc-500">~{sec.estimatedWords} words</span>
                  )}
                </div>
                {sec.guidance && <p className="mt-1 text-xs text-zinc-400">{sec.guidance}</p>}
                {sec.subsections && sec.subsections.length > 0 && (
                  <div className="mt-2 space-y-1 pl-4 border-l border-zinc-700">
                    {sec.subsections.map((sub, j) => (
                      <div key={j}>
                        <span className="text-xs text-zinc-300">H3: {sub.h3}</span>
                        {sub.guidance && (
                          <p className="text-xs text-zinc-500">{sub.guidance}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Competitive Gaps */}
      {d.competitiveGaps && d.competitiveGaps.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-zinc-400">Competitive Gaps</h4>
          <ul className="space-y-1">
            {d.competitiveGaps.map((gap, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="mt-1 text-green-400">✓</span>
                {gap}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* PAA Questions */}
      {d.paaQuestions && d.paaQuestions.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-zinc-400">People Also Ask</h4>
          <div className="space-y-2">
            {d.paaQuestions.map((paa, i) => (
              <div key={i} className="rounded border border-zinc-700 bg-zinc-800/30 p-3">
                <p className="text-sm font-medium text-white">{paa.question}</p>
                {paa.suggestedAnswer && (
                  <p className="mt-1 text-xs text-zinc-400">{paa.suggestedAnswer}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Internal Links */}
      {d.internalLinks && d.internalLinks.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-zinc-400">Internal Links</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700 text-left text-xs text-zinc-500">
                  <th className="pb-2 pr-4">Target Page</th>
                  <th className="pb-2 pr-4">Anchor Text</th>
                  <th className="pb-2">Context</th>
                </tr>
              </thead>
              <tbody>
                {d.internalLinks.map((link, i) => (
                  <tr key={i} className="border-b border-zinc-800">
                    <td className="py-2 pr-4 text-zinc-300">{link.targetPage}</td>
                    <td className="py-2 pr-4 text-blue-400">{link.anchorText}</td>
                    <td className="py-2 text-zinc-500">{link.context}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CTA Recommendations */}
      {d.ctaRecommendations && d.ctaRecommendations.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-zinc-400">CTA Recommendations</h4>
          <div className="space-y-2">
            {d.ctaRecommendations.map((cta, i) => (
              <div key={i} className="flex items-center gap-3 rounded bg-zinc-800/30 p-2 text-sm">
                <span className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
                  {cta.placement}
                </span>
                <span className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
                  {cta.type}
                </span>
                <span className="text-zinc-300">{cta.text}</span>
              </div>
            ))}
          </div>
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
