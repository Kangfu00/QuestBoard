# Guild Quest Reception Counter Specification (เคาน์เตอร์ส่งงานกิลด์)

**Date:** 2026-11-19  
**Feature:** ถาดทองเหลืองส่งงานกิลด์ + กระดิ่งเคาน์เตอร์ (Guild Turn-in Tray & Receptionist Service Bell)  
**Status:** In Progress / Plan  

---

## 1. Goal & Product Vision

In The Questboard, completing a quest is not merely checking an abstract checkbox—it is a tangible moment of triumph within an authentic fantasy guildhall. To elevate the feeling of finishing work into an enjoyable ceremony, we introduce the **Guild Quest Reception Counter (เคาน์เตอร์ส่งงานกิลด์)** stationed at the left rim of the desk:

1. **ถาดทองเหลืองส่งงานกิลด์ (Brass Guild Turn-in Tray):**
   - An ornate engraved brass tray lined with dark woodland green/golden velvet, sized proportionately to receive quest papers.
   - Sits on the left desk rim (`.desk-surface` / `#board-scroll` under the atmosphere layer), creating a balanced spatial composition opposite the right-side drawers and top tool rail.
   - Functions as an interactive dropzone: dragging an active quest over the tray activates a warm golden ambient highlight. Releasing the quest gently snaps it flat into the tray (`paperDrop` cue), where it rests peacefully awaiting submission.
   - **Freedom to withdraw:** At any time before ringing the bell, the player can drag the quest out of the tray back onto the desk without any loss of data or forced completion.

2. **กระดิ่งเคาน์เตอร์กิลด์ (Receptionist Service Bell 🛎️):**
   - A polished brass desk service bell mounted at the top corner of the tray, complete with a round brass plunger.
   - **Idle Delight:** Even when the tray is empty, the player can click or press Enter on the bell to ring it (*Ding!*). A guild receptionist speech bubble floats up with playful banter (e.g. *"ยังไม่มีเควสมาส่งเหรอ? สู้ ๆ นะ ออกเดินทางปลอดภัยล่ะ!"*).
   - **Submission Trigger:** When a quest rests in the tray, clicking the bell triggers the submission ceremony:
     1. Bell plunger depresses 1.5px and the bell body wobbles subtly (±2° micro-vibration, 200ms) with a resonant chime sound cue.
     2. A parchment speech bubble floats up from the receptionist with randomized warm congratulations (e.g. *"ยินดีต้อนรับกลับมา! ภารกิจสำเร็จลุล่วงด้วยดีนะจ๊ะ"*).
     3. A large **GUILD ACCEPTED** red/gold seal stamps down with impact (*ตึ้ง!*) onto the quest paper.
     4. A luminous fountain of blue mana particles bursts upward from the impact point and arcs gracefully downward toward the **Adventurer Card** at the bottom-left dock.
     5. The completed quest slides smoothly into the keepsakes drawer (`#quest-drawer` archive).

---

## 2. Global Constraints & Architecture Invariants

- **Zero New Dependencies & Zero Build Steps:** Pure vanilla ES module (`.mjs`) and CSS.
- **State Integrity:** Completed quests transition via `setItemStatus(state, questId, 'done')` and `setArchived(state, questId, true)`. No new required schema fields; zero backup format version bumps.
- **Motion Governance Compliance:** All animations route through `animateTransient` and `cancelMotion` from `dist/desk-motion.mjs`. Full `prefers-reduced-motion` support (crossfades and immediate state transitions without disorienting shakes or particle flights).
- **Audio Restraint:** Bell and stamp cues respect the existing sound toggle (`sound.getSettings().muted`) and master volume.
- **Responsive Geometry:** The tray scales harmoniously with `--desk-scale` and viewport resizing, docked gracefully along the left edge.

---

## 3. Pure Model (`dist/quest-reception-model.mjs`)

### Receptionist Dialogue Banks
```javascript
export const RECEPTIONIST_IDLE_QUOTES = Object.freeze([
  'ยังไม่มีเควสมาส่งเหรอ? สู้ ๆ นะ ออกเดินทางปลอดภัยล่ะ!',
  'แหม กดกระดิ่งเล่นซะแล้ว... ว่างล่ะสิ!',
  'ยินดีต้อนรับสู่กิลด์! วันนี้รับงานอะไรดีล่ะ?',
  'ถ้าเหนื่อยก็พักดื่มน้ำชาสักหน่อยก่อนนะ นักผจญภัย',
]);

export const RECEPTIONIST_TURNIN_QUOTES = Object.freeze([
  'ยินดีต้อนรับกลับมา! ภารกิจสำเร็จลุล่วงด้วยดีนะจ๊ะ',
  'ตรวจเอกสารเรียบร้อย... เจ้าทำได้ยอดเยี่ยมมาก นักผจญภัย!',
  'เหนื่อยหน่อยนะ! รับรางวัลและค่าตอบแทนไปได้เลย',
  'ภารกิจระดับนี้ จัดการได้สมกับเป็นเจ้าจริง ๆ!',
  'ขอบคุณสำหรับหยาดเหงื่อ กิลด์แห่งนี้ภูมิใจในตัวเจ้า',
]);
```

### Pure Helper Functions
1. `pickReceptionistQuote(isSubmission = false, seed = Math.random())`: Returns a quote from the appropriate quote bank.
2. `canReceiveQuest(item)`: Validates that an item is an unarchived quest eligible for submission.

---

## 4. Component Structure (`dist/quest-reception.mjs`)

### DOM Elements
```html
<div class="guild-reception" id="guild-reception" aria-label="เคาน์เตอร์ส่งงานกิลด์">
  <div class="reception-tray" data-reception-dropzone aria-label="ถาดทองเหลืองส่งงานกิลด์">
    <div class="reception-tray-inner">
      <div class="reception-tray-velvet">
        <span class="reception-tray-rune" aria-hidden="true"></span>
        <span class="reception-tray-label">GUILD SUBMISSION</span>
      </div>
      <div class="reception-slot" data-slot></div>
    </div>
  </div>
  <button type="button" class="reception-bell" id="reception-bell" aria-label="สั่นกระดิ่งเคาน์เตอร์เพื่อส่งงานหรือเรียกพนักงานกิลด์">
    <span class="bell-plunger"></span>
    <span class="bell-dome"></span>
    <span class="bell-base"></span>
    <span class="bell-glow" aria-hidden="true"></span>
  </button>
  <div class="reception-speech-bubble" id="reception-speech" aria-live="polite" hidden></div>
</div>
```

---

## 5. Interaction Flow Details

1. **Drag-Over:** When dragging an active quest over the tray bounding rect (`containsPoint`), `.guild-reception` toggles `.is-drop-target`.
2. **Drop into Tray:**
   - The dragged quest is placed into `.reception-slot`.
   - Card angle resets to 0°.
   - `.reception-bell` gains `.has-quest` pulse glow.
3. **Ring Bell:**
   - Plays bell sound recipe (`bell`).
   - Depresses plunger via CSS/WAAPI.
   - Pops speech bubble with floating fade animation (2500ms duration).
   - If a quest is in the tray:
     - Stamps big `GUILD ACCEPTED` seal on the paper.
     - Spawns blue mana particles directed at Adventurer Card.
     - Commits quest as `done` and archives it.
     - Slices the paper cleanly out to the right drawer.
   - If tray is empty:
     - Displays friendly idle receptionist quote.
4. **Keyboard Accessibility:**
   - Tab focuses the bell button.
   - Enter/Space rings the bell.
   - Tray has accessible label and status announcements.
