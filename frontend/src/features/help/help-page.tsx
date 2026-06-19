'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Rocket,
  Workflow,
  Clock,
  Tag,
  Map,
  FileText,
  BarChart2,
  Bot,
  Eye,
  Calendar,
  CreditCard,
  Search,
  ArrowRight,
} from 'lucide-react';
import { HELP_CATEGORIES, searchHelp } from './help-content';
import type { HelpCategory, HelpArticle } from './help-content';
import { HelpSearch } from './help-search';
import { HelpSidebar } from './help-sidebar';
import { HelpArticleView } from './help-article';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Rocket,
  Workflow,
  Clock,
  Tag,
  Map,
  FileText,
  BarChart2,
  Bot,
  Eye,
  Calendar,
  CreditCard,
};

// ─── Category landing card ────────────────────────────────────────────────────

function CategoryCard({
  category,
  onSelect,
}: {
  category: HelpCategory;
  onSelect: (categoryId: string) => void;
}) {
  const Icon = ICON_MAP[category.icon] ?? Rocket;
  return (
    <button
      onClick={() => onSelect(category.id)}
      className="group flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 text-left transition-all hover:border-zinc-700 hover:bg-zinc-800/60"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10">
          <Icon className="h-4.5 w-4.5 text-rose-400" />
        </div>
        <ArrowRight className="h-4 w-4 text-zinc-700 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-zinc-100">{category.title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{category.description}</p>
      </div>
      <div className="text-xs text-zinc-600">
        {category.articles.length} article{category.articles.length !== 1 ? 's' : ''}
      </div>
    </button>
  );
}

// ─── Search results view ──────────────────────────────────────────────────────

function SearchResults({
  query,
  onSelect,
}: {
  query: string;
  onSelect: (categoryId: string, articleId: string) => void;
}) {
  const results = useMemo(() => searchHelp(query), [query]);

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Search className="mb-4 h-10 w-10 text-zinc-700" />
        <p className="text-sm font-medium text-zinc-400">No results for &ldquo;{query}&rdquo;</p>
        <p className="mt-1 text-xs text-zinc-600">Try a different search term or browse categories below</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-xs text-zinc-500">
        {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
      </p>
      <div className="flex flex-col gap-2">
        {results.map(({ category, article, matchType }) => (
          <button
            key={`${category.id}-${article.id}`}
            onClick={() => onSelect(category.id, article.id)}
            className="group flex flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-left transition-all hover:border-zinc-700 hover:bg-zinc-800/60"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-200 group-hover:text-white">
                {article.title}
              </span>
              {matchType === 'title' && (
                <span className="rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-400">
                  title match
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span>{category.title}</span>
              <span className="text-zinc-700">·</span>
              <span>{article.estimatedReadTime} min read</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Category landing view ────────────────────────────────────────────────────

function CategoryLanding({
  category,
  onSelectArticle,
}: {
  category: HelpCategory;
  onSelectArticle: (categoryId: string, articleId: string) => void;
}) {
  const Icon = ICON_MAP[category.icon] ?? Rocket;
  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10">
          <Icon className="h-5 w-5 text-rose-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-100">{category.title}</h1>
          <p className="text-sm text-zinc-500">{category.description}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {category.articles.map((article: HelpArticle) => (
          <button
            key={article.id}
            onClick={() => onSelectArticle(category.id, article.id)}
            className="group flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-left transition-all hover:border-zinc-700 hover:bg-zinc-800/60"
          >
            <div>
              <p className="text-sm font-medium text-zinc-200 group-hover:text-white">{article.title}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{article.estimatedReadTime} min read</p>
            </div>
            <ArrowRight className="h-4 w-4 flex-shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Home view ────────────────────────────────────────────────────────────────

function HelpHome({ onSelectCategory }: { onSelectCategory: (id: string) => void }) {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Help Center</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Everything you need to get the most out of Organiq.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {HELP_CATEGORIES.map((cat) => (
          <CategoryCard key={cat.id} category={cat} onSelect={onSelectCategory} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Help Page ───────────────────────────────────────────────────────────

export function HelpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState('');

  const categoryParam = searchParams.get('category');
  const articleParam = searchParams.get('article');

  const activeCategory = useMemo(
    () => HELP_CATEGORIES.find((c) => c.id === categoryParam) ?? null,
    [categoryParam],
  );

  const activeArticle = useMemo(() => {
    if (!activeCategory || !articleParam) return null;
    return activeCategory.articles.find((a) => a.id === articleParam) ?? null;
  }, [activeCategory, articleParam]);

  const updateUrl = useCallback(
    (categoryId: string | null, articleId: string | null) => {
      const params = new URLSearchParams();
      if (categoryId) params.set('category', categoryId);
      if (articleId) params.set('article', articleId);
      const qs = params.toString();
      router.push(`/help${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [router],
  );

  const handleSelectCategory = useCallback(
    (categoryId: string) => {
      setSearchQuery('');
      updateUrl(categoryId, null);
    },
    [updateUrl],
  );

  const handleSelectArticle = useCallback(
    (categoryId: string, articleId: string) => {
      setSearchQuery('');
      updateUrl(categoryId, articleId);
    },
    [updateUrl],
  );

  const handleHomeClick = useCallback(() => {
    setSearchQuery('');
    updateUrl(null, null);
  }, [updateUrl]);

  // Keyboard shortcut: Escape clears article → category → home
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (articleParam) {
          updateUrl(categoryParam, null);
        } else if (categoryParam) {
          updateUrl(null, null);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [articleParam, categoryParam, updateUrl]);

  const showSearch = searchQuery.trim().length > 0;

  return (
    <div className="flex min-h-[calc(100vh-48px)] gap-6">
      {/* ── Left sidebar ───────────────────────────────────────────────────── */}
      <aside className="hidden w-56 flex-shrink-0 lg:block">
        <div className="sticky top-[calc(48px+24px)] flex flex-col gap-4">
          {/* Back to home */}
          <button
            onClick={handleHomeClick}
            className="text-left text-xs font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
          >
            Help Center
          </button>
          <HelpSidebar
            categories={HELP_CATEGORIES}
            activeCategoryId={activeCategory?.id ?? null}
            activeArticleId={activeArticle?.id ?? null}
            onSelectArticle={handleSelectArticle}
            onSelectCategory={handleSelectCategory}
          />
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="min-w-0 flex-1">
        {/* Search bar */}
        <div className="mb-6">
          <HelpSearch value={searchQuery} onChange={setSearchQuery} autoFocus={false} />
        </div>

        {/* Content area */}
        {showSearch ? (
          <SearchResults query={searchQuery} onSelect={handleSelectArticle} />
        ) : activeArticle && activeCategory ? (
          <HelpArticleView
            category={activeCategory}
            article={activeArticle}
            onSelectCategory={handleSelectCategory}
          />
        ) : activeCategory ? (
          <CategoryLanding category={activeCategory} onSelectArticle={handleSelectArticle} />
        ) : (
          <HelpHome onSelectCategory={handleSelectCategory} />
        )}
      </main>
    </div>
  );
}
