# Implementation Plan: Adventurer Plate & XP Coin Pouch (ป้ายนักผจญภัย + ถุงเหรียญ XP)

**Date:** 2026-11-19  
**Specification Reference:** `docs/superpowers/specs/2026-11-19-adventurer-plate-design.md`  
**Status:** In Progress

---

## 1. Goal
Implement the physical desk brass plate and leather coin pouch for The Questboard:
- Move XP and Level representation from text inside the drawer menu into an interactive on-desk fixture.
- Realize physical feedback: parabolic coin flight on completing quests, pouch bounce, level-up celebratory lift and stamp-in, and 3D card flip.
- Comply with all project invariants: 0 new dependencies, 0 schema changes, strict motion governance, reduced-motion fallback.

---

## 2. Architecture & Modules

```
dist/
├── adventurer-model.mjs      (Pure calculations: xpSummary, coinCount)
├── adventurer-plate.mjs      (Component: DOM mounting, flip, coin flight, celebration)
├── adventurer-plate.css      (Visuals: brass gradient, leather straps, 3D card, pouch, animations)
├── app.mjs                   (Integration: renderCounts, stampPaper, cancel lifecycle)
└── index.html                (Link adventurer-plate.css)

tests/
├── adventurer-model.test.mjs (Unit tests for pure math and edge cases)
└── adventurer-plate.test.mjs (Component lifecycle, coin flight, reduced-motion, serialization test)
```

---

## 3. Step-by-Step Execution Plan

### Step 1: Pure Model (`dist/adventurer-model.mjs`) & Unit Tests (`tests/adventurer-model.test.mjs`)
- [x] Create `dist/adventurer-model.mjs`:
  - `XP_PER_LEVEL = 500`
  - `ADVENTURER_TITLES` (ranks 1 to 8+)
  - `xpSummary(rawXp)`: returns `{ level, intoLevel, perLevel, toNext, title, totalXp }`
  - `coinCount(rawDeltaXp)`: returns clamped count 1..8, or 0
- [ ] Create `tests/adventurer-model.test.mjs`:
  - Test `xpSummary` across boundary points (0, 499, 500, 999, 1000, 5000), negative inputs, NaN, non-numeric values, and high ranks.
  - Test `coinCount` with delta 0, negatives, NaN, small delta (1, 25), exactly 50, 51, 100, 400, 500, 1000.
  - Run `node --test tests/adventurer-model.test.mjs`.

### Step 2: Styling (`dist/adventurer-plate.css`) & Linking in `dist/index.html`
- [ ] Create `dist/adventurer-plate.css`:
  - Position: `#desk-surface > .adventurer-fixture` at `left: 18px; bottom: 18px; z-index: 40;`.
  - Leather straps: hanging cord styling (`--leather-*`).
  - Brass plate: metallic gradients, engraved bevels, lighting-aware box-shadows.
  - 3D flip card effect (`transform-style: preserve-3d; perspective: 600px;`).
  - Progress groove: recessed track with burnished gold fill.
  - Leather coin pouch: stitched edges, drawstring, dynamic bulge.
  - Keyframes: `@keyframes pouch-bounce`, `@keyframes brass-sheen`, `@keyframes coin-spin`.
  - Class `.flying-coin`: absolute floating coin with metallic shine.
  - Accessibility: `prefers-reduced-motion` and `forced-colors` rules.
- [ ] Add `<link rel="stylesheet" href="adventurer-plate.css">` to `dist/index.html`.

### Step 3: Component Implementation (`dist/adventurer-plate.mjs`)
- [ ] Implement `createAdventurerPlate({ deskSurface, document, window, reducedMotion, onCue, icon })`:
  - Mount `.adventurer-fixture` into `#desk-surface`.
  - Plate `<button class="adventurer-plate">` with front and back faces.
  - Click / keydown handler for flipping.
  - `update(xp, { doneCount, emblem, imageDataUrl })`: updates DOM state, progress groove width, titles, aria-labels.
  - `flyCoins({ origin, deltaXp })`: spawns flying coin DOM nodes, computes parabolic flight curves via `animateTransient`, triggers pouch squash/bounce, plays `paperweightDrop` cue. Respects maximum concurrent coin limit (8).
  - `celebrateLevelUp(newLevel)`: plays lift, specular sheen, and stamp-in keyframes via `animateTransient`, announces to `role="status"` live region.
  - `cancelAll()`: clears flying coins and cancels ongoing animations.
  - `destroy()`: unmounts fixture.

### Step 4: Integration in `dist/app.mjs`
- [ ] Import `createAdventurerPlate` from `./adventurer-plate.mjs`.
- [ ] Instantiate `adventurerPlate` during desk initialization inside `shell()`.
- [ ] In `renderCounts()`: call `adventurerPlate.update(xp, { doneCount, emblem, imageDataUrl })`. Retain existing `#adventurer-level` text as backup.
- [ ] In `stampPaper()`: compute `prevXp` and `nextXp`. When stamping 'done' with `deltaXp > 0`, invoke `adventurerPlate.flyCoins({ origin, deltaXp })`. If `nextLevel > prevLevel`, call `adventurerPlate.celebrateLevelUp(nextLevel)`.
- [ ] In drawer opening / window blur / pagehide: call `adventurerPlate.cancelAll()`.

### Step 5: Integration Tests (`tests/adventurer-plate.test.mjs`)
- [ ] Test component creation, DOM presence, and cleanup.
- [ ] Test 3D flip interaction and aria-label updates.
- [ ] Test coin flight lifecycle with mocked WAAPI animation.
- [ ] Test rapid stamping concurrency cap.
- [ ] Test reduced-motion path (no coins, instant/fade update).
- [ ] Test state serialization immutability (no stray keys added to `serializeState`).

### Step 6: Governance & Verification
- [ ] Update `package.json` check script to include `dist/adventurer-model.mjs` and `dist/adventurer-plate.mjs`.
- [ ] Run `npm run check`.
- [ ] Run `node --test tests/motion-governance.test.mjs`.
- [ ] Run full `npm test`.

### Step 7: Documentation & Git Commit
- [ ] Update `README.md` (user perspective + Ctrl+F5 note).
- [ ] Update `.agent/rules/motion-and-interaction.md` (verbs table: flying coins, plate stamping).
- [ ] Update `.agent/rules/design-system.md` (brass plate materials).
- [ ] Update `docs/ideas-backlog.md` (mark item done).
- [ ] Update `docs/verification.md` (latest test run results).
- [ ] Git commit and push to `origin/main`.
