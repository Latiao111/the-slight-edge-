import type { BookData, BookParagraph, BookSection, ReadingMode, TranslationMap } from '../types/book';

export interface ParagraphBatch {
  items: { idx: number; id: string; text: string; kind: BookParagraph['kind'] }[];
}

/**
 * Splits a section's paragraphs into bounded character batches so each Gemini translation
 * call stays fast, accurate, and preserves exact paragraph boundaries.
 */
export function buildTranslationBatches(
  paragraphs: BookParagraph[],
  maxCharsPerBatch = 5500
): ParagraphBatch[] {
  const batches: ParagraphBatch[] = [];
  let current: ParagraphBatch['items'] = [];
  let currentChars = 0;

  paragraphs.forEach((p, idx) => {
    const len = p.text.length;
    if (current.length > 0 && (currentChars + len > maxCharsPerBatch || current.length >= 28)) {
      batches.push({ items: current });
      current = [];
      currentChars = 0;
    }
    current.push({ idx, id: p.id, text: p.text, kind: p.kind });
    currentChars += len;
  });

  if (current.length > 0) {
    batches.push({ items: current });
  }
  return batches;
}

/**
 * Parses model output formatted with `[P{idx}] translated text` blocks into
 * a `{ [paragraphId]: translatedText }` map. Works incrementally on partial streams.
 */
export function parseTaggedTranslation(
  rawOutput: string,
  batchItems: { idx: number; id: string }[]
): Record<string, string> {
  const result: Record<string, string> = {};
  const idByIdx = new Map<number, string>();
  for (const item of batchItems) {
    idByIdx.set(item.idx, item.id);
  }

  const markerRegex = /\[P(\d+)\]\s*/g;
  const matches: { idx: number; contentStart: number; markerStart: number }[] = [];

  let match: RegExpExecArray | null;
  while ((match = markerRegex.exec(rawOutput)) !== null) {
    matches.push({
      idx: parseInt(match[1], 10),
      contentStart: match.index + match[0].length,
      markerStart: match.index,
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const curr = matches[i];
    const nextStart = i + 1 < matches.length ? matches[i + 1].markerStart : rawOutput.length;
    const text = rawOutput.slice(curr.contentStart, nextStart).trim();
    const pid = idByIdx.get(curr.idx);
    if (pid && text) {
      result[pid] = text;
    }
  }

  return result;
}

export interface TranslationProgress {
  translatedParagraphs: number;
  totalParagraphs: number;
  translatedSections: number;
  totalSections: number;
  percentage: number;
}

export function getSectionTranslationStats(
  section: BookSection,
  translations: TranslationMap
): { translated: number; total: number; isComplete: boolean; percentage: number } {
  const secMap = translations[section.id] ?? {};
  const total = section.paragraphs.length;
  if (total === 0) {
    return { translated: 0, total: 0, isComplete: true, percentage: 100 };
  }
  let translated = 0;
  for (const p of section.paragraphs) {
    if (secMap[p.id] && secMap[p.id].trim().length > 0) {
      translated += 1;
    }
  }
  const percentage = Math.round((translated / total) * 100);
  return {
    translated,
    total,
    isComplete: translated >= total,
    percentage,
  };
}

export function getBookTranslationProgress(
  book: BookData,
  translations: TranslationMap
): TranslationProgress {
  let translatedParagraphs = 0;
  let totalParagraphs = 0;
  let translatedSections = 0;

  for (const section of book.sections) {
    const stats = getSectionTranslationStats(section, translations);
    translatedParagraphs += stats.translated;
    totalParagraphs += stats.total;
    if (stats.isComplete && stats.total > 0) {
      translatedSections += 1;
    }
  }

  return {
    translatedParagraphs,
    totalParagraphs,
    translatedSections,
    totalSections: book.sections.length,
    percentage: totalParagraphs > 0 ? Math.round((translatedParagraphs / totalParagraphs) * 100) : 0,
  };
}

export function buildExportDocument(
  book: BookData,
  translations: TranslationMap,
  mode: Extract<ReadingMode, 'zh' | 'bilingual'>,
  includeOnlyTranslated = false
): string {
  const lines: string[] = [];
  lines.push(`# 《${book.titleZh}》（${book.titleEn}）`);
  lines.push(`> ${book.subtitleZh} · ${book.editionZh}`);
  lines.push(`> 作者：${book.authorZh}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const section of book.sections) {
    const secTrans = translations[section.id] ?? {};
    const stats = getSectionTranslationStats(section, translations);
    if (includeOnlyTranslated && stats.translated === 0) {
      continue;
    }

    if (section.partTitleZh) {
      lines.push(`*${section.partTitleZh}*`);
      lines.push('');
    }

    lines.push(`## ${section.titleZh}${mode === 'bilingual' ? ` / ${section.titleEn}` : ''}`);
    lines.push('');

    for (const p of section.paragraphs) {
      const zh = secTrans[p.id];
      if (p.kind === 'subheading' || p.kind === 'story_header' || p.kind === 'essential_header') {
        if (mode === 'bilingual') {
          lines.push(`### ${zh || p.text} (${p.text})`);
        } else {
          lines.push(`### ${zh || `[待翻译] ${p.text}`}`);
        }
        lines.push('');
      } else if (p.kind === 'epigraph') {
        if (mode === 'bilingual') {
          lines.push(`> ${zh || '[待翻译]'}`);
          lines.push(`> *${p.text}*`);
        } else {
          lines.push(`> ${zh || p.text}`);
        }
        lines.push('');
      } else if (p.kind === 'essential_item') {
        if (mode === 'bilingual') {
          lines.push(`- ${zh || '[待翻译]'} (${p.text})`);
        } else {
          lines.push(`- ${zh || p.text}`);
        }
      } else {
        if (mode === 'bilingual') {
          lines.push(zh || '[待翻译]');
          lines.push('');
          lines.push(`*${p.text}*`);
          lines.push('');
        } else {
          lines.push(zh || p.text);
          lines.push('');
        }
      }
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n').trim() + '\n';
}
