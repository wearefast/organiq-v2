'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Normalize legacy single-line numbered lists into proper markdown.
 * e.g. "1. Do X 2. Do Y 3. Do Z" → "1. Do X\n2. Do Y\n3. Do Z"
 * Only activates when the text starts with "1. " confirming it's a list.
 */
export function normalizeInlineList(text: string): string {
  const stripped = text.replace(/^→\s*/, '').trim();
  if (/^1\.\s/.test(stripped) && /\s2\.\s/.test(stripped)) {
    return stripped.replace(/\s+(\d+)\.\s/g, '\n$1. ');
  }
  return text;
}

/**
 * Compact markdown renderer for workflow output cards.
 * Handles paragraphs, bullet lists, numbered lists, bold, and italics
 * with tight spacing suitable for dense card layouts.
 */
export function RichText({
  children,
  textClass = 'text-zinc-400',
  size = 'xs',
}: {
  children: string;
  textClass?: string;
  /** 'xs' for card body copy, 'sm' for summary/lead text */
  size?: 'xs' | 'sm';
}) {
  const textSize = size === 'sm' ? 'text-sm' : 'text-xs';
  const normalized = normalizeInlineList(children);
  return (
    <div className={`mt-1 leading-relaxed ${textSize} ${textClass}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children: c }) => <p className="mb-1.5 last:mb-0">{c}</p>,
          ul: ({ children: c }) => <ul className="mt-1 mb-1.5 space-y-0.5 pl-4 list-disc">{c}</ul>,
          ol: ({ children: c }) => <ol className="mt-1 mb-1.5 space-y-0.5 pl-4 list-decimal">{c}</ol>,
          li: ({ children: c }) => <li className="leading-snug">{c}</li>,
          strong: ({ children: c }) => <strong className="font-semibold text-zinc-200">{c}</strong>,
          em: ({ children: c }) => <em className="italic opacity-90">{c}</em>,
          // Suppress raw <a> tags — keep text only for safety
          a: ({ children: c }) => <span className="underline opacity-75">{c}</span>,
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
