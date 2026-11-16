import { AlertCircle, BookDown, Check, Download, Loader2, Play, Square } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { BookData, TranslationMap } from '../types/book';
import { generateEpubBlob, getIncludedEpubSections } from '../utils/epubGenerator';
import {
  buildExportDocument,
  getBookTranslationProgress,
  getSectionTranslationStats,
} from '../utils/translationAlign';

interface ExportViewProps {
  book: BookData;
  translations: TranslationMap;
  batchRunning: boolean;
  batchCurrentSectionId: string | null;
  translationError: string | null;
  onStartBatchTranslate: () => void;
  onStopBatchTranslate: () => void;
  onOpenSection: (sectionId: string) => void;
}

export function ExportView({
  book,
  translations,
  batchRunning,
  batchCurrentSectionId,
  translationError,
  onStartBatchTranslate,
  onStopBatchTranslate,
  onOpenSection,
}: ExportViewProps) {
  const [exportFormat, setExportFormat] = useState<'zh' | 'bilingual'>('zh');
  const [onlyTranslated, setOnlyTranslated] = useState(true);
  const [epubExporting, setEpubExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const progress = getBookTranslationProgress(book, translations);

  const includedSections = useMemo(
    () => getIncludedEpubSections(book, translations, onlyTranslated),
    [book, translations, onlyTranslated]
  );

  const previewText = useMemo(() => {
    const full = buildExportDocument(book, translations, exportFormat, onlyTranslated);
    return full.slice(0, 3200) + (full.length > 3200 ? '\n\n……（预览已截断，下载文件包含完整内容）' : '');
  }, [book, translations, exportFormat, onlyTranslated]);

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownload = (ext: 'md' | 'txt') => {
    const content = buildExportDocument(book, translations, exportFormat, onlyTranslated);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const filename = `微小的优势_The_Slight_Edge_${exportFormat === 'bilingual' ? '双语版' : '中文版'}.${ext}`;
    triggerDownload(blob, filename);
    setExportNotice(`已生成并开始下载 ${filename}。`);
  };

  const handleDownloadEpub = async () => {
    if (epubExporting) return;
    setEpubExporting(true);
    setExportNotice(null);
    try {
      const { blob, filename, sectionCount } = await generateEpubBlob(
        book,
        translations,
        exportFormat,
        onlyTranslated
      );
      triggerDownload(blob, filename);
      setExportNotice(`已打包完成并开始下载 ${filename}（含封面、目录与 ${sectionCount} 个章节）。`);
    } catch (err) {
      setExportNotice(
        err instanceof Error ? `EPUB 导出失败：${err.message}` : 'EPUB 导出失败，请重试。'
      );
    } finally {
      setEpubExporting(false);
    }
  };

  const remainingSections = book.sections.filter(
    (s) => !getSectionTranslationStats(s, translations).isComplete
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
      <header className="border-b border-stone-200 pb-8">
        <p className="text-xs tracking-[0.2em] text-stone-500 uppercase">
          Full-Book Translation & Export Studio
        </p>
        <h1 className="font-editorial mt-2 text-3xl font-semibold text-stone-950 sm:text-4xl text-balance">
          全书批量翻译与电子书导出
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600">
          在此一键续译全书尚未完成的章节，或将当前已译成的中文版与中英双语对照版导出为标准 EPUB 电子书、Markdown 或纯文本文档。
        </p>
      </header>

      {/* Progress & Batch Translation Control */}
      <section className="mt-8 border border-stone-200 bg-[#F3EFE6]/70 p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold tracking-widest text-stone-500 uppercase">
              当前全书翻译进度
            </p>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="font-num text-3xl font-semibold text-stone-950">
                {progress.percentage}%
              </span>
              <span className="text-sm text-stone-600">
                已完成 <strong className="font-num text-stone-900">{progress.translatedSections}</strong> /{' '}
                <span className="font-num">{progress.totalSections}</span> 节（共{' '}
                <span className="font-num">{progress.translatedParagraphs.toLocaleString()}</span> /{' '}
                <span className="font-num">{progress.totalParagraphs.toLocaleString()}</span> 段）
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {batchRunning ? (
              <button
                type="button"
                onClick={onStopBatchTranslate}
                className="inline-flex items-center gap-2 rounded-md border border-[#9A3412] bg-[#FBF9F5] px-5 py-2.5 text-sm font-medium text-[#9A3412] hover:bg-[#9A3412]/10 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Square className="h-4 w-4" />
                <span>暂停批量翻译</span>
              </button>
            ) : remainingSections.length > 0 ? (
              <button
                type="button"
                onClick={onStartBatchTranslate}
                className="inline-flex items-center gap-2 rounded-md bg-[#1C1917] px-5 py-2.5 text-sm font-medium text-[#FBF9F5] transition-colors hover:bg-[#78350F] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Play className="h-4 w-4" />
                <span>一键翻译剩余 {remainingSections.length} 节</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#14532D]">
                <Check className="h-4 w-4" />
                <span>全书 24 节已全部翻译完成</span>
              </span>
            )}
          </div>
        </div>

        {/* Hairline Progress Track */}
        <div className="mt-6 h-1.5 w-full overflow-hidden bg-stone-300/70">
          <div
            className="h-full bg-[#14532D] transition-all duration-300"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>

        {batchRunning && batchCurrentSectionId && (
          <p className="mt-3 flex items-center gap-2 text-xs text-[#78350F]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>
              正在实时译制：{book.sections.find((s) => s.id === batchCurrentSectionId)?.titleZh}…
            </span>
          </p>
        )}

        {translationError && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 border border-[#9A3412]/30 bg-[#9A3412]/5 p-3.5 text-xs text-[#9A3412]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{translationError}</span>
          </div>
        )}
      </section>

      {/* Export Controls & Live Preview */}
      <section className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <div>
            <h2 className="font-editorial text-xl font-semibold text-stone-900">导出选项</h2>
            <p className="mt-1 text-xs leading-relaxed text-stone-500">
              当前将导出 <span className="font-num font-medium text-stone-800">{includedSections.length}</span> /{' '}
              <span className="font-num">{book.sections.length}</span> 节（包含封面、目录与内嵌曲线图，适配 Apple Books、Kindle、微信读书与 Calibre）。
            </p>
          </div>

          <div>
            <span className="block text-xs font-semibold text-stone-700">版本格式</span>
            <div className="mt-2 inline-flex rounded-md bg-[#EBE6DF] p-1">
              <button
                type="button"
                onClick={() => setExportFormat('zh')}
                className={`rounded-[5px] px-4 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  exportFormat === 'zh' ? 'bg-[#FBF9F5] text-stone-950 shadow-xs' : 'text-stone-600'
                }`}
              >
                纯中文译本
              </button>
              <button
                type="button"
                onClick={() => setExportFormat('bilingual')}
                className={`rounded-[5px] px-4 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  exportFormat === 'bilingual'
                    ? 'bg-[#FBF9F5] text-stone-950 shadow-xs'
                    : 'text-stone-600'
                }`}
              >
                中英双语对照版
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-stone-700 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyTranslated}
              onChange={(e) => setOnlyTranslated(e.target.checked)}
              className="h-4 w-4 accent-[#78350F]"
            />
            <span>仅导出已有中文译文的章节</span>
          </label>

          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={() => {
                void handleDownloadEpub();
              }}
              disabled={epubExporting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#78350F] px-5 py-3 text-sm font-medium text-[#FBF9F5] transition-colors hover:bg-[#5C280B] disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {epubExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BookDown className="h-4 w-4" />
              )}
              <span>{epubExporting ? '正在打包 EPUB 电子书…' : '导出 EPUB 电子书 (.epub)'}</span>
            </button>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleDownload('md')}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-stone-300 px-4 py-2.5 text-xs font-medium text-stone-800 transition-colors hover:bg-[#F3EFE6] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>导出 Markdown (.md)</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownload('txt')}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-stone-300 px-4 py-2.5 text-xs font-medium text-stone-800 transition-colors hover:bg-[#F3EFE6] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>导出纯文本 (.txt)</span>
              </button>
            </div>
          </div>

          {exportNotice && (
            <p
              role="status"
              className="border border-stone-200 bg-[#F3EFE6]/80 px-3.5 py-2.5 text-xs leading-relaxed text-[#14532D]"
            >
              {exportNotice}
            </p>
          )}

          {/* Section Completion Breakdown */}
          <div className="border-t border-stone-200 pt-5">
            <h3 className="text-xs font-semibold tracking-widest text-stone-500 uppercase">
              各章节译文状态
            </h3>
            <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-2 text-xs">
              {book.sections.map((sec) => {
                const st = getSectionTranslationStats(sec, translations);
                return (
                  <li key={sec.id} className="flex items-center justify-between gap-2 py-1">
                    <button
                      type="button"
                      onClick={() => onOpenSection(sec.id)}
                      className="truncate text-left text-stone-700 hover:text-[#78350F] hover:underline cursor-pointer"
                    >
                      {sec.titleZh}
                    </button>
                    <span
                      className={`font-num shrink-0 ${
                        st.isComplete ? 'text-[#14532D] font-medium' : 'text-stone-400'
                      }`}
                    >
                      {st.percentage}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="border border-stone-200 bg-[#F3EFE6]/50 p-5">
            <div className="mb-3 flex items-center justify-between border-b border-stone-200 pb-2 text-xs text-stone-500">
              <span>导出文稿实时预览</span>
              <span className="font-num">{exportFormat === 'bilingual' ? '中英双语' : '纯中文'}</span>
            </div>
            <pre className="font-editorial max-h-[520px] overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-stone-700">
              {previewText}
            </pre>
          </div>
        </div>
      </section>
    </main>
  );
}
