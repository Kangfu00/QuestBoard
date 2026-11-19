import { xpSummary, coinCount } from './adventurer-model.mjs';
import { animateTransient, cancelMotion, reducedMotionCrossfade } from './desk-motion.mjs';
import { MOTION_DURATION, MOTION_EASING } from './motion-tokens.mjs';

/**
 * Creates and mounts the Adventurer Plate & XP Coin Pouch on the desk frame.
 * @param {object} options
 * @param {HTMLElement} [options.deskSurface] - Desk surface container (#desk-surface).
 * @param {Document} [options.document] - DOM document.
 * @param {Window} [options.window] - DOM window.
 * @param {Function} [options.reducedMotion] - Predicate returning true when reduced motion is preferred.
 * @param {Function} [options.onCue] - Sound playback callback (e.g. onCue(name)).
 * @param {Function} [options.icon] - Icon rendering function icon(name).
 * @param {number} [options.maxConcurrentCoins] - Maximum simultaneous flying coins.
 */
export function createAdventurerPlate({
  deskSurface = globalThis.document?.getElementById('desk-surface'),
  document = globalThis.document,
  window = globalThis.window,
  reducedMotion = () => false,
  onCue = () => {},
  icon = () => '',
  maxConcurrentCoins = 8,
} = {}) {
  if (!deskSurface || !document) {
    return {
      element: null,
      update() {},
      flip() {},
      flyCoins() {},
      celebrateLevelUp() {},
      cancelAll() {},
      destroy() {},
    };
  }

  const isReduced = () => {
    try {
      return typeof reducedMotion === 'function' ? reducedMotion() : Boolean(reducedMotion);
    } catch {
      return false;
    }
  };

  // Build DOM Structure
  const fixture = document.createElement('div');
  fixture.className = 'adventurer-fixture';
  fixture.id = 'adventurer-fixture';

  fixture.innerHTML = `
    <div class="adventurer-straps" aria-hidden="true">
      <div class="adventurer-strap"><span class="adventurer-stud"></span></div>
      <div class="adventurer-strap"><span class="adventurer-stud"></span></div>
    </div>
    <div class="adventurer-rig">
      <button type="button" class="adventurer-plate" aria-label="สถานะนักผจญภัย" title="คลิกเพื่อพลิกดูรายละเอียด">
        <div class="adventurer-plate-inner">
          <div class="adventurer-plate-face front">
            <span class="adventurer-sheen" aria-hidden="true"></span>
            <div class="adventurer-plate-header">
              <span class="adventurer-emblem" aria-hidden="true"></span>
              <div class="adventurer-rank-info">
                <span class="adventurer-level-label">LV. <strong class="adventurer-level-num">1</strong></span>
                <span class="adventurer-title">ผู้สมัครกิลด์</span>
              </div>
            </div>
            <div class="adventurer-groove" aria-hidden="true">
              <div class="adventurer-groove-bar"></div>
            </div>
          </div>
          <div class="adventurer-plate-face back" aria-hidden="true">
            <div class="adventurer-back-row">
              <span class="adventurer-back-label">XP รวม</span>
              <strong class="adventurer-back-value adventurer-back-xp">0 XP</strong>
            </div>
            <div class="adventurer-back-row">
              <span class="adventurer-back-label">เควสสำเร็จ</span>
              <span class="adventurer-back-value adventurer-back-done">0</span>
            </div>
            <div class="adventurer-back-row sub">
              <span class="adventurer-back-label">สู่เลเวลถัดไป</span>
              <span class="adventurer-back-value adventurer-back-tonext">อีก 500 XP</span>
            </div>
          </div>
        </div>
      </button>
      <div class="adventurer-pouch" aria-label="ถุงเหรียญ XP" title="ถุงเหรียญ XP">
        <svg class="adventurer-pouch-svg" viewBox="0 0 44 48" aria-hidden="true">
          <defs>
            <radialGradient id="qb-pouch-leather" cx="45%" cy="50%" r="55%">
              <stop offset="0%" stop-color="#6a4c30" />
              <stop offset="45%" stop-color="#4d341e" />
              <stop offset="85%" stop-color="#352112" />
              <stop offset="100%" stop-color="#22140a" />
            </radialGradient>
            <linearGradient id="qb-pouch-cord" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#805b38" />
              <stop offset="50%" stop-color="#ba9663" />
              <stop offset="100%" stop-color="#5a3d22" />
            </linearGradient>
          </defs>
          <path d="M14 18 C14 18, 6 24, 6 34 C6 42, 14 46, 22 46 C30 46, 38 42, 38 34 C38 24, 30 18, 30 18 Z" fill="url(#qb-pouch-leather)" stroke="#22140a" stroke-width="1.2" />
          <path d="M11 34 C11 40, 16 43, 22 43 C28 43, 33 40, 33 34" fill="none" stroke="#8d6844" stroke-width="0.8" stroke-dasharray="1.5 1.5" />
          <path d="M13 18 C16 20, 28 20, 31 18 C33 13, 29 9, 22 9 C15 9, 11 13, 13 18 Z" fill="#3a2414" stroke="#22140a" stroke-width="1" />
          <path d="M12 18 C17 19, 27 19, 32 18" fill="none" stroke="url(#qb-pouch-cord)" stroke-width="1.8" />
          <circle cx="22" cy="19" r="2.5" fill="#cfb77f" stroke="#3d2714" stroke-width="0.7" />
          <path d="M22 21 L20 27 M23 21 L25 26" stroke="url(#qb-pouch-cord)" stroke-width="1.2" stroke-linecap="round" />
        </svg>
        <div class="adventurer-pouch-target" aria-hidden="true"></div>
      </div>
    </div>
    <span class="adventurer-status sr-only" role="status" aria-live="polite"></span>
  `;

  deskSurface.appendChild(fixture);

  // Cached DOM elements
  const plateBtn = fixture.querySelector('.adventurer-plate');
  const levelNumEl = fixture.querySelector('.adventurer-level-num');
  const titleEl = fixture.querySelector('.adventurer-title');
  const emblemEl = fixture.querySelector('.adventurer-emblem');
  const grooveBar = fixture.querySelector('.adventurer-groove-bar');
  const sheenEl = fixture.querySelector('.adventurer-sheen');
  const pouchEl = fixture.querySelector('.adventurer-pouch');
  const pouchTarget = fixture.querySelector('.adventurer-pouch-target');
  const backXp = fixture.querySelector('.adventurer-back-xp');
  const backDone = fixture.querySelector('.adventurer-done, .adventurer-back-done');
  const backToNext = fixture.querySelector('.adventurer-back-tonext');
  const statusEl = fixture.querySelector('.adventurer-status');

  // Internal state
  let currentSummary = xpSummary(0);
  let currentDoneCount = 0;
  let isFlipped = false;
  let pouchBounceTimer = null;
  const activeCoins = new Set();
  const pendingTimers = new Set();

  function updateAriaLabel() {
    if (!plateBtn) return;
    if (isFlipped) {
      plateBtn.setAttribute(
        'aria-label',
        `รายละเอียด: รวม ${currentSummary.totalXp.toLocaleString()} XP, สำเร็จ ${currentDoneCount} เควส, อีก ${currentSummary.toNext.toLocaleString()} XP สู่เลเวลถัดไป - คลิกเพื่อพลิกกลับ`,
      );
    } else {
      plateBtn.setAttribute(
        'aria-label',
        `LEVEL ${currentSummary.level}, ${currentSummary.totalXp.toLocaleString()} XP (${currentSummary.title}) - คลิกเพื่อดูรายละเอียด`,
      );
    }
  }

  function flip() {
    isFlipped = !isFlipped;
    plateBtn?.classList.toggle('is-flipped', isFlipped);
    updateAriaLabel();
  }

  plateBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    flip();
  });

  /**
   * Synchronizes adventurer state with current cumulative XP and counts.
   * Pure data updates; zero animation side-effects.
   */
  function update(rawXp, { doneCount = 0, emblem = 'shield', imageDataUrl = null } = {}) {
    currentSummary = xpSummary(rawXp);
    currentDoneCount = Math.max(0, Number(doneCount) || 0);

    if (levelNumEl) levelNumEl.textContent = String(currentSummary.level);
    if (titleEl) titleEl.textContent = currentSummary.title;

    if (emblemEl) {
      if (emblem === 'custom' && imageDataUrl) {
        emblemEl.innerHTML = `<img src="${imageDataUrl}" alt="">`;
      } else {
        emblemEl.innerHTML = icon(emblem === 'custom' ? 'shield' : (emblem || 'shield'));
      }
    }

    if (grooveBar) {
      const pct = Math.min(100, Math.max(0, (currentSummary.intoLevel / currentSummary.perLevel) * 100));
      grooveBar.style.width = `${pct}%`;
    }

    if (pouchEl) {
      const bulge = currentSummary.intoLevel / currentSummary.perLevel;
      pouchEl.style.transform = `scale(${1 + bulge * 0.12})`;
    }

    if (backXp) backXp.textContent = `${currentSummary.totalXp.toLocaleString()} XP`;
    if (backDone) backDone.textContent = `${currentDoneCount} เควส`;
    if (backToNext) backToNext.textContent = `อีก ${currentSummary.toNext.toLocaleString()} XP`;

    updateAriaLabel();
  }

  /**
   * Triggers physical coin flight animation on quest completion.
   * Staggers 1..8 coins from stamp origin to coin pouch.
   */
  function flyCoins({ origin = null, deltaXp = 0 } = {}) {
    const count = coinCount(deltaXp);
    if (count <= 0) return;

    if (isReduced()) {
      return;
    }

    // Determine target location (center of coin pouch)
    const targetRect = pouchTarget?.getBoundingClientRect?.() || pouchEl?.getBoundingClientRect?.();
    const destX = targetRect ? targetRect.left + targetRect.width / 2 : 180;
    const destY = targetRect ? targetRect.top + targetRect.height / 2 : (window?.innerHeight || 600) - 40;

    // Determine start location
    const startX = origin && Number.isFinite(origin.x) ? origin.x : (window?.innerWidth || 800) / 2;
    const startY = origin && Number.isFinite(origin.y) ? origin.y : (window?.innerHeight || 600) / 2;

    const availableSlots = Math.max(0, maxConcurrentCoins - activeCoins.size);
    const toSpawn = Math.min(count, availableSlots);

    for (let i = 0; i < toSpawn; i++) {
      const timerId = setTimeout(() => {
        pendingTimers.delete(timerId);
        spawnSingleCoin(startX, startY, destX, destY, i === toSpawn - 1);
      }, i * 50);
      pendingTimers.add(timerId);
    }
  }

  function spawnSingleCoin(x0, y0, x1, y1, isLast) {
    if (!document?.body) return;

    const coin = document.createElement('div');
    coin.className = 'flying-coin';
    document.body.appendChild(coin);
    activeCoins.add(coin);

    // Parabolic arc keyframes
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const arcHeight = Math.min(130, Math.max(50, dist * 0.22)) + (Math.random() - 0.5) * 20;

    const steps = 7;
    const keyframes = [];
    const spin = 360 + Math.random() * 180;

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      // Parabolic vertical offset: -4 * h * t * (1 - t)
      const currentX = x0 + dx * t - 7;
      const currentY = y0 + dy * t - 4 * arcHeight * t * (1 - t) - 7;
      const currentRot = spin * t;
      const currentScale = t > 0.85 ? Math.max(0.1, 1 - (t - 0.85) * 5) : 1;
      const currentOpacity = t > 0.88 ? Math.max(0, 1 - (t - 0.88) / 0.12) : 1;

      keyframes.push({
        transform: `translate(${currentX.toFixed(1)}px, ${currentY.toFixed(1)}px) rotate(${currentRot.toFixed(1)}deg) scale(${currentScale.toFixed(2)})`,
        opacity: currentOpacity,
      });
    }

    const duration = 440 + Math.floor(Math.random() * 80); // 440-520ms (within 420-560ms)

    animateTransient(
      coin,
      keyframes,
      {
        duration,
        easing: MOTION_EASING.slide,
        fill: 'forwards',
      },
      {
        remove: true,
        onFinish: () => {
          activeCoins.delete(coin);
          if (isLast && pouchEl) {
            triggerPouchBounce();
            onCue?.('paperweightDrop');
          }
        },
      },
    );
  }

  function triggerPouchBounce() {
    if (!pouchEl || isReduced()) return;
    pouchEl.classList.remove('is-bouncing');
    // Force reflow
    void pouchEl.offsetWidth;
    pouchEl.classList.add('is-bouncing');
    clearTimeout(pouchBounceTimer);
    pouchBounceTimer = setTimeout(() => {
      pouchEl.classList.remove('is-bouncing');
    }, 160);
  }

  /**
   * Celebrates reaching a new level rank.
   * Data is updated before calling this function.
   */
  function celebrateLevelUp(newLevel) {
    if (statusEl) {
      statusEl.textContent = `ขึ้นสู่ LEVEL ${newLevel} (${currentSummary.title})!`;
    }

    if (isReduced()) {
      if (levelNumEl) {
        reducedMotionCrossfade(levelNumEl, { duration: MOTION_DURATION.reducedFade });
      }
      return;
    }

    // Plate lift and settle (~900ms)
    if (plateBtn) {
      animateTransient(
        plateBtn,
        [
          { transform: 'translateY(0) scale(1)' },
          { transform: 'translateY(-6px) scale(1.03)', offset: 0.22 },
          { transform: 'translateY(-6px) scale(1.03)', offset: 0.48 },
          { transform: 'translateY(1.5px) scale(0.985)', offset: 0.76 },
          { transform: 'translateY(0) scale(1)' },
        ],
        {
          duration: 900,
          easing: MOTION_EASING.slide,
        },
      );
    }

    // Golden specular sheen sweep
    if (sheenEl) {
      animateTransient(
        sheenEl,
        [
          { opacity: 0, transform: 'translateX(-100%)' },
          { opacity: 0.85, offset: 0.35 },
          { opacity: 0.85, offset: 0.65 },
          { opacity: 0, transform: 'translateX(130%)' },
        ],
        {
          duration: 800,
          easing: 'ease-in-out',
        },
      );
    }

    // Level numeral stamp-in impact (380ms)
    if (levelNumEl) {
      animateTransient(
        levelNumEl,
        [
          { transform: 'scale(1.9) translateY(-4px)', opacity: 0 },
          { transform: 'scale(0.95) translateY(1px)', opacity: 1, offset: 0.72 },
          { transform: 'scale(1) translateY(0)', opacity: 1 },
        ],
        {
          duration: MOTION_DURATION.stampIn,
          easing: 'cubic-bezier(.16,1,.3,1)',
        },
        {
          onStart: () => {
            onCue?.('paperweightDrop');
          },
        },
      );
    }
  }

  /**
   * Cancels all pending timers, flying coins, and active WAAPI animations.
   */
  function cancelAll() {
    for (const timerId of pendingTimers) {
      clearTimeout(timerId);
    }
    pendingTimers.clear();

    clearTimeout(pouchBounceTimer);
    pouchEl?.classList.remove('is-bouncing');

    for (const coin of activeCoins) {
      cancelMotion(coin);
      try {
        coin.remove();
      } catch {}
    }
    activeCoins.clear();

    if (plateBtn) cancelMotion(plateBtn);
    if (sheenEl) cancelMotion(sheenEl);
    if (levelNumEl) cancelMotion(levelNumEl);
  }

  function destroy() {
    cancelAll();
    try {
      fixture.remove();
    } catch {}
  }

  return {
    get element() {
      return fixture;
    },
    update,
    flip,
    flyCoins,
    celebrateLevelUp,
    cancelAll,
    destroy,
  };
}
