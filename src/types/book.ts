export type ParagraphKind =
  | 'epigraph'
  | 'attribution'
  | 'subheading'
  | 'story_header'
  | 'essential_header'
  | 'body'
  | 'essential_item';

export interface BookParagraph {
  id: string;
  kind: ParagraphKind;
  text: string;
}

export type SectionCategory = 'front' | 'part1' | 'part2' | 'back';

export interface BookSection {
  id: string;
  index: number;
  category: SectionCategory;
  partTitleEn?: string;
  partTitleZh?: string;
  chapterNumber?: number;
  titleEn: string;
  titleZh: string;
  epigraphEn?: string;
  epigraphAttributionEn?: string;
  epigraphZh?: string;
  epigraphAttributionZh?: string;
  paragraphs: BookParagraph[];
  wordCount: number;
  essentialPointsZh?: string[];
}

export interface BookData {
  titleEn: string;
  titleZh: string;
  subtitleEn: string;
  subtitleZh: string;
  author: string;
  authorZh: string;
  coauthor: string;
  editionEn: string;
  editionZh: string;
  sections: BookSection[];
}

export type TranslationMap = Record<string, Record<string, string>>;

export type ReadingMode = 'zh' | 'bilingual' | 'en';
export type BilingualOrder = 'zh-en' | 'en-zh';
export type FontScale = 'sm' | 'md' | 'lg';
export type AppView = 'overview' | 'reader' | 'maxims' | 'export';

export interface MaximItem {
  id: string;
  sectionId: string;
  chapterLabel: string;
  theme: 'philosophy' | 'time' | 'habits' | 'happiness';
  themeLabel: string;
  en: string;
  zh: string;
}
