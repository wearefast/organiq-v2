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
    img: ({ src, alt, ...props }) => {
      // Resolve image-N placeholders to base64 data URIs
      const srcStr = typeof src === 'string' ? src : undefined;
      const resolved = srcStr && imageMap?.[srcStr] ? imageMap[srcStr] : srcStr;
      return (
        <img
          {...props}
          src={resolved}
          alt={alt ?? ''}
          className="my-4 rounded-lg max-w-full h-auto"
          loading="lazy"
        />
      );
    },
    // Style tables for dark theme
    table: ({ children, ...props }) => (
      <div className="overflow-x-auto my-4">
        <table {...props} className="w-full border-collapse text-sm">
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }) => (
      <th {...props} className="border border-zinc-600 bg-zinc-700/50 px-3 py-2 text-left text-xs font-medium text-zinc-300">
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td {...props} className="border border-zinc-700 px-3 py-2 text-xs text-zinc-400">
        {children}
      </td>
    ),
    // Links
    a: ({ children, href, ...props }) => (
      <a {...props} href={href} className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
  };

  return (
    <div className={`prose prose-invert prose-sm max-w-none ${className ?? ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
