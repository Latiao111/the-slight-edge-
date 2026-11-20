import {
  AlertCircle,
  ArrowLeftRight,
  ArrowRight,
  Bookmark,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Eye,
  EyeOff,
  GraduationCap,
  HelpCircle,
  Languages,
  List,
  Loader2,
  Maximize2,
  Minimize2,
  MousePointerClick,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRelatedKnowledgeForSection } from '../data/relatedKnowledge';
import type {
  BilingualOrder,
  BookData,
  BookParagraph,
  ChapterQuizQuestion,
  FontScale,
  ReadingMode,
  TeacherMode,
  TranslationMap,
} from '../types/book';
import {
  calculateBookReadingProgress,
  computeArticleScrollRatio,
} from '../utils/readingProgress';
import { isEditableElementLike } from '../utils/readerChrome';
import {
  extractEnglishWordFromSelection,
  extractSurroundingSentence,
} from '../utils/teacherBot';
import { getSectionTranslationStats } from '../utils/translationAlign';
import { RollerCoasterDiagram, TwoPathsDiagram } from './SlightEdgeDiagram';

const DBLCLICK_LOOKUP_KEY = 'slight_edge_dblclick_lookup_v1';
const STUDIED_PARAGRAPHS_KEY = 'slight_edge_studied_paragraphs_v1';

function readStoredBool(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === '1') return true;
    if (raw === '0') return false;
    return fallback;
  } catch {
    return fallback;
  }
}

function readStoredStringBoolMap(key: string): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

interface ReaderViewProps {
  book: BookData;
  activeSectionId: string;
  highlightParagraphId?: string | null;
  translations: TranslationMap;
  readingMode: ReadingMode;
  bilingualOrder: BilingualOrder;
  fontScale: FontScale;
  translatingSectionId: string | null;
  translationBatchProgress: { current: number; total: number } | null;
  translationError: string | null;
  teacherOpen?: boolean;
  focusMode?: boolean;
  chromeHidden?: boolean;
  savedHighlightTexts?: Set<string>;
  onToggleTeacher?: () => void;
  onToggleFocusMode?: () => void;
  onOpenSearch?: () => void;
  onOpenKnowledge?: () => void;
  onLearnText?: (text: string, mode?: TeacherMode) => void;
  onSaveHighlight?: (params: {
    sectionId: string;
    sectionTitleZh: string;
    paragraphId?: string;
    text: string;
  }) => void;
  onSelectSection: (sectionId: string) => void;
  onChangeMode: (mode: ReadingMode) => void;
  onChangeBilingualOrder: (order: BilingualOrder) => void;
  onChangeFontScale: (scale: FontScale) => void;
  onTranslateSection: (sectionId: string, force?: boolean) => void;
  onCancelTranslation: () => void;
}

const FONT_SIZE_CLASSES: Record<FontScale, string> = {
  sm: 'text-[15.5px] leading-[1.88]',
  md: 'text-[17.5px] leading-[1.92]',
  lg: 'text-[19.5px] leading-[1.96]',
};

export function ReaderView({
  book,
  activeSectionId,
  highlightParagraphId,
  translations,
  readingMode,
  bilingualOrder,
  fontScale,
  translatingSectionId,
  translationBatchProgress,
  translationError,
  teacherOpen = false,
  focusMode = false,
  chromeHidden = false,
  savedHighlightTexts,
  onToggleTeacher,
  onToggleFocusMode,
  onOpenSearch,
  onOpenKnowledge,
  onLearnText,
  onSaveHighlight,
  onSelectSection,
  onChangeMode,
  onChangeBilingualOrder,
  onChangeFontScale,
  onTranslateSection,
  onCancelTranslation,
}: ReaderViewProps) {
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeParagraphId, setActiveParagraphId] = useState<string | null>(null);
  const [sectionScrollRatio, setSectionScrollRatio] = useState(0);
  const articleRef = useRef<HTMLElement | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  // English-first progressive learning states ("先看英文原文，再学习不懂地方")
  const [doubleClickLookup, setDoubleClickLookup] = useState<boolean>(() =>
    readStoredBool(DBLCLICK_LOOKUP_KEY, true)
  );
  const [revealedZhIds, setRevealedZhIds] = useState<Record<string, boolean>>({});
  const [revealAllInlineZh, setRevealAllInlineZh] = useState(false);
  const [studiedParagraphIds, setStudiedParagraphIds] = useState<Record<string, boolean>>(() =>
    readStoredStringBoolMap(STUDIED_PARAGRAPHS_KEY)
  );

  // Interactive Chapter Quiz state (scoped per sectionId)
  const [quizBySection, setQuizBySection] = useState<Record<string, ChapterQuizQuestion[]>>({});
  const [quizAnswersBySection, setQuizAnswersBySection] = useState<
    Record<string, Record<number, number>>
  >({});
  const [quizLoadingSection, setQuizLoadingSection] = useState<string | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);

  const toggleDoubleClickLookup = useCallback(() => {
    setDoubleClickLookup((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(DBLCLICK_LOOKUP_KEY, next ? '1' : '0');
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const markParagraphStudied = useCallback((paragraphId: string) => {
    setStudiedParagraphIds((prev) => {
      if (prev[paragraphId]) return prev;
      const next = { ...prev, [paragraphId]: true };
      try {
        window.localStorage.setItem(STUDIED_PARAGRAPHS_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const toggleParagraphInlineZh = useCallback((paragraphId: string) => {
    setRevealedZhIds((prev) => ({ ...prev, [paragraphId]: !prev[paragraphId] }));
  }, []);

  const handleParagraphDoubleClick = useCallback(
    (paragraphText: string) => {
      if (!doubleClickLookup || !onLearnText) return;
      const rawSel = window.getSelection()?.toString() ?? '';
      const word = extractEnglishWordFromSelection(rawSel);
      if (!word) return;
      const sentence = extractSurroundingSentence(paragraphText, word);
      const prompt = sentence ? `${word}\n语境原句：${sentence}` : word;
      onLearnText(prompt, 'vocab');
    },
    [doubleClickLookup, onLearnText]
  );

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
  const relatedItems = useMemo(() => getRelatedKnowledgeForSection(section.id), [section.id]);
  const sectionQuiz = quizBySection[section.id] ?? null;
  const sectionQuizAnswers = quizAnswersBySection[section.id] ?? {};

  const handleGenerateQuiz = useCallback(async () => {
    setQuizLoadingSection(section.id);
    setQuizError(null);
    try {
      const res = await fetch('/api/study/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId: section.id }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `生成自测题失败（HTTP ${res.status}）`);
      }
      const data = (await res.json()) as { questions?: ChapterQuizQuestion[] };
      if (!data.questions || data.questions.length === 0) {
        throw new Error('暂未获取到自测题目，请重试。');
      }
      setQuizBySection((prev) => ({ ...prev, [section.id]: data.questions! }));
      setQuizAnswersBySection((prev) => ({ ...prev, [section.id]: {} }));
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : '生成本章理解自测失败，请稍后重试。');
    } finally {
      setQuizLoadingSection(null);
    }
  }, [section.id]);

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
    setQuizError(null);
    setRevealedZhIds({});
    setRevealAllInlineZh(false);
    setActiveParagraphId(null);
    setSettingsOpen(false);
    if (highlightParagraphId) {
      const rafId = window.requestAnimationFrame(() => {
        const target = document.querySelector<HTMLElement>(
          `[data-paragraph-id="${highlightParagraphId}"]`
        );
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        }
        updateScrollProgress();
      });
      return () => window.cancelAnimationFrame(rafId);
    }
    setSectionScrollRatio(0);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    const rafId = window.requestAnimationFrame(() => {
      updateScrollProgress();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [activeSectionId, highlightParagraphId, updateScrollProgress]);

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
  }, [updateScrollProgress, readingMode, fontScale, bilingualOrder, focusMode]);

  // Close Aa typography popover on outside click & handle M / Esc shortcuts inside Reader
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (tocOpen) {
          setTocOpen(false);
          e.stopPropagation();
          return;
        }
        if (settingsOpen) {
          setSettingsOpen(false);
          e.stopPropagation();
          return;
        }
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableElementLike(e.target as HTMLElement | null)) return;
      if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setTocOpen((prev) => !prev);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [tocOpen, settingsOpen]);

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
            {revealAllInlineZh && displayZh && (
              <p className="font-editorial mt-1 text-sm text-stone-500 dark:text-zinc-400">
                {displayZh}
              </p>
            )}
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
          <div className="min-w-0 flex-1">
            <p
              onDoubleClick={
                readingMode === 'en' ? () => handleParagraphDoubleClick(p.text) : undefined
              }
              className={`font-editorial text-stone-800 dark:text-stone-200 ${bodyTextClass}`}
            >
              {readingMode === 'en' ? p.text : displayZh || p.text}
            </p>
            {readingMode === 'en' && revealAllInlineZh && displayZh && (
              <p className="font-editorial mt-1.5 text-sm leading-relaxed text-stone-500 dark:text-zinc-400">
                {displayZh}
              </p>
            )}
          </div>
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

    const isJumpHighlighted = highlightParagraphId === p.id;
    const paragraphExcerpt = zh || p.text;
    const isBookmarked = Boolean(
      savedHighlightTexts &&
        (savedHighlightTexts.has(paragraphExcerpt.trim()) ||
          savedHighlightTexts.has(p.text.trim()))
    );

    const isActiveParagraph = activeParagraphId === p.id;

    const renderQuietActions = (includeTranslate: boolean) => {
      if (!onLearnText && !onSaveHighlight) return null;
      return (
        <div
          data-testid="paragraph-actions"
          className={`mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 font-ui text-[11.5px] font-medium text-stone-400 transition-opacity duration-150 ease-out dark:text-zinc-500 ${
            isActiveParagraph
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto'
          }`}
        >
          {includeTranslate && onLearnText && (
            <button
              type="button"
              onClick={() => onLearnText(p.text, 'article')}
              className="inline-flex items-center gap-1 transition-colors hover:text-[#78350F] dark:hover:text-amber-400 cursor-pointer"
            >
              <Sparkles className="h-3 w-3" />
              <span>精讲此段</span>
            </button>
          )}
          {onLearnText && (
            <button
              type="button"
              onClick={() =>
                onLearnText(
                  `请深度解读《微小的优势》「${section.titleZh}」中下面这段文字的核心含义，并延伸关联相关的心理学、复利或习惯科学原理：\n\n${paragraphExcerpt}`,
                  'explore'
                )
              }
              className="inline-flex items-center gap-1 transition-colors hover:text-[#78350F] dark:hover:text-amber-400 cursor-pointer"
            >
              <Compass className="h-3 w-3" />
              <span>延伸讲解</span>
            </button>
          )}
          {onSaveHighlight && (
            <button
              type="button"
              onClick={() =>
                onSaveHighlight({
                  sectionId: section.id,
                  sectionTitleZh: section.titleZh,
                  paragraphId: p.id,
                  text: paragraphExcerpt,
                })
              }
              className={`inline-flex items-center gap-1 transition-colors cursor-pointer ${
                isBookmarked
                  ? 'text-[#14532D] dark:text-emerald-400'
                  : 'hover:text-[#78350F] dark:hover:text-amber-400'
              }`}
            >
              <Bookmark className="h-3 w-3" />
              <span>{isBookmarked ? '已收藏' : '收藏'}</span>
            </button>
          )}
        </div>
      );
    };

    const highlightRingClass = isJumpHighlighted
      ? 'rounded-md bg-[#78350F]/8 px-3.5 py-2 -mx-3.5 transition-colors dark:bg-amber-500/12'
      : 'rounded-md -mx-3.5 px-3.5 py-1.5 transition-colors duration-150 hover:bg-stone-900/[0.02] dark:hover:bg-white/[0.025]';

    if (readingMode === 'bilingual') {
      const zhCol = (
        <div
          className={`prose-editorial-body font-editorial ${
            bilingualOrder === 'zh-en'
              ? 'text-stone-900 dark:text-stone-100'
              : 'text-stone-700 dark:text-stone-300'
          } ${bodyTextClass}`}
        >
          {zh ? (
            zh
          ) : (
            <span className="text-sm text-stone-400 italic dark:text-zinc-500">
              （此段尚未翻译，点击上方「排版」或「AI 实时翻译本章」即可生成中文）
            </span>
          )}
        </div>
      );
      const enCol = (
        <div
          className={`prose-editorial-body font-editorial ${
            bilingualOrder === 'en-zh'
              ? 'text-stone-900 dark:text-stone-100'
              : 'text-stone-600 dark:text-zinc-400'
          } ${bodyTextClass}`}
        >
          <span>{p.text}</span>
          {renderQuietActions(true)}
        </div>
      );
      return (
        <div
          key={p.id}
          data-paragraph-id={p.id}
          onClick={() => setActiveParagraphId(p.id)}
          className={`group ${highlightRingClass}`}
        >
          <div className="grid grid-cols-1 gap-4 border-b border-stone-200/60 py-3.5 md:grid-cols-2 md:gap-10 dark:border-zinc-800/80">
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
      const isZhRevealed = revealAllInlineZh || Boolean(revealedZhIds[p.id]);
      const isStudied = Boolean(studiedParagraphIds[p.id]);
      const showControls = isZhRevealed || isActiveParagraph;

      return (
        <div
          key={p.id}
          data-paragraph-id={p.id}
          onClick={() => {
            const sel = window.getSelection()?.toString().trim();
            if (!sel) {
              setActiveParagraphId((prev) => (prev === p.id ? null : p.id));
            }
          }}
          className={`group mb-4 ${highlightRingClass}`}
        >
          <p
            onDoubleClick={() => handleParagraphDoubleClick(p.text)}
            className={`prose-editorial-body font-editorial text-stone-900 dark:text-stone-100 ${bodyTextClass} ${
              isFirstBody && canDropCapEn ? 'drop-cap' : ''
            }`}
          >
            {p.text}
          </p>

          {/* Progressive Inline Chinese Peek (Revealed only when learner asks to verify understanding) */}
          {isZhRevealed && (
            <div
              data-testid="inline-zh-reveal"
              onClick={(e) => e.stopPropagation()}
              className="animate-editorial-reveal mt-3 border-t border-stone-200/80 pt-3 pl-3 text-[15.5px] leading-[1.88] text-stone-600 dark:border-zinc-800/80 dark:text-zinc-300"
            >
              {zh ? (
                <p className="font-editorial">{zh}</p>
              ) : (
                <div className="flex flex-wrap items-center gap-3 font-ui text-xs text-stone-500 dark:text-zinc-400">
                  <span>本段中文参考译文尚未生成。</span>
                  {onLearnText && (
                    <button
                      type="button"
                      onClick={() => {
                        markParagraphStudied(p.id);
                        onLearnText(p.text, 'article');
                      }}
                      className="font-medium text-[#78350F] hover:underline dark:text-amber-400 cursor-pointer"
                    >
                      让英语老师精讲此段
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onTranslateSection(section.id)}
                    className="font-medium text-stone-700 hover:underline dark:text-stone-200 cursor-pointer"
                  >
                    AI 实时翻译本章
                  </button>
                </div>
              )}
            </div>
          )}

          {/* True On-Demand Paragraph Controls: 100% invisible at rest; fade in on hover, tap, or focus */}
          <div
            data-testid="paragraph-actions"
            onClick={(e) => e.stopPropagation()}
            className={`mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-ui text-[11.5px] font-medium transition-opacity duration-150 ease-out ${
              showControls
                ? 'text-stone-500 opacity-100 pointer-events-auto dark:text-zinc-400'
                : 'text-stone-400 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto dark:text-zinc-500'
            }`}
          >
            <button
              type="button"
              data-testid="peek-zh-btn"
              aria-expanded={isZhRevealed}
              onClick={() => toggleParagraphInlineZh(p.id)}
              className={`inline-flex items-center gap-1 transition-colors cursor-pointer ${
                isZhRevealed
                  ? 'text-[#78350F] dark:text-amber-400'
                  : 'hover:text-[#78350F] dark:hover:text-amber-400'
              }`}
            >
              {isZhRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              <span>{isZhRevealed ? '收起译文' : '看译文'}</span>
            </button>

            {onLearnText && (
              <button
                type="button"
                data-testid="study-paragraph-btn"
                onClick={() => {
                  markParagraphStudied(p.id);
                  onLearnText(p.text, 'article');
                }}
                className="inline-flex items-center gap-1 transition-colors hover:text-[#78350F] dark:hover:text-amber-400 cursor-pointer"
              >
                <Sparkles className="h-3 w-3" />
                <span>精讲此段</span>
              </button>
            )}

            {onLearnText && (
              <button
                type="button"
                onClick={() =>
                  onLearnText(
                    `请深度解读《微小的优势》「${section.titleZh}」中下面这段英文的核心含义，并延伸关联相关的心理学、复利或习惯科学原理：\n\n${p.text}`,
                    'explore'
                  )
                }
                className="inline-flex items-center gap-1 transition-colors hover:text-[#78350F] dark:hover:text-amber-400 cursor-pointer"
              >
                <Compass className="h-3 w-3" />
                <span>延伸讲解</span>
              </button>
            )}

            {onSaveHighlight && (
              <button
                type="button"
                onClick={() =>
                  onSaveHighlight({
                    sectionId: section.id,
                    sectionTitleZh: section.titleZh,
                    paragraphId: p.id,
                    text: p.text,
                  })
                }
                className={`inline-flex items-center gap-1 transition-colors cursor-pointer ${
                  isBookmarked
                    ? 'text-[#14532D] dark:text-emerald-400'
                    : 'hover:text-[#78350F] dark:hover:text-amber-400'
                }`}
              >
                <Bookmark className="h-3 w-3" />
                <span>{isBookmarked ? '已收藏' : '收藏'}</span>
              </button>
            )}

            {isStudied && (
              <span
                data-testid="paragraph-studied-mark"
                className="inline-flex items-center gap-0.5 text-[#14532D] dark:text-emerald-400"
              >
                <Check className="h-3 w-3" />
                <span>已精学</span>
              </span>
            )}
          </div>
          {showDiagramAfter}
        </div>
      );
    }

    // 'zh' mode
    return (
      <div
        key={p.id}
        data-paragraph-id={p.id}
        onClick={() => {
          const sel = window.getSelection()?.toString().trim();
          if (!sel) {
            setActiveParagraphId((prev) => (prev === p.id ? null : p.id));
          }
        }}
        className={`group mb-4 ${highlightRingClass}`}
      >
        <p
          className={`prose-editorial-body font-editorial text-stone-900 dark:text-stone-200 ${bodyTextClass} ${
            isFirstBody && (zh ? canDropCapZh : canDropCapEn) ? 'drop-cap' : ''
          }`}
        >
          {zh ? (
            zh
          ) : (
            <span className="text-stone-500 dark:text-zinc-400">{p.text}</span>
          )}
        </p>
        {renderQuietActions(false)}
        {showDiagramAfter}
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* Persistent Ultra-Slim Whole-Book Reading Progress Hairline (Pinned cleanly to top edge when chrome is hidden) */}
      <div
        data-testid="reader-progress-strip"
        className={`fixed inset-x-0 z-40 transition-[top] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
          chromeHidden ? 'top-0' : 'top-[65px]'
        }`}
      >
        <div
          role="progressbar"
          aria-label="全书阅读进度"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={bookProgress.roundedPercentage}
          aria-valuetext={`全书阅读进度 ${bookProgress.formattedPercentage}，第 ${bookProgress.sectionNumber} 节（共 ${bookProgress.totalSections} 节）`}
          className="h-[2px] w-full overflow-hidden bg-stone-200/70 dark:bg-zinc-800/80"
        >
          <div
            data-testid="book-reading-progress-fill"
            className="h-full w-full origin-left bg-[#78350F] transition-transform duration-150 ease-out motion-reduce:transition-none dark:bg-amber-500"
            style={{ transform: `scaleX(${bookProgress.ratio})` }}
          />
        </div>
      </div>

      {/* Unified On-Demand Slide-Over Chapter Directory Drawer (Hidden by default so prose owns the canvas) */}
      {tocOpen && (
        <div
          className="fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
          aria-label="全书章节目录"
          data-testid="toc-drawer"
        >
          <div
            className="fixed inset-0 bg-stone-950/35 backdrop-blur-xs transition-opacity dark:bg-black/70"
            onClick={() => setTocOpen(false)}
          />
          <div className="relative z-10 flex h-full w-80 max-w-[85vw] flex-col border-r border-stone-200 bg-[#FBF9F5] shadow-2xl sm:w-[340px] dark:border-zinc-800 dark:bg-[#111317]">
            <div className="flex items-center justify-between border-b border-stone-200/80 px-5 py-4 dark:border-zinc-800">
              <div>
                <p className="text-[11px] tracking-[0.18em] text-stone-400 uppercase dark:text-zinc-500">
                  Table of Contents
                </p>
                <span className="font-editorial text-base font-semibold text-stone-950 dark:text-stone-100">
                  全书目录 · {book.sections.length} 节
                </span>
              </div>
              <button
                type="button"
                aria-label="关闭目录"
                data-testid="close-toc-drawer-btn"
                onClick={() => setTocOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-stone-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
              {book.sections.map((sec, idx) => {
                const secStats = getSectionTranslationStats(sec, translations);
                const active = sec.id === section.id;
                return (
                  <li key={sec.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectSection(sec.id);
                        setTocOpen(false);
                      }}
                      className={`flex min-h-[40px] w-full items-center justify-between gap-2.5 rounded-md px-3 py-2 text-left text-[13px] transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#EBE6DF] font-semibold text-[#78350F] dark:bg-zinc-800/90 dark:text-amber-400'
                          : 'text-stone-700 hover:bg-[#F3EFE6] hover:text-stone-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-stone-100'
                      }`}
                    >
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span className="font-num text-[11px] text-stone-400 dark:text-zinc-500 shrink-0">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="truncate">{sec.titleZh}</span>
                      </span>
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
            <div className="border-t border-stone-200/80 px-5 py-3 text-[11px] text-stone-400 dark:border-zinc-800 dark:text-zinc-500">
              快捷键：M 开关目录 · F 专注阅读 · T 英语老师
            </div>
          </div>
        </div>
      )}

      {/* Whisper-Quiet Floating Corner Controls when Focused or Scrolled Deep */}
      {chromeHidden && (
        <div
          data-testid="focus-floating-bar"
          className={`fixed top-3.5 z-30 flex items-center gap-1.5 rounded-md border border-stone-200/80 bg-[#FBF9F5]/90 px-2.5 py-1.5 text-xs text-stone-600 shadow-xs backdrop-blur-md transition-opacity duration-200 opacity-45 hover:opacity-100 focus-within:opacity-100 dark:border-zinc-800/90 dark:bg-[#111317]/90 dark:text-zinc-300 ${
            teacherOpen ? 'right-4 xl:right-[406px] 2xl:right-[436px]' : 'right-4 sm:right-6'
          }`}
        >
          <span
            data-testid="book-reading-progress-percent"
            className="font-num px-1 text-[11px] font-semibold text-[#78350F] dark:text-amber-400"
          >
            {bookProgress.formattedPercentage}
          </span>
          <span aria-hidden="true" className="text-stone-300 dark:text-zinc-700">
            ·
          </span>
          <button
            type="button"
            onClick={() => setTocOpen(true)}
            title="打开全书目录 (M)"
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors hover:text-stone-950 dark:hover:text-stone-100 cursor-pointer whitespace-nowrap"
          >
            <List className="h-3.5 w-3.5" />
            <span>目录</span>
          </button>
          {onToggleTeacher && (
            <button
              type="button"
              onClick={onToggleTeacher}
              title="展开/收起英语老师 (T)"
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                teacherOpen
                  ? 'text-[#78350F] dark:text-amber-400'
                  : 'hover:text-stone-950 dark:hover:text-stone-100'
              }`}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">老师</span>
            </button>
          )}
          {onToggleFocusMode && (
            <button
              type="button"
              onClick={onToggleFocusMode}
              data-testid={focusMode ? 'exit-focus-mode-btn' : 'enter-focus-floating-btn'}
              title={focusMode ? '退出专注模式 (Esc)' : '进入专注阅读模式 (F)'}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-[#78350F] transition-colors hover:bg-[#F3EFE6] dark:text-amber-400 dark:hover:bg-zinc-800 cursor-pointer whitespace-nowrap"
            >
              {focusMode ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5" />
                  <span>退出专注</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span>专注</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Main Centered Reading Column */}
      <div className="min-w-0 flex-1">
        {/* Serene Single-Row Editorial Workspace Toolbar (Completely hidden in Focus Mode) */}
        {!focusMode && (
          <div
            data-testid="reader-toolbar"
            className="border-b border-stone-200/80 bg-[#FBF9F5] px-4 py-2.5 dark:border-zinc-800/80 dark:bg-[#0B0C0E] sm:px-8"
          >
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 overflow-visible">
              {/* Left Cluster: TOC Drawer Trigger + Mode Segmented Control */}
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTocOpen(true)}
                  data-testid="open-toc-drawer-btn"
                  title="打开全书目录 (M)"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-stone-200/90 px-2.5 text-xs font-medium text-stone-700 transition-colors hover:border-stone-400 hover:bg-[#F3EFE6] dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-900 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <List className="h-3.5 w-3.5" />
                  <span>目录</span>
                  <span className="hidden font-num text-[11px] text-stone-400 dark:text-zinc-500 sm:inline">
                    {bookProgress.sectionNumber}/{bookProgress.totalSections}
                  </span>
                </button>

                <div
                  role="group"
                  aria-label="阅读模式"
                  className="inline-flex items-center rounded-md bg-[#EBE6DF] p-0.5 dark:bg-zinc-900"
                >
                  {(
                    [
                      { id: 'en', label: '英文精读' },
                      { id: 'bilingual', label: '双语对照' },
                      { id: 'zh', label: '纯中文' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      data-testid={`reading-mode-${m.id}`}
                      onClick={() => onChangeMode(m.id)}
                      className={`rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        readingMode === m.id
                          ? 'bg-[#FBF9F5] text-stone-950 shadow-xs dark:bg-zinc-800 dark:text-stone-100'
                          : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-stone-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Compact Progress Readout (Unboxed) */}
                {!chromeHidden && (
                  <span
                    data-testid="book-reading-progress-percent"
                    className="hidden font-num text-[11px] text-stone-400 dark:text-zinc-500 md:inline whitespace-nowrap shrink-0"
                    title={`全书阅读进度 ${bookProgress.formattedPercentage}`}
                  >
                    · {bookProgress.formattedPercentage}
                  </span>
                )}
              </div>

              {/* Right Cluster: English Helpers + Live Translation + Aa Settings + Search + Focus + Teacher */}
              <div className="flex shrink-0 items-center gap-1.5">
                {readingMode === 'en' && (
                  <>
                    <button
                      type="button"
                      data-testid="toggle-dblclick-lookup"
                      aria-pressed={doubleClickLookup}
                      onClick={toggleDoubleClickLookup}
                      title="开启后，在英文正文中双击任意生词即可自动带原句语境精讲"
                      className={`hidden h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer sm:inline-flex ${
                        doubleClickLookup
                          ? 'border-[#78350F]/35 bg-[#F3EFE6] text-[#78350F] dark:border-amber-500/40 dark:bg-zinc-900 dark:text-amber-400'
                          : 'border-stone-200/90 text-stone-500 hover:text-stone-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-stone-200'
                      }`}
                    >
                      <MousePointerClick className="h-3.5 w-3.5" />
                      <span>双击查词</span>
                    </button>

                    <button
                      type="button"
                      data-testid="toggle-all-inline-zh"
                      aria-pressed={revealAllInlineZh}
                      onClick={() => {
                        setRevealAllInlineZh((prev) => !prev);
                        setRevealedZhIds({});
                      }}
                      title="一键展开或收起本章全部段落的中文参考译文"
                      className={`hidden h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer md:inline-flex ${
                        revealAllInlineZh
                          ? 'border-[#78350F]/35 bg-[#F3EFE6] text-[#78350F] dark:border-amber-500/40 dark:bg-zinc-900 dark:text-amber-400'
                          : 'border-stone-200/90 text-stone-500 hover:text-stone-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-stone-200'
                      }`}
                    >
                      {revealAllInlineZh ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                      <span>{revealAllInlineZh ? '仅看英文' : '全章译文'}</span>
                    </button>
                  </>
                )}

                {isTranslatingThis && (
                  <button
                    type="button"
                    onClick={onCancelTranslation}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#78350F] bg-[#F3EFE6] px-2.5 text-xs font-medium text-[#78350F] hover:bg-[#EBE6DF] dark:border-amber-500 dark:bg-zinc-900 dark:text-amber-400 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>
                      {translationBatchProgress
                        ? `${translationBatchProgress.current}/${translationBatchProgress.total} · 停止`
                        : '停止译制'}
                    </span>
                  </button>
                )}

                {/* Compact Aa Typography & Translation Settings Popover */}
                <div ref={settingsRef} className="relative">
                  <button
                    type="button"
                    data-testid="reader-settings-btn"
                    aria-expanded={settingsOpen}
                    aria-label="排版与译文设置"
                    title="字号、译文与排版设置"
                    onClick={() => setSettingsOpen((prev) => !prev)}
                    className={`inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      settingsOpen
                        ? 'border-[#78350F]/40 bg-[#F3EFE6] text-[#78350F] dark:border-amber-500/40 dark:bg-zinc-900 dark:text-amber-400'
                        : 'border-stone-200/90 text-stone-600 hover:bg-[#F3EFE6] hover:text-stone-950 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-stone-100'
                    }`}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span className="hidden lg:inline">排版</span>
                  </button>

                  {settingsOpen && (
                    <div
                      data-testid="reader-settings-popover"
                      className="animate-editorial-reveal absolute right-0 top-10 z-40 w-64 rounded-md border border-stone-200 bg-[#FBF9F5] p-3.5 shadow-xl dark:border-zinc-800 dark:bg-[#14161A]"
                    >
                      <div className="space-y-3.5 text-xs">
                        {/* Font Size */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-stone-500 dark:text-zinc-400">正文字号</span>
                          <div
                            role="group"
                            aria-label="字号调节"
                            className="inline-flex items-center rounded-md bg-[#EBE6DF] p-0.5 dark:bg-zinc-900"
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
                                className={`rounded-[4px] px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                                  fontScale === f.id
                                    ? 'bg-[#FBF9F5] text-stone-950 shadow-2xs dark:bg-zinc-800 dark:text-stone-100'
                                    : 'text-stone-600 hover:text-stone-950 dark:text-zinc-400 dark:hover:text-stone-200'
                                }`}
                              >
                                {f.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Bilingual Order when in bilingual mode */}
                        {readingMode === 'bilingual' && (
                          <div className="flex items-center justify-between gap-2 border-t border-stone-200/70 pt-3 dark:border-zinc-800">
                            <span className="text-stone-500 dark:text-zinc-400">双语栏位</span>
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
                                  className={`rounded-[4px] px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                                    bilingualOrder === o.id
                                      ? 'bg-[#FBF9F5] text-[#78350F] shadow-2xs dark:bg-zinc-800 dark:text-amber-400'
                                      : 'text-stone-600 dark:text-zinc-400'
                                  }`}
                                >
                                  {o.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Chapter Translation Control */}
                        <div className="border-t border-stone-200/70 pt-3 dark:border-zinc-800">
                          <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-zinc-400">
                            <span>本章参考译文</span>
                            <span className="font-num">
                              {stats.translated}/{stats.total} 段 ({stats.percentage}%)
                            </span>
                          </div>
                          {!isTranslatingThis && (
                            <button
                              type="button"
                              onClick={() => {
                                setSettingsOpen(false);
                                onTranslateSection(section.id, stats.isComplete);
                              }}
                              className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                                !stats.isComplete
                                  ? 'bg-[#78350F] text-[#FBF9F5] hover:bg-[#5C280B] dark:bg-amber-600 dark:text-stone-950 dark:font-semibold dark:hover:bg-amber-500'
                                  : 'border border-stone-300 text-stone-700 hover:border-stone-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500'
                              }`}
                            >
                              {!stats.isComplete ? (
                                <>
                                  <Sparkles className="h-3.5 w-3.5" />
                                  <span>AI 实时翻译本章</span>
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  <span>重新译制本章</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        <div className="border-t border-stone-200/70 pt-2.5 text-[11px] text-stone-400 dark:border-zinc-800 dark:text-zinc-500">
                          快捷键：F 专注 · M 目录 · T 老师 · ⌘K 检索
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {onOpenSearch && (
                  <button
                    type="button"
                    onClick={onOpenSearch}
                    data-testid="reader-search-btn"
                    aria-label="全文检索"
                    title="全书中英与延伸知识检索 (⌘/Ctrl + K)"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-200/90 text-stone-600 transition-colors hover:bg-[#F3EFE6] hover:text-stone-950 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-stone-100 shrink-0 cursor-pointer"
                  >
                    <Search className="h-3.5 w-3.5" />
                  </button>
                )}

                {onToggleFocusMode && (
                  <button
                    type="button"
                    onClick={onToggleFocusMode}
                    data-testid="enter-focus-mode-btn"
                    title="隐藏顶栏与工具栏，进入沉浸式专注阅读 (F)"
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-stone-200/90 px-2.5 text-xs font-medium text-stone-700 transition-colors hover:border-[#78350F]/40 hover:bg-[#F3EFE6] hover:text-[#78350F] dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-amber-500/40 dark:hover:bg-zinc-900 dark:hover:text-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    <span>专注</span>
                  </button>
                )}

                {onToggleTeacher && (
                  <button
                    type="button"
                    onClick={onToggleTeacher}
                    aria-pressed={teacherOpen}
                    title="展开/收起英语老师侧栏 (T)"
                    className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      teacherOpen
                        ? 'border-[#78350F]/40 bg-[#F3EFE6] text-[#78350F] dark:border-amber-500/40 dark:bg-zinc-900 dark:text-amber-400'
                        : 'border-stone-200/90 text-stone-700 hover:bg-[#F3EFE6] dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <GraduationCap className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">英语老师</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reading Canvas */}
        <article
          ref={articleRef}
          className={`mx-auto px-6 sm:px-10 ${
            focusMode ? 'pt-14 pb-24 sm:pt-20' : 'py-10 sm:py-14'
          } ${readingMode === 'bilingual' ? 'max-w-5xl' : 'max-w-[68ch]'}`}
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
            <p className="font-editorial mt-1.5 text-base italic text-stone-500 dark:text-zinc-400">
              {readingMode === 'en' ? section.titleZh : section.titleEn}
            </p>

            {/* Epigraph Pull Quote */}
            {(section.epigraphEn || section.epigraphZh) && (
              <blockquote className="mt-8 border-t border-stone-200/90 pt-6 text-center dark:border-zinc-800">
                {readingMode !== 'en' && section.epigraphZh && (
                  <p className="font-editorial text-lg italic text-stone-800 sm:text-xl dark:text-stone-200">
                    {section.epigraphZh}
                  </p>
                )}
                {(readingMode === 'en' || readingMode === 'bilingual' || !section.epigraphZh) &&
                  section.epigraphEn && (
                    <p
                      className={`font-editorial italic ${
                        readingMode === 'en'
                          ? 'text-lg text-stone-800 sm:text-xl dark:text-stone-200'
                          : 'mt-1.5 text-sm text-stone-500 dark:text-zinc-400'
                      }`}
                    >
                      {section.epigraphEn}
                    </p>
                  )}
                {readingMode === 'en' && revealAllInlineZh && section.epigraphZh && (
                  <p className="font-editorial mt-2 text-sm text-stone-500 dark:text-zinc-400">
                    {section.epigraphZh}
                  </p>
                )}
                <footer className="mt-2.5 text-xs tracking-wide text-stone-500 dark:text-zinc-400">
                  {readingMode === 'en'
                    ? section.epigraphAttributionEn
                    : section.epigraphAttributionZh || section.epigraphAttributionEn}
                </footer>
              </blockquote>
            )}

            {/* Quiet English-First Reading Workflow Cue (Hidden in Focus Mode for pure print feel) */}
            {readingMode === 'en' && !focusMode && (
              <p
                data-testid="english-first-guide"
                className="mt-6 text-center text-xs leading-relaxed text-stone-400 dark:text-zinc-500"
              >
                先通读英文原文 · 悬停或轻点段落按需查看译文与精讲 ·{' '}
                {doubleClickLookup ? '双击生词即学' : '划选词句即学'}
              </p>
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

          {/* End-of-Chapter Study & Interdisciplinary Extension Hub */}
          <section
            aria-label="本章研学与延伸"
            data-testid="chapter-study-hub"
            className="mt-16 border-t border-stone-300 pt-10 dark:border-zinc-800"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs tracking-[0.2em] text-[#78350F] uppercase dark:text-amber-400">
                  Chapter Study &amp; Beyond
                </p>
                <h2 className="font-editorial mt-1 text-2xl font-semibold text-stone-950 dark:text-stone-100">
                  本章研学与跨学科延伸
                </h2>
              </div>
              {onOpenKnowledge && (
                <button
                  type="button"
                  onClick={onOpenKnowledge}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#78350F] hover:underline dark:text-amber-400 cursor-pointer"
                >
                  <span>进入完整延伸研学中心</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Related Knowledge Cards for this chapter */}
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              {relatedItems.slice(0, 2).map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col justify-between border border-stone-200 bg-[#F3EFE6]/45 p-5 dark:border-zinc-800 dark:bg-[#111317]"
                >
                  <div>
                    <div className="flex items-center gap-2 text-[11px] text-stone-500 dark:text-zinc-400">
                      <span className="font-medium text-[#78350F] dark:text-amber-400">
                        {item.disciplineLabel}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{item.chapterHint}</span>
                    </div>
                    <h3 className="font-editorial mt-1.5 text-base font-semibold text-stone-950 dark:text-stone-100">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-stone-600 dark:text-zinc-400">
                      {item.summary}
                    </p>
                  </div>

                  {onLearnText && (
                    <div className="mt-4 flex items-center justify-between border-t border-stone-200/70 pt-3 dark:border-zinc-800">
                      <span className="truncate text-[11px] text-stone-500 dark:text-zinc-500">
                        {item.referenceWork}
                      </span>
                      <button
                        type="button"
                        onClick={() => onLearnText(item.explorePrompt, 'explore')}
                        className="ml-3 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#78350F] hover:underline dark:text-amber-400 cursor-pointer"
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>请老师深讲</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Interactive 3-Question AI Comprehension Quiz */}
            <div className="mt-6 border border-stone-200 bg-[#FBF9F5] p-6 dark:border-zinc-800 dark:bg-[#111317]">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#78350F] uppercase dark:text-amber-400">
                    <HelpCircle className="h-4 w-4" />
                    <span>即时理解自测 · 本章 3 题检视</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-zinc-400">
                    用 1 分钟检验你是否真正吸收了「{section.titleZh}」的核心逻辑、生活应用与延伸关联。
                  </p>
                </div>

                <button
                  type="button"
                  data-testid="generate-quiz-btn"
                  disabled={quizLoadingSection === section.id}
                  onClick={() => void handleGenerateQuiz()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#78350F] px-4 py-2 text-xs font-medium text-[#FBF9F5] transition-colors hover:bg-[#5C280B] disabled:opacity-60 dark:bg-amber-600 dark:text-stone-950 dark:font-semibold dark:hover:bg-amber-500 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {quizLoadingSection === section.id ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>正在命题…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{sectionQuiz ? '重新生成 3 题' : '生成本章理解自测'}</span>
                    </>
                  )}
                </button>
              </div>

              {quizError && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2 rounded border border-[#9A3412]/30 bg-[#9A3412]/5 p-3 text-xs text-[#9A3412] dark:border-orange-500/40 dark:bg-orange-950/30 dark:text-orange-300"
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{quizError}</span>
                </div>
              )}

              {sectionQuiz && sectionQuiz.length > 0 && (
                <div className="mt-6 space-y-6 border-t border-stone-200 pt-5 dark:border-zinc-800">
                  {sectionQuiz.map((q, qIdx) => {
                    const picked = sectionQuizAnswers[qIdx];
                    const answered = picked !== undefined;
                    const isRight = answered && picked === q.correctIndex;
                    return (
                      <div key={qIdx} data-testid={`quiz-question-${qIdx}`} className="space-y-2.5">
                        <p className="text-sm font-medium leading-relaxed text-stone-950 dark:text-stone-100">
                          <span className="font-num mr-2 text-xs font-semibold text-[#78350F] dark:text-amber-400">
                            Q{qIdx + 1}.
                          </span>
                          {q.question}
                        </p>

                        <div className="grid grid-cols-1 gap-2">
                          {q.options.map((opt, optIdx) => {
                            const selected = picked === optIdx;
                            const showCorrect = answered && optIdx === q.correctIndex;
                            const showWrong = answered && selected && optIdx !== q.correctIndex;
                            return (
                              <button
                                key={optIdx}
                                type="button"
                                data-testid={`quiz-q${qIdx}-opt${optIdx}`}
                                onClick={() =>
                                  setQuizAnswersBySection((prev) => ({
                                    ...prev,
                                    [section.id]: {
                                      ...(prev[section.id] ?? {}),
                                      [qIdx]: optIdx,
                                    },
                                  }))
                                }
                                className={`flex items-start gap-2.5 rounded-md border px-3.5 py-2.5 text-left text-xs leading-relaxed transition-colors cursor-pointer ${
                                  showCorrect
                                    ? 'border-[#14532D] bg-[#14532D]/10 text-[#14532D] font-medium dark:border-emerald-500 dark:bg-emerald-950/30 dark:text-emerald-300'
                                    : showWrong
                                    ? 'border-[#9A3412] bg-[#9A3412]/10 text-[#9A3412] dark:border-orange-500 dark:bg-orange-950/30 dark:text-orange-300'
                                    : 'border-stone-200 bg-transparent text-stone-700 hover:border-[#78350F]/60 dark:border-zinc-800 dark:text-stone-300 dark:hover:border-amber-500/50'
                                }`}
                              >
                                <span className="font-num font-semibold shrink-0">
                                  {String.fromCharCode(65 + optIdx)}.
                                </span>
                                <span>{opt}</span>
                              </button>
                            );
                          })}
                        </div>

                        {answered && (
                          <div className="rounded-md bg-[#F3EFE6]/70 px-3.5 py-3 text-xs leading-relaxed text-stone-700 dark:bg-zinc-900/80 dark:text-stone-300">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span
                                className={
                                  isRight
                                    ? 'font-semibold text-[#14532D] dark:text-emerald-400'
                                    : 'font-semibold text-[#9A3412] dark:text-orange-400'
                                }
                              >
                                {isRight
                                  ? '回答正确'
                                  : `正确答案：${String.fromCharCode(65 + q.correctIndex)}`}
                                {q.relatedConcept ? ` · 延伸概念：${q.relatedConcept}` : ''}
                              </span>

                              {onLearnText && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onLearnText(
                                      `在《微小的优势》「${section.titleZh}」自测题中，涉及「${q.relatedConcept}」与这道题：“${q.question}”。请帮我进一步把这道题背后的原理和跨学科知识讲透。`,
                                      'explore'
                                    )
                                  }
                                  className="inline-flex items-center gap-1 text-[#78350F] hover:underline dark:text-amber-400 cursor-pointer"
                                >
                                  <Sparkles className="h-3 w-3" />
                                  <span>请老师延伸精讲</span>
                                </button>
                              )}
                            </div>
                            <p className="mt-1.5">{q.explanation}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

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
  );
}
