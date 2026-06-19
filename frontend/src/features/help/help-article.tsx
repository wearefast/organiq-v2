'use client';

import { Clock, ChevronRight } from 'lucide-react';
import { MarkdownPreview } from '@/shared/components/markdown-preview';
import type { HelpArticle, HelpCategory } from './help-content';

interface HelpArticleViewProps {
  category: HelpCategory;
  article: HelpArticle;
  onSelectCategory: (categoryId: string) => void;
}

export function HelpArticleView({ category, article, onSelectCategory }: HelpArticleViewProps) {
  return (
    <article className="max-w-3xl">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-zinc-500">
        <button
          onClick={() => onSelectCategory(category.id)}
          className="transition-colors hover:text-zinc-300"
        >
          Help Center
        </button>
        <ChevronRight className="h-3 w-3 flex-shrink-0" />
        <button
          onClick={() => onSelectCategory(category.id)}
          className="transition-colors hover:text-zinc-300"
        >
          {category.title}
        </button>
        <ChevronRight className="h-3 w-3 flex-shrink-0" />
        <span className="text-zinc-400">{article.title}</span>
      </nav>

      {/* Article header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">{article.title}</h1>
        <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
          <Clock className="h-3.5 w-3.5" />
          <span>{article.estimatedReadTime} min read</span>
          {article.tags.length > 0 && (
            <>
              <span className="mx-1 text-zinc-700">·</span>
              <div className="flex flex-wrap gap-1">
                {article.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-0.5 text-zinc-500"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Article body */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <MarkdownPreview content={article.body} />
      </div>
    </article>
  );
}
