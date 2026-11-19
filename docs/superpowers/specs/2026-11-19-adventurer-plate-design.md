# Adventurer Card & Blue Mana Light Specification

**Date:** 2026-11-19  
**Feature:** บัตรนักผจญภัยแบบลากได้ + เอฟเฟกต์มานาแสงสีฟ้า (Draggable Adventurer Card & Blue Mana Light Particle Effect)  
**Status:** Implemented & Verified

---

## 1. Goal & Product Vision

In accordance with The Questboard's core fantasy-registrar ethos—where physical desk artifacts replace abstract web dashboards—we have created:
1. **บัตรนักผจญภัย (Draggable Adventurer Card):** An antique engraved brass & pewter ID card sized to standard ID-1 card proportions (85.6 : 54 ratio, 160×101px, 8px border radius). It sits on the `#desk-surface` frame outside `#board-scroll` (does not zoom or pan). It features a magnetic dock slot at the bottom-left corner (`left: 18px; bottom: 18px;`) and can be picked up, dragged freely across the desk frame, and snapped back into the dock when dropped within 65px. The card tilts up to ±6° with dynamic specular sheen as it moves. Clicking or pressing Enter flips the card in 3D (520ms) to display back-side career statistics.
2. **มานาแสงสีฟ้า (Blue Mana Light Particle Flight):** Replacing physical gold coins with magical guild mana. When a quest is stamped "Done", pure blue mana particles (`--mana-core: #bfe6ff; --mana-mid: #7fc4ff; --mana-deep: #3d7fd0;`) emerge from the stamp impact and fly in an accelerating parabolic trajectory into the card's circular seal chip, where they are absorbed with a glowing pulse and shockwave on level-up.

---

## 2. Global Constraints & Project Invariants

- **Optional Position Persistence:** Only `adventurerCard: { x, y, docked }` is stored in state. When omitted, it safely normalizes to default `{ x: 18, y: 18, docked: true }`. Zero version bumps; legacy backup import test verifies zero key leakage.
- **Strictly Derived Progression:** Total XP and Level are strictly calculated on-the-fly from completed quests (`questItems(true).filter(q => q.status === 'done').reduce((a, q) => a + q.xp, 0)`). XP or Level is never stored as a field in database or backup files.
- **Clean Elimination of Dead Code:** Coin pouch, flying coins, and pouch bounce animations are completely eliminated from code, CSS, and tests.
- **Bounded Blue Mana Exception:** Blue mana colors (`--mana-core: #bfe6ff; --mana-mid: #7fc4ff; --mana-deep: #3d7fd0;`) are strictly bounded to the Adventurer Card and mana particles; forbidden across other UI components.
- **Motion Governance Compliance:** All WAAPI `.animate()` calls route exclusively through `animateTransient` / `cancelMotion` from `dist/desk-motion.mjs`, respect `prefers-reduced-motion`, and avoid DOM leaks.

---

## 3. Pure Model (`dist/adventurer-model.mjs`)

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
   - `intoLevel = xp % XP_PER_LEVEL` (0..499).
   - `toNext = XP_PER_LEVEL - intoLevel`.
   - `title = ADVENTURER_TITLES[level] || ADVENTURER_TITLES[8] || 'ตำนานแห่งกิลด์'`.
   - Returns `{ level, intoLevel, perLevel: XP_PER_LEVEL, toNext, title, totalXp: xp }`.

2. `manaCount(rawDeltaXp)`:
   - Sanitizes input: `delta = Number(rawDeltaXp)`.
   - If `!Number.isFinite(delta) || delta <= 0`, returns `0`.
   - Clamped to: `Math.min(12, Math.max(3, Math.ceil(delta / 60)))` (3..12 luminous particles).

---

## 4. Visual & Interaction Architecture (`dist/adventurer-card.mjs` & `dist/adventurer-card.css`)

### Card Dimensions & Anatomy
- **Dimensions:** 160px × 101px (ratio 85.6 : 54), corner radius 8px (~8%).
- **Seal Chip:** 32px × 32px circular brass/pewter seal positioned at smart-card chip coordinates (`left: 12px; top: 22px;`).
- **Typography:** `Cinzel` for Level numeral, `Noto Serif Thai` for Title, board name header (`boardName`).
- **Mana Tube:** Engraved horizontal groove containing flowing blue mana light (`.adventurer-mana-bar`).
- **Magnetic Dock Slot:** `.adventurer-dock-slot` positioned at `left: 18px; bottom: 18px;`. Drops within 65px radius snap automatically to docked state with `paperweightDrop` cue.

### 3D Flip & Drag Dynamics
- Flip transition: 520ms `preserve-3d` rotation triggered by click or Enter/Space.
- Perspective drag tilt: up to ±6° on X and Y axes with dynamic specular sheen sweep.
- Keyboard navigation: Arrow keys move 10px, Shift+Arrow moves 50px, Esc cancels drag, Enter/Space flips.
- In-flight particle interruption: If the card is picked up or dragged while mana particles are in-flight, particles cancel immediately and absorb at the card's new position.
- Concurrent particle ceiling: Maximum 24 concurrent particles in rapid quest stamping.
- Reduced motion fallback: Flying particles suppressed; seal pulses via crossfade (120ms).
