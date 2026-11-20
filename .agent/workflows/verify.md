---
description: ตรวจสอบ Questboard ก่อนส่งงาน (เทสต์ + ตรวจ syntax + บันทึกผล)
---

1. รันจากรากรีโปด้วย Node.js 20 ขึ้นไป ใช้ `node --test tests/<ชื่อ>.test.mjs` เพื่อตรวจจุดที่แก้ก่อน
2. ตรวจโค้ดด้วยคำสั่งที่ใช้ได้ใน PowerShell หรือ shell อื่นเมื่อแตะ runtime
   ```powershell
   node --version
   npm run check
   npm test
   git diff --check
   ```
   `npm test` รันชุดรวมแบบ serial และ `tests/motion-governance.test.mjs` ตรวจว่า `package.json` มี syntax check ครบทุกโมดูลใน `dist/` สำหรับงานเอกสารให้ตรวจ diff และลิงก์ที่เปลี่ยน
3. สำหรับงาน UI ใช้ [ขั้นตอนตรวจ UI](ui-review.md) และเบราว์เซอร์ที่ได้รับอนุญาต ใช้ข้อมูลสมมติและโปรไฟล์แยก ถ้าต้องเปิดแอปจริงเพื่อทดสอบ ให้เปิด instance ชั่วคราวด้วย `startQuestboardServer({ port: 0, backupDir })` โดยส่งไดเรกทอรีสำรองชั่วคราวอย่างชัดเจน
4. ถ้าเทสต์เบราว์เซอร์ข้ามเพราะหา Chromium ไม่เจอ ให้เลือก executable ตามตัวแปรของชุดทดสอบ
   - รูป: `PHOTO_TEST_BROWSER`
   - แสง: `ATMOSPHERE_TEST_BROWSER` (เก็บภาพด้วย `ATMOSPHERE_TEST_SCREENSHOTS`)
   - เสียงตามเวลา: `DAYPART_TEST_BROWSER`
   - เงื่อนไขเควส: `PREREQUISITE_TEST_BROWSER` (เก็บภาพด้วย `PREREQUISITE_TEST_SCREENSHOTS`)

5. เมื่อล้ม ให้ระบุเทสต์และตรวจว่าทำซ้ำได้หรือมีอยู่ก่อนการแก้ อย่าลดเงื่อนไขหรือแก้งานค้างของคนอื่นเพื่อให้ชุดรวมผ่าน
6. สรุปผลจากการรันครั้งล่าสุด บอกจำนวนผ่าน/ล้ม/ข้ามตามจริง แยกการจำลอง DOM จากการลากหรือดูภาพในเบราว์เซอร์จริง และบันทึกหลักฐานที่ใช้ตรวจต่อได้ใน `docs/verification.md` เมื่อเหมาะกับขอบเขตงาน
