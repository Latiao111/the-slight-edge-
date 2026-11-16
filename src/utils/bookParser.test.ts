import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseBookText } from './bookParser';
import { SECTION_META_ZH, SEED_TRANSLATIONS } from '../data/pretranslatedBook';

const BOOK_PATH = path.resolve(
  process.cwd(),
  'public/assets/aistudio/The_Slight_Edge__Turning_Simple_-_Olson__Jeff_e727ea6b.txt'
);

test('parses The Slight Edge into all 24 structured sections', () => {
  const raw = fs.readFileSync(BOOK_PATH, 'utf8');
  const book = parseBookText(raw, SECTION_META_ZH);

  assert.equal(book.sections.length, 24);
  assert.equal(book.sections[0].id, 'praise');
  assert.equal(book.sections[1].id, 'preface');
  assert.equal(book.sections[1].paragraphs.length, 9);

  for (let ch = 1; ch <= 18; ch++) {
    const sec = book.sections.find((s) => s.id === `ch-${ch}`);
    assert.ok(sec, `Missing chapter ch-${ch}`);
    assert.equal(sec.chapterNumber, ch);
    assert.ok(sec.paragraphs.length > 20, `Chapter ${ch} has too few paragraphs`);
    assert.ok(sec.titleZh.length > 0, `Chapter ${ch} missing titleZh`);
    assert.ok(sec.essentialPointsZh && sec.essentialPointsZh.length > 0, `Chapter ${ch} missing essentialPointsZh`);
  }

  assert.ok(book.sections.find((s) => s.id === 'invitation'));
  assert.ok(book.sections.find((s) => s.id === 'books'));
  assert.ok(book.sections.find((s) => s.id === 'acknowledgments'));
  assert.ok(book.sections.find((s) => s.id === 'about'));
});

test('Chapter 1 detects epigraph, subheadings, story header, and essential points accurately', () => {
  const raw = fs.readFileSync(BOOK_PATH, 'utf8');
  const book = parseBookText(raw, SECTION_META_ZH);
  const ch1 = book.sections.find((s) => s.id === 'ch-1');
  assert.ok(ch1);

  assert.equal(ch1.paragraphs[0].kind, 'epigraph');
  assert.equal(ch1.paragraphs[1].kind, 'attribution');
  assert.ok(ch1.paragraphs.some((p) => p.kind === 'subheading' && p.text === 'My Day of Disgust'));
  assert.ok(ch1.paragraphs.some((p) => p.kind === 'story_header'));
  assert.ok(ch1.paragraphs.some((p) => p.kind === 'essential_header'));
  assert.equal(ch1.paragraphs.filter((p) => p.kind === 'essential_item').length, 4);
});

test('Seed translations match every paragraph ID in preface, ch-1, invitation, books, acknowledgments, and about', () => {
  const raw = fs.readFileSync(BOOK_PATH, 'utf8');
  const book = parseBookText(raw, SECTION_META_ZH);

  for (const sid of ['preface', 'ch-1', 'invitation', 'books', 'acknowledgments', 'about'] as const) {
    const sec = book.sections.find((s) => s.id === sid);
    assert.ok(sec, `Missing section ${sid}`);
    const trans = SEED_TRANSLATIONS[sid];
    assert.ok(trans, `Missing seed translation for ${sid}`);
    for (const p of sec.paragraphs) {
      assert.ok(trans[p.id] && trans[p.id].trim().length > 0, `Missing translation for ${p.id}`);
    }
  }
});
