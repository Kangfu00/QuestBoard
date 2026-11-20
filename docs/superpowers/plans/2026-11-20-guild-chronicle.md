# The Guild Chronicle (สมุดบันทึกประวัติศาสตร์การผจญภัย) — Implementation Plan

## Phase 1: โมเดลและตรรกะข้อมูล (Model & Data Logic)
- [ ] สร้าง `dist/guild-chronicle-model.mjs`:
  - `chronicleQuests(items, { search, category, rank })`
  - `chronicleStats(items)`
  - `reopenQuest(state, id)`
  - `markQuestTurnedIn(state, id, timestamp)`
- [ ] อัปเดต `dist/storage-tray.mjs`:
  - กรอง `!item.turnedIn` ใน `trayItems` เพื่อไม่ให้เควสที่ส่งแล้วไปโผล่ในลิ้นชักขวา

## Phase 2: โมดูลหน้าต่างสมุดประวัติศาสตร์ (Chronicle Component & Styles)
- [ ] สร้าง `dist/guild-chronicle.css`:
  - เลย์เอาต์สมุดคู่ 2 หน้า (`.guild-chronicle-window`, `.chronicle-spread`, `.chronicle-left`, `.chronicle-right`)
  - หนังขอบทองเหลือง, พื้นกระดาษพาร์ชเมนต์, แถบสารบัญเรียงรายชื่อ
  - ช่องจัดแสดงใบเควสจริง A4 พร้อมตราทอง GUILD ACCEPTED
  - อนิเมชั่นเปิดกาง (`is-unfolding`), สลับเควส, และ reduced-motion
- [ ] สร้าง `dist/guild-chronicle.mjs`:
  - `createGuildChronicle({ document, window, windows, getState, commit, renderQuest, icon, onCue, reducedMotion })`
  - เมธอด: `open({ questId })`, `close()`, `toggle()`, `isOpen`

## Phase 3: การเชื่อมโยงกับระบบบอร์ด (Integration)
- [ ] เพิ่ม `<link rel="stylesheet" href="guild-chronicle.css">` ใน `dist/index.html`
- [ ] เชื่อมโยงใน `dist/app.mjs`:
  - เริ่มต้นอินสแตนซ์ `guildChronicle`
  - อัปเดต `onTurnIn` ใน `questReception` ให้บันทึก `turnedIn: true` และ `turnedInAt`
  - เพิ่มปุ่มเปิดสมุดประวัติศาสตร์ใน:
    - ส่วนหัวเคาน์เตอร์ส่งมอบเควสฝั่งซ้าย (`reception-drawer`)
    - หลังบัตรนักผจญภัย (`adventurer-back-done`)
  - เชื่อมปุ่มกู้คืนเควส (`reopenQuest`) คืนสู่บอร์ด

## Phase 4: การทดสอบและการตรวจสอบ (Testing & Verification)
- [ ] เพิ่ม `dist/guild-chronicle-model.mjs` และ `dist/guild-chronicle.mjs` ลงในสคริปต์ `check` ใน `package.json`
- [ ] สร้างชุดทดสอบ `tests/guild-chronicle.test.mjs`
- [ ] รัน `npm run check`
- [ ] รัน `npm test`
- [ ] Commit & Push สรุปงานพร้อมลิงก์ไฟล์
