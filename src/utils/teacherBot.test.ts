import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStudyNoteTitle,
  buildTeacherSystemInstruction,
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

test('buildTeacherSystemInstruction embeds Drive template when available and defaults to literal-first format', () => {
  const defaultVocab = buildTeacherSystemInstruction({
    mode: 'vocab',
    sectionTitleZh: '第 1 章 · 沙滩流浪汉与百万富翁',
  });
  assert.match(defaultVocab, /字面直译|直译先行/);
  assert.match(defaultVocab, /第 1 章/);
  assert.match(defaultVocab, /音标与词性/);

  const defaultArticle = buildTeacherSystemInstruction({ mode: 'article' });
  assert.match(defaultArticle, /忠实直译/);
  assert.match(defaultArticle, /直译优先/);

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

test('buildStudyNoteTitle and markdownToGoogleDocHtml format clean Google Doc payloads', () => {
  const title = buildStudyNoteTitle(
    'vocab',
    'simple daily disciplines:\nmeaning',
    new Date('2026-11-16T12:00:00Z')
  );
  assert.equal(title, '学单词 · simple daily disciplines mea… · 2026-11-16');

  const html = markdownToGoogleDocHtml({
    title,
    mode: 'vocab',
    userPrompt: 'simple daily disciplines',
    markdownContent: '### 核心释义\n- **日常自律**：坚持微小的正反馈行动\n> 做起来容易，不做也容易',
    sectionTitleZh: '第 1 章',
  });
  assert.match(html, /<h1>学单词/);
  assert.match(html, /<h4>核心释义<\/h4>/);
  assert.match(html, /<ul>\s*<li><strong>日常自律<\/strong>/);
  assert.match(html, /<blockquote><p>做起来容易/);
});
