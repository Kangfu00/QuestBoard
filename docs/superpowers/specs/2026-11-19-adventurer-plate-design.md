# Adventurer Plate & XP Coin Pouch Specification

**Date:** 2026-11-19  
**Feature:** ป้ายนักผจญภัย + ถุงเหรียญ XP บนกรอบโต๊ะ (Brass Adventurer Plate & Leather Coin Pouch)  
**Status:** Approved for Implementation

---

## 1. Goal & Product Vision

Currently, Level and XP are rendered as plain text in the drawer summary (`<small id="adventurer-level"></small>`). In accordance with The Questboard's core fantasy-registrar ethos—where physical desk artifacts replace abstract web dashboards—we introduce:
1. **ป้ายนักผจญภัย (Brass Adventurer Plate):** An antique engraved brass plate hung from leather straps on the bottom-left frame of the desk. The front displays the adventurer's rank emblem, current Level numeral, title in Thai, and an engraved progress groove toward the next rank. Clicking or pressing Enter flips the plate in 3D to reveal back-side details (total XP, completed quests, and remaining XP to the next level).
2. **ถุงเหรียญหนัง (Leather XP Coin Pouch):** A stitched leather drawstring pouch positioned next to the brass plate that visibly bulges as XP accumulates. When a quest is stamped "Done", physical gold coins fly from the stamp point in a parabolic arc into the pouch, causing it to squash and settle with a metallic clink.

---

## 2. Global Constraints & Project Invariants

- **No Data Schema Modifications:** Do not edit `dist/model.mjs`, backup structures, or schema version numbers. All values are computed on-the-fly from existing quest state (`questItems(true).filter(q => q.status === 'done').reduce((a, q) => a + q.xp, 0)`).
- **No External Dependencies / Build Steps:** Pure native ES modules (`.mjs`) and CSS (`dist/adventurer-plate.css`).
- **No New Audio/Image Assets:** Use existing CC0 sounds (`paperweightDrop` / `impactMetal_light`) and SVG/CSS geometry.
- **Fixed Desk Frame Placement:** Fixed to `#desk-surface` outside `#board-scroll` so it never moves, scales, or zooms when panning the board.
- **Motion Governance Compliance:** All WAAPI `.animate()` calls must route exclusively through `animateTransient` / `cancelMotion` from `dist/desk-motion.mjs`, respect `prefers-reduced-motion`, and avoid DOM leaks.

---

## 3. Desk Geometry & Conflict Analysis

- **Target Container:** `#desk-surface` (`position: relative; height: 100%`).
- **Anchor Coordinates:** `position: absolute; left: 18px; bottom: 18px; z-index: 40;`
- **Conflict Verification:**
  - **Top:** Tool rail is mounted along the top edge (`top: 0`). No conflict.
  - **Right:** `#quest-drawer` / side storage occupies the right edge. No conflict.
  - **Bottom Lip:** `--shutter-lip` is fixed at bottom (`z-index: 11000`, `pointer-events: none` except handle).
  - **Bottom Center:** `#toast` is fixed at `bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 200;`. Plate is at `left: 18px`, leaving abundant clearance.
  - **Z-Index Hierarchy:** `.board-scroll` is `z-index: 0`, `.desk-atmosphere` is `z-index: 20` (with `pointer-events: none`). Plate sits at `z-index: 40`, safely accessible to pointer clicks and keyboard focus, while remaining below drawer overlays (160–175) and dialogs (10000+).

---

## 4. Pure Model (`dist/adventurer-model.mjs`)

### Constants
```javascript
export const XP_PER_LEVEL = 500;

export const ADVENTURER_TITLES = Object.freeze({
  1: 'ผู้สมัครกิลด์',
  2: 'ผู้ฝึกหัด',
  3: 'นักสำรวจ',
  4: 'นักผจญภัย',
  5: 'ผู้กล้า',
  6: 'ผู้เชี่ยวชาญ',
  7: 'ผู้พิทักษ์',
  8: 'ตำนานแห่งกิลด์',
});
```

### Pure Functions
1. `xpSummary(rawXp)`:
   - Sanitizes input: `xp = Math.floor(Math.max(0, Number(rawXp) || 0))`.
   - `level = Math.floor(xp / XP_PER_LEVEL) + 1`.
   - `intoLevel = xp % XP_PER_LEVEL` (range 0..499).
   - `toNext = XP_PER_LEVEL - intoLevel`.
   - `title = ADVENTURER_TITLES[level] || ADVENTURER_TITLES[8] || 'ตำนานแห่งกิลด์'`.
   - Returns `{ level, intoLevel, perLevel: XP_PER_LEVEL, toNext, title, totalXp: xp }`.

2. `coinCount(rawDeltaXp)`:
   - Sanitizes input: `delta = Number(rawDeltaXp)`.
   - If `!Number.isFinite(delta) || delta <= 0`, returns `0`.
   - Otherwise: `Math.min(8, Math.max(1, Math.ceil(delta / 50)))` (1..8 coins).

---

## 5. Visual Specifications (`dist/adventurer-plate.css`)

### Materials & Color Palette
- **Antique Brass:**
  - Base gradient: `linear-gradient(145deg, #d4be88 0%, #b89b62 35%, #7a5d3c 75%, #4d3a22 100%)`
  - Bevel highlight: `inset 1px 1px 1px #fff0b866, inset -1px -1px 2px #26160899`
  - Drop shadow: Modulated by `--light-x`, `--light-y`, and `--lift`.
- **Leather Straps & Rivets:**
  - Straps: Two vertical straps looping above the plate (`#533922` to `#3a2414`, edge `#26160d`).
  - Rivets: Two round brass studs (`#cfb67d` with dark burnished shadow `#382613`).
- **Engraved Groove (Progress Bar):**
  - Track: Cut into the brass `background: #2b1c10; box-shadow: inset 1px 1px 2px #150c06, 0 1px 0 #ecd69c40;`
  - Fill: Burnished gold inlay `background: linear-gradient(90deg, #9b7941, #ecd69c);`
- **Coin Pouch:**
  - Leather sack body (`#4a3320` to `#342214`), stitched seams (`#8a6543`), brass drawstring clasp.
  - Scale/bulge adjusts subtly with `intoLevel / 500`.

### Flip Interaction & Accessibility
- Plate element is a `<button type="button" class="adventurer-plate" aria-label="..." role="button">`.
- Minimum tap target size: 40px × 40px (plate dimensions ~150px × 74px).
- Flip triggered on `click` or `Enter`/`Space` keypress.
- 3D card rotation: `transform-style: preserve-3d; transition: transform 420ms var(--ease-slide);`
- Front side: Level number (`Cinzel`), Title (`Noto Serif Thai`), Guild emblem (`icon`), Progress groove.
- Back side: Total XP, completed quests count, remaining XP to next level.
- Live region: An attached `<span class="adventurer-status sr-only" role="status" aria-live="polite">` announces level-up milestones.

---

## 6. Motion & Animation Behaviors

### 1. Stamping "Done" (Flying Coins)
- Count: `coinCount(deltaXp)` (1 to 8 coins).
- Origin: Client `{ x, y }` from stamp event, or center of stamped paper element.
- Destination: Center of coin pouch on desk frame.
- Parabolic Flight: Keyframes calculated via parametric quadratic Bézier curve with an upward peak offset (-60px to -120px) to simulate gravity arc.
- Duration: 420ms to 560ms, staggered by 50ms per coin.
- Easing: `cubic-bezier(.22,.8,.24,1)` (`MOTION_EASING.slide`).
- Pouch Reaction: On coin arrival, pouch squashes and bounces (`pouch-bounce` ~160ms).
- Audio Cue: Plays `paperweightDrop` cue.
- Rate Limiting: Max 8 flying coins simultaneously in DOM. Excess coins are dropped cleanly while data remains exact.

### 2. Level-Up Celebration (~900ms)
- Data changes immediately before visual sequence starts.
- Plate lifts: `translateY(-4px)` with brass specular flash (`brass-sheen` keyframes).
- Old level numeral crossfades to new numeral.
- Stamp-in impact: Numeral settles down with `stamp-in` impact (380ms).
- Audio Cue: Plays `paperweightDrop` cue.
- Status Announcement: Announces new level and title in Thai to screen readers.

### 3. XP Decrease / Deletions / App Launch
- XP drop: Instant, silent update. No flying coins, no celebration.
- Initial load: Silent initialization, zero animation.

### 4. Reduced Motion
- When `prefers-reduced-motion` is active:
  - Zero flying coins.
  - Pouch does not bounce.
  - Numeral updates with `reducedMotionCrossfade` (120ms).
  - All status updates and audio cues fire normally.

---

## 7. Testing Strategy

1. `tests/adventurer-model.test.mjs`:
   - `xpSummary`: 0, 499, 500, 999, 1000, 5000, -100, NaN, non-numeric strings, rank overflow (level >= 8).
   - `coinCount`: 0, negative, NaN, 1, 25, 50, 51, 100, 350, 400, 500, 1000 (clamped at 8).
2. `tests/adventurer-plate.test.mjs`:
   - Element creation, mounting into desk frame, front/back flip interaction, aria-label formatting.
   - Coin flight DOM lifecycle and cleanup under normal, rapid stamping, and cancelled scenarios.
   - Reduced-motion mode fallback.
   - State serialization non-interference (ensuring no extra fields leaked into `serializeState`).
3. Verification:
   - `npm run check` (all `.mjs` in dist verified).
   - `node --test tests/motion-governance.test.mjs`.
   - `npm test` (full suite pass).
