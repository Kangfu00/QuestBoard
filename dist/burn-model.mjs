/**
 * Urgency & Paper Burn Model for The Questboard.
 * Computes deterministic burn stages and the SVG layers (scorch halo, char rim, ember front)
 * that paint them, without any persistent state.
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

/* ------------------------------------------------------------------ */
/*  Burn layers                                                        */
/*                                                                     */
/*  A burning edge is read as three things stacked along one ragged     */
/*  line: black char on the outside, a glowing ember front on the line  */
/*  itself, and a brown scorch that fades into the paper on the inside. */
/*  Every layer is drawn from the same seeded outline, so they agree.   */
/* ------------------------------------------------------------------ */

export const BURN_VARIANTS = 4;

const PAPER_W = 300;
const PAPER_H = 424;
const SAMPLE_STEP = 30;
const TAU = Math.PI * 2;

// Depth in px of each layer's edge for stage 0..4 (0 = layer not drawn).
const HALO_DEPTH = [0, 20, 28, 34, 38];
const CHAR_DEPTH = [0, 0, 0, 9, 22];
const HALO_ALPHA = [0, 0.42, 0.6, 0.74, 0.84];

const num = n => String(Math.round(n * 10) / 10);

/** Points around the paper edge, clockwise from the top-left corner, with inward normals. */
function perimeterSamples(width, height) {
  const cx = Math.max(2, Math.round(width / SAMPLE_STEP));
  const cy = Math.max(2, Math.round(height / SAMPLE_STEP));
  const out = [];
  const add = (x, y, nx, ny) => out.push({ x, y, nx, ny, s: 0 });
  const c = 0.75; // corners are pushed in a little less than diagonally so they bite, not gouge
  for (let i = 0; i < cx; i++) add(i * width / cx, 0, i ? 0 : c, i ? 1 : c);
  for (let i = 0; i < cy; i++) add(width, i * height / cy, i ? -1 : -c, i ? 0 : c);
  for (let i = 0; i < cx; i++) add(width - i * width / cx, height, i ? 0 : -c, i ? -1 : -c);
  for (let i = 0; i < cy; i++) add(0, height - i * height / cy, i ? 1 : c, i ? 0 : -c);
  let length = 0;
  for (let i = 0; i < out.length; i++) {
    out[i].s = length;
    const next = out[(i + 1) % out.length];
    length += Math.hypot(next.x - out[i].x, next.y - out[i].y);
  }
  return { samples: out, length, corners: [0, cx, cx + cy, 2 * cx + cy] };
}

/**
 * Seeded "how deep does the fire bite here" curve, as a multiplier around 1.
 * Slow waves give broad bays, a few gaussian bites (two of them at corners) give
 * the deep, uneven eating that real burns have, and a little jitter breaks the rest.
 */
function edgeProfile(variant, edge) {
  const { samples, length, corners } = edge;
  const rand = prng(7919 + (Math.abs(variant) % BURN_VARIANTS) * 104729);
  const waves = [[3, 0.2], [5, 0.13], [9, 0.07]].map(([f, a]) => ({ f, a, p: rand() * TAU }));
  const bites = [0, 1, 2].map(k => ({
    c: k < 2 ? samples[corners[Math.floor(rand() * 4)]].s + (rand() - 0.5) * 60 : rand() * length,
    w: 22 + rand() * 20,
    h: 0.8 + rand() * 0.8,
  }));
  const jitter = samples.map(() => (rand() - 0.5) * 0.14);
  return i => {
    const s = samples[i].s;
    let v = 0.75;
    for (const { f, a, p } of waves) v += a * Math.sin(TAU * f * s / length + p);
    for (const b of bites) {
      let d = Math.abs(s - b.c) % length;
      d = Math.min(d, length - d);
      v += b.h * Math.exp(-(d * d) / (2 * b.w * b.w));
    }
    return Math.max(0.25, v + jitter[i]);
  };
}

/** Outline points of the burn edge pushed `depth` px (average) into the paper. */
export function burnEdgePoints(variant = 0, depth = 10, width = PAPER_W, height = PAPER_H) {
  const edge = perimeterSamples(width, height);
  const shape = edgeProfile(variant, edge);
  return edge.samples.map((p, i) => {
    const d = Math.min(80, Math.max(1.2, depth * shape(i)));
    return [p.x + p.nx * d, p.y + p.ny * d];
  });
}

/** Closed Catmull-Rom spline through the points, as an SVG path. */
function smoothPath(points) {
  const n = points.length;
  let d = `M${num(points[0][0])} ${num(points[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n], p3 = points[(i + 2) % n];
    d += `C${num(p1[0] + (p2[0] - p0[0]) / 6)} ${num(p1[1] + (p2[1] - p0[1]) / 6)} `
      + `${num(p2[0] - (p3[0] - p1[0]) / 6)} ${num(p2[1] - (p3[1] - p1[1]) / 6)} `
      + `${num(p2[0])} ${num(p2[1])}`;
  }
  return `${d}Z`;
}

/** Everything between the burn edge and the paper's outer border (needs fill-rule evenodd). */
const zonePath = (points, width, height) =>
  `M-80 -80H${width + 80}V${height + 80}H-80Z${smoothPath(points)}`;

const blurFilter = (id, deviation) =>
  `<filter id='${id}' x='-30%' y='-30%' width='160%' height='160%'><feGaussianBlur stdDeviation='${num(deviation)}'/></filter>`;

/**
 * Roughens an edge with fractal noise so it frays instead of curving smoothly, then optionally
 * softens it. Layers that must meet on the same line use the same seed and `rough` amount.
 */
const frayFilter = (id, { rough, seed, blur = 0 }) =>
  `<filter id='${id}' x='-30%' y='-30%' width='160%' height='160%'>`
  + `<feTurbulence type='fractalNoise' baseFrequency='.045' numOctaves='3' seed='${seed}' result='n'/>`
  + `<feDisplacementMap in='SourceGraphic' in2='n' scale='${num(rough)}' xChannelSelector='R' yChannelSelector='G'${blur ? " result='d'" : ''}/>`
  + (blur ? `<feGaussianBlur in='d' stdDeviation='${num(blur)}'/>` : '')
  + `</filter>`;

const wrapSvg = (width, height, defs, body) =>
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}' preserveAspectRatio='none'>`
  + `${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`;

/**
 * One SVG layer of the burn.
 *   halo  — stages 1–4: yellow toasting, then brown scorch fading inward from the edge
 *   char  — stages 3–4: black crust hugging the ragged edge
 *   ember — stages 3–4: broken glowing line along that edge, brightest in a few spots
 */
export function generateBurnLayerSvg(layer, variant = 0, stage = 1, width = PAPER_W, height = PAPER_H) {
  const st = Math.max(0, Math.min(4, Math.trunc(stage)));
  const v = Math.abs(Math.trunc(variant)) % BURN_VARIANTS;
  const edge = (depth) => burnEdgePoints(v, depth, width, height);
  const seed = 11 + v * 5;

  if (layer === 'halo') {
    const depth = HALO_DEPTH[st];
    if (!depth) return '';
    return wrapSvg(width, height,
      frayFilter('t', { rough: 16, seed: seed + 1, blur: depth * 0.28 })
      + frayFilter('b', { rough: 11, seed, blur: depth * 0.15 }),
      `<path d='${zonePath(edge(depth * 1.9), width, height)}' fill='#c58f35' fill-opacity='${num(HALO_ALPHA[st] * 0.55)}' fill-rule='evenodd' filter='url(#t)'/>`
      + `<path d='${zonePath(edge(depth), width, height)}' fill='#5a3216' fill-opacity='${HALO_ALPHA[st]}' fill-rule='evenodd' filter='url(#b)'/>`);
  }

  const depth = CHAR_DEPTH[st];
  if (!depth) return '';
  const rough = 8;

  if (layer === 'char') {
    return wrapSvg(width, height,
      frayFilter('c', { rough, seed })
      + frayFilter('k', { rough: rough + 4, seed: seed + 2, blur: 1.6 }),
      `<path d='${zonePath(edge(depth * 1.8), width, height)}' fill='#3a2414' fill-opacity='.85' fill-rule='evenodd' filter='url(#k)'/>`
      + `<path d='${zonePath(edge(depth), width, height)}' fill='#1b110b' fill-rule='evenodd' filter='url(#c)'/>`);
  }

  if (layer === 'ember') {
    const ring = smoothPath(edge(depth));
    const rand = prng(15485863 + v * 7727 + st);
    // Mostly dull red coal with a few bright runs and a few white-hot specks, never an even outline.
    const bright = Array.from({ length: 10 }, (_, i) => num(i % 2 ? 40 + rand() * 90 : 9 + rand() * 26)).join(' ');
    const points = edge(depth);
    const specks = Array.from({ length: 5 }, () => points[Math.floor(rand() * points.length)])
      .map(([x, y]) => `<circle cx='${num(x)}' cy='${num(y)}' r='${num(2 + rand() * 2.2)}' fill='#ffd27a' fill-opacity='.9' filter='url(#h)'/>`)
      .join('');
    return wrapSvg(width, height,
      frayFilter('e', { rough, seed })
      + frayFilter('g', { rough, seed, blur: 3 })
      + blurFilter('h', 1.6),
      `<g filter='url(#g)'><path d='${ring}' fill='none' stroke='#d9531c' stroke-opacity='.4' stroke-width='7' stroke-dasharray='${bright}'/></g>`
      + `<g filter='url(#e)'>`
      + `<path d='${ring}' fill='none' stroke='#7a2a12' stroke-width='1.8' stroke-linejoin='round'/>`
      + `<path d='${ring}' fill='none' stroke='#e8742a' stroke-width='2.2' stroke-linejoin='round' stroke-dasharray='${bright}'/>`
      + `</g>${specks}`);
  }

  throw new RangeError(`Unknown burn layer: ${layer}`);
}

/** Compact data URI for an SVG string, safe inside a double-quoted CSS url(). */
export function svgDataUri(svg) {
  return 'data:image/svg+xml,' + svg
    .replace(/%/g, '%25').replace(/#/g, '%23')
    .replace(/</g, '%3C').replace(/>/g, '%3E')
    .replace(/"/g, "'");
}

/**
 * CSS that binds each (stage, variant) to its layer images. The images are generated at
 * runtime so no build step is needed; paper-burn.css owns everything that is not an image.
 */
export function burnLayerCss(width = PAPER_W, height = PAPER_H) {
  const rules = [];
  for (let stage = 1; stage <= 4; stage++) {
    for (let v = 0; v < BURN_VARIANTS; v++) {
      const at = `.quest-paper[data-burn="${stage}"][data-burn-variant="${v}"] .paper-burn,`
        + `.paper-burn[data-burn="${stage}"][data-burn-variant="${v}"]`;
      const image = layer => `url("${svgDataUri(generateBurnLayerSvg(layer, v, stage, width, height))}")`;
      rules.push(`:is(${at}){background-image:${image('halo')}}`);
      if (stage >= 3) {
        rules.push(`:is(${at})::before{background-image:${image('char')}}`);
        rules.push(`:is(${at})::after{background-image:${image('ember')}}`);
      }
    }
  }
  return rules.join('\n');
}

/** Adds the generated burn layer rules to the page once. Returns true when it added them. */
export function installBurnLayers(doc = globalThis.document) {
  if (!doc?.head || !doc.createElement) return false;
  if (doc.head.querySelector?.('style[data-burn-layers]')) return false;
  const style = doc.createElement('style');
  style.setAttribute('data-burn-layers', '');
  style.textContent = burnLayerCss();
  doc.head.append(style);
  return true;
}
