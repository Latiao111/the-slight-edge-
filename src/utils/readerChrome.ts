export interface ChromeScrollInput {
  scrollY: number;
  lastScrollY: number;
  currentlyHidden: boolean;
  focusMode: boolean;
  hideThreshold?: number;
  revealDelta?: number;
  hideDelta?: number;
}

/**
 * Pure state machine deciding whether top navigation chrome should hide
 * during immersive long-form reading.
 * - Always hidden when explicit Focus Mode is active.
 * - Always visible near the top of the document (scrollY < hideThreshold).
 * - Hides after deliberate downward scrolling (> hideDelta).
 * - Reveals after deliberate upward scrolling (> revealDelta).
 */
export function computeNextChromeHidden(input: ChromeScrollInput): boolean {
  const {
    scrollY,
    lastScrollY,
    currentlyHidden,
    focusMode,
    hideThreshold = 110,
    hideDelta = 12,
    revealDelta = 10,
  } = input;

  if (focusMode) return true;
  if (scrollY < hideThreshold) return false;

  const delta = scrollY - lastScrollY;
  if (delta > hideDelta) return true;
  if (delta < -revealDelta) return false;
  return currentlyHidden;
}

/**
 * Returns true if the event target is an interactive text-entry control
 * where single-key reading shortcuts (F, M, T) must not fire.
 */
export function isEditableElementLike(
  target: { tagName?: string; isContentEditable?: boolean } | null | undefined
): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = (target.tagName || '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
