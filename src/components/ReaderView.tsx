import {
  AlertCircle,
  ArrowLeftRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Languages,
  List,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  BilingualOrder,
  BookData,
  BookParagraph,
  FontScale,
  ReadingMode,
  TeacherMode,
  TranslationMap,
} from '../types/book';
import {
  calculateBookReadingProgress,
  computeArticleScrollRatio,
} from '../utils/readingProgress';
import { getSectionTranslationStats } from '../utils/translationAlign';
import { RollerCoasterDiagram, TwoPathsDiagram } from './SlightEdgeDiagram';

interface ReaderViewProps {
  book: BookData;
  activeSectionId: string;
  translations: TranslationMap;
  readingMode: ReadingMode;
  bilingualOrder: BilingualOrder;
  fontScale: FontScale;
  translatingSectionId: string | null;
  translationBatchProgress: { current: number; total: number } | null;
  translationError: string | null;
  teacherOpen?: boolean;
  onToggleTeacher?: () => void;
  onLearnText?: (text: string, mode?: TeacherMode) => void;
  onSelectSection: (sectionId: string) => void;
  onChangeMode: (mode: ReadingMode) => void;
  onChangeBilingualOrder: (order: BilingualOrder) => void;
  onChangeFontScale: (scale: FontScale) => void;
  onTranslateSection: (sectionId: string, force?: boolean) => void;
  onCancelTranslation: () => void;
}

const FONT_SIZE_CLASSES: Record<FontScale, string> = {
  sm: 'text-[15px] leading-[1.85]',
  md: 'text-[17px] leading-[1.9]',
  lg: 'text-[19px] leading-[1.95]',
};

export function ReaderView({
  book,
  activeSectionId,
  translations,
  readingMode,
  bilingualOrder,
  fontScale,
  translatingSectionId,
  translationBatchProgress,
  translationError,
  teacherOpen = false,
  onToggleTeacher,
  onLearnText,
  onSelectSection,
  onChangeMode,
  onChangeBilingualOrder,
  onChangeFontScale,
  onTranslateSection,
  onCancelTranslation,
}: ReaderViewProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sectionScrollRatio, setSectionScrollRatio] = useState(0);
  const articleRef = useRef<HTMLElement | null>(null);

  const sectionIndex = Math.max(
    0,
    book.sections.findIndex((s) => s.id === activeSectionId)
  );
  const section = book.sections[sectionIndex] ?? book.sections[0];
  const prevSection = sectionIndex > 0 ? book.sections[sectionIndex - 1] : null;
  const nextSection =
    sectionIndex < book.sections.length - 1 ? book.sections[sectionIndex + 1] : null;

  const sectionTrans = translations[section.id] ?? {};
  const stats = getSectionTranslationStats(section, translations);
  const isTranslatingThis = translatingSectionId === section.id;

  const updateScrollProgress = useCallback(() => {
    const el = articleRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const articleBottomInDoc = rect.bottom + window.scrollY;
    const nextRatio = computeArticleScrollRatio({
      scrollY: window.scrollY,
      viewportHeight: window.innerHeight,
      articleBottomInDoc,
    });
    setSectionScrollRatio((prev) => (Math.abs(prev - nextRatio) < 0.0005 ? prev : nextRatio));
  }, []);

  useEffect(() => {
    setSectionScrollRatio(0);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    const rafId = window.requestAnimationFrame(() => {
      updateScrollProgress();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [activeSectionId, updateScrollProgress]);

  useEffect(() => {
    let rafId = 0;
    const scheduleUpdate = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        updateScrollProgress();
      });
    };

    scheduleUpdate();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && articleRef.current) {
      resizeObserver = new ResizeObserver(scheduleUpdate);
      resizeObserver.observe(articleRef.current);
    }

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      resizeObserver?.disconnect();
    };
  }, [updateScrollProgress, readingMode, fontScale, bilingualOrder]);

  const bookProgress = useMemo(
    () => calculateBookReadingProgress(book.sections, section.id, sectionScrollRatio),
    [book.sections, section.id, sectionScrollRatio]
  );

  const bodyTextClass = FONT_SIZE_CLASSES[fontScale];

  const renderParagraph = (p: BookParagraph, idx: number) => {
    const zh = sectionTrans[p.id];

    // Special structural headings inside chapters
    if (p.kind === 'epigraph' || p.kind === 'attribution') {
      return null; // Rendered in the chapter header block
    }

    if (p.kind === 'subheading' || p.kind === 'story_header' || p.kind === 'essential_header') {
      const displayZh =
        zh ||
        (p.kind === 'story_header'
          ? '来自《微小的优势》读者的真实故事'
          : p.kind === 'essential_header' && section.chapterNumber
          ? `第 ${section.chapterNumber} 章核心要点`
          : undefined);

      if (readingMode === 'bilingual') {
        const zhHeading = (
          <h2 className="font-editorial text-xl font-semibold text-stone-900 sm:text-2xl dark:text-stone-100">
            {displayZh || (
              <span className="text-stone-400 italic font-normal text-base dark:text-zinc-500">
                （小节标题待译）
              </span>
            )}
          </h2>
        );
        const enHeading = (
          <h2 className="font-editorial text-xl font-semibold text-stone-700 sm:text-2xl dark:text-stone-300">
            {p.text}
          </h2>
        );
        return (
          <div
            key={p.id}
            className={`mt-12 mb-5 grid grid-cols-1 gap-4 border-t border-stone-200 pt-6 md:grid-cols-2 md:gap-10 dark:border-zinc-800 ${
              p.kind === 'story_header' ? 'border-[#78350F]/30 dark:border-amber-500/40' : ''
            }`}
          >
            {bilingualOrder === 'en-zh' ? (
              <>
                {enHeading}
                {zhHeading}
              </>
            ) : (
              <>
                {zhHeading}
                {enHeading}
              </>
            )}
          </div>
        );
      }

      if (readingMode === 'en') {
        return (
          <div
            key={p.id}
            className={`mt-12 mb-5 border-t border-stone-200 pt-6 dark:border-zinc-800 ${
              p.kind === 'story_header' ? 'border-[#78350F]/30 dark:border-amber-500/40' : ''
            }`}
          >
            <h2 className="font-editorial text-xl font-semibold text-stone-900 sm:text-2xl dark:text-stone-100">
              {p.text}
            </h2>
          </div>
        );
      }

      return (
        <div
          key={p.id}
          className={`mt-12 mb-5 border-t border-stone-200 pt-6 dark:border-zinc-800 ${
            p.kind === 'story_header' ? 'border-[#78350F]/30 dark:border-amber-500/40' : ''
          }`}
        >
          <h2 className="font-editorial text-xl font-semibold text-stone-900 sm:text-2xl dark:text-stone-100">
            {displayZh || p.text}
          </h2>
          {displayZh && (
            <p className="font-editorial mt-1 text-sm italic text-stone-500 dark:text-zinc-400">
              {p.text}
            </p>
          )}
        </div>
      );
    }

    if (p.kind === 'essential_item') {
      const itemIdx =
        section.paragraphs
          .slice(0, idx)
          .filter((prev) => prev.kind === 'essential_item').length;
      const fallbackEssentialZh = section.essentialPointsZh?.[itemIdx];
      const displayZh = zh || fallbackEssentialZh;

      if (readingMode === 'bilingual') {
        const numBadge = (
          <span className="font-num mr-2 text-xs font-semibold text-[#78350F] dark:text-amber-400">
            0{itemIdx + 1}.
          </span>
        );
        return (
          <div
            key={p.id}
            className="grid grid-cols-1 gap-4 border-b border-stone-200/70 py-4 md:grid-cols-2 md:gap-10 dark:border-zinc-800/80"
          >
            {bilingualOrder === 'en-zh' ? (
              <>
                <div className={`font-editorial text-stone-800 dark:text-stone-200 ${bodyTextClass}`}>
                  {numBadge}
                  {p.text}
                </div>
                <div className={`font-editorial text-stone-700 dark:text-stone-300 ${bodyTextClass}`}>
                  {displayZh || <span className="text-stone-400 dark:text-zinc-500">待翻译</span>}
                </div>
              </>
            ) : (
              <>
                <div className={`font-editorial text-stone-800 dark:text-stone-200 ${bodyTextClass}`}>
                  {numBadge}
                  {displayZh || <span className="text-stone-400 dark:text-zinc-500">待翻译</span>}
                </div>
                <div className={`font-editorial text-stone-600 dark:text-zinc-400 ${bodyTextClass}`}>
                  {p.text}
                </div>
              </>
            )}
          </div>
        );
      }

      return (
        <div
          key={p.id}
          className="flex items-baseline gap-3 border-b border-stone-200/70 py-3 dark:border-zinc-800/80"
        >
          <span className="font-num text-xs font-semibold text-[#78350F] dark:text-amber-400 shrink-0">
            0{itemIdx + 1}.
          </span>
          <p className={`font-editorial text-stone-800 dark:text-stone-200 ${bodyTextClass}`}>
            {readingMode === 'en' ? p.text : displayZh || p.text}
          </p>
        </div>
      );
    }

    // Standard body paragraph
    const isFirstBody =
      section.paragraphs.findIndex((item) => item.kind === 'body') === idx;
    const canDropCapEn = /^[A-Za-z]/.test(p.text.trim());
    const canDropCapZh = Boolean(zh && /^[\u4e00-\u9fff]/.test(zh.trim()));

    const showDiagramAfter =
      (p.id === 'ch-1-p-60' && <RollerCoasterDiagram />) ||
      (p.id === 'ch-10-p-21' && <TwoPathsDiagram />) ||
      null;

    if (readingMode === 'bilingual') {
      const zhCol = (
        <div
          className={`font-editorial ${
            bilingualOrder === 'zh-en'
              ? 'text-stone-900 dark:text-stone-100'
              : 'text-stone-700 dark:text-stone-300'
          } ${bodyTextClass}`}
        >
          {zh ? (
            zh
          ) : (
            <span className="text-sm text-stone-400 italic dark:text-zinc-500">
              （此段尚未翻译，点击上方「AI 实时翻译本章」即可生成中文）
            </span>
          )}
        </div>
      );
      const enCol = (
        <div
          className={`font-editorial ${
            bilingualOrder === 'en-zh'
              ? 'text-stone-900 dark:text-stone-100'
              : 'text-stone-600 dark:text-zinc-400'
          } ${bodyTextClass}`}
        >
          <span>{p.text}</span>
          {onLearnText && (
            <button
              type="button"
              onClick={() => onLearnText(p.text, 'article')}
              className="mt-1.5 inline-flex items-center gap-1 font-ui text-[11px] font-medium text-stone-400 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-[#78350F] dark:text-zinc-500 dark:hover:text-amber-400 cursor-pointer"
            >
              <Sparkles className="h-3 w-3" />
              <span>翻译学习此段</span>
            </button>
          )}
        </div>
      );
      return (
        <div key={p.id} className="group">
          <div className="grid grid-cols-1 gap-4 border-b border-stone-200/60 py-4 md:grid-cols-2 md:gap-10 dark:border-zinc-800/80">
            {bilingualOrder === 'en-zh' ? (
              <>
                {enCol}
                {zhCol}
              </>
            ) : (
              <>
                {zhCol}
                {enCol}
              </>
            )}
          </div>
          {showDiagramAfter}
        </div>
      );
    }

    if (readingMode === 'en') {
      return (
        <div key={p.id} className="group mb-5">
          <p
            className={`font-editorial text-stone-800 dark:text-stone-200 ${bodyTextClass} ${
              isFirstBody && canDropCapEn ? 'drop-cap' : ''
            }`}
          >
            {p.text}
          </p>
          {onLearnText && (
            <button
              type="button"
              onClick={() => onLearnText(p.text, 'article')}
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-stone-400 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-[#78350F] dark:text-zinc-500 dark:hover:text-amber-400 cursor-pointer"
            >
              <Sparkles className="h-3 w-3" />
              <span>翻译学习</span>
            </button>
          )}
          {showDiagramAfter}
        </div>
      );
    }

    // 'zh' mode
    return (
      <div key={p.id}>
        <p
          className={`font-editorial mb-5 text-stone-900 dark:text-stone-200 ${bodyTextClass} ${
            isFirstBody && (zh ? canDropCapZh : canDropCapEn) ? 'drop-cap' : ''
          }`}
        >
          {zh ? (
            zh
          ) : (
            <span className="text-stone-500 dark:text-zinc-400">{p.text}</span>
          )}
        </p>
        {showDiagramAfter}
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* Persistent Whole-Book Reading Progress Bar */}
      <div
        data-testid="reader-progress-strip"
        className="sticky top-[69px] z-30 border-b border-stone-200/80 bg-[#FBF9F5]/95 backdrop-blur-sm dark:border-zinc-800 dark:bg-[#0B0C0E]/95 md:top-[65px]"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 sm:px-8">
          <div className="flex min-w-0 items-center gap-2 text-xs text-stone-500 dark:text-zinc-400">
            <span className="shrink-0 font-medium text-stone-700 dark:text-zinc-300">
              全书阅读进度
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-num shrink-0">
              第 {bookProgress.sectionNumber}/{bookProgress.totalSections} 节
            </span>
            <span aria-hidden="true" className="hidden sm:inline">
              ·
            </span>
            <span className="hidden truncate sm:inline">{section.titleZh}</span>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <span className="hidden font-num text-[11px] text-stone-400 dark:text-zinc-500 md:inline">
              本章 {Math.round(sectionScrollRatio * 100)}%
            </span>
            <span
              data-testid="book-reading-progress-percent"
              className="font-num text-xs font-semibold text-[#78350F] dark:text-amber-400"
            >
              {bookProgress.formattedPercentage}
            </span>
          </div>
        </div>

        <div
          role="progressbar"
          aria-label="全书阅读进度"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={bookProgress.roundedPercentage}
          aria-valuetext={`全书阅读进度 ${bookProgress.formattedPercentage}，第 ${bookProgress.sectionNumber} 节（共 ${bookProgress.totalSections} 节）`}
          className="h-[3px] w-full overflow-hidden bg-stone-200/80 dark:bg-zinc-800"
        >
          <div
            data-testid="book-reading-progress-fill"
            className="h-full w-full origin-left bg-[#78350F] transition-transform duration-150 ease-out motion-reduce:transition-none dark:bg-amber-500"
            style={{ transform: `scaleX(${bookProgress.ratio})` }}
          />
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        {/* Desktop Chapter Index Rail */}
        <aside
          aria-label="章节目录"
          className={`hidden shrink-0 border-r border-stone-200/80 bg-[#F7F4EE]/60 dark:border-zinc-800 dark:bg-[#111317] lg:block ${
            teacherOpen ? 'w-56 xl:w-60' : 'w-72'
          }`}
        >
          <div className="sticky top-[102px] max-h-[calc(100vh-6.375rem)] overflow-y-auto px-5 py-8">
            <p className="text-xs font-semibold tracking-widest text-stone-500 uppercase dark:text-zinc-400">
              全书目录 · {book.sections.length} 节
            </p>
          <ul className="mt-4 space-y-1">
            {book.sections.map((sec) => {
              const secStats = getSectionTranslationStats(sec, translations);
              const active = sec.id === section.id;
              return (
                <li key={sec.id}>
                  <button
                    type="button"
                    onClick={() => onSelectSection(sec.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#EBE6DF] font-semibold text-[#78350F] dark:bg-zinc-800 dark:text-amber-400'
                        : 'text-stone-700 hover:bg-[#F3EFE6] hover:text-stone-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-stone-100'
                    }`}
                  >
                    <span className="truncate">{sec.titleZh}</span>
                    {secStats.isComplete ? (
                      <Check
                        className="h-3.5 w-3.5 shrink-0 text-[#14532D] dark:text-emerald-400"
                        aria-label="已译完"
                      />
                    ) : (
                      <span className="font-num text-[11px] text-stone-400 dark:text-zinc-500 shrink-0">
                        {secStats.percentage}%
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {/* Mobile Chapter Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="章节目录抽屉">
          <div
            className="fixed inset-0 bg-stone-950/35 backdrop-blur-xs dark:bg-black/70"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-10 flex h-full w-80 max-w-[85vw] flex-col bg-[#FBF9F5] shadow-xl dark:bg-[#111317] dark:border-r dark:border-zinc-800">
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 dark:border-zinc-800">
              <span className="font-editorial text-base font-semibold text-stone-900 dark:text-stone-100">
                全书章节索引
              </span>
              <button
                type="button"
                aria-label="关闭目录"
                onClick={() => setSidebarOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-zinc-900 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="flex-1 space-y-1 overflow-y-auto p-4">
              {book.sections.map((sec) => {
                const secStats = getSectionTranslationStats(sec, translations);
                const active = sec.id === section.id;
                return (
                  <li key={sec.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectSection(sec.id);
                        setSidebarOpen(false);
                      }}
                      className={`flex min-h-[42px] w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#EBE6DF] font-semibold text-[#78350F] dark:bg-zinc-800 dark:text-amber-400'
                          : 'text-stone-700 hover:bg-[#F3EFE6] dark:text-zinc-300 dark:hover:bg-zinc-900'
                      }`}
                    >
                      <span className="truncate">{sec.titleZh}</span>
                      <span className="font-num text-xs text-stone-500 dark:text-zinc-400 shrink-0">
                        {secStats.isComplete ? '已译' : `${secStats.percentage}%`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Main Reading Column */}
      <div className="min-w-0 flex-1">
        {/* Workspace Toolbar (Placed below Header, non-sticky on mobile to preserve viewport) */}
        <div className="border-b border-stone-200 bg-[#FBF9F5] px-4 py-3 dark:border-zinc-800 dark:bg-[#0B0C0E] sm:px-8">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-[#F3EFE6] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 lg:hidden cursor-pointer whitespace-nowrap shrink-0"
              >
                <List className="h-3.5 w-3.5" />
                <span>目录</span>
              </button>

              {/* Reading Mode Segmented Control */}
              <div
                role="group"
                aria-label="阅读模式"
                className="inline-flex items-center rounded-md bg-[#EBE6DF] p-0.5 dark:bg-zinc-900"
              >
                {(
                  [
                    { id: 'zh', label: '纯中文' },
                    { id: 'bilingual', label: '双语对照' },
                    { id: 'en', label: '英文原版' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChangeMode(m.id)}
                    className={`rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      readingMode === m.id
                        ? 'bg-[#FBF9F5] text-stone-950 shadow-xs dark:bg-zinc-800 dark:text-stone-100'
                        : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-stone-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Bilingual Column Order Control */}
              {readingMode === 'bilingual' && (
                <div
                  role="group"
                  aria-label="双语栏位顺序"
                  className="inline-flex items-center rounded-md bg-[#EBE6DF] p-0.5 dark:bg-zinc-900"
                >
                  {(
                    [
                      { id: 'zh-en', label: '左中右英' },
                      { id: 'en-zh', label: '左英右中' },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => onChangeBilingualOrder(o.id)}
                      className={`rounded-[5px] px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        bilingualOrder === o.id
                          ? 'bg-[#FBF9F5] text-[#78350F] shadow-xs dark:bg-zinc-800 dark:text-amber-400'
                          : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-stone-200'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Font Scale Segmented Control */}
              <div
                role="group"
                aria-label="字号调节"
                className="hidden sm:inline-flex items-center rounded-md bg-[#EBE6DF] p-0.5 dark:bg-zinc-900"
              >
                {(
                  [
                    { id: 'sm', label: '小' },
                    { id: 'md', label: '中' },
                    { id: 'lg', label: '大' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onChangeFontScale(f.id)}
                    className={`rounded-[5px] px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      fontScale === f.id
                        ? 'bg-[#FBF9F5] text-stone-950 shadow-xs dark:bg-zinc-800 dark:text-stone-100'
                        : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-stone-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Chapter Translation & Teacher Toggle Action */}
            <div className="flex items-center gap-2.5">
              <span className="hidden font-num text-xs text-stone-500 dark:text-zinc-400 xl:inline">
                本章译文 {stats.translated}/{stats.total} 段（{stats.percentage}%）
              </span>

              {onToggleTeacher && (
                <button
                  type="button"
                  onClick={onToggleTeacher}
                  aria-pressed={teacherOpen}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    teacherOpen
                      ? 'border-[#78350F]/40 bg-[#F3EFE6] text-[#78350F] dark:border-amber-500/40 dark:bg-zinc-900 dark:text-amber-400'
                      : 'border-stone-300 text-stone-700 hover:bg-[#F3EFE6] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900'
                  }`}
                >
                  <GraduationCap className="h-3.5 w-3.5" />
                  <span>英语老师</span>
                </button>
              )}

              {isTranslatingThis ? (
                <button
                  type="button"
                  onClick={onCancelTranslation}
                  className="inline-flex items-center gap-2 rounded-md border border-[#78350F] bg-[#F3EFE6] px-3.5 py-1.5 text-xs font-medium text-[#78350F] hover:bg-[#EBE6DF] dark:border-amber-500 dark:bg-zinc-900 dark:text-amber-400 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>
                    {translationBatchProgress
                      ? `译制中 ${translationBatchProgress.current}/${translationBatchProgress.total} · 停止`
                      : '正在译制 · 停止'}
                  </span>
                </button>
              ) : !stats.isComplete ? (
                <button
                  type="button"
                  onClick={() => onTranslateSection(section.id)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#78350F] px-3.5 py-1.5 text-xs font-medium text-[#FBF9F5] transition-colors hover:bg-[#5C280B] dark:bg-amber-600 dark:text-stone-950 dark:font-semibold dark:hover:bg-amber-500 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>AI 实时翻译本章</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onTranslateSection(section.id, true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:border-stone-400 hover:text-stone-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-stone-100 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>重新翻译</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Reading Canvas */}
        <article
          ref={articleRef}
          className={`mx-auto px-5 py-10 sm:px-10 sm:py-14 ${
            readingMode === 'bilingual' ? 'max-w-5xl' : 'max-w-[70ch]'
          }`}
        >
          {/* Section Header */}
          <header className="border-b border-stone-200 pb-8 dark:border-zinc-800">
            <div className="flex flex-wrap items-center gap-x-2 text-xs tracking-widest text-stone-500 uppercase dark:text-zinc-400">
              <span>{section.partTitleZh || '微小的优势'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-num">{section.wordCount.toLocaleString()} 英文词</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  stats.isComplete
                    ? 'text-[#14532D] font-semibold dark:text-emerald-400'
                    : ''
                }
              >
                {stats.isComplete ? '中文全文已就绪' : `中文译文 ${stats.percentage}%`}
              </span>
            </div>

            <h1 className="font-editorial mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl text-balance dark:text-stone-100">
              {readingMode === 'en' ? section.titleEn : section.titleZh}
            </h1>
            {readingMode !== 'en' && (
              <p className="font-editorial mt-1.5 text-base italic text-stone-500 dark:text-zinc-400">
                {section.titleEn}
              </p>
            )}

            {/* Epigraph Pull Quote */}
            {(section.epigraphEn || section.epigraphZh) && (
              <blockquote className="mt-8 border-t border-b border-stone-200/90 py-5 text-center dark:border-zinc-800">
                {readingMode !== 'en' && section.epigraphZh && (
                  <p className="font-editorial text-lg italic text-stone-800 sm:text-xl dark:text-stone-200">
                    {section.epigraphZh}
                  </p>
                )}
                {(readingMode === 'en' || readingMode === 'bilingual' || !section.epigraphZh) &&
                  section.epigraphEn && (
                    <p className="font-editorial mt-1.5 text-sm italic text-stone-500 dark:text-zinc-400">
                      {section.epigraphEn}
                    </p>
                  )}
                <footer className="mt-2.5 text-xs tracking-wide text-stone-500 dark:text-zinc-400">
                  {readingMode === 'en'
                    ? section.epigraphAttributionEn
                    : section.epigraphAttributionZh || section.epigraphAttributionEn}
                </footer>
              </blockquote>
            )}
          </header>

          {/* Translation Error Alert if any */}
          {translationError && (
            <div
              role="alert"
              className="mt-6 flex items-start gap-3 border border-[#9A3412]/30 bg-[#9A3412]/5 p-4 text-sm text-[#9A3412] dark:border-orange-500/40 dark:bg-orange-950/30 dark:text-orange-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">实时翻译未能完成</p>
                <p className="mt-1 text-xs leading-relaxed text-stone-700 dark:text-zinc-300">
                  {translationError}
                </p>
              </div>
            </div>
          )}

          {/* Untranslated Chapter Guided Digest Banner */}
          {!stats.isComplete && !isTranslatingThis && readingMode === 'zh' && (
            <section className="mt-8 border border-stone-200 bg-[#F3EFE6]/70 p-6 dark:border-zinc-800 dark:bg-[#14161A]">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#78350F] uppercase dark:text-amber-400">
                    <Languages className="h-4 w-4" />
                    <span>本章全文待译 · 先为您呈现中文导读</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-stone-700 dark:text-zinc-300">
                    下方已为您整理本章中文核心要点；点击右侧按钮即可调用 Gemini 实时流式翻译本章全部 {section.paragraphs.length} 个自然段并自动缓存。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onTranslateSection(section.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[#78350F] px-4 py-2.5 text-xs font-medium text-[#FBF9F5] transition-colors hover:bg-[#5C280B] dark:bg-amber-600 dark:text-stone-950 dark:font-semibold dark:hover:bg-amber-500 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>立即翻译本章</span>
                </button>
              </div>

              {section.essentialPointsZh && section.essentialPointsZh.length > 0 && (
                <div className="mt-5 border-t border-stone-300/80 pt-4 dark:border-zinc-800">
                  <h2 className="text-xs font-semibold tracking-widest text-stone-600 uppercase dark:text-zinc-400">
                    本章核心要点中文导读
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {section.essentialPointsZh.map((pt, i) => (
                      <li
                        key={i}
                        className="flex items-baseline gap-2.5 text-sm leading-relaxed text-stone-800 dark:text-stone-200"
                      >
                        <span className="font-num text-xs font-semibold text-[#78350F] dark:text-amber-400 shrink-0">
                          0{i + 1}.
                        </span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Bilingual Column Headings */}
          {readingMode === 'bilingual' && (
            <div className="mt-6 hidden grid-cols-2 gap-10 border-b border-stone-300 pb-2 text-xs font-semibold tracking-widest text-stone-500 uppercase dark:border-zinc-800 dark:text-zinc-400 md:grid">
              <span>{bilingualOrder === 'en-zh' ? '英文原著' : '中文译文'}</span>
              <div className="flex items-center justify-between gap-2">
                <span>{bilingualOrder === 'en-zh' ? '中文译文' : '英文原著'}</span>
                <button
                  type="button"
                  onClick={() =>
                    onChangeBilingualOrder(bilingualOrder === 'zh-en' ? 'en-zh' : 'zh-en')
                  }
                  className="inline-flex items-center gap-1 text-[11px] font-medium tracking-normal text-stone-500 normal-case transition-colors hover:text-[#78350F] dark:text-zinc-400 dark:hover:text-amber-400 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ArrowLeftRight className="h-3 w-3" />
                  <span>对调左右栏</span>
                </button>
              </div>
            </div>
          )}

          {/* Section Body Paragraphs */}
          <div className="mt-8">
            {section.paragraphs.map((p, idx) => renderParagraph(p, idx))}
          </div>

          {/* Previous / Next Chapter Navigation */}
          <nav
            aria-label="章节翻页"
            className="mt-16 flex flex-col justify-between gap-4 border-t border-stone-200 pt-8 dark:border-zinc-800 sm:flex-row sm:items-center"
          >
            {prevSection ? (
              <button
                type="button"
                onClick={() => onSelectSection(prevSection.id)}
                className="group flex items-center gap-3 text-left transition-colors hover:text-[#78350F] dark:hover:text-amber-400 cursor-pointer"
              >
                <ChevronLeft className="h-5 w-5 text-stone-400 group-hover:text-[#78350F] dark:text-zinc-500 dark:group-hover:text-amber-400" />
                <div>
                  <span className="block text-xs text-stone-500 dark:text-zinc-400">上一节</span>
                  <span className="font-editorial text-sm font-medium text-stone-900 group-hover:text-[#78350F] dark:text-stone-100 dark:group-hover:text-amber-400">
                    {prevSection.titleZh}
                  </span>
                </div>
              </button>
            ) : (
              <div />
            )}

            {nextSection ? (
              <button
                type="button"
                onClick={() => onSelectSection(nextSection.id)}
                className="group flex items-center justify-end gap-3 text-right transition-colors hover:text-[#78350F] dark:hover:text-amber-400 cursor-pointer"
              >
                <div>
                  <span className="block text-xs text-stone-500 dark:text-zinc-400">下一节</span>
                  <span className="font-editorial text-sm font-medium text-stone-900 group-hover:text-[#78350F] dark:text-stone-100 dark:group-hover:text-amber-400">
                    {nextSection.titleZh}
                  </span>
                </div>
                <ChevronRight className="h-5 w-5 text-stone-400 group-hover:text-[#78350F] dark:text-zinc-500 dark:group-hover:text-amber-400" />
              </button>
            ) : (
              <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-zinc-400">
                <BookOpen className="h-4 w-4" />
                <span>已至全书末页</span>
              </div>
            )}
          </nav>
        </article>
      </div>
      </div>
    </div>
  );
}
