/**
 * PageSpeed Insights parser — transforms raw Lighthouse JSON into normalized metrics.
 * Port of python-sidecar/routers/analyze.py::analyze_pagespeed
 */

export interface PageSpeedResult {
  performanceScore: number;
  metrics: Record<string, string>;
  opportunities: Array<{
    audit: string;
    title: string;
    savingsMs: number;
    description: string;
  }>;
}

export function parsePageSpeed(rawData: Record<string, unknown>, _strategy = 'mobile'): PageSpeedResult {
  const lighthouse = (rawData.lighthouseResult ?? {}) as Record<string, unknown>;
  const categories = (lighthouse.categories ?? {}) as Record<string, Record<string, unknown>>;
  const audits = (lighthouse.audits ?? {}) as Record<string, Record<string, unknown>>;

  const perfCategory = categories.performance ?? {};
  const performanceScore = Math.round(((perfCategory.score as number) ?? 0) * 100);

  const metrics: Record<string, string> = {
    lcp: getDisplayValue(audits, 'largest-contentful-paint'),
    fid: getDisplayValue(audits, 'max-potential-fid'),
    cls: getDisplayValue(audits, 'cumulative-layout-shift'),
    inp: getDisplayValue(audits, 'interaction-to-next-paint'),
    ttfb: getDisplayValue(audits, 'server-response-time'),
    fcp: getDisplayValue(audits, 'first-contentful-paint'),
  };

  const opportunities: PageSpeedResult['opportunities'] = [];

  for (const [key, audit] of Object.entries(audits)) {
    const details = (audit.details ?? {}) as Record<string, unknown>;
    if (details.type === 'opportunity') {
      const savingsMs = (details.overallSavingsMs as number) ?? 0;
      if (savingsMs > 100) {
        opportunities.push({
          audit: key,
          title: (audit.title as string) ?? key,
          savingsMs,
          description: (audit.description as string) ?? '',
        });
      }
    }
  }

  opportunities.sort((a, b) => b.savingsMs - a.savingsMs);

  return {
    performanceScore,
    metrics,
    opportunities: opportunities.slice(0, 10),
  };
}

function getDisplayValue(audits: Record<string, Record<string, unknown>>, key: string): string {
  return (audits[key]?.displayValue as string) ?? 'N/A';
}
