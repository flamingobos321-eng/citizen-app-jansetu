import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { screenTopPadding } from '../artifacts/jansetu-mobile/lib/screenInsets.ts';

test('iOS does not add the status bar or Dynamic Island inset twice', () => {
  for (const top of [0, 20, 47, 59, 62]) {
    assert.equal(screenTopPadding('ios', top), 14);
    // UIKit's automatic inset plus our content gap: one safe area, not two.
    assert.equal(top + screenTopPadding('ios', top), top + 14);
  }
});

test('Android preserves its reported status bar inset', () => {
  assert.equal(screenTopPadding('android', 24), 38);
  assert.equal(screenTopPadding('android', 0), 14);
});

test('web has no artificial 67px status bar gap', () => {
  assert.equal(screenTopPadding('web', 0), 14);
  assert.equal(screenTopPadding('web', 30), 44);
});

test('both regular and keyboard-aware screens retain iOS automatic inset handling', () => {
  const screen = readFileSync(
    new URL('../artifacts/jansetu-mobile/components/ui.tsx', import.meta.url), 'utf8',
  ).split('export function BrandMark')[0];
  assert.equal((screen.match(/contentInsetAdjustmentBehavior="automatic"/g) || []).length, 2);
  assert.match(screen, /paddingTop: screenTopPadding\(Platform\.OS, insets\.top\)/);
});
