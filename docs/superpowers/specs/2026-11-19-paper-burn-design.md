# The Questboard — สเปกการออกแบบระบบรอยไหม้ใบเควสตามกำหนดเวลา (Paper Burn & Urgency)

**วันที่:** 19 พฤศจิกายน 2026  
**สถานะ:** ดำเนินการตามข้อกำหนดผู้ใช้ (User Specification)  
**ขอบเขต:** ระบบรอยไหม้คำนวณจากวันกำหนดเสร็จ (`due`) ร่วมกับสถานะ (`status`) และเวลาท้องถิ่น (`today`), มาร์กอัปแบบไม่รบกวน, CSS รอยไหม้และถ่านคุ, การอัปเดตตามเวลา (Midnight Timer / Visibility), อนิเมชันไฟมอดและฟื้นกลับ, และการทดสอบ

---

## 1. หลักการและข้อตกลง (Principles & Contracts)
1. **คำนวณจากข้อมูล ไม่เก็บสถานะค้าง (Pure & Ephemeral):** ใช้เพียง `due`, `status` และ `today` (เวลาท้องถิ่น) ไม่มีฟิลด์ burnState ในโมเดลข้อมูลหรือไฟล์สำรอง
2. **ไม่แตะพื้นที่คลิกและไม่บังตัวอักษร (Accessible & Usable):** ไหม้เฉพาะบริเวณขอบกระดาษ (`pointer-events: none; inset: 0;`) กลางกระดาษโปร่งใส 100% ตัวอักษรและปุ่มคลิกใช้งานได้ปกติ ข้อความ "เลยกำหนด" ยังคงอยู่
3. **เปลี่ยนข้อมูลก่อน แล้วค่อยเล่นอนิเมชัน (Model-First):** เมื่อประทับตรา สถานะเปลี่ยนเป็น `done`/`failed`/`paused` ทันที รอยไหม้บนมาร์กอัปใหม่ถูกลบออก และเล่นเลเยอร์ไฟมอดจำลองผ่าน `createPaperEffects`
4. **สีอิงจานสีเดิมของกิลด์ (Guild Palette):** น้ำตาลอุ่น โทนเข้ม `#7a4a22` → `#5a351a` → `#3a2414` → `#1b110b` โดยไม่ใช้ดำล้วน เส้นถ่านแดง `#d9772f` ปรากฏเฉพาะระดับ 3 (วันนี้) เล็กน้อย
5. **Zero External Dependencies:** ใช้เฉพาะ JavaScript Vanilla (`.mjs`), SVG data URI, และ CSS บริสุทธิ์

---

## 2. ระดับรอยไหม้ (Burn Stages)

ฟังก์ชันบริสุทธิ์ `burnStage(due, today, status)` ใน `dist/burn-model.mjs`:
- คำนวณความต่างของวันด้วยเวลาเที่ยงวัน UTC (`Date.UTC(y, m - 1, d, 12, 0, 0)`) เพื่อหลีกเลี่ยงความคลาดเคลื่อนจาก DST

| ความต่างของวัน (`diffDays = due - today`) | ระดับ (`burnStage`) | ความหมาย | ลักษณะภาพ |
|---|---|---|---|
| ไม่ `active` หรือไม่มี `due` หรือ `diffDays > 3` | **0** | สดใหม่ / ปกติ | ไม่มีรอยไหม้ |
| `diffDays` เท่ากับ 2 หรือ 3 วัน | **1** | ใกล้กำหนด (3–2 วัน) | ขอบเหลืองอมน้ำตาลอ่อนไล่เข้ามาบาง ๆ |
| `diffDays` เท่ากับ 1 วัน | **2** | พรุ่งนี้ | ขอบเกรียมลึกขึ้น สีน้ำตาลไหม้ |
| `diffDays` เท่ากับ 0 วัน | **3** | กำหนดวันนี้ | ขอบดำเกรียม มีเส้นถ่านแดง `#d9772f` และไฟคุเบา ๆ |
| `diffDays < 0` | **4** | เลยกำหนด (Overdue) | ขอบดำกรอบเกรียม ไหม้เว้าลึกรอบใบ |

---

## 3. มาร์กอัปและการจัดวาง (Markup & Placement)

ใน `renderQuest(q, index)` (`dist/app.mjs`):
- หาก `burnStage >= 1`:
  - บนแท็ก `<article class="quest-paper ...">` กำหนด `data-burn="${burnStage}"` และ `data-burn-variant="${burnVariant(q.id)}"`
  - วางเลเยอร์ `<span class="paper-burn" aria-hidden="true"></span>` ต่อท้าย `<span class="paper-wear" aria-hidden="true"></span>` ทันที
- มาสก์ขอบขาดไม่เรียบ (Approach B: มาสก์สำเร็จรูป):
  - สร้าง 4 แบบตามแฮชของ `id` ด้วยฟังก์ชัน `burnVariant(id)` เพื่อให้ใบเดิมได้รอยไหม้ลายเดิมทุกครั้ง
  - แต่ละแบบสร้างด้วย SVG Data URI ที่มีเส้นขอบหยักแบบสุ่มกำหนด seed อย่างคงที่
  - ผูกผ่านตัวแปร CSS `--burn-mask`

---

## 4. สไตล์และอนิเมชัน (`paper-burn.css`)

- **Layering:**
  - `box-shadow: inset ...` ซ้อนหลายระดับตามความลึกของรอยไหม้
  - `mask-image: var(--burn-mask)` ตัดขอบไม่เรียบอย่างเป็นธรรมชาติ
- **ถ่านกะพริบ (ระดับ 3):**
  - `@keyframes burn-ember`: เปลี่ยน opacity ช้า ๆ แบบ pulse
  - หยุดเมื่อกำลังลาก (`.quest-paper.dragging .paper-burn::after { animation-play-state: paused; }`)
  - ปิดเมื่อ `prefers-reduced-motion: reduce`
- **ไฟมอดเมื่อประทับตรา (Extinguish Flourish):**
  - เมธอด `paperEffects.extinguish(paper, { stage, variant })`
  - ใช้ `animateTransient(ghost, [{ opacity: 1, filter: 'brightness(1.2)' }, { opacity: 0, filter: 'brightness(0.7)' }], { duration: 360, easing: 'cubic-bezier(.22,.8,.24,1)' }, { remove: true })`
  - ถูกยกเลิกได้หมดจดด้วย `cancelAll()` หรือ `cancelEntry()`
- **ฟื้นรอยไหม้เมื่อเลิกทำตรา (Rekindle):**
  - เล่น fade-in คืนสภาพ ~400ms เมื่อกลับมาเป็น active
- **Forced Colors Mode:**
  - `@media (forced-colors: active) { .paper-burn { display: none !important; } }`

---

## 5. การอัปเดตตามเวลา (Midnight & Tab Return)

- ตั้ง `setTimeout` 1 ตัวถึงเที่ยงคืนท้องถิ่นถัดไป (`msUntilNextMidnight()`)
- ดักจับ `visibilitychange`: เมื่อผู้ใช้สลับแท็บกลับมา เรียกอัปเดต `data-burn` ทันที
- อัปเดตเฉพาะ attribute `data-burn` และสลับ `<span class="paper-burn">` ของใบที่เปลี่ยนแปลงโดยตรง ไม่ต้อง render โต๊ะใหม่ทั้งหมด
