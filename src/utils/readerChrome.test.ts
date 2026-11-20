import assert from 'node:assert/strict';
import test from 'node:test';
import { computeNextChromeHidden, isEditableElementLike } from './readerChrome';

test('computeNextChromeHidden hides on downward scroll past threshold and reveals on upward scroll', () => {
  // Always visible near top of page
  assert.equal(
    computeNextChromeHidden({
      scrollY: 60,
      lastScrollY: 20,
      currentlyHidden: false,
      focusMode: false,
    }),
    false
  );

  // Hides on deliberate downward scroll past threshold
  assert.equal(
    computeNextChromeHidden({
      scrollY: 240,
      lastScrollY: 180,
      currentlyHidden: false,
      focusMode: false,
    }),
    true
  );

  // Ignores tiny jitter while hidden
  assert.equal(
    computeNextChromeHidden({
      scrollY: 236,
      lastScrollY: 240,
      currentlyHidden: true,
      focusMode: false,
    }),
    true
  );

  // Reveals on deliberate upward scroll
  assert.equal(
    computeNextChromeHidden({
      scrollY: 210,
      lastScrollY: 240,
      currentlyHidden: true,
      focusMode: false,
    }),
    false
  );

  // Always hidden when Focus Mode is active, even at top of page
  assert.equal(
    computeNextChromeHidden({
      scrollY: 0,
      lastScrollY: 0,
      currentlyHidden: false,
      focusMode: true,
    }),
    true
  );
});

test('isEditableElementLike protects text inputs from reading keyboard shortcuts', () => {
  assert.equal(isEditableElementLike({ tagName: 'TEXTAREA' }), true);
  assert.equal(isEditableElementLike({ tagName: 'input' }), true);
  assert.equal(isEditableElementLike({ tagName: 'SELECT' }), true);
  assert.equal(isEditableElementLike({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(isEditableElementLike({ tagName: 'BODY', isContentEditable: false }), false);
  assert.equal(isEditableElementLike(null), false);
});
