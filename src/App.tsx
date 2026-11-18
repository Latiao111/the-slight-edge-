import { AlertCircle, BookOpen, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOverview } from './components/BookOverview';
import { EnglishTeacherPanel, type TeacherLaunchRequest } from './components/EnglishTeacherPanel';
import { ExportView } from './components/ExportView';
import { Header } from './components/Header';
import { MaximsView } from './components/MaximsView';
import { ReaderView } from './components/ReaderView';
import { KEY_MAXIMS } from './data/pretranslatedBook';
import type {
  AppView,
  BilingualOrder,
  BookData,
  FontScale,
  ReadingMode,
  TeacherMode,
  ThemeMode,
  TranslationMap,
} from './types/book';
import { getBookTranslationProgress, getSectionTranslationStats } from './utils/translationAlign';

const LOCAL_CACHE_KEY = 'slight_edge_translations_v1';
const BILINGUAL_ORDER_KEY = 'slight_edge_bilingual_order_v1';
const THEME_KEY = 'slight_edge_theme_v1';
const TEACHER_OPEN_KEY = 'slight_edge_teacher_open_v1';

function readInitialTeacherOpen(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get('teacher');
    if (q === '1' || q === 'true') return true;
    if (q === '0' || q === 'false') return false;
    const stored = window.localStorage.getItem(TEACHER_OPEN_KEY);
    if (stored === '1') return true;
    if (stored === '0') return false;
    return window.innerWidth >= 1280;
  } catch {
    return false;
  }
}

function readStoredBilingualOrder(): BilingualOrder {
  try {
    return window.localStorage.getItem(BILINGUAL_ORDER_KEY) === 'en-zh' ? 'en-zh' : 'zh-en';
  } catch {
    return 'zh-en';
  }
}

function readInitialTheme(): ThemeMode {
  try {
    const q = new URLSearchParams(window.location.search).get('theme');
    if (q === 'light' || q === 'dark') return q;
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return 'dark';
  } catch {
    return 'dark';
  }
}

function readLocalCache(): TranslationMap {
  try {
    const raw = window.localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalCache(map: TranslationMap) {
  try {
    window.localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota issues
  }
}

function mergeTranslationMaps(localMap: TranslationMap, serverMap: TranslationMap): TranslationMap {
  const merged: TranslationMap = {};
  const allKeys = new Set([...Object.keys(localMap), ...Object.keys(serverMap)]);
  for (const secId of allKeys) {
    merged[secId] = {
      ...(localMap[secId] ?? {}),
      ...(serverMap[secId] ?? {}),
    };
  }
  return merged;
}

export default function App() {
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialView: AppView = initialParams.get('autostart') === '1' ? 'reader' : 'overview';
  const initialSection = initialParams.get('section') || 'ch-1';

  const [book, setBook] = useState<BookData | null>(null);
  const [translations, setTranslations] = useState<TranslationMap>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [theme, setTheme] = useState<ThemeMode>(readInitialTheme);
  const [teacherOpen, setTeacherOpen] = useState<boolean>(readInitialTeacherOpen);
  const [teacherLaunchRequest, setTeacherLaunchRequest] = useState<TeacherLaunchRequest | null>(
    null
  );
  const [selectionPopover, setSelectionPopover] = useState<{
    text: string;
    top: number;
    left: number;
  } | null>(null);
  const [activeView, setActiveView] = useState<AppView>(initialView);
  const [activeSectionId, setActiveSectionId] = useState<string>(initialSection);
  const [readingMode, setReadingMode] = useState<ReadingMode>('zh');
  const [bilingualOrder, setBilingualOrder] = useState<BilingualOrder>(readStoredBilingualOrder);
  const [fontScale, setFontScale] = useState<FontScale>('md');

  const [translatingSectionId, setTranslatingSectionId] = useState<string | null>(null);
  const [translationBatchProgress, setTranslationBatchProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [translationError, setTranslationError] = useState<string | null>(null);

  const [batchRunning, setBatchRunning] = useState(false);
  const [batchCurrentSectionId, setBatchCurrentSectionId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const batchStopRequestedRef = useRef(false);
  const workspaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const handleToggleTeacher = useCallback((nextOpen: boolean) => {
    setTeacherOpen(nextOpen);
    try {
      window.localStorage.setItem(TEACHER_OPEN_KEY, nextOpen ? '1' : '0');
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handleLearnText = useCallback(
    (text: string, mode?: TeacherMode) => {
      const cleaned = text.trim();
      if (!cleaned) return;
      handleToggleTeacher(true);
      setTeacherLaunchRequest({
        id: Date.now() + Math.random(),
        text: cleaned,
        mode,
      });
      setSelectionPopover(null);
      window.getSelection()?.removeAllRanges();
    },
    [handleToggleTeacher]
  );

  useEffect(() => {
    const syncSelectionPopover = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelectionPopover(null);
        return;
      }
      const text = sel.toString().trim();
      if (text.length < 2 || text.length > 2000) {
        setSelectionPopover(null);
        return;
      }
      const anchor = sel.anchorNode;
      if (!anchor || !workspaceRef.current?.contains(anchor)) {
        setSelectionPopover(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setSelectionPopover(null);
        return;
      }
      const left = Math.max(72, Math.min(window.innerWidth - 72, rect.left + rect.width / 2));
      const top = rect.top > 76 ? rect.top - 42 : rect.bottom + 8;
      setSelectionPopover({ text, top, left });
    };

    const handleScrollHide = () => setSelectionPopover(null);

    document.addEventListener('mouseup', syncSelectionPopover);
    document.addEventListener('keyup', syncSelectionPopover);
    window.addEventListener('scroll', handleScrollHide, { passive: true });
    return () => {
      document.removeEventListener('mouseup', syncSelectionPopover);
      document.removeEventListener('keyup', syncSelectionPopover);
      window.removeEventListener('scroll', handleScrollHide);
    };
  }, []);

  const fetchBookData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/book');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `服务器返回状态码 ${res.status}`);
      }
      const data = (await res.json()) as { book: BookData; translations: TranslationMap };
      const localMap = readLocalCache();
      const merged = mergeTranslationMaps(localMap, data.translations ?? {});
      setBook(data.book);
      setTranslations(merged);
      writeLocalCache(merged);

      if (
        initialSection &&
        !data.book.sections.some((s) => s.id === initialSection) &&
        data.book.sections.length > 0
      ) {
        setActiveSectionId(data.book.sections[0].id);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '无法加载原著数据，请检查服务是否正常运行。');
    } finally {
      setLoading(false);
    }
  }, [initialSection]);

  useEffect(() => {
    fetchBookData();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchBookData]);

  const updateSectionTranslations = useCallback(
    (sectionId: string, incoming: Record<string, string>) => {
      if (!incoming || Object.keys(incoming).length === 0) return;
      setTranslations((prev) => {
        const next: TranslationMap = {
          ...prev,
          [sectionId]: {
            ...(prev[sectionId] ?? {}),
            ...incoming,
          },
        };
        writeLocalCache(next);
        return next;
      });
    },
    []
  );

  const translateSection = useCallback(
    async (sectionId: string, force = false): Promise<boolean> => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setTranslatingSectionId(sectionId);
      setTranslationBatchProgress(null);
      setTranslationError(null);

      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sectionId, force }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          setTranslationError(errBody.error || `翻译请求失败（HTTP ${res.status}）`);
          return false;
        }

        if (!res.body) {
          setTranslationError('服务器未返回流式响应体。');
          return false;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let succeeded = false;

        const processSseEvent = (rawEvent: string): boolean => {
          const dataLine = rawEvent
            .split('\n')
            .find((line) => line.startsWith('data: '));
          if (!dataLine) return true;

          try {
            const payload = JSON.parse(dataLine.slice(6)) as {
              type: 'chunk' | 'done' | 'error';
              batchIndex?: number;
              totalBatches?: number;
              translations?: Record<string, string>;
              message?: string;
            };

            if (payload.type === 'chunk') {
              if (
                typeof payload.batchIndex === 'number' &&
                typeof payload.totalBatches === 'number'
              ) {
                setTranslationBatchProgress({
                  current: payload.batchIndex + 1,
                  total: payload.totalBatches,
                });
              }
              if (payload.translations) {
                updateSectionTranslations(sectionId, payload.translations);
              }
            } else if (payload.type === 'done') {
              if (payload.translations) {
                updateSectionTranslations(sectionId, payload.translations);
              }
              succeeded = true;
            } else if (payload.type === 'error') {
              setTranslationError(payload.message || '实时翻译过程中发生错误。');
              return false;
            }
          } catch {
            // Ignore malformed SSE lines
          }
          return true;
        };

        while (true) {
          const { value, done } = await reader.read();
          if (value) {
            buffer += decoder.decode(value, { stream: !done });
          }

          const events = buffer.split('\n\n');
          buffer = done ? '' : (events.pop() ?? '');

          for (const rawEvent of events) {
            if (!rawEvent.trim()) continue;
            if (!processSseEvent(rawEvent)) {
              return false;
            }
          }

          if (done) break;
        }

        if (!succeeded) {
          setTranslationError((prev) => prev || '翻译响应意外中断，已为您保留已译段落，请重试。');
        }
        return succeeded;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return false;
        }
        setTranslationError(err instanceof Error ? err.message : '网络连接中断，未能完成翻译。');
        return false;
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        setTranslatingSectionId(null);
        setTranslationBatchProgress(null);
      }
    },
    [updateSectionTranslations]
  );

  const handleCancelTranslation = useCallback(() => {
    batchStopRequestedRef.current = true;
    abortControllerRef.current?.abort();
    setBatchRunning(false);
    setBatchCurrentSectionId(null);
    setTranslatingSectionId(null);
    setTranslationBatchProgress(null);
  }, []);

  const handleStartBatchTranslate = useCallback(async () => {
    if (!book || batchRunning) return;
    batchStopRequestedRef.current = false;
    setBatchRunning(true);
    setTranslationError(null);

    const pending = book.sections.filter(
      (sec) => !getSectionTranslationStats(sec, translations).isComplete
    );

    for (const sec of pending) {
      if (batchStopRequestedRef.current) break;
      setBatchCurrentSectionId(sec.id);
      const ok = await translateSection(sec.id, false);
      if (!ok || batchStopRequestedRef.current) {
        break;
      }
    }

    setBatchRunning(false);
    setBatchCurrentSectionId(null);
  }, [book, batchRunning, translations, translateSection]);

  const handleOpenSection = useCallback((sectionId: string) => {
    setActiveSectionId(sectionId);
    setTranslationError(null);
    setActiveView('reader');
  }, []);

  const bookProgress = useMemo(() => {
    if (!book) return null;
    return getBookTranslationProgress(book, translations);
  }, [book, translations]);

  const activeSection = useMemo(
    () => book?.sections.find((s) => s.id === activeSectionId) ?? book?.sections[0] ?? null,
    [book, activeSectionId]
  );

  const hasUntranslatedChapters = bookProgress
    ? bookProgress.translatedSections < bookProgress.totalSections
    : true;

  const handlePrimaryHeaderAction = useCallback(() => {
    setActiveView('reader');
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FBF9F5] px-4 text-stone-700 dark:bg-[#0B0C0E] dark:text-stone-300">
        <Loader2 className="h-6 w-6 animate-spin text-[#78350F] dark:text-amber-400" />
        <p className="font-editorial mt-3 text-base">正在排版《微小的优势》全书文本与译文……</p>
      </div>
    );
  }

  if (loadError || !book) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FBF9F5] px-6 text-center dark:bg-[#0B0C0E]">
        <AlertCircle className="h-8 w-8 text-[#9A3412] dark:text-orange-400" />
        <h1 className="font-editorial mt-4 text-2xl font-semibold text-stone-900 dark:text-stone-100">
          未能载入原著文本
        </h1>
        <p className="mt-2 max-w-md text-sm text-stone-600 dark:text-zinc-400">
          {loadError || '请确认服务端口正常运行。'}
        </p>
        <button
          type="button"
          onClick={fetchBookData}
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#78350F] px-5 py-2.5 text-sm font-medium text-[#FBF9F5] hover:bg-[#5C280B] dark:bg-amber-600 dark:text-stone-950 dark:font-semibold dark:hover:bg-amber-500 cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" />
          <span>重新加载</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF9F5] text-[#1C1917] dark:bg-[#0B0C0E] dark:text-[#E7E5E4]">
      <Header
        activeView={activeView}
        theme={theme}
        onNavigate={(view) => setActiveView(view)}
        onPrimaryAction={handlePrimaryHeaderAction}
        onToggleTheme={handleToggleTheme}
        hasUntranslatedChapters={hasUntranslatedChapters}
      />

      <div className="flex min-w-0 flex-1">
        <div ref={workspaceRef} className="min-w-0 flex-1">
          {activeView === 'overview' && (
            <BookOverview
              book={book}
              translations={translations}
              onOpenSection={handleOpenSection}
              onOpenExport={() => setActiveView('export')}
            />
          )}

          {activeView === 'reader' && (
            <ReaderView
              book={book}
              activeSectionId={activeSectionId}
              translations={translations}
              readingMode={readingMode}
              bilingualOrder={bilingualOrder}
              fontScale={fontScale}
              translatingSectionId={translatingSectionId}
              translationBatchProgress={translationBatchProgress}
              translationError={translationError}
              teacherOpen={teacherOpen}
              onToggleTeacher={() => handleToggleTeacher(!teacherOpen)}
              onLearnText={handleLearnText}
              onSelectSection={handleOpenSection}
              onChangeMode={setReadingMode}
              onChangeBilingualOrder={(order) => {
                setBilingualOrder(order);
                try {
                  window.localStorage.setItem(BILINGUAL_ORDER_KEY, order);
                } catch {
                  // Ignore storage quota issues
                }
              }}
              onChangeFontScale={setFontScale}
              onTranslateSection={(secId, force) => {
                void translateSection(secId, force);
              }}
              onCancelTranslation={handleCancelTranslation}
            />
          )}

          {activeView === 'maxims' && (
            <MaximsView maxims={KEY_MAXIMS} onJumpToSection={handleOpenSection} />
          )}

          {activeView === 'export' && (
            <ExportView
              book={book}
              translations={translations}
              batchRunning={batchRunning}
              batchCurrentSectionId={batchCurrentSectionId}
              translationError={translationError}
              onStartBatchTranslate={() => {
                void handleStartBatchTranslate();
              }}
              onStopBatchTranslate={handleCancelTranslation}
              onOpenSection={handleOpenSection}
            />
          )}
        </div>

        <EnglishTeacherPanel
          isOpen={teacherOpen}
          onToggleOpen={handleToggleTeacher}
          sectionTitleZh={activeView === 'reader' ? activeSection?.titleZh : undefined}
          sectionTitleEn={activeView === 'reader' ? activeSection?.titleEn : undefined}
          launchRequest={teacherLaunchRequest}
        />
      </div>

      {selectionPopover && (
        <button
          type="button"
          data-testid="selection-learn-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleLearnText(selectionPopover.text)}
          style={{
            top: `${selectionPopover.top}px`,
            left: `${selectionPopover.left}px`,
            transform: 'translateX(-50%)',
          }}
          className="fixed z-50 inline-flex items-center gap-1.5 rounded-md border border-[#78350F]/30 bg-[#78350F] px-3 py-1.5 text-xs font-medium text-[#FBF9F5] shadow-lg transition-transform hover:scale-[1.02] dark:border-amber-400/40 dark:bg-amber-500 dark:text-stone-950 dark:font-semibold whitespace-nowrap cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>翻译学习</span>
        </button>
      )}

      <footer className="border-t border-stone-200/80 bg-[#F7F4EE]/50 px-4 py-6 text-center text-xs text-stone-500 dark:border-zinc-800 dark:bg-[#111317] dark:text-zinc-400">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 sm:flex-row">
          <span className="inline-flex items-center gap-1.5 font-editorial text-stone-600 dark:text-zinc-300">
            <BookOpen className="h-3.5 w-3.5 text-[#78350F] dark:text-amber-400" />
            <span>《微小的优势》The Slight Edge · 中文精译与双语精读版</span>
          </span>
          <span>原著 Jeff Olson &amp; John David Mann（第八周年纪念版）</span>
        </div>
      </footer>
    </div>
  );
}
