---
description: ขั้นตอนเพิ่มฟีเจอร์ใหม่ให้ Questboard ตามธรรมเนียมของโปรเจกต์
---

1. อ่าน `.agent/rules/questboard.md`, ส่วนที่เกี่ยวข้องใน README และ `docs/ideas-backlog.md`
2. สรุปแผนสั้น ๆ ให้ผู้ใช้ก่อนลงมือ: ฟีเจอร์แตะข้อมูลส่วนไหน กระทบไฟล์สำรอง/ตัวตรวจสอบใน `dist/model.mjs` หรือไม่
3. งานใหญ่: เขียนสเปก `docs/superpowers/specs/<วันที่>-<ชื่อ>-design.md` และแผน `docs/superpowers/plans/<วันที่>-<ชื่อ>.md` (Goal, Architecture, Tech Stack, Global Constraints, Review Focus)
4. แยกตรรกะล้วนเป็น `*-model.mjs` และส่วนต่อ DOM/อนิเมชันเป็นโมดูลแยก แล้วค่อยเชื่อมใน `dist/app.mjs` อย่ายัดทุกอย่างใส่ `app.mjs`
5. ถ้าเพิ่มฟิลด์ข้อมูล: normalize ค่าที่ขาดเป็นค่าเริ่มต้น ไม่เพิ่ม `version` และเขียนเทสต์นำเข้าไฟล์เก่า
6. ถ้าฟีเจอร์เกี่ยวกับการหยิบ/ลาก/วาง/เก็บ/เปิดของ ให้ตอบสเปกอนิเมชัน 9 ข้อใน `.agent/rules/motion-and-interaction.md` หัวข้อ 4 ก่อนเขียนโค้ด และใส่คีย์บอร์ด Esc, reduced-motion และ cleanup ตั้งแต่แรก
7. เขียนเทสต์ใน `tests/` (ข้อมูลสมมติ) เพิ่มไฟล์ `.mjs` ใหม่ลง `check` ใน `package.json` แล้วรัน workflow `verify`
8. อัปเดต README (มุมผู้ใช้ + Ctrl+F5 ถ้าจำเป็น) และ `docs/ideas-backlog.md`
