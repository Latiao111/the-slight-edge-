import assert from 'node:assert/strict';
import test from 'node:test';
import { RELATED_KNOWLEDGE_ITEMS } from '../data/relatedKnowledge';
import type { BookData, TranslationMap } from '../types/book';
import { searchBookAndKnowledge } from './bookSearch';

const MOCK_BOOK: BookData = {
  titleEn: 'The Slight Edge',
  titleZh: '微小的优势',
  subtitleEn: 'Turning Simple Disciplines into Massive Success',
  subtitleZh: '把简单的日常自律转化为非凡成功',
  author: 'Jeff Olson',
  authorZh: '杰夫·奥尔森',
  coauthor: 'John David Mann',
  editionEn: '8th Anniversary Edition',
  editionZh: '第八周年纪念版',
  sections: [
    {
      id: 'ch-1',
      index: 0,
      category: 'part1',
      chapterNumber: 1,
      titleEn: '1. The Beach Bum and the Millionaire',
      titleZh: '第 1 章 · 沙滩流浪汉与百万富翁',
      wordCount: 4000,
      essentialPointsZh: ['我们每个人的内心都住着一个沙滩流浪汉和一个百万富翁。'],
      paragraphs: [
        { id: 'ch-1-p-0', kind: 'body', text: 'I want to tell you about two friends from New Mexico.' },
        { id: 'ch-1-p-1', kind: 'body', text: 'He became a beach bum in Daytona Beach.' },
      ],
    },
    {
      id: 'ch-6',
      index: 1,
      category: 'part1',
      chapterNumber: 6,
      titleEn: '6. Don’t Fall for the Quantum Leap',
      titleZh: '第 6 章 · 别迷信“量子飞跃”',
      wordCount: 3000,
      essentialPointsZh: ['真正的量子飞跃永远只是长期渐进积累的结果。'],
      paragraphs: [
        { id: 'ch-6-p-0', kind: 'body', text: 'There is no such thing as an overnight success.' },
      ],
    },
  ],
};

const MOCK_TRANSLATIONS: TranslationMap = {
  'ch-1': {
    'ch-1-p-0': '我想给你讲两个来自新墨西哥州的朋友的故事。',
    'ch-1-p-1': '他在代托纳海滩成了一个彻底的沙滩流浪汉。',
  },
};

test('searchBookAndKnowledge finds Chinese translations, English original paragraphs, and related knowledge', () => {
  const zhHits = searchBookAndKnowledge({
    book: MOCK_BOOK,
    translations: MOCK_TRANSLATIONS,
    knowledgeItems: RELATED_KNOWLEDGE_ITEMS,
    query: '量子飞跃',
  });
  assert.ok(zhHits.some((h) => h.kind === 'section' && h.sectionId === 'ch-6'));
  assert.ok(zhHits.some((h) => h.kind === 'knowledge' && h.knowledgeId === 'k-plateau-of-latent-potential'));

  const enHits = searchBookAndKnowledge({
    book: MOCK_BOOK,
    translations: MOCK_TRANSLATIONS,
    knowledgeItems: RELATED_KNOWLEDGE_ITEMS,
    query: 'Daytona Beach',
  });
  assert.equal(enHits.length, 1);
  assert.equal(enHits[0].paragraphId, 'ch-1-p-1');
  assert.equal(enHits[0].matchedLang, 'en');
});

test('searchBookAndKnowledge returns empty array for blank query', () => {
  const hits = searchBookAndKnowledge({
    book: MOCK_BOOK,
    translations: MOCK_TRANSLATIONS,
    knowledgeItems: RELATED_KNOWLEDGE_ITEMS,
    query: '   ',
  });
  assert.deepEqual(hits, []);
});
