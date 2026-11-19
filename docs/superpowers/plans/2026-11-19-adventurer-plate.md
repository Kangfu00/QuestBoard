# Implementation Plan: Adventurer Card & Blue Mana Light (บัตรนักผจญภัย + มานาแสงสีฟ้า)

**Date:** 2026-11-19  
**Specification Reference:** `docs/superpowers/specs/2026-11-19-adventurer-plate-design.md`  
**Status:** Completed & Verified

---

## 1. Goal
Transition the fixed plate and coin pouch into a freely draggable Adventurer Card with magnetic frame dock and blue mana light particle effects:
- ID-1 card proportions (85.6 : 54 ratio, 160×101px, 8px radius) with antique brass/pewter engraving.
- Draggable across the `#desk-surface` frame outside `#board-scroll`, perspective tilt up to ±6° with dynamic specular sheen sweep.
- Magnetic dock slot at bottom-left corner (`left: 18px; bottom: 18px;`) snapping within 65px radius with settle easing.
- Optional position persistence in `dist/model.mjs` (`adventurerCard: { x, y, docked }`), zero version bump, zero legacy key leakage.
- Blue mana light particle flight replacing flying coins: `manaCount(deltaXp) = clamp(ceil(deltaXp / 60), 3, 12)`, inward curved flight to card seal, level-up shockwave.
- 0 new dependencies, full WAAPI motion governance via `animateTransient`, reduced-motion crossfade fallback.

---

## 2. Architecture & Modules

```
dist/
├── adventurer-model.mjs      (Pure calculations: xpSummary, manaCount)
├── adventurer-card.mjs       (Component: drag, magnetic dock, 3D flip, mana flight, shockwave celebration)
├── adventurer-card.css       (Visuals: ID-1 card, brass/pewter gradient, mana tube, particles, shockwave)
├── app.mjs                   (Integration: createAdventurerCard, renderCounts, stampPaper mana flight)
└── index.html                (Link adventurer-card.css)

tests/
├── adventurer-model.test.mjs (Unit tests for pure math, titles, manaCount)
└── adventurer-card.test.mjs  (Component lifecycle, drag, magnetic snap, keyboard nav, mana flight, model persistence)
```

---

## 3. Execution Checklist

- [x] **Step 1: Pure Model (`dist/adventurer-model.mjs`) & Unit Tests (`tests/adventurer-model.test.mjs`)**
  - Implement `xpSummary` and `manaCount(rawDeltaXp)`.
  - Comprehensive unit tests covering milestone levels, clamping (3..12), invalid/negative inputs.
- [x] **Step 2: Model Persistence (`dist/model.mjs`)**
  - Added `DEFAULT_ADVENTURER_CARD`, `normalizeAdventurerCard`, `updateAdventurerCard`.
  - Integrated into `validateState` as optional field.
- [x] **Step 3: Motion Tokens & Design System (`dist/motion-tokens.mjs` & `dist/motion-tokens.css`)**
  - Added `--dur-card-flip: 520ms`, `--dur-mana-flight: 580ms`, `--dur-mana-absorb: 300ms`.
  - Added blue mana palette variables `--mana-core`, `--mana-mid`, `--mana-deep`.
- [x] **Step 4: Styling (`dist/adventurer-card.css`) & Linking in `dist/index.html`**
  - ID-1 card geometry, front/back 3D faces, mana tube with flowing light, luminous particles, shockwave.
  - Linked in `dist/index.html`, removed obsolete `adventurer-plate.css`.
- [x] **Step 5: Component (`dist/adventurer-card.mjs`)**
  - Dragging with perspective tilt (±6°), magnetic dock slot with 65px snap radius.
  - Keyboard navigation (Arrow keys 10px / 50px with Shift, Enter/Space flip).
  - Blue mana particle flight with acceleration to seal center, instant absorb if moved while flying.
  - Level-up celebration with shockwave ring, brass lift, and numeral stamp-in.
  - Reduced-motion crossfade and clean cancellation.
- [x] **Step 6: Integration in `dist/app.mjs`**
  - Wired `createAdventurerCard` in `shell()`.
  - Updated `renderCounts()` to sync XP, completed count, and board name.
  - Updated `stampPaper()` to trigger `flyMana` and `celebrateLevelUp`.
  - Updated `blur` and `pagehide` to clean up active particles and timers.
- [x] **Step 7: Unit & Integration Tests (`tests/adventurer-card.test.mjs`)**
  - 13 test suites covering mounting, 3D flip, keyboard controls, mana flight, cancellation, shockwave, reduced motion, WAAPI degradation, and legacy backup import.
- [x] **Step 8: Governance & Verification**
  - Updated `package.json` check script.
  - Verified `npm run check` and `tests/motion-governance.test.mjs`.
  - Verified full test suite.
