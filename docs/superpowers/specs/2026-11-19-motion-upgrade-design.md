# The Questboard — สเปกการยกระดับระบบอนิเมชัน (เฟส 2 และเฟส 3)

**วันที่:** 19 พฤศจิกายน 2026  
**สถานะ:** ดำเนินการต่อจากเฟส 1 (Baseline: tokens, governance test, waapi consolidation)  
**ขอบเขต:** อนิเมชันบนโต๊ะกิลด์ (ทิศทางแสงเดียว, ฟิสิกส์การหยิบปล่อย, หยุดบรรยากาศตอนลาก, playbackRate เร่งความเร็ว, และ reduced-motion crossfade)

---

## 1. วัตถุประสงค์
ยกระดับความรู้สึก "โต๊ะที่หยิบจับได้จริง" ตามหลักการ 8 ข้อใน `.agent/rules/motion-and-interaction.md`:
1. แสงเงาทั่วทั้งโต๊ะมีทิศทางเดียวตามช่วงเวลาของวัน (`morning`, `day`, `evening`, `night`)
2. วัตถุมีจังหวะ Anticipation → Action → Settle และแรงเฉื่อยการเอียง (Release Inertia) โดยไม่หลุดจากมือ
3. ระหว่างลากวัตถุ ระบบจะพักแอนิเมชันบรรยากาศเพื่อคืนทรัพยากร GPU/CPU ให้การลากลื่น 60 FPS
4. เมื่อสั่งงานแทรกขณะเปิด/ปิดแฟ้มหรือสมุด จะเร่ง `playbackRate` ให้จบเร็วแทนการตัดฉับ
5. โหมด `prefers-reduced-motion` ใช้ crossfade สั้น 120ms แทนการกระโดดฉับพลัน

---

## 2. การออกแบบเชิงเทคนิค (Technical Design)

### 2.1 ทิศทางแสงเดียว (`--light-x`, `--light-y`)
- กำหนดเวกเตอร์แสงตามช่วงเวลาใน `atmosphere.mjs`:
  - `morning`: `--light-x: 1.2`, `--light-y: 1.1` (แสงเฉียงจากซ้ายบน เงาทอดยาวไปขวาล่าง)
  - `day`: `--light-x: 0`, `--light-y: 1.2` (แสงดวงอาทิตย์ตรงกลาง เงาทิ้งดิ่งลงล่าง)
  - `evening`: `--light-x: -1.2`, `--light-y: 1.1` (แสงสีทองจากขวา เงาทอดไปซ้ายล่าง)
  - `night`: `--light-x: 0`, `--light-y: 0.8` (แสงตะเกียงอุ่นนุ่ม นุ่มนวลและไม่ทอดยาว)
  - `off`: `--light-x: 0.4`, `--light-y: 1.0` (ค่าตั้งต้น)
- ผูกตัวแปร CSS `--light-x`, `--light-y`, `--lift` เข้ากับคอนเทนเนอร์โต๊ะ (`.board-scroll`, `.desk-board`) และ `:root`
- วัตถุบนโต๊ะ (กระดาษเควส, แฟ้ม, สมุดบันทึก, ที่ทับกระดาษ, ghost ตอนลาก) คำนวณเงาผ่าน `calc(var(--light-x) * ... * var(--lift))`

### 2.2 แรงเฉื่อยและการลงสู่โต๊ะ (Inertia & Anticipation-Action-Settle)
- สร้างฟังก์ชันบริสุทธิ์ `settleTiltKeyframes(rotation, velocityTilt, options)` ใน `dist/desk-motion.mjs`
  - ไม่แตะ `left/top` เด็ดขาด ขยับเฉพาะ `rotate()` และ `scale()`
  - Anticipation (0% - 18%): ย่อ/กดลงเล็กน้อยเพื่อเตรียมรับแรงโน้มถ่วง
  - Action / Impact (18% - 55%): แตะผิวโต๊ะ พร้อม overshoot เล็กน้อยตรงข้ามกับทิศทางการลาก
  - Settle Rebound (55% - 80%): ดีดกลับเบา ๆ แบบ damped oscillation
  - Rest (80% - 100%): เข้าสู่ตำแหน่งพักคงที่
- นำมาใช้ใน `settlePaper(id, tilt)` ใน `app.mjs` และปรับจังหวะการลงของที่ทับกระดาษใน `paperweight.mjs`

### 2.3 หยุดบรรยากาศระหว่างลากของ (Suspend Atmosphere)
- เพิ่มเมธอด `setSuspended(Boolean)` ใน `createDeskAtmosphere` (`atmosphere.mjs`)
- เมื่อเริ่มลากวัตถุใด ๆ (`pointerdown` / drag start) เรียก `setSuspended(true)`
- ตั้งค่า `data-atmosphere-paused="true"` เพื่อให้ CSS สั่ง `animation-play-state: paused !important` กับฝุ่น เมฆ และแสงรอบโต๊ะ
- เมื่อวางหรือยกเลิกการลาก เรียก `setSuspended(false)`

### 2.4 เร่งแทนการยกเลิก (`playbackRate`)
- เพิ่ม helper `fastForwardAnimations(element, rate = 4)` ใน `dist/desk-motion.mjs`
- ตรวจจับ `.is-unfolding` หากผู้ใช้คลิกซ้ำหรือปิดขณะกาง ให้เร่ง `animation.playbackRate = 4` เพื่อให้จบใน ~100-200ms

### 2.5 Reduced-Motion Crossfade
- ในโหมด reduced-motion เพิ่มทางเลือก crossfade นุ่มนวล 120ms (`MOTION_DURATION.reducedFade`) ด้วย `animateTransient`
- ดูแล cleanup ให้หมดจด ไม่ทิ้ง ghost หรือ timer ค้าง
