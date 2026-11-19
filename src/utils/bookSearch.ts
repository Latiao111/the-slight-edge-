import type { BookData, RelatedKnowledgeItem, TranslationMap } from '../types/book';

export interface BookSearchHit {
  id: string;
  kind: 'section' | 'paragraph' | 'essential' | 'knowledge';
  sectionId: string;
  sectionTitleZh: string;
  paragraphId?: string;
  knowledgeId?: string;
  title: string;
  snippet: string;
  matchedLang: 'zh' | 'en' | 'concept';
  score: number;
}

function buildSnippet(text: string, query: string, maxLen = 110): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const lower = clean.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx < 0) return `${clean.slice(0, maxLen)}…`;
  const start = Math.max(0, idx - 32);
  const end = Math.min(clean.length, idx + query.length + 64);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < clean.length ? '…' : '';
  return `${prefix}${clean.slice(start, end)}${suffix}`;
}

export function searchBookAndKnowledge(params: {
  book: BookData;
  translations: TranslationMap;
  knowledgeItems: RelatedKnowledgeItem[];
  query: string;
  limit?: number;
}): BookSearchHit[] {
  const { book, translations, knowledgeItems, limit = 24 } = params;
  const trimmed = params.query.trim();
  if (trimmed.length < 1) return [];

  const q = trimmed.toLowerCase();
  const hits: BookSearchHit[] = [];

  // 1. Related knowledge concepts & companion books
  for (const item of knowledgeItems) {
    const haystack = `${item.title} ${item.subtitle} ${item.summary} ${item.bookConnection} ${item.referenceWork}`.toLowerCase();
    if (haystack.includes(q)) {
      const titleHit = item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q);
      hits.push({
        id: `k-${item.id}`,
        kind: 'knowledge',
        sectionId: item.linkedSectionIds[0] || 'ch-1',
        sectionTitleZh: item.chapterHint,
        knowledgeId: item.id,
        title: item.title,
        snippet: buildSnippet(`${item.summary} ${item.referenceWork}`, trimmed),
        matchedLang: 'concept',
        score: titleHit ? 95 : 70,
      });
    }
  }

  // 2. Chapters, essential points, Chinese translations, and English original paragraphs
  for (const sec of book.sections) {
    const titleZhHit = sec.titleZh.toLowerCase().includes(q);
    const titleEnHit = sec.titleEn.toLowerCase().includes(q);
    if (titleZhHit || titleEnHit) {
      hits.push({
        id: `sec-${sec.id}`,
        kind: 'section',
        sectionId: sec.id,
        sectionTitleZh: sec.titleZh,
        title: `${sec.titleZh} · ${sec.titleEn}`,
        snippet: sec.epigraphZh || sec.epigraphEn || `${sec.wordCount.toLocaleString()} 英文词`,
        matchedLang: titleZhHit ? 'zh' : 'en',
        score: 100,
      });
    }

    if (sec.essentialPointsZh) {
      sec.essentialPointsZh.forEach((pt, idx) => {
        if (pt.toLowerCase().includes(q)) {
          hits.push({
            id: `ess-${sec.id}-${idx}`,
            kind: 'essential',
            sectionId: sec.id,
            sectionTitleZh: sec.titleZh,
            title: `${sec.titleZh} · 核心要点`,
            snippet: buildSnippet(pt, trimmed),
            matchedLang: 'zh',
            score: 85,
          });
        }
      });
    }

    const secTrans = translations[sec.id] ?? {};
    let sectionParagraphHits = 0;
    for (const p of sec.paragraphs) {
      if (sectionParagraphHits >= 4) break;
      const zh = secTrans[p.id];
      const zhHit = Boolean(zh && zh.toLowerCase().includes(q));
      const enHit = p.text.toLowerCase().includes(q);
      if (zhHit || enHit) {
        sectionParagraphHits += 1;
        hits.push({
          id: `p-${p.id}`,
          kind: 'paragraph',
          sectionId: sec.id,
          sectionTitleZh: sec.titleZh,
          paragraphId: p.id,
          title: sec.titleZh,
          snippet: buildSnippet(zhHit ? zh! : p.text, trimmed),
          matchedLang: zhHit ? 'zh' : 'en',
          score: zhHit ? 78 : 74,
        });
      }
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
