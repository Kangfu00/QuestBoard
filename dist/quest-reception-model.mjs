/**
 * The Questboard — Guild Quest Reception Counter Pure Model
 * Pure business logic for receptionist quotes and quest eligibility.
 */

export const RECEPTIONIST_IDLE_QUOTES = Object.freeze([
  'ยังไม่มีเควสมาส่งเหรอ? สู้ ๆ นะ ออกเดินทางปลอดภัยล่ะ!',
  'แหม กดกระดิ่งเล่นซะแล้ว... ว่างล่ะสิ!',
  'ยินดีต้อนรับสู่กิลด์! วันนี้รับงานอะไรดีล่ะ?',
  'ถ้าเหนื่อยก็พักดื่มน้ำชาสักหน่อยก่อนนะ นักผจญภัย',
  'เคาน์เตอร์กิลด์พร้อมให้บริการเสมอ มีอะไรให้ช่วยไหมจ๊ะ?',
  'กระดิ่งกังวานดีใช่ไหมล่ะ? เป็นทองเหลืองแท้ของกิลด์เชียวนะ!',
]);

export const RECEPTIONIST_TURNIN_QUOTES = Object.freeze([
  'ยินดีต้อนรับกลับมา! ภารกิจสำเร็จลุล่วงด้วยดีนะจ๊ะ',
  'ตรวจเอกสารเรียบร้อย... เจ้าทำได้ยอดเยี่ยมมาก นักผจญภัย!',
  'เหนื่อยหน่อยนะ! รับรางวัลและเกียรติยศไปได้เลย',
  'ภารกิจระดับนี้ จัดการได้สมกับเป็นเจ้าจริง ๆ!',
  'ขอบคุณสำหรับหยาดเหงื่อ กิลด์แห่งนี้ภูมิใจในตัวเจ้าเสมอ',
  'ผลงานยอดเยี่ยม! นี่คือค่าตอบแทนและบันทึกประวัติของเจ้า',
]);

/**
 * Selects a receptionist dialogue line based on context and an optional seed.
 * @param {boolean} isSubmission - True if a quest is being submitted; false for idle ring.
 * @param {number} [seed=Math.random()] - Deterministic selector value between 0 and 1.
 * @returns {string} The chosen receptionist quote.
 */
export function pickReceptionistQuote(isSubmission = false, seed = Math.random()) {
  const bank = isSubmission ? RECEPTIONIST_TURNIN_QUOTES : RECEPTIONIST_IDLE_QUOTES;
  const index = Math.floor(Math.abs(seed) * bank.length) % bank.length;
  return bank[index];
}

/**
 * Checks whether an item is eligible for quest reception turn-in.
 * An item is eligible if it exists, is of type 'quest', and is not archived.
 * @param {object|null|undefined} item - The board item to check.
 * @returns {boolean} True if eligible for submission.
 */
export function canReceiveQuest(item) {
  if (!item || typeof item !== 'object') return false;
  return item.type === 'quest' && !item.archived;
}
