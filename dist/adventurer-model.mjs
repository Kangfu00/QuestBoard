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

/**
 * Pure function summarizing XP into adventurer progression metrics.
 * @param {unknown} rawXp - Cumulative XP earned.
 * @returns {{ level: number, intoLevel: number, perLevel: number, toNext: number, title: string, totalXp: number }}
 */
export function xpSummary(rawXp) {
  const numeric = Number(rawXp);
  const totalXp = Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const intoLevel = totalXp % XP_PER_LEVEL;
  const toNext = XP_PER_LEVEL - intoLevel;
  const title = ADVENTURER_TITLES[level] || ADVENTURER_TITLES[8] || 'ตำนานแห่งกิลด์';

  return {
    level,
    intoLevel,
    perLevel: XP_PER_LEVEL,
    toNext,
    title,
    totalXp,
  };
}

/**
 * Pure function mapping earned XP delta to physical coin count (0 or 1..8).
 * @param {unknown} rawDeltaXp - XP gained from stamping a quest.
 * @returns {number} Integer between 0 and 8.
 */
export function coinCount(rawDeltaXp) {
  const delta = Number(rawDeltaXp);
  if (!Number.isFinite(delta) || delta <= 0) return 0;
  return Math.min(8, Math.max(1, Math.ceil(delta / 50)));
}
