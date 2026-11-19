/**
 * Urgency & Paper Burn Model for The Questboard.
 * Computes deterministic burn stages and SVG edge masks without persistent state.
 */

export const BURN_STAGES = Object.freeze({
  NONE: 0,
  UPCOMING: 1, // 3–2 days left
  TOMORROW: 2, // 1 day left
  TODAY: 3,    // Due today
  OVERDUE: 4,  // Past due
});

export const BURN_COLORS = Object.freeze({
  warmToast: '#7a4a22',
  mediumChar: '#5a351a',
  deepChar: '#3a2414',
  blackChar: '#1b110b',
  emberRed: '#d9772f',
});

/**
 * Calculates burn urgency stage (0–4) from due date, current local date, and status.
 *
 * @param {string|null|undefined} due - Due date string (YYYY-MM-DD)
 * @param {string|Date} [today] - Reference date (string YYYY-MM-DD or Date object)
 * @param {string} [status='active'] - Item status
 * @returns {number} Burn stage 0 to 4
 */
export function burnStage(due, today = new Date(), status) {
  const resolvedStatus = arguments.length >= 3 ? status : 'active';
  if (resolvedStatus !== 'active') return 0;
  if (!due || typeof due !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(due)) return 0;

  const todayStr = today instanceof Date
    ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    : typeof today === 'string' ? today : '';

  if (!todayStr || !/^\d{4}-\d{2}-\d{2}$/.test(todayStr)) return 0;

  const [y1, m1, d1] = due.split('-').map(Number);
  const [y2, m2, d2] = todayStr.split('-').map(Number);

  if (!Number.isFinite(y1) || !Number.isFinite(m1) || !Number.isFinite(d1) ||
      !Number.isFinite(y2) || !Number.isFinite(m2) || !Number.isFinite(d2)) return 0;

  // Use UTC midday to eliminate Daylight Saving Time and timezone skew
  const dueMidday = Date.UTC(y1, m1 - 1, d1, 12, 0, 0);
  const todayMidday = Date.UTC(y2, m2 - 1, d2, 12, 0, 0);
  const diffDays = Math.round((dueMidday - todayMidday) / 86400000);

  if (diffDays < 0) return 4;   // Overdue
  if (diffDays === 0) return 3;  // Due today
  if (diffDays === 1) return 2;  // Due tomorrow
  if (diffDays <= 3) return 1;  // 2–3 days left
  return 0;                     // > 3 days left
}

/**
 * Returns a stable variant index (0..3) from the quest ID hash.
 *
 * @param {string} id
 * @returns {number} 0, 1, 2, or 3
 */
export function burnVariant(id = '') {
  const str = String(id ?? '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 4;
}

/**
 * Milliseconds until next local midnight (+1 second buffer).
 *
 * @param {Date} [now=new Date()]
 * @returns {number}
 */
export function msUntilNextMidnight(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return Math.max(1000, next.getTime() - now.getTime());
}

/**
 * Simple deterministic pseudo-random generator (LCG) based on integer seed.
 */
function prng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generates an SVG mask with an organic, jagged charred rim around a card of width x height.
 * The outer border is opaque (black alpha), leaving the center transparent.
 *
 * @param {number} variant - 0, 1, 2, or 3
 * @param {number} [width=300]
 * @param {number} [height=420]
 * @returns {string} SVG string
 */
export function generateBurnMaskSvg(variant = 0, width = 300, height = 420) {
  const v = Math.abs(variant % 4);
  const rand = prng(1009 + v * 337);

  // Rim thickness variation (between 12px and 26px)
  const insetBase = 18;
  const stepsX = 12;
  const stepsY = 16;

  // Inner cutout points
  const points = [];

  // Top edge (left to right)
  for (let i = 0; i <= stepsX; i++) {
    const x = (i / stepsX) * (width - 2 * insetBase) + insetBase;
    const y = insetBase + (rand() - 0.5) * 10;
    points.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
  }
  // Right edge (top to bottom)
  for (let i = 1; i <= stepsY; i++) {
    const y = (i / stepsY) * (height - 2 * insetBase) + insetBase;
    const x = width - insetBase + (rand() - 0.5) * 10;
    points.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
  }
  // Bottom edge (right to left)
  for (let i = stepsX - 1; i >= 0; i--) {
    const x = (i / stepsX) * (width - 2 * insetBase) + insetBase;
    const y = height - insetBase + (rand() - 0.5) * 10;
    points.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
  }
  // Left edge (bottom to top)
  for (let i = stepsY - 1; i > 0; i--) {
    const y = (i / stepsY) * (height - 2 * insetBase) + insetBase;
    const x = insetBase + (rand() - 0.5) * 10;
    points.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
  }

  const innerPath = `M ${points[0][0]} ${points[0][1]} ` + points.slice(1).map(p => `L ${p[0]} ${p[1]}`).join(' ') + ' Z';
  // Outer rectangle + inner cutout using fill-rule evenodd
  const combinedPath = `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z ${innerPath}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><path fill="#000" fill-rule="evenodd" d="${combinedPath}"/></svg>`;
}

/**
 * Returns data:image/svg+xml Data URI for the specified variant mask.
 *
 * @param {number} variant
 * @returns {string}
 */
export function burnMaskDataUri(variant = 0) {
  const svg = generateBurnMaskSvg(variant);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const BURN_MASKS = Object.freeze([
  burnMaskDataUri(0),
  burnMaskDataUri(1),
  burnMaskDataUri(2),
  burnMaskDataUri(3),
]);
