/**
 * Citability analysis — evaluates how citable a page is by AI systems.
 * Port of python-sidecar/routers/analyze.py::analyze_citability
 */

import * as cheerio from 'cheerio';

export interface CitabilityResult {
  score: number; // 0-100
  signals: Record<string, boolean>;
  recommendations: string[];
}

export function analyzeCitability(html: string): CitabilityResult {
  const $ = cheerio.load(html);

  const signals: Record<string, boolean> = {
    has_schema: hasSchema($),
    has_faq: hasFaq($),
    has_tables: $('table').length > 0,
    has_lists: $('ul, ol').length >= 3,
    has_headings: $('h1, h2, h3').length >= 3,
    has_definitions: hasDefinitions($),
    has_author: hasAuthor($),
    short_paragraphs: avgParagraphLength($) < 150,
    has_stats: hasStatistics($),
  };

  const weights: Array<[string, number]> = [
    ['has_schema', 15],
    ['has_faq', 15],
    ['has_tables', 10],
    ['has_lists', 10],
    ['has_headings', 10],
    ['has_definitions', 10],
    ['has_author', 10],
    ['short_paragraphs', 10],
    ['has_stats', 10],
  ];

  const score = weights.reduce((sum, [signal, weight]) => sum + (signals[signal] ? weight : 0), 0);

  const recommendations: string[] = [];
  if (!signals.has_schema) recommendations.push('Add structured data (JSON-LD) for key entities');
  if (!signals.has_faq) recommendations.push('Add an FAQ section with clear Q&A pairs');
  if (!signals.has_tables) recommendations.push('Include comparison tables or data tables');
  if (!signals.has_definitions) recommendations.push('Add clear definitions for key terms');
  if (!signals.has_author) recommendations.push('Add author byline with credentials (E-E-A-T)');
  if (!signals.short_paragraphs) recommendations.push('Break long paragraphs into shorter, scannable chunks');

  return { score, signals, recommendations };
}

function hasSchema($: cheerio.CheerioAPI): boolean {
  return $('script[type="application/ld+json"]').length > 0;
}

function hasFaq($: cheerio.CheerioAPI): boolean {
  // Check for FAQ schema
  let found = false;
  $('script[type="application/ld+json"]').each((_, el) => {
    if ($(el).text().includes('FAQPage')) found = true;
  });
  if (found) return true;

  // Check for FAQ headings
  const headings = $('h2, h3');
  for (let i = 0; i < headings.length; i++) {
    const text = $(headings[i]).text().toLowerCase();
    if (text.includes('faq') || text.includes('frequently asked')) return true;
  }
  return false;
}

function hasDefinitions($: cheerio.CheerioAPI): boolean {
  if ($('dl').length > 0) return true;
  const text = $.root().text();
  const pattern = /\b\w+\s+is\s+(a|an|the)\s+/gi;
  const matches = text.match(pattern);
  return (matches?.length ?? 0) >= 3;
}

function hasAuthor($: cheerio.CheerioAPI): boolean {
  return (
    $('[class*="author" i]').length > 0 ||
    $('[rel="author"]').length > 0 ||
    $('[itemprop="author"]').length > 0
  );
}

function avgParagraphLength($: cheerio.CheerioAPI): number {
  const paragraphs: string[] = [];
  $('p').each((_, el) => {
    const text = $(el).text().trim();
    if (text) paragraphs.push(text);
  });
  if (paragraphs.length === 0) return 0;
  return paragraphs.reduce((sum, p) => sum + p.length, 0) / paragraphs.length;
}

function hasStatistics($: cheerio.CheerioAPI): boolean {
  const text = $.root().text();
  const pattern = /\d+%|\$\d+|\d+\.\d+x|\d{1,3}(,\d{3})+/g;
  const matches = text.match(pattern);
  return (matches?.length ?? 0) >= 3;
}
