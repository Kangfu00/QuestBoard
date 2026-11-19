# Guild Quest Reception Counter Specification (ลิ้นชักเคาน์เตอร์ส่งงานกิลด์)

**Date:** 2026-11-19  
**Feature:** ลิ้นชักเคาน์เตอร์ส่งเควสด้านซ้าย + ถาดทองเหลืองขนาดใหญ่ + กระดิ่งบริการ (Guild Reception Drawer & Service Bell)  
**Status:** Implemented & Verified  

---

## 1. Goal & Product Vision

In The Questboard, completing a quest is not merely checking an abstract checkbox—it is a tangible moment of triumph within an authentic fantasy guildhall. To elevate the feeling of finishing work into an enjoyable ceremony without cluttering the desk canvas, we introduce the **Guild Quest Reception Drawer (ลิ้นชักเคาน์เตอร์ส่งเควสฝั่งซ้าย)**:

1. **ลิ้นชักเคาน์เตอร์ส่งเควสฝั่งซ้าย (Left Slide-out Reception Drawer):**
   - Hides neatly along the left edge of the screen (`position: fixed; left: 0; top: 18px; height: min(680px, calc(100dvh - 220px));`), keeping the desk surface clean and leaving the bottom-left area completely open for the Adventurer Card.
   - A stylish vertical drawer handle (`44px` wide) peeks out on the left rim with a brass shield icon, vertical Thai title `"ส่งมอบเควส"`, and notification badge.
   - Clicking the handle smoothly slides open/closed with tactile drawer audio (`drawerOpen` / `drawerClose`).
   - Dragging an active quest sheet towards the left edge (`e.clientX <= 75`) automatically slides open the drawer to receive the paper!

2. **ถาดทองเหลืองบุผ้ากำมะหยี่ขนาดใหญ่ (Spacious Velvet Turn-in Bed):**
   - Sized comfortably (`~328px` wide × `~430px` tall) to accommodate an entire standard A4 quest paper (`280px × 396px`) with rich parchment details (title, category badge, description, XP reward, and a withdraw button).
   - Dropping a quest into the tray immediately clears the drag ghost, plays `paperDrop`, and displays the quest resting inside the tray.
   - **Freedom to withdraw:** At any time before ringing the bell, clicking the withdraw button returns the quest paper back to the desk unharmed.

3. **กระดิ่งเคาน์เตอร์บริการกิลด์ (Counter Service Bell 🛎️):**
   - A seamless 3D brass service bell with plunger firmly seated on the dome, mounted in the top action bar next to the receptionist speech bubble.
   - **Idle Delight:** Clicking the bell when empty rings a cheerful chime (*Ding!*) and shows playful banter from the receptionist.
   - **Submission Ceremony & Golden Dissolving Animation:**
     1. Bell depresses with chime sound `bell`.
     2. Receptionist speech bubble pops up with warm congratulations.
     3. Giant **GUILD ACCEPTED** red wax stamp slams down onto the quest paper with impact audio (`receptionStamp`).
     4. Luminous blue mana particles burst from the stamp impact and arc down toward the Adventurer Card seal.
     5. The quest paper **dissolves cleanly into golden mana sparkles and fades away** (`is-dissolving`), disappearing completely into the guild archives without any stuck artifacts.
     6. State is committed (`status: 'done'`, `archived: true`), XP is added, and the drawer gently auto-closes.

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
