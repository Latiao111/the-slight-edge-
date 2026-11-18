import { ArrowRight, BookOpen, Sparkles } from 'lucide-react';
import type { BookData, BookSection, TranslationMap } from '../types/book';
import { getBookTranslationProgress, getSectionTranslationStats } from '../utils/translationAlign';
import { MonographFrontispiece } from './SlightEdgeDiagram';

interface BookOverviewProps {
  book: BookData;
  translations: TranslationMap;
  onOpenSection: (sectionId: string) => void;
  onOpenExport: () => void;
}

export function BookOverview({
  book,
  translations,
  onOpenSection,
  onOpenExport,
}: BookOverviewProps) {
  const progress = getBookTranslationProgress(book, translations);

  const frontSections = book.sections.filter((s) => s.category === 'front');
  const part1Sections = book.sections.filter((s) => s.category === 'part1');
  const part2Sections = book.sections.filter((s) => s.category === 'part2');
  const backSections = book.sections.filter((s) => s.category === 'back');

  const renderSectionRow = (section: BookSection) => {
    const stats = getSectionTranslationStats(section, translations);
    const statusText = stats.isComplete
      ? '已完整译出'
      : stats.translated > 0
      ? `已译 ${stats.percentage}%`
      : '导读就绪 · 可实时全文翻译';

    return (
      <button
        key={section.id}
        type="button"
        onClick={() => onOpenSection(section.id)}
        className="group flex w-full items-baseline justify-between gap-4 border-b border-stone-200/90 py-4 text-left transition-colors hover:border-[#78350F]/50 dark:border-zinc-800/90 dark:hover:border-amber-500/60 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#78350F] dark:focus-visible:outline-amber-400"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            {section.chapterNumber !== undefined && (
              <span className="font-num text-xs font-medium text-[#78350F] dark:text-amber-400 shrink-0">
                {String(section.chapterNumber).padStart(2, '0')}
              </span>
            )}
            <span className="font-editorial text-base font-medium text-stone-900 group-hover:text-[#78350F] dark:text-stone-100 dark:group-hover:text-amber-400 transition-colors sm:text-lg">
              {section.titleZh}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500 dark:text-zinc-400">
            <span className="truncate">{section.titleEn}</span>
            <span aria-hidden="true">·</span>
            <span className="font-num">{section.wordCount.toLocaleString()} 英文词</span>
            <span aria-hidden="true">·</span>
            <span
              className={
                stats.isComplete
                  ? 'text-[#14532D] font-medium dark:text-emerald-400'
                  : 'text-stone-500 dark:text-zinc-400'
              }
            >
              {statusText}
            </span>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-stone-400 transition-transform group-hover:translate-x-1 group-hover:text-[#78350F] dark:text-zinc-500 dark:group-hover:text-amber-400" />
      </button>
    );
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8 sm:py-14">
      {/* Editorial Monograph Frontispiece Split */}
      <section className="grid grid-cols-1 items-stretch gap-10 border-b border-stone-200 pb-14 dark:border-zinc-800 lg:grid-cols-12">
        <div className="flex flex-col justify-between lg:col-span-7">
          <div>
            <p className="text-xs tracking-[0.2em] text-stone-500 uppercase dark:text-zinc-400">
              {book.editionZh} · 全书汉译与中英双语精读版
            </p>
            <h1 className="font-editorial -ml-[0.35em] mt-4 text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl text-balance dark:text-stone-100">
              《{book.titleZh}》
            </h1>
            <p className="font-editorial mt-3 text-xl text-stone-700 sm:text-2xl text-balance dark:text-stone-300">
              {book.subtitleZh}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-stone-600 max-w-xl dark:text-zinc-400">
              {book.authorZh}。本书揭示了一个看似平淡却改变无数人命运的底层规律：真正决定人生走向成功还是滑向平庸的，并非惊天动地的“量子飞跃”，而是每天那些“做起来容易，不做也容易”的微小日常自律。
            </p>
          </div>

          <div className="mt-8 space-y-6">
            {/* Unboxed Clean Reading Metrics */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-b border-stone-200 py-3 text-xs text-stone-600 dark:border-zinc-800 dark:text-zinc-400">
              <span>
                全书共 <strong className="font-num text-stone-900 dark:text-stone-100">{book.sections.length}</strong> 个章节与附录
              </span>
              <span aria-hidden="true">·</span>
              <span>
                已精译 <strong className="font-num text-[#14532D] dark:text-emerald-400">{progress.translatedSections}</strong> /{' '}
                <span className="font-num">{progress.totalSections}</span> 节（
                <span className="font-num">{progress.percentage}%</span>）
              </span>
              <span aria-hidden="true">·</span>
              <span>支持纯中文、双语对照与 EPUB 电子书导出</span>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onOpenSection('ch-1')}
                className="inline-flex items-center gap-2 rounded-md bg-[#78350F] px-6 py-3 text-sm font-medium text-[#FBF9F5] transition-colors hover:bg-[#5C280B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#78350F] dark:bg-amber-600 dark:text-stone-950 dark:font-semibold dark:hover:bg-amber-500 dark:focus-visible:outline-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BookOpen className="h-4 w-4" />
                <span>开始精读第 1 章</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenSection('preface')}
                className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-transparent px-5 py-3 text-sm font-medium text-stone-800 transition-colors hover:border-stone-500 hover:bg-[#F3EFE6] dark:border-zinc-700 dark:text-stone-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-900 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>先读序言</span>
              </button>

              <button
                type="button"
                onClick={onOpenExport}
                className="inline-flex items-center gap-1.5 px-2 py-2 text-sm font-medium text-stone-600 underline decoration-stone-300 underline-offset-4 transition-colors hover:text-[#78350F] hover:decoration-[#78350F] dark:text-zinc-400 dark:decoration-zinc-700 dark:hover:text-amber-400 dark:hover:decoration-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                <span>批量翻译剩余章节</span>
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <MonographFrontispiece translatedPercentage={progress.percentage} />
        </div>
      </section>

      {/* Complete Table of Contents */}
      <section className="pt-12" aria-labelledby="toc-heading">
        <div className="mb-8 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs tracking-[0.2em] text-stone-500 uppercase dark:text-zinc-400">
              Table of Contents
            </p>
            <h2
              id="toc-heading"
              className="font-editorial mt-1 text-2xl font-semibold text-stone-900 sm:text-3xl dark:text-stone-100"
            >
              全书目录与译文索引
            </h2>
          </div>
          <p className="text-xs text-stone-500 dark:text-zinc-400">
            点击任意章节进入精读模式；未翻译章节均附带核心要点导读，并支持一键实时翻译
          </p>
        </div>

        {/* Front Matter */}
        <div className="mb-10">
          <h3 className="mb-2 text-xs font-semibold tracking-widest text-stone-500 uppercase dark:text-zinc-400">
            卷首 · Front Matter
          </h3>
          <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
            {frontSections.map(renderSectionRow)}
          </div>
        </div>

        {/* Part I & Part II Two-Column Catalog */}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <div>
            <div className="mb-3 border-b border-stone-900 pb-2 dark:border-zinc-700">
              <p className="text-xs tracking-widest text-[#78350F] uppercase dark:text-amber-400">
                Part I
              </p>
              <h3 className="font-editorial mt-0.5 text-xl font-semibold text-stone-900 dark:text-stone-100">
                第一部分：微小的优势如何运作
              </h3>
            </div>
            <div>{part1Sections.map(renderSectionRow)}</div>
          </div>

          <div>
            <div className="mb-3 border-b border-stone-900 pb-2 dark:border-zinc-700">
              <p className="text-xs tracking-widest text-[#78350F] uppercase dark:text-amber-400">
                Part II
              </p>
              <h3 className="font-editorial mt-0.5 text-xl font-semibold text-stone-900 dark:text-stone-100">
                第二部分：践行微小的优势
              </h3>
            </div>
            <div>{part2Sections.map(renderSectionRow)}</div>
          </div>
        </div>

        {/* Back Matter */}
        <div className="mt-12">
          <h3 className="mb-2 text-xs font-semibold tracking-widest text-stone-500 uppercase dark:text-zinc-400">
            尾声与附录 · Back Matter
          </h3>
          <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
            {backSections.map(renderSectionRow)}
          </div>
        </div>
      </section>
    </main>
  );
}
