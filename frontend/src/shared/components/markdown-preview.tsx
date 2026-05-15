'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { Components } from 'react-markdown';

interface MarkdownPreviewProps {
  content: string;
  imageMap?: Record<string, string>;
  className?: string;
}

export function MarkdownPreview({ content, imageMap, className }: MarkdownPreviewProps) {
  const components: Components = {
    // ── Headings ──────────────────────────────────────────────────────────────
    h1: ({ children }) => (
      <h1 className="mt-8 mb-4 text-2xl font-bold text-white leading-tight tracking-tight border-b border-zinc-700 pb-3">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-8 mb-3 text-xl font-semibold text-white leading-snug border-b border-zinc-700/60 pb-2">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-6 mb-2 text-base font-semibold text-zinc-100 leading-snug">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="mt-4 mb-2 text-sm font-semibold text-zinc-200 uppercase tracking-wide">
        {children}
      </h4>
    ),
    h5: ({ children }) => (
      <h5 className="mt-4 mb-1 text-sm font-medium text-zinc-300">
        {children}
      </h5>
    ),
    h6: ({ children }) => (
      <h6 className="mt-3 mb-1 text-xs font-medium text-zinc-400 uppercase tracking-widest">
        {children}
      </h6>
    ),

    // ── Paragraphs ────────────────────────────────────────────────────────────
    p: ({ children }) => (
      <p className="my-3 text-sm text-zinc-300 leading-relaxed">
        {children}
      </p>
    ),

    // ── Horizontal rule ───────────────────────────────────────────────────────
    hr: () => (
      <div className="my-6 flex items-center gap-3">
        <div className="flex-1 border-t border-zinc-700" />
        <div className="h-1 w-1 rounded-full bg-zinc-600" />
        <div className="flex-1 border-t border-zinc-700" />
      </div>
    ),

    // ── Blockquote ────────────────────────────────────────────────────────────
    blockquote: ({ children }) => (
      <blockquote className="my-4 border-l-4 border-blue-500/60 bg-blue-950/20 pl-4 pr-3 py-2 rounded-r-md">
        <div className="text-sm text-blue-200/80 italic leading-relaxed">{children}</div>
      </blockquote>
    ),

    // ── Lists ─────────────────────────────────────────────────────────────────
    ul: ({ children }) => (
      <ul className="my-3 space-y-1 pl-5">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="my-3 space-y-1 pl-5 list-decimal">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="text-sm text-zinc-300 leading-relaxed marker:text-zinc-500">
        {children}
      </li>
    ),

    // ── Inline elements ───────────────────────────────────────────────────────
    strong: ({ children }) => (
      <strong className="font-semibold text-zinc-100">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="text-zinc-300 italic">{children}</em>
    ),

    // ── Code ──────────────────────────────────────────────────────────────────
    code: ({ children, className: cls }) => {
      const isBlock = cls?.includes('language-');
      if (isBlock) return <code className={cls}>{children}</code>;
      return (
        <code className="rounded bg-zinc-700/70 px-1.5 py-0.5 text-xs font-mono text-emerald-300">
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="my-4 overflow-x-auto rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-xs font-mono text-zinc-300 leading-relaxed">
        {children}
      </pre>
    ),

    // ── Images ────────────────────────────────────────────────────────────────
    img: ({ src, alt }) => {
      const srcStr = typeof src === 'string' ? src : undefined;
      const isPlaceholder = srcStr?.startsWith('image-');
      const resolved = srcStr && imageMap?.[srcStr] ? imageMap[srcStr] : (!isPlaceholder ? srcStr : null);

      if (!resolved) {
        // Styled image placeholder
        return (
          <div className="my-5 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-600 bg-zinc-800/40 py-8 px-4">
            <svg className="h-8 w-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
            <p className="text-xs text-zinc-500">
              {alt ? <><span className="font-medium text-zinc-400">Image:</span> {alt}</> : 'Image placeholder'}
            </p>
            {srcStr && <p className="text-xs text-zinc-600 font-mono">{srcStr}</p>}
          </div>
        );
      }

      return (
        <img
          src={resolved}
          alt={alt ?? ''}
          className="my-5 rounded-lg max-w-full h-auto border border-zinc-700/50"
          loading="lazy"
        />
      );
    },

    // ── Tables ────────────────────────────────────────────────────────────────
    table: ({ children }) => (
      <div className="my-5 overflow-x-auto rounded-lg border border-zinc-700">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-zinc-800/80">{children}</thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-zinc-700/50">{children}</tbody>
    ),
    tr: ({ children }) => (
      <tr className="hover:bg-zinc-800/30 transition-colors">{children}</tr>
    ),
    th: ({ children }) => (
      <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-300 uppercase tracking-wide">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2.5 text-xs text-zinc-400 border-t border-zinc-700/50">
        {children}
      </td>
    ),

    // ── Links ─────────────────────────────────────────────────────────────────
    a: ({ children, href }) => (
      <a href={href} className="text-blue-400 hover:text-blue-300 underline underline-offset-2" target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
  };

  return (
    <div className={`article-content ${className ?? ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
