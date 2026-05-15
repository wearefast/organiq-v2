'use client';

import { useState, useCallback, useMemo } from 'react';
import { MarkdownPreview } from '@/shared/components/markdown-preview';
import { ArticleEditor } from './article-editor';
import { updateArtifact } from '../services/workflow.service';
import type { WorkflowStep } from '../types';

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

/* ---------- AEO ---------- */
interface DirectAnswer {
  question: string;
  answer: string;
  format?: string;
  snippetReady?: boolean;
}
interface PaaOpt {
  question: string;
  answered?: boolean;
  position?: string;
}
interface ConciseDefinition {
  term: string;
  definition: string;
  wordCount?: number;
}
interface AeoScore {
  overallScore?: number;
  directAnswerDensity?: number;
  questionCoverage?: number;
  featuredSnippetEligibility?: number;
  voiceSearchReadiness?: number;
  details?: {
    directAnswers?: DirectAnswer[];
    paaOptimization?: PaaOpt[];
    conciseDefinitions?: ConciseDefinition[];
  };
}

/* ---------- GEO ---------- */
interface CitablePassage {
  text: string;
  reason?: string;
  section?: string;
}
interface FactualClaim {
  claim: string;
  sourced?: boolean;
  sourceType?: string;
}
interface StructuredElement {
  type: string;
  section?: string;
  aiExtractable?: boolean;
}
interface GeoScore {
  overallScore?: number;
  citability?: number;
  factualDensity?: number;
  structuredDataRichness?: number;
  sourceAttribution?: number;
  details?: {
    citablePassages?: CitablePassage[];
    factualClaims?: FactualClaim[];
    structuredElements?: StructuredElement[];
  };
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
  aeoScore?: AeoScore;
  geoScore?: GeoScore;
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

function normalize(raw: Record<string, unknown>): ContentArticleData {
  const d = raw as ContentArticleData & Record<string, unknown>;

  // keywordDensity → keywordUsage normalization
  if (!d.keywordUsage && d.keywordDensity) {
    const kd = d.keywordDensity as Record<string, unknown>;
    const primary = kd.primary as Record<string, unknown> | undefined;
    const sec = kd.secondary as Record<string, unknown> | unknown[] | undefined;
    // secondary may be { keywords: [...] } or [...] directly
    const secArr: KeywordUsage[] = Array.isArray(sec)
      ? (sec as KeywordUsage[])
      : Array.isArray((sec as Record<string, unknown>)?.keywords)
        ? ((sec as Record<string, unknown>).keywords as KeywordUsage[])
        : [];
    d.keywordUsage = {
      primary: primary
        ? {
            keyword: (primary.keyword as string) ?? '',
            count: (primary.count as number) ?? 0,
            density: (primary.density as string) ?? '',
          }
        : undefined,
      secondary: secArr.map((k) => ({
        keyword: k.keyword ?? '',
        count: k.count ?? 0,
        density: k.density ?? '',
      })),
    };
  }

  // scores: accept any variant naming or compute defaults if missing
  if (!d.scores) {
    const s = (raw.contentScores ?? raw.qualityScores ?? raw.articleScores) as Scores | undefined;
    if (s) d.scores = s;
  }

  // internalLinksUsed: string[] → object[]
  if (Array.isArray(d.internalLinksUsed) && d.internalLinksUsed.length > 0 && typeof d.internalLinksUsed[0] === 'string') {
    d.internalLinksUsed = (d.internalLinksUsed as unknown as string[]).map((url) => ({
      anchorText: url,
      targetUrl: url,
    }));
  }

  // imageAltSuggestions: string[] → object[]
  if (Array.isArray(d.imageAltSuggestions) && d.imageAltSuggestions.length > 0 && typeof d.imageAltSuggestions[0] === 'string') {
    d.imageAltSuggestions = (d.imageAltSuggestions as unknown as string[]).map((text) => ({
      placement: '',
      altText: text,
    }));
  }

  // faqSection: string[] → {question, answer}[]
  if (Array.isArray(d.faqSection) && d.faqSection.length > 0 && typeof d.faqSection[0] === 'string') {
    d.faqSection = (d.faqSection as unknown as string[]).map((s) => ({ question: s, answer: '' }));
  }

  // aeoScore: accept variant keys
  if (!d.aeoScore) {
    const a = (raw.aeoScore ?? raw.aeo ?? raw.answerEngineScore) as AeoScore | undefined;
    if (a) d.aeoScore = a;
  }

  // geoScore: accept variant keys
  if (!d.geoScore) {
    const g = (raw.geoScore ?? raw.geo ?? raw.generativeEngineScore) as GeoScore | undefined;
    if (g) d.geoScore = g;
  }

  return d;
}

type TabKey = 'preview' | 'scores' | 'seo' | 'aeo' | 'geo';

const TAB_LABELS: Record<TabKey, string> = {
  preview: 'Preview',
  scores: 'Scores',
  seo: 'SEO Details',
  aeo: 'AEO',
  geo: 'GEO',
};

export function ContentArticleRenderer({ data, allSteps }: { data: unknown; allSteps?: WorkflowStep[] }) {
  const d = data ? normalize(data as Record<string, unknown>) : null;
  const [tab, setTab] = useState<TabKey>('preview');
  const [editing, setEditing] = useState(false);
  const [articleContent, setArticleContent] = useState(d?.content ?? '');

  // Build imageMap from content-images step artifact
  const imageMap = useMemo(() => {
    if (!allSteps) return undefined;
    const imgStep = allSteps.find((s) => s.stepKey === 'content-images');
    const imgData = imgStep?.artifacts?.[0]?.data as { images?: Array<{ index: number; base64: string }> } | undefined;
    if (!imgData?.images?.length) return undefined;
    const map: Record<string, string> = {};
    for (const img of imgData.images) {
      const b64 = img.base64.startsWith('data:') ? img.base64 : `data:image/png;base64,${img.base64}`;
      map[`image-${img.index}`] = b64;
    }
    return Object.keys(map).length > 0 ? map : undefined;
  }, [allSteps]);

  const handleSave = useCallback(async (newContent: string) => {
    setArticleContent(newContent);
    setEditing(false);
    const runId = allSteps?.[0]?.workflowRunId;
    if (runId) {
      try {
        await updateArtifact(runId, 'content-article', { content: newContent });
      } catch (err) {
        console.error('Failed to save article:', err);
      }
    }
  }, [allSteps]);

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
        {(Object.keys(TAB_LABELS) as TabKey[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              tab === t
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* ========== Preview Tab ========== */}
      {tab === 'preview' && (
        editing ? (
          <ArticleEditor
            content={articleContent}
            imageMap={imageMap}
            onSave={handleSave}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="space-y-4">
            {/* Edit button */}
            <div className="flex justify-end">
              <button
                onClick={() => setEditing(true)}
                className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300 transition"
              >
                Edit Article
              </button>
            </div>

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

            {/* Article Content — rendered HTML */}
            {articleContent && (
              <div className="rounded border border-zinc-700 bg-zinc-800/30 px-6 py-5">
                <MarkdownPreview content={articleContent} imageMap={imageMap} />
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
        )
      )}

      {/* ========== Scores Tab ========== */}
      {tab === 'scores' && (
        d.scores ? (
          <div className="rounded border border-zinc-700 bg-zinc-800/30 p-4 space-y-3">
            <h4 className="text-sm font-medium text-zinc-400">Content Scores</h4>
            <ScoreBar label="Readability" value={d.scores.estimatedReadability ?? 0} />
            <ScoreBar label="SEO Quality" value={d.scores.estimatedSeoQuality ?? 0} />
            <ScoreBar label="AI Citability" value={d.scores.estimatedCitability ?? 0} />
            <ScoreBar label="Content Length" value={d.scores.estimatedContentLength ?? 0} />
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No scores available for this article.</p>
        )
      )}

      {/* ========== SEO Details Tab ========== */}
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
                    {img.placement && <span className="text-zinc-500">{img.placement}: </span>}
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

      {/* ========== AEO Tab ========== */}
      {tab === 'aeo' && (
        d.aeoScore ? (
          <div className="space-y-4">
            {/* AEO Score Bars */}
            <div className="rounded border border-zinc-700 bg-zinc-800/30 p-4 space-y-3">
              <h4 className="text-sm font-medium text-zinc-400">Answer Engine Optimization</h4>
              <ScoreBar label="Overall AEO" value={d.aeoScore.overallScore ?? 0} />
              <ScoreBar label="Direct Answers" value={d.aeoScore.directAnswerDensity ?? 0} />
              <ScoreBar label="Question Coverage" value={d.aeoScore.questionCoverage ?? 0} />
              <ScoreBar label="Snippet Ready" value={d.aeoScore.featuredSnippetEligibility ?? 0} />
              <ScoreBar label="Voice Search" value={d.aeoScore.voiceSearchReadiness ?? 0} />
            </div>

            {/* Direct Answers */}
            {d.aeoScore.details?.directAnswers && d.aeoScore.details.directAnswers.length > 0 && (
              <div className="rounded border border-zinc-700 bg-zinc-800/30 p-4">
                <h4 className="mb-2 text-sm font-medium text-zinc-400">Direct Answers</h4>
                <div className="space-y-2">
                  {d.aeoScore.details.directAnswers.map((da, i) => (
                    <div key={i} className="rounded border border-zinc-700 bg-zinc-800/20 p-3">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          da.snippetReady ? 'bg-green-900/40 text-green-400' : 'bg-yellow-900/40 text-yellow-400'
                        }`}>
                          {da.snippetReady ? 'Snippet Ready' : 'Needs Work'}
                        </span>
                        {da.format && (
                          <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400">{da.format}</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-medium text-white">{da.question}</p>
                      <p className="mt-1 text-xs text-zinc-400">{da.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PAA Optimization */}
            {d.aeoScore.details?.paaOptimization && d.aeoScore.details.paaOptimization.length > 0 && (
              <div className="rounded border border-zinc-700 bg-zinc-800/30 p-4">
                <h4 className="mb-2 text-sm font-medium text-zinc-400">People Also Ask Coverage</h4>
                <div className="space-y-1">
                  {d.aeoScore.details.paaOptimization.map((paa, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className={`h-2 w-2 rounded-full ${paa.answered ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-zinc-300">{paa.question}</span>
                      {paa.position && (
                        <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500">{paa.position}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Concise Definitions */}
            {d.aeoScore.details?.conciseDefinitions && d.aeoScore.details.conciseDefinitions.length > 0 && (
              <div className="rounded border border-zinc-700 bg-zinc-800/30 p-4">
                <h4 className="mb-2 text-sm font-medium text-zinc-400">Concise Definitions</h4>
                <div className="space-y-2">
                  {d.aeoScore.details.conciseDefinitions.map((def, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium text-blue-400">{def.term}</span>
                      <span className="text-zinc-500"> — </span>
                      <span className="text-zinc-300">{def.definition}</span>
                      {def.wordCount != null && (
                        <span className="ml-1 text-[10px] text-zinc-500">({def.wordCount}w)</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No AEO data available. Rerun the article to generate AEO scores.</p>
        )
      )}

      {/* ========== GEO Tab ========== */}
      {tab === 'geo' && (
        d.geoScore ? (
          <div className="space-y-4">
            {/* GEO Score Bars */}
            <div className="rounded border border-zinc-700 bg-zinc-800/30 p-4 space-y-3">
              <h4 className="text-sm font-medium text-zinc-400">Generative Engine Optimization</h4>
              <ScoreBar label="Overall GEO" value={d.geoScore.overallScore ?? 0} />
              <ScoreBar label="Citability" value={d.geoScore.citability ?? 0} />
              <ScoreBar label="Factual Density" value={d.geoScore.factualDensity ?? 0} />
              <ScoreBar label="Structured Data" value={d.geoScore.structuredDataRichness ?? 0} />
              <ScoreBar label="Source Attribution" value={d.geoScore.sourceAttribution ?? 0} />
            </div>

            {/* Citable Passages */}
            {d.geoScore.details?.citablePassages && d.geoScore.details.citablePassages.length > 0 && (
              <div className="rounded border border-zinc-700 bg-zinc-800/30 p-4">
                <h4 className="mb-2 text-sm font-medium text-zinc-400">Citable Passages</h4>
                <div className="space-y-2">
                  {d.geoScore.details.citablePassages.map((cp, i) => (
                    <div key={i} className="rounded border border-zinc-700 bg-zinc-800/20 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        {cp.reason && (
                          <span className="rounded bg-purple-900/40 px-1.5 py-0.5 text-[10px] text-purple-300">{cp.reason}</span>
                        )}
                        {cp.section && (
                          <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500">{cp.section}</span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-300 italic">&ldquo;{cp.text}&rdquo;</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Factual Claims */}
            {d.geoScore.details?.factualClaims && d.geoScore.details.factualClaims.length > 0 && (
              <div className="rounded border border-zinc-700 bg-zinc-800/30 p-4">
                <h4 className="mb-2 text-sm font-medium text-zinc-400">Factual Claims</h4>
                <div className="space-y-1">
                  {d.geoScore.details.factualClaims.map((fc, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className={`h-2 w-2 rounded-full ${fc.sourced ? 'bg-green-500' : 'bg-yellow-500'}`} />
                      <span className="text-zinc-300">{fc.claim}</span>
                      {fc.sourceType && (
                        <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500">{fc.sourceType}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Structured Elements */}
            {d.geoScore.details?.structuredElements && d.geoScore.details.structuredElements.length > 0 && (
              <div className="rounded border border-zinc-700 bg-zinc-800/30 p-4">
                <h4 className="mb-2 text-sm font-medium text-zinc-400">Structured Elements</h4>
                <div className="flex flex-wrap gap-2">
                  {d.geoScore.details.structuredElements.map((se, i) => (
                    <span
                      key={i}
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        se.aiExtractable
                          ? 'bg-green-900/30 text-green-400 border border-green-800'
                          : 'bg-zinc-700 text-zinc-400'
                      }`}
                    >
                      {se.type}{se.section ? ` · ${se.section}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No GEO data available. Rerun the article to generate GEO scores.</p>
        )
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
