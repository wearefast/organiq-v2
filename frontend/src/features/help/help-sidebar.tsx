'use client';

import { useState } from 'react';
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
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { HelpCategory, HelpArticle } from './help-content';

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

interface HelpSidebarProps {
  categories: HelpCategory[];
  activeCategoryId: string | null;
  activeArticleId: string | null;
  onSelectArticle: (categoryId: string, articleId: string) => void;
  onSelectCategory: (categoryId: string) => void;
}

export function HelpSidebar({
  categories,
  activeCategoryId,
  activeArticleId,
  onSelectArticle,
  onSelectCategory,
}: HelpSidebarProps) {
  // Track which categories are expanded (default: only the active one)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(activeCategoryId ? [activeCategoryId] : []),
  );

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCategoryClick = (cat: HelpCategory) => {
    toggleExpanded(cat.id);
    onSelectCategory(cat.id);
  };

  return (
    <nav className="flex flex-col gap-0.5">
      {categories.map((cat) => {
        const Icon = ICON_MAP[cat.icon] ?? Rocket;
        const isExpanded = expandedIds.has(cat.id);
        const isActiveCategory = activeCategoryId === cat.id;

        return (
          <div key={cat.id}>
            {/* Category row */}
            <button
              onClick={() => handleCategoryClick(cat)}
              className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                isActiveCategory
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
            >
              <Icon className={`h-4 w-4 flex-shrink-0 ${isActiveCategory ? 'text-rose-500' : 'text-zinc-500'}`} />
              <span className="flex-1 font-medium">{cat.title}</span>
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-zinc-600" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-zinc-600" />
              )}
            </button>

            {/* Article sub-items */}
            {isExpanded && (
              <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-zinc-800 pl-3">
                {cat.articles.map((article: HelpArticle) => {
                  const isActive = activeArticleId === article.id;
                  return (
                    <button
                      key={article.id}
                      onClick={() => onSelectArticle(cat.id, article.id)}
                      className={`w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                        isActive
                          ? 'bg-rose-500/10 text-rose-400 font-medium'
                          : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
                      }`}
                    >
                      {article.title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
