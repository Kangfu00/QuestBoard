---
description: ตรวจสอบ Questboard ก่อนส่งงาน (เทสต์ + ตรวจ syntax + บันทึกผล)
---

1. ตรวจว่าใช้ Node.js 20 ขึ้นไป
   ```sh
   node --version
   ```

2. ตรวจว่าไฟล์ `.mjs` ใหม่ทุกไฟล์ใน `dist/` ถูกเพิ่มในสคริปต์ `check` ของ `package.json` แล้ว
   ```sh
   for f in dist/*.mjs; do grep -q "node --check $f" package.json || echo "ยังไม่อยู่ใน check: $f"; done
   ```

3. รันเทสต์ทั้งหมด (เรียงทีละชุดโดยตั้งใจ ห้ามรันขนาน เทสต์บางชุดต้องเปิดเซิร์ฟเวอร์ loopback ชั่วคราว)
   ```sh
   npm test
   ```

4. รันการตรวจ syntax
   ```sh
   npm run check
   ```

5. ถ้าเทสต์ที่ใช้เบราว์เซอร์ถูกข้ามเพราะหา Chromium ไม่เจอ ให้กำหนดตัวแปรตามชุดทดสอบ
   - รูป: `PHOTO_TEST_BROWSER`
   - แสง: `ATMOSPHERE_TEST_BROWSER` (เก็บภาพด้วย `ATMOSPHERE_TEST_SCREENSHOTS`)
   - เสียงตามเวลา: `DAYPART_TEST_BROWSER`
   - เงื่อนไขเควส: `PREREQUISITE_TEST_BROWSER` (เก็บภาพด้วย `PREREQUISITE_TEST_SCREENSHOTS`)

6. สรุปผลให้ผู้ใช้ตามจริง: จำนวนที่ผ่าน/ล้ม ชุดที่ถูกข้ามและสาเหตุ และระบุว่าอะไร **ยังไม่ได้ตรวจด้วยตาในเบราว์เซอร์จริง** (ความลื่นของอนิเมชัน การลากด้วยเมาส์จริง) แล้วเพิ่มหัวข้อลงบนสุดของ `docs/verification.md`
