import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BURN_STAGES,
  BURN_COLORS,
  burnStage,
  burnVariant,
  msUntilNextMidnight,
  BURN_VARIANTS,
  burnEdgePoints,
  generateBurnLayerSvg,
  svgDataUri,
  burnLayerCss,
  installBurnLayers,
  PAPER_AGE_STAGES,
  paperAgeStage,
  burnWispAnchors,
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

test('burnEdgePoints is deterministic, distinct per variant and stays on the paper', () => {
  const a = burnEdgePoints(0, 20);
  assert.deepEqual(a, burnEdgePoints(0, 20));
  assert.notDeepEqual(a, burnEdgePoints(1, 20));
  assert.equal(a.length, 48);
  for (const [x, y] of a) {
    assert.ok(x >= 0 && x <= 300 && y >= 0 && y <= 424, `point ${x},${y} left the paper`);
  }
});

test('a deeper burn edge sits further inside the paper on average', () => {
  const mean = points => points.reduce((sum, [x, y]) => sum + Math.min(x, 300 - x, y, 424 - y), 0) / points.length;
  assert.ok(mean(burnEdgePoints(2, 30)) > mean(burnEdgePoints(2, 8)));
});

test('generateBurnLayerSvg draws halo for stages 1-4 but char and ember only for stages 3-4', () => {
  for (let v = 0; v < BURN_VARIANTS; v++) {
    for (let stage = 1; stage <= 4; stage++) {
      const halo = generateBurnLayerSvg('halo', v, stage);
      assert.ok(halo.startsWith("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 424'"));
      assert.ok(halo.endsWith('</svg>'));
      for (const layer of ['mask', 'char', 'ember']) {
        const svg = generateBurnLayerSvg(layer, v, stage);
        assert.equal(svg === '', stage < 3, `${layer} stage ${stage}`);
      }
    }
  }
  assert.equal(generateBurnLayerSvg('halo', 0, 0), '');
  assert.throws(() => generateBurnLayerSvg('smoke', 0, 3), RangeError);
});

test('burn layers are deterministic and differ by variant and by stage', () => {
  assert.equal(generateBurnLayerSvg('halo', 1, 2), generateBurnLayerSvg('halo', 1, 2));
  assert.notEqual(generateBurnLayerSvg('halo', 0, 2), generateBurnLayerSvg('halo', 1, 2));
  assert.notEqual(generateBurnLayerSvg('char', 0, 3), generateBurnLayerSvg('char', 0, 4));
});

test('char and ember share the same edge so the glow sits on the char line', () => {
  const char = generateBurnLayerSvg('char', 2, 3);
  const ember = generateBurnLayerSvg('ember', 2, 3);
  const fray = svg => svg.match(/seed='(\d+)'/)[1];
  assert.equal(fray(char), fray(ember));
});

test('svgDataUri is safe inside a double-quoted CSS url()', () => {
  const uri = svgDataUri(generateBurnLayerSvg('halo', 0, 3));
  assert.ok(uri.startsWith('data:image/svg+xml,'));
  assert.doesNotMatch(uri.slice('data:image/svg+xml,'.length), /[#<>"]/);
});

test('burnLayerCss binds every stage and variant to its layers', () => {
  const css = burnLayerCss();
  for (let stage = 1; stage <= 4; stage++) {
    for (let v = 0; v < BURN_VARIANTS; v++) {
      assert.ok(css.includes(`.paper-burn[data-burn="${stage}"][data-burn-variant="${v}"]`), `stage ${stage} variant ${v}`);
    }
  }
  assert.equal(css.split('\n').length, 16 + 8 + 8 + 8);
  assert.equal(css.match(/mask-image:/g).length, 16);
  assert.equal(css.match(/\)::before\{/g).length, 8);
  assert.equal(css.match(/\)::after\{/g).length, 8);
});

test('installBurnLayers adds the style once and tolerates a missing document', () => {
  const added = [];
  const doc = {
    head: { querySelector: () => added[0] ?? null, append: el => added.push(el) },
    createElement: () => ({ attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }),
  };
  assert.equal(installBurnLayers(doc), true);
  assert.equal(installBurnLayers(doc), false);
  assert.equal(added.length, 1);
  assert.ok('data-burn-layers' in added[0].attrs);
  assert.ok(added[0].textContent.includes('data-burn="4"'));
  assert.equal(installBurnLayers(null), false);
});

test('paperAgeStage computes fresh, aged (14+ days), and antique (30+ days) stages safely', () => {
  const today = '2026-11-19';
  assert.equal(paperAgeStage(undefined, today), PAPER_AGE_STAGES.FRESH);
  assert.equal(paperAgeStage('', today), PAPER_AGE_STAGES.FRESH);
  assert.equal(paperAgeStage('bad-date', today), PAPER_AGE_STAGES.FRESH);
  assert.equal(paperAgeStage('2026-11-19', today), PAPER_AGE_STAGES.FRESH);
  assert.equal(paperAgeStage('2026-11-06', today), PAPER_AGE_STAGES.FRESH);   // 13 days
  assert.equal(paperAgeStage('2026-11-05', today), PAPER_AGE_STAGES.AGED);    // 14 days
  assert.equal(paperAgeStage('2026-10-21', today), PAPER_AGE_STAGES.AGED);    // 29 days
  assert.equal(paperAgeStage('2026-10-20', today), PAPER_AGE_STAGES.ANTIQUE); // 30 days
  assert.equal(paperAgeStage('2026-09-01', new Date(2026, 10, 19, 10, 0)), PAPER_AGE_STAGES.ANTIQUE);
});

test('burnWispAnchors returns 3 deterministic stage-3 ember anchors per variant', () => {
  for (let v = 0; v < BURN_VARIANTS; v++) {
    const anchors = burnWispAnchors(v);
    assert.equal(anchors.length, 3);
    assert.deepEqual(anchors, burnWispAnchors(v));
  }
  assert.notDeepEqual(burnWispAnchors(0), burnWispAnchors(1));
  assert.deepEqual(burnWispAnchors(4), burnWispAnchors(0));
});
