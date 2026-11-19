import { ArrowRight, BookOpen, Compass, Search, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { RELATED_KNOWLEDGE_ITEMS } from '../data/relatedKnowledge';
import type { BookData, TranslationMap } from '../types/book';
import { searchBookAndKnowledge, type BookSearchHit } from '../utils/bookSearch';

interface BookSearchModalProps {
  isOpen: boolean;
  book: BookData;
  translations: TranslationMap;
  onClose: () => void;
  onSelectSection: (sectionId: string, paragraphId?: string) => void;
  onExploreTopic: (prompt: string) => void;
}

const SUGGESTED_QUERIES = [
  '量子飞跃',
  '复利',
  '爱默生',
  '肖恩·阿克尔',
  '自动驾驶',
  'compound interest',
  'easy not to do',
  'Ripple Effect',
];

export function BookSearchModal({
  isOpen,
  book,
  translations,
  onClose,
  onSelectSection,
  onExploreTopic,
}: BookSearchModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const raf = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose]);

  const hits = useMemo(() => {
    if (!query.trim()) return [];
    return searchBookAndKnowledge({
      book,
      translations,
      knowledgeItems: RELATED_KNOWLEDGE_ITEMS,
      query,
      limit: 20,
    });
  }, [book, translations, query]);

  if (!isOpen) return null;

  const handleHitClick = (hit: BookSearchHit) => {
    onSelectSection(hit.sectionId, hit.paragraphId);
    onClose();
  };

  const kindLabel = (hit: BookSearchHit): string => {
    if (hit.kind === 'knowledge') return '延伸概念';
    if (hit.kind === 'section') return '章节标题';
    if (hit.kind === 'essential') return '核心要点';
    return hit.matchedLang === 'zh' ? '中文正文' : '英文原著';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-16 sm:pt-24"
      role="dialog"
      aria-modal="true"
      aria-label="全书中英与延伸知识检索"
      data-testid="book-search-modal"
    >
      <div
        className="fixed inset-0 bg-stone-950/45 backdrop-blur-xs dark:bg-black/75"
        onClick={onClose}
      />

      <div className="relative z-10 flex max-h-[75vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-stone-200 bg-[#FBF9F5] shadow-2xl dark:border-zinc-800 dark:bg-[#111317]">
        {/* Search Input Header */}
        <div className="flex items-center gap-3 border-b border-stone-200 px-4 py-3.5 dark:border-zinc-800">
          <Search className="h-4 w-4 shrink-0 text-[#78350F] dark:text-amber-400" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索全书中英正文、章节要点、思想家或相关概念…"
            aria-label="全文检索关键词"
            data-testid="book-search-input"
            className="w-full bg-transparent text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none dark:text-stone-100 dark:placeholder:text-zinc-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-xs text-stone-400 hover:text-stone-800 dark:text-zinc-500 dark:hover:text-stone-200 cursor-pointer whitespace-nowrap"
            >
              清空
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭检索框"
            className="flex h-7 w-7 items-center justify-center rounded text-stone-500 hover:bg-stone-200/60 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-stone-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!query.trim() ? (
            <div className="space-y-4">
              <p className="text-xs text-stone-500 dark:text-zinc-400">
                可同时检索 21 个章节的中文译文、英文原文、核心要点及 12 项跨学科延伸概念：
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUERIES.map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => setQuery(kw)}
                    className="rounded-md border border-stone-200 bg-[#F3EFE6]/70 px-2.5 py-1.5 text-xs text-stone-700 transition-colors hover:border-[#78350F] hover:text-[#78350F] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-amber-500 dark:hover:text-amber-400 cursor-pointer"
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>
          ) : hits.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-stone-600 dark:text-zinc-400">
                全书与延伸词条中暂未直接匹配到「{query}」。
              </p>
              <button
                type="button"
                onClick={() => {
                  onExploreTopic(
                    `请结合《微小的优势》的核心思想，帮我深入讲解与「${query.trim()}」相关的书内联系与跨学科延伸知识。`
                  );
                  onClose();
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[#78350F] px-4 py-2 text-xs font-medium text-[#FBF9F5] hover:bg-[#5C280B] dark:bg-amber-600 dark:text-stone-950 dark:font-semibold dark:hover:bg-amber-500 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>请导师延伸讲解「{query.trim()}」</span>
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="mb-2 flex items-center justify-between text-xs text-stone-500 dark:text-zinc-400">
                <span className="font-num">找到 {hits.length} 条相关定位</span>
                <button
                  type="button"
                  onClick={() => {
                    onExploreTopic(
                      `请结合《微小的优势》全书内容，系统梳理与「${query.trim()}」相关的观点、原理与跨学科延伸知识。`
                    );
                    onClose();
                  }}
                  className="inline-flex items-center gap-1 text-[#78350F] hover:underline dark:text-amber-400 cursor-pointer"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>请老师系统串讲此主题</span>
                </button>
              </div>

              <ul className="divide-y divide-stone-200/70 dark:divide-zinc-800/80">
                {hits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onClick={() => handleHitClick(hit)}
                      data-testid="search-result-item"
                      className="group flex w-full items-start justify-between gap-3 py-3 text-left transition-colors hover:bg-[#F3EFE6]/60 px-2 rounded-md dark:hover:bg-zinc-900/70 cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-stone-500 dark:text-zinc-400">
                          <span className="inline-flex items-center gap-1 font-medium text-[#78350F] dark:text-amber-400">
                            {hit.kind === 'knowledge' ? (
                              <Compass className="h-3 w-3" />
                            ) : (
                              <BookOpen className="h-3 w-3" />
                            )}
                            {kindLabel(hit)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{hit.sectionTitleZh}</span>
                        </div>
                        <p className="font-editorial mt-1 text-sm font-medium text-stone-900 group-hover:text-[#78350F] dark:text-stone-100 dark:group-hover:text-amber-400">
                          {hit.title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-stone-600 dark:text-zinc-400">
                          {hit.snippet}
                        </p>
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-stone-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#78350F] dark:text-zinc-500 dark:group-hover:text-amber-400" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer Hints */}
        <div className="flex items-center justify-between border-t border-stone-200 px-4 py-2 text-[11px] text-stone-400 dark:border-zinc-800 dark:text-zinc-500">
          <span>点击任意结果可直达对应章节段落并高亮定位</span>
          <span className="font-num">ESC 关闭 · ⌘/Ctrl + K 随时呼出</span>
        </div>
      </div>
    </div>
  );
}
