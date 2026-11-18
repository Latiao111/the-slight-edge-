import type { BookSection } from '../types/book';

export interface BookReadingProgress {
  sectionIndex: number;
  sectionNumber: number;
  totalSections: number;
  ratio: number;
  percentage: number;
  roundedPercentage: number;
  formattedPercentage: string;
  sectionStartRatio: number;
  sectionEndRatio: number;
}

function getSectionWeight(section: Pick<BookSection, 'wordCount' | 'paragraphs'>): number {
  if (typeof section.wordCount === 'number' && section.wordCount > 0) {
    return section.wordCount;
  }
  const paraCount = Array.isArray(section.paragraphs) ? section.paragraphs.length : 0;
  return Math.max(1, paraCount * 40);
}

/**
 * Computes normalized [0, 1] scroll progress within an article container.
 */
export function computeArticleScrollRatio(params: {
  scrollY: number;
  viewportHeight: number;
  articleBottomInDoc: number;
}): number {
  const { scrollY, viewportHeight, articleBottomInDoc } = params;
  if (
    !Number.isFinite(scrollY) ||
    !Number.isFinite(viewportHeight) ||
    !Number.isFinite(articleBottomInDoc) ||
    viewportHeight <= 0
  ) {
    return 0;
  }

  const maxScroll = articleBottomInDoc - viewportHeight;
  if (maxScroll <= 4) {
    return 1;
  }

  return Math.min(1, Math.max(0, scrollY / maxScroll));
}

export function formatProgressPercentage(ratio: number): string {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  if (clamped <= 0.0005) return '0%';
  if (clamped >= 0.9995) return '100%';
  return `${(clamped * 100).toFixed(1)}%`;
}

/**
 * Computes the reader's position across the entire book weighted by section length,
 * smoothly interpolating from the start of the active section to its end using
 * `sectionScrollRatio` in [0, 1].
 */
export function calculateBookReadingProgress(
  sections: Pick<BookSection, 'id' | 'wordCount' | 'paragraphs'>[],
  activeSectionId: string,
  sectionScrollRatio: number
): BookReadingProgress {
  const totalSections = sections.length;
  if (totalSections === 0) {
    return {
      sectionIndex: 0,
      sectionNumber: 0,
      totalSections: 0,
      ratio: 0,
      percentage: 0,
      roundedPercentage: 0,
      formattedPercentage: '0%',
      sectionStartRatio: 0,
      sectionEndRatio: 0,
    };
  }

  const foundIndex = sections.findIndex((s) => s.id === activeSectionId);
  const sectionIndex = foundIndex >= 0 ? foundIndex : 0;

  const weights = sections.map(getSectionWeight);
  const totalWeight = weights.reduce((acc, w) => acc + w, 0);

  let weightBefore = 0;
  for (let i = 0; i < sectionIndex; i += 1) {
    weightBefore += weights[i];
  }
  const currentWeight = weights[sectionIndex];
  const clampedScroll = Math.min(
    1,
    Math.max(0, Number.isFinite(sectionScrollRatio) ? sectionScrollRatio : 0)
  );

  const sectionStartRatio = totalWeight > 0 ? weightBefore / totalWeight : 0;
  const sectionEndRatio = totalWeight > 0 ? (weightBefore + currentWeight) / totalWeight : 0;
  const coveredWeight = weightBefore + currentWeight * clampedScroll;
  const ratio =
    totalWeight > 0 ? Math.min(1, Math.max(0, coveredWeight / totalWeight)) : 0;

  return {
    sectionIndex,
    sectionNumber: sectionIndex + 1,
    totalSections,
    ratio,
    percentage: Math.round(ratio * 1000) / 10,
    roundedPercentage: Math.round(ratio * 100),
    formattedPercentage: formatProgressPercentage(ratio),
    sectionStartRatio,
    sectionEndRatio,
  };
}
