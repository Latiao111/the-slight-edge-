import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExportDocument,
  buildTranslationBatches,
  getBookTranslationProgress,
  getSectionTranslationStats,
  parseTaggedTranslation,
} from './translationAlign';
import type { BookData, BookParagraph } from '../types/book';

test('buildTranslationBatches splits large paragraph sets cleanly without dropping items', () => {
  const paragraphs: BookParagraph[] = Array.from({ length: 35 }, (_, i) => ({
    id: `ch-2-p-${i}`,
    kind: 'body',
    text: 'A'.repeat(250),
  }));

  const batches = buildTranslationBatches(paragraphs, 2000);
  assert.ok(batches.length >= 2);
  const flattened = batches.flatMap((b) => b.items);
  assert.equal(flattened.length, 35);
  assert.equal(flattened[0].id, 'ch-2-p-0');
  assert.equal(flattened[34].id, 'ch-2-p-34');
});

test('parseTaggedTranslation parses complete and partial streamed [P{idx}] blocks', () => {
  const batchItems = [
    { idx: 0, id: 'ch-2-p-0' },
    { idx: 1, id: 'ch-2-p-1' },
    { idx: 2, id: 'ch-2-p-2' },
  ];

  const partial = `[P0] 第一段译文内容。

[P1] 第二段正在输出`;
  const parsedPartial = parseTaggedTranslation(partial, batchItems);
  assert.equal(parsedPartial['ch-2-p-0'], '第一段译文内容。');
  assert.equal(parsedPartial['ch-2-p-1'], '第二段正在输出');
  assert.equal(parsedPartial['ch-2-p-2'], undefined);

  const full = `${partial}的完整句。\n\n[P2] 第三段译文。`;
  const parsedFull = parseTaggedTranslation(full, batchItems);
  assert.equal(parsedFull['ch-2-p-1'], '第二段正在输出的完整句。');
  assert.equal(parsedFull['ch-2-p-2'], '第三段译文。');
});

test('progress calculation and markdown export reflect translated state accurately', () => {
  const book: BookData = {
    titleEn: 'The Slight Edge',
    titleZh: '微小的优势',
    subtitleEn: 'Turning Simple Disciplines into Massive Success & Happiness',
    subtitleZh: '将简单的日常自律转化为巨大的成功与幸福',
    author: 'Jeff Olson',
    authorZh: '杰夫·奥尔森',
    coauthor: 'John David Mann',
    editionEn: '8th Anniversary Edition',
    editionZh: '第八周年纪念版',
    sections: [
      {
        id: 'preface',
        index: 0,
        category: 'front',
        titleEn: 'Preface',
        titleZh: '序言',
        wordCount: 10,
        paragraphs: [
          { id: 'preface-p-0', kind: 'body', text: 'Hello world.' },
          { id: 'preface-p-1', kind: 'body', text: 'Second paragraph.' },
        ],
      },
    ],
  };

  const translations = {
    preface: {
      'preface-p-0': '你好，世界。',
    },
  };

  const secStats = getSectionTranslationStats(book.sections[0], translations);
  assert.equal(secStats.translated, 1);
  assert.equal(secStats.total, 2);
  assert.equal(secStats.isComplete, false);
  assert.equal(secStats.percentage, 50);

  const bookProgress = getBookTranslationProgress(book, translations);
  assert.equal(bookProgress.percentage, 50);
  assert.equal(bookProgress.translatedSections, 0);

  const md = buildExportDocument(book, translations, 'bilingual');
  assert.match(md, /《微小的优势》/);
  assert.match(md, /你好，世界。/);
  assert.match(md, /Hello world\./);
});
