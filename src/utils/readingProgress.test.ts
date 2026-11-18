import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBookReadingProgress,
  computeArticleScrollRatio,
  formatProgressPercentage,
} from './readingProgress';

const SAMPLE_SECTIONS = [
  { id: 'praise', wordCount: 1000, paragraphs: [] },
  { id: 'preface', wordCount: 1000, paragraphs: [] },
  { id: 'ch-1', wordCount: 4000, paragraphs: [] },
  { id: 'ch-2', wordCount: 4000, paragraphs: [] },
];

test('handles empty section list safely', () => {
  const res = calculateBookReadingProgress([], 'ch-1', 0.5);
  assert.equal(res.totalSections, 0);
  assert.equal(res.ratio, 0);
  assert.equal(res.formattedPercentage, '0%');
});

test('calculates monotonic progress across sections and within active section scroll', () => {
  const atStart = calculateBookReadingProgress(SAMPLE_SECTIONS, 'praise', 0);
  assert.equal(atStart.sectionNumber, 1);
  assert.equal(atStart.totalSections, 4);
  assert.equal(atStart.ratio, 0);
  assert.equal(atStart.formattedPercentage, '0%');

  const ch1Start = calculateBookReadingProgress(SAMPLE_SECTIONS, 'ch-1', 0);
  assert.equal(ch1Start.sectionNumber, 3);
  assert.equal(ch1Start.ratio, 0.2); // 2000 / 10000
  assert.equal(ch1Start.formattedPercentage, '20.0%');

  const ch1Mid = calculateBookReadingProgress(SAMPLE_SECTIONS, 'ch-1', 0.5);
  assert.equal(ch1Mid.ratio, 0.4); // (2000 + 2000) / 10000
  assert.equal(ch1Mid.roundedPercentage, 40);
  assert.equal(ch1Mid.formattedPercentage, '40.0%');

  const ch1End = calculateBookReadingProgress(SAMPLE_SECTIONS, 'ch-1', 1);
  const ch2Start = calculateBookReadingProgress(SAMPLE_SECTIONS, 'ch-2', 0);
  assert.equal(ch1End.ratio, ch2Start.ratio); // Seamless handoff between chapters (0.6)
  assert.equal(ch2Start.formattedPercentage, '60.0%');

  const bookEnd = calculateBookReadingProgress(SAMPLE_SECTIONS, 'ch-2', 1);
  assert.equal(bookEnd.ratio, 1);
  assert.equal(bookEnd.roundedPercentage, 100);
  assert.equal(bookEnd.formattedPercentage, '100%');
});

test('clamps out-of-range scroll ratios and falls back when wordCount is 0', () => {
  const clampedLow = calculateBookReadingProgress(SAMPLE_SECTIONS, 'ch-1', -0.4);
  assert.equal(clampedLow.ratio, 0.2);

  const clampedHigh = calculateBookReadingProgress(SAMPLE_SECTIONS, 'ch-1', 1.8);
  assert.equal(clampedHigh.ratio, 0.6);

  const fallbackSections = [
    { id: 'a', wordCount: 0, paragraphs: [{ id: '1', kind: 'body' as const, text: 'x' }] },
    { id: 'b', wordCount: 0, paragraphs: [{ id: '2', kind: 'body' as const, text: 'y' }] },
  ];
  const mid = calculateBookReadingProgress(fallbackSections, 'b', 0);
  assert.equal(mid.ratio, 0.5);
});

test('computeArticleScrollRatio computes viewport-relative scroll bounds accurately', () => {
  assert.equal(
    computeArticleScrollRatio({ scrollY: 0, viewportHeight: 900, articleBottomInDoc: 2900 }),
    0
  );
  assert.equal(
    computeArticleScrollRatio({ scrollY: 1000, viewportHeight: 900, articleBottomInDoc: 2900 }),
    0.5
  );
  assert.equal(
    computeArticleScrollRatio({ scrollY: 2200, viewportHeight: 900, articleBottomInDoc: 2900 }),
    1
  );
  // Short section fitting entirely inside viewport
  assert.equal(
    computeArticleScrollRatio({ scrollY: 0, viewportHeight: 900, articleBottomInDoc: 720 }),
    1
  );
  // Safe formatting near 0% and 100%
  assert.equal(formatProgressPercentage(0.0001), '0%');
  assert.equal(formatProgressPercentage(0.9997), '100%');
});
