import type { BookData, BookParagraph, BookSection, SectionCategory } from '../types/book';

export interface SectionTitleMeta {
  titleZh: string;
  partTitleEn?: string;
  partTitleZh?: string;
  epigraphZh?: string;
  epigraphAttributionZh?: string;
  essentialPointsZh?: string[];
}

export type SectionMetaLookup = Record<string, SectionTitleMeta>;

const CHAPTER_REGEX = /^(\d{1,2})\.\s+(.+)$/;

interface RawLine {
  text: string;
  blankLinesBefore: number;
}

function tokenizeLines(rawText: string): RawLine[] {
  const lines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const result: RawLine[] = [];
  let blankCount = 0;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      blankCount += 1;
    } else {
      result.push({ text: trimmed, blankLinesBefore: blankCount });
      blankCount = 0;
    }
  }
  return result;
}

function classifyParagraphKind(
  line: RawLine,
  indexInSection: number,
  inEssentialSection: boolean,
  sectionId: string
): BookParagraph['kind'] {
  const { text, blankLinesBefore } = line;

  if (text === 'Personal Stories from The Slight Edge Readers' || text === 'Personal Stories from The Slight Edge Readers') {
    return 'story_header';
  }
  if (/^Essential Points from Chapter \d+$/.test(text)) {
    return 'essential_header';
  }
  if (inEssentialSection) {
    return 'essential_item';
  }

  // First non-empty line in a numbered chapter is typically the epigraph quote
  if (sectionId.startsWith('ch-') && indexInSection === 0 && (text.startsWith('“') || text.startsWith('"'))) {
    return 'epigraph';
  }
  if (
    sectionId.startsWith('ch-') &&
    indexInSection <= 2 &&
    (text.startsWith('—') || text.startsWith('--'))
  ) {
    return 'attribution';
  }

  // Subheadings inside chapters are preceded by >= 3 blank lines in the source text
  if (
    sectionId.startsWith('ch-') &&
    blankLinesBefore >= 3 &&
    text.length <= 95 &&
    !text.endsWith('.') &&
    !text.endsWith('!') &&
    !text.endsWith('”') &&
    !text.endsWith(')')
  ) {
    return 'subheading';
  }

  return 'body';
}

export function parseBookText(
  rawText: string,
  metaLookup: SectionMetaLookup = {}
): BookData {
  const tokens = tokenizeLines(rawText);

  // Locate key structural boundaries
  const contentsIdx = tokens.findIndex((t) => t.text === 'Contents');
  const tocEndMarkerIdx = tokens.findIndex((t, idx) => idx > contentsIdx && t.text === 'About the Author');
  const prefaceIdx = tokens.findIndex(
    (t, idx) => idx > (tocEndMarkerIdx > contentsIdx ? tocEndMarkerIdx : contentsIdx) && t.text === 'Preface'
  );
  const part1Idx = tokens.findIndex((t, idx) => idx > prefaceIdx && t.text === 'Part I');
  const part2Idx = tokens.findIndex((t, idx) => idx > part1Idx && t.text === 'Part II');
  const invitationIdx = tokens.findIndex((t, idx) => idx > part2Idx && t.text === 'A Personal Invitation');
  const booksIdx = tokens.findIndex((t, idx) => idx > invitationIdx && t.text === 'Life-Transforming Books');
  const ackIdx = tokens.findIndex((t, idx) => idx > booksIdx && t.text === 'Acknowledgments');
  const aboutIdx = tokens.findIndex((t, idx) => idx > ackIdx && t.text === 'About the Author');

  interface RawSectionSlice {
    id: string;
    category: SectionCategory;
    partTitleEn?: string;
    chapterNumber?: number;
    titleEn: string;
    startIdx: number;
    endIdx: number;
  }

  const slices: RawSectionSlice[] = [];

  if (contentsIdx > 0) {
    slices.push({
      id: 'praise',
      category: 'front',
      titleEn: 'Praise From Readers of The Slight Edge',
      startIdx: 1,
      endIdx: contentsIdx,
    });
  }

  if (prefaceIdx >= 0 && part1Idx > prefaceIdx) {
    slices.push({
      id: 'preface',
      category: 'front',
      titleEn: 'Preface',
      startIdx: prefaceIdx + 1,
      endIdx: part1Idx,
    });
  }

  // Find all chapters between part1Idx and invitationIdx
  const chapterStarts: { idx: number; num: number; title: string; part: 'part1' | 'part2' }[] = [];
  const searchEnd = invitationIdx > 0 ? invitationIdx : tokens.length;

  for (let i = Math.max(0, part1Idx); i < searchEnd; i++) {
    const text = tokens[i].text;
    if (text === 'Part I' || text === 'HOW THE SLIGHT EDGE WORKS' || text === 'Part II' || text === 'LIVING THE SLIGHT EDGE') {
      continue;
    }
    const m = text.match(CHAPTER_REGEX);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num >= 1 && num <= 18) {
        const part: 'part1' | 'part2' = part2Idx > 0 && i > part2Idx ? 'part2' : 'part1';
        chapterStarts.push({ idx: i, num, title: m[2], part });
      }
    }
  }

  for (let c = 0; c < chapterStarts.length; c++) {
    const curr = chapterStarts[c];
    const nextStart = c + 1 < chapterStarts.length ? chapterStarts[c + 1].idx : searchEnd;
    // Trim trailing "Part II" / "LIVING THE SLIGHT EDGE" markers from chapter 9
    let endIdx = nextStart;
    while (
      endIdx > curr.idx + 1 &&
      (tokens[endIdx - 1].text === 'Part II' || tokens[endIdx - 1].text === 'LIVING THE SLIGHT EDGE')
    ) {
      endIdx -= 1;
    }
    slices.push({
      id: `ch-${curr.num}`,
      category: curr.part,
      partTitleEn:
        curr.part === 'part1'
          ? 'Part I: How the Slight Edge Works'
          : 'Part II: Living the Slight Edge',
      chapterNumber: curr.num,
      titleEn: `${curr.num}. ${curr.title}`,
      startIdx: curr.idx + 1,
      endIdx,
    });
  }

  if (invitationIdx >= 0) {
    slices.push({
      id: 'invitation',
      category: 'back',
      titleEn: 'A Personal Invitation',
      startIdx: invitationIdx + 1,
      endIdx: booksIdx > invitationIdx ? booksIdx : tokens.length,
    });
  }
  if (booksIdx >= 0) {
    slices.push({
      id: 'books',
      category: 'back',
      titleEn: 'Life-Transforming Books',
      startIdx: booksIdx + 1,
      endIdx: ackIdx > booksIdx ? ackIdx : tokens.length,
    });
  }
  if (ackIdx >= 0) {
    slices.push({
      id: 'acknowledgments',
      category: 'back',
      titleEn: 'Acknowledgments',
      startIdx: ackIdx + 1,
      endIdx: aboutIdx > ackIdx ? aboutIdx : tokens.length,
    });
  }
  if (aboutIdx >= 0) {
    slices.push({
      id: 'about',
      category: 'back',
      titleEn: 'About the Author',
      startIdx: aboutIdx + 1,
      endIdx: tokens.length,
    });
  }

  const sections: BookSection[] = slices.map((slice, sectionIdx) => {
    const meta = metaLookup[slice.id];
    const rawSlice = tokens.slice(slice.startIdx, slice.endIdx);
    const paragraphs: BookParagraph[] = [];
    let inEssentialSection = false;
    let epigraphEn: string | undefined;
    let epigraphAttributionEn: string | undefined;

    for (let i = 0; i < rawSlice.length; i++) {
      const line = rawSlice[i];
      const kind = classifyParagraphKind(line, i, inEssentialSection, slice.id);
      if (kind === 'essential_header') {
        inEssentialSection = true;
      }
      if (kind === 'epigraph' && !epigraphEn) {
        epigraphEn = line.text;
      } else if (kind === 'attribution' && !epigraphAttributionEn) {
        epigraphAttributionEn = line.text;
      }
      paragraphs.push({
        id: `${slice.id}-p-${i}`,
        kind,
        text: line.text,
      });
    }

    const wordCount = paragraphs.reduce((acc, p) => {
      return acc + p.text.split(/\s+/).filter(Boolean).length;
    }, 0);

    return {
      id: slice.id,
      index: sectionIdx,
      category: slice.category,
      partTitleEn: slice.partTitleEn ?? meta?.partTitleEn,
      partTitleZh: meta?.partTitleZh,
      chapterNumber: slice.chapterNumber,
      titleEn: slice.titleEn,
      titleZh: meta?.titleZh ?? slice.titleEn,
      epigraphEn,
      epigraphAttributionEn,
      epigraphZh: meta?.epigraphZh,
      epigraphAttributionZh: meta?.epigraphAttributionZh,
      paragraphs,
      wordCount,
      essentialPointsZh: meta?.essentialPointsZh,
    };
  });

  return {
    titleEn: 'The Slight Edge',
    titleZh: '微小的优势',
    subtitleEn: 'Turning Simple Disciplines into Massive Success & Happiness',
    subtitleZh: '将简单的日常自律转化为巨大的成功与幸福',
    author: 'Jeff Olson with John David Mann',
    authorZh: '杰夫·奥尔森（Jeff Olson）著 · 约翰·大卫·曼恩（John David Mann）合著',
    coauthor: 'John David Mann',
    editionEn: '8th Anniversary Edition',
    editionZh: '第八周年纪念修订版',
    sections,
  };
}
