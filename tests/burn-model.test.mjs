import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BURN_STAGES,
  BURN_COLORS,
  burnStage,
  burnVariant,
  msUntilNextMidnight,
  generateBurnMaskSvg,
  burnMaskDataUri,
  BURN_MASKS,
} from '../dist/burn-model.mjs';

test('burnStage returns 0 for non-active quests regardless of due date', () => {
  for (const status of ['done', 'failed', 'paused', '', 'archived', null, undefined]) {
    assert.equal(burnStage('2026-11-10', '2026-11-19', status), 0);
    assert.equal(burnStage('2026-11-19', '2026-11-19', status), 0);
    assert.equal(burnStage('2026-11-20', '2026-11-19', status), 0);
  }
});

test('burnStage returns 0 for missing or malformed due date or today reference', () => {
  assert.equal(burnStage('', '2026-11-19', 'active'), 0);
  assert.equal(burnStage(null, '2026-11-19', 'active'), 0);
  assert.equal(burnStage(undefined, '2026-11-19', 'active'), 0);
  assert.equal(burnStage('invalid-date', '2026-11-19', 'active'), 0);
  assert.equal(burnStage('2026-11-19', '', 'active'), 0);
  assert.equal(burnStage('2026-11-19', 'bad-today', 'active'), 0);
});

test('burnStage correctly determines all 5 stages (0–4) according to due date distance', () => {
  const today = '2026-11-19';

  // Stage 4: Overdue (yesterday or earlier)
  assert.equal(burnStage('2026-11-18', today, 'active'), BURN_STAGES.OVERDUE);
  assert.equal(burnStage('2026-11-01', today, 'active'), BURN_STAGES.OVERDUE);
  assert.equal(burnStage('2025-12-31', today, 'active'), BURN_STAGES.OVERDUE);

  // Stage 3: Due Today
  assert.equal(burnStage('2026-11-19', today, 'active'), BURN_STAGES.TODAY);

  // Stage 2: Due Tomorrow (1 day left)
  assert.equal(burnStage('2026-11-20', today, 'active'), BURN_STAGES.TOMORROW);

  // Stage 1: In 2 to 3 days
  assert.equal(burnStage('2026-11-21', today, 'active'), BURN_STAGES.UPCOMING);
  assert.equal(burnStage('2026-11-22', today, 'active'), BURN_STAGES.UPCOMING);

  // Stage 0: More than 3 days left
  assert.equal(burnStage('2026-11-23', today, 'active'), BURN_STAGES.NONE);
  assert.equal(burnStage('2026-12-01', today, 'active'), BURN_STAGES.NONE);
  assert.equal(burnStage('2027-01-01', today, 'active'), BURN_STAGES.NONE);
});

test('burnStage works across month and year boundaries and handles Date objects', () => {
  // Month transition
  assert.equal(burnStage('2026-12-01', '2026-11-30', 'active'), 2); // tomorrow
  assert.equal(burnStage('2026-12-02', '2026-11-30', 'active'), 1); // in 2 days
  assert.equal(burnStage('2026-11-30', '2026-12-01', 'active'), 4); // overdue

  // Year transition
  assert.equal(burnStage('2027-01-01', '2026-12-31', 'active'), 2); // tomorrow
  assert.equal(burnStage('2026-12-31', '2027-01-01', 'active'), 4); // overdue

  // Date instance as today
  const nowDate = new Date(2026, 10, 19, 15, 30, 0); // Nov 19, 2026
  assert.equal(burnStage('2026-11-19', nowDate, 'active'), 3);
  assert.equal(burnStage('2026-11-20', nowDate, 'active'), 2);
  assert.equal(burnStage('2026-11-18', nowDate, 'active'), 4);
});

test('burnVariant returns stable, deterministic variant (0..3) based on ID', () => {
  const v1 = burnVariant('quest-alpha-123');
  const v2 = burnVariant('quest-alpha-123');
  assert.equal(v1, v2);
  assert.ok(v1 >= 0 && v1 <= 3);

  assert.equal(burnVariant(''), 0);
  assert.equal(burnVariant(null), 0);

  // Test across multiple IDs that variants distribute across 0..3
  const seen = new Set();
  for (let i = 0; i < 20; i++) {
    seen.add(burnVariant(`quest-${i}`));
  }
  assert.ok(seen.size > 1, 'Variants should distribute across IDs');
});

test('msUntilNextMidnight calculates milliseconds until next local midnight', () => {
  const testNoon = new Date(2026, 10, 19, 12, 0, 0);
  const ms = msUntilNextMidnight(testNoon);
  // Noon to midnight is 12 hours = 43,200,000 ms + 1000 ms buffer
  assert.equal(ms, 43201000);

  const testNearMidnight = new Date(2026, 10, 19, 23, 59, 59);
  const msNear = msUntilNextMidnight(testNearMidnight);
  assert.equal(msNear, 2000);
});

test('generateBurnMaskSvg produces valid, deterministic SVG masks', () => {
  const svg0 = generateBurnMaskSvg(0);
  const svg0Again = generateBurnMaskSvg(0);
  assert.equal(svg0, svg0Again, 'Same variant must generate identical SVG');

  const svg1 = generateBurnMaskSvg(1);
  assert.notEqual(svg0, svg1, 'Different variants should produce distinct SVG paths');

  for (let v = 0; v < 4; v++) {
    const svg = generateBurnMaskSvg(v);
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420">'));
    assert.ok(svg.includes('fill-rule="evenodd"'));
    assert.ok(svg.endsWith('</svg>'));
  }
});

test('burnMaskDataUri and BURN_MASKS provide usable data URIs', () => {
  assert.equal(BURN_MASKS.length, 4);
  for (let i = 0; i < 4; i++) {
    const uri = burnMaskDataUri(i);
    assert.ok(uri.startsWith('data:image/svg+xml;charset=utf-8,'));
    assert.equal(BURN_MASKS[i], uri);
    const decoded = decodeURIComponent(uri.replace('data:image/svg+xml;charset=utf-8,', ''));
    assert.ok(decoded.includes('<svg'));
  }
});
