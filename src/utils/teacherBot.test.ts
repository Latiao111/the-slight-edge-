import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStudyNoteFilename,
  buildStudyNoteMarkdownDocument,
  buildStudyNoteTitle,
  buildTeacherSystemInstruction,
  extractEnglishWordFromSelection,
  extractSurroundingSentence,
  inferTeacherModeFromText,
  markdownToGoogleDocHtml,
  pickBestDriveTemplate,
  sanitizeChatHistory,
} from './teacherBot';

test('inferTeacherModeFromText classifies short phrases as vocab and sentences as article', () => {
  assert.equal(inferTeacherModeFromText('slight edge'), 'vocab');
  assert.equal(inferTeacherModeFromText('simple daily disciplines'), 'vocab');
  assert.equal(
    inferTeacherModeFromText('The same things that are easy to do are also easy not to do.'),
    'article'
  );
  assert.equal(inferTeacherModeFromText('First line.\nSecond line.'), 'article');
});

test('buildTeacherSystemInstruction embeds Drive template when available and defaults to comprehension-first accurate format', () => {
  const defaultVocab = buildTeacherSystemInstruction({
    mode: 'vocab',
    sectionTitleZh: '第 1 章 · 沙滩流浪汉与百万富翁',
  });
  assert.match(defaultVocab, /准确释义与核心理解/);
  assert.match(defaultVocab, /准确理解原意/);
  assert.match(defaultVocab, /第 1 章/);
  assert.match(defaultVocab, /音标与词性/);

  const defaultArticle = buildTeacherSystemInstruction({ mode: 'article' });
  assert.match(defaultArticle, /准确译文/);
  assert.match(defaultArticle, /以准确理解原文为前提/);
  assert.match(defaultArticle, /绝不为了生搬英文词序|切忌生硬的逐词死译/);

  const withTemplate = buildTeacherSystemInstruction({
    mode: 'article',
    template: {
      key: 'article',
      targetName: '英语文章学习',
      found: true,
      name: '英语文章学习',
      sampleContent: '## 今日金句\n## 语法精讲\n## 核心生词',
    },
  });
  assert.match(withTemplate, /严格参照学习者 Google 云端硬盘中的「英语文章学习」范本格式/);
  assert.match(withTemplate, /## 语法精讲/);

  const explorePrompt = buildTeacherSystemInstruction({
    mode: 'explore',
    sectionTitleZh: '第 7 章 · 幸福的秘密',
  });
  assert.match(explorePrompt, /核心原理与本质解读/);
  assert.match(explorePrompt, /跨学科关联与延伸书单/);
  assert.match(explorePrompt, /第 7 章/);
});

test('pickBestDriveTemplate prefers exact Google Doc match over partial matches', () => {
  const best = pickBestDriveTemplate(
    [
      {
        id: '1',
        name: '学单词备份',
        mimeType: 'application/vnd.google-apps.document',
        modifiedTime: '2026-11-16T00:00:00Z',
      },
      {
        id: '2',
        name: '学单词',
        mimeType: 'application/vnd.google-apps.folder',
        modifiedTime: '2026-11-10T00:00:00Z',
      },
      {
        id: '3',
        name: '学单词',
        mimeType: 'application/vnd.google-apps.document',
        modifiedTime: '2026-11-12T00:00:00Z',
      },
    ],
    '学单词'
  );
  assert.equal(best?.id, '3');
});

test('sanitizeChatHistory filters invalid entries and bounds turn count', () => {
  const invalid = [
    { role: 'user', text: '   ' },
    { role: 'system', text: 'bad' },
    { role: 'user', text: 'hello' },
    { role: 'model', text: 'hi there' },
  ];
  const cleaned = sanitizeChatHistory(invalid, 10);
  assert.deepEqual(cleaned, [
    { role: 'user', text: 'hello' },
    { role: 'model', text: 'hi there' },
  ]);
});

test('buildStudyNoteTitle, buildStudyNoteFilename, and buildStudyNoteMarkdownDocument preserve lossless Markdown', () => {
  const date = new Date('2026-11-16T12:00:00Z');
  const title = buildStudyNoteTitle(
    'vocab',
    'disciplines:\n语境原句：Simple daily disciplines compound over time.',
    date
  );
  assert.equal(title, '学单词 · disciplines · 2026-11-16');

  const filename = buildStudyNoteFilename('vocab', 'disciplines', date);
  assert.equal(filename, '学单词 · disciplines · 2026-11-16.md');
  assert.ok(filename.endsWith('.md'));

  const verbatimLesson =
    '### 1. 准确释义与核心理解\n- **音标**：/ˈdɪsəplɪnz/\n- **核心译义**：自律习惯、日常准则\n\n### 2. 双语例句\n> Simple daily disciplines compound over time.';

  const md = buildStudyNoteMarkdownDocument({
    mode: 'vocab',
    userPrompt: 'disciplines\n语境原句：Simple daily disciplines compound over time.',
    markdownContent: verbatimLesson,
    sectionTitleZh: '第 1 章 · 沙滩流浪汉与百万富翁',
    sectionTitleEn: 'Chapter 1: The Beach Bum and the Millionaire',
    date,
  });

  assert.match(md, /^---\n/);
  assert.match(md, /mode: "vocab"/);
  assert.match(md, /section_zh: "第 1 章 · 沙滩流浪汉与百万富翁"/);
  assert.match(md, /section_en: "Chapter 1: The Beach Bum and the Millionaire"/);
  assert.match(md, /created_at: "2026-11-16T12:00:00.000Z"/);
  assert.match(md, /## 原文 \/ 提问/);
  assert.match(md, /> disciplines/);
  assert.match(md, /## 导师精讲笔记/);
  // Verifies 100% lossless retention of teacher Markdown body
  assert.ok(md.includes(verbatimLesson));

  const html = markdownToGoogleDocHtml({
    title,
    mode: 'vocab',
    userPrompt: 'simple daily disciplines',
    markdownContent: '### 核心释义\n- **日常自律**：坚持微小的正反馈行动\n> 做起来容易，不做也容易',
    sectionTitleZh: '第 1 章',
  });
  assert.match(html, /<h1>学单词/);
  assert.match(html, /<h4>核心释义<\/h4>/);
});

test('extractEnglishWordFromSelection and extractSurroundingSentence cleanly handle double-clicked English words', () => {
  assert.equal(extractEnglishWordFromSelection('  "disciplines,"  '), 'disciplines');
  assert.equal(extractEnglishWordFromSelection('self-discipline.'), 'self-discipline');
  assert.equal(extractEnglishWordFromSelection('don’t'), "don't");
  assert.equal(extractEnglishWordFromSelection('中文词'), null);
  assert.equal(extractEnglishWordFromSelection('two words'), null);
  assert.equal(extractEnglishWordFromSelection('a'), null);

  const longParagraph =
    'In the spring of 1978 I sat on a quiet beach wondering why my life had drifted so far off course. Nothing dramatic had destroyed my momentum in a single afternoon. Instead, tiny neglected disciplines had quietly compounded against me over years of hesitation. Once I understood that invisible curve, everything changed.';
  const sentence = extractSurroundingSentence(longParagraph, 'disciplines');
  assert.equal(
    sentence,
    'Instead, tiny neglected disciplines had quietly compounded against me over years of hesitation.'
  );
});
