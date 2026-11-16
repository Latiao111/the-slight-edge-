import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { parseBookText } from './bookParser';
import { SECTION_META_ZH, SEED_TRANSLATIONS } from '../data/pretranslatedBook';
import {
  buildEpubPackageFiles,
  escapeXml,
  generateEpubUint8Array,
} from './epubGenerator';

const BOOK_PATH = path.resolve(
  process.cwd(),
  'public/assets/aistudio/The_Slight_Edge__Turning_Simple_-_Olson__Jeff_e727ea6b.txt'
);

test('escapeXml escapes special XML characters and strips invalid control chars', () => {
  assert.equal(
    escapeXml('A & B <tag> "quote" \'apos\'\u0007'),
    'A &amp; B &lt;tag&gt; &quot;quote&quot; &apos;apos&apos;'
  );
});

test('buildEpubPackageFiles constructs valid OCF structure for translated and full book modes', () => {
  const raw = fs.readFileSync(BOOK_PATH, 'utf8');
  const book = parseBookText(raw, SECTION_META_ZH);

  const translatedOnlyPkg = buildEpubPackageFiles(
    book,
    SEED_TRANSLATIONS,
    'zh',
    true,
    '2026-11-16T01:00:00Z'
  );
  assert.equal(translatedOnlyPkg.includedSections.length, 6);
  assert.equal(translatedOnlyPkg.files[0].path, 'mimetype');
  assert.equal(translatedOnlyPkg.files[0].content, 'application/epub+zip');
  assert.equal(translatedOnlyPkg.files[0].store, true);

  const fullBilingualPkg = buildEpubPackageFiles(
    book,
    SEED_TRANSLATIONS,
    'bilingual',
    false,
    '2026-11-16T01:00:00Z'
  );
  assert.equal(fullBilingualPkg.includedSections.length, 24);
  const opf = fullBilingualPkg.files.find((f) => f.path === 'OEBPS/content.opf');
  assert.ok(opf);
  assert.match(opf.content, /<dc:language>zh-CN<\/dc:language>/);
  assert.match(opf.content, /微小的优势（中英双语对照版）/);
  assert.match(opf.content, /sec_ch-10/);
});

test('generateEpubUint8Array produces a valid readable EPUB ZIP archive with uncompressed mimetype first', async () => {
  const raw = fs.readFileSync(BOOK_PATH, 'utf8');
  const book = parseBookText(raw, SECTION_META_ZH);

  const { data, filename, sectionCount } = await generateEpubUint8Array(
    book,
    SEED_TRANSLATIONS,
    'bilingual',
    true
  );

  assert.equal(sectionCount, 6);
  assert.equal(filename, '微小的优势_The_Slight_Edge_双语版.epub');
  // PK\x03\x04 ZIP header and uncompressed "mimetype" right at the beginning of the local file header
  assert.equal(data[0], 0x50);
  assert.equal(data[1], 0x4b);
  const headerProbe = Buffer.from(data.slice(0, 80)).toString('utf8');
  assert.ok(headerProbe.includes('mimetypeapplication/epub+zip'));

  const loaded = await JSZip.loadAsync(data);
  const containerXml = await loaded.file('META-INF/container.xml')?.async('string');
  assert.ok(containerXml && containerXml.includes('OEBPS/content.opf'));

  const ch1Xhtml = await loaded.file('OEBPS/sections/ch-1.xhtml')?.async('string');
  assert.ok(ch1Xhtml);
  assert.ok(ch1Xhtml.includes('第 1 章 · 沙滩流浪汉与百万富翁'));
  assert.ok(ch1Xhtml.includes('class="en-parallel"'));
  assert.ok(ch1Xhtml.includes('图 1 · 逃离“过山车诅咒”'));
});
