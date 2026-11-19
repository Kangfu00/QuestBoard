import { xpSummary, manaCount } from './adventurer-model.mjs';
import { animateTransient, cancelMotion, reducedMotionCrossfade } from './desk-motion.mjs';
import { MOTION_DURATION, MOTION_EASING } from './motion-tokens.mjs';
import { DEFAULT_ADVENTURER_CARD, ADVENTURER_CARD_SIZE } from './model.mjs';

/**
 * Creates and binds the Adventurer Card on the desk surface frame.
 * @param {object} options
 * @param {HTMLElement} [options.deskSurface] - Desk surface container (#desk-surface).
 * @param {Document} [options.document] - DOM document.
 * @param {Window} [options.window] - DOM window.
 * @param {Function} [options.getState] - State getter.
 * @param {Function} [options.onSavePosition] - Callback when card position is committed.
 * @param {Function} [options.onEdit] - Callback to open the card edit dialog.
 * @param {Function} [options.reducedMotion] - Predicate returning true when reduced motion is preferred.
 * @param {Function} [options.onCue] - Sound playback callback (e.g. onCue(name)).
 * @param {Function} [options.icon] - Icon rendering function icon(name).
 * @param {Function} [options.boardName] - Board name getter.
 * @param {number} [options.maxConcurrentParticles] - Maximum simultaneous flying mana particles.
 */
export function createAdventurerCard({
  deskSurface = globalThis.document?.getElementById('desk-surface'),
  document = globalThis.document,
  window = globalThis.window,
  getState = () => ({}),
  onSavePosition = () => {},
  onEdit = () => {},
  reducedMotion = () => false,
  onCue = () => {},
  icon = () => '',
  boardName = () => 'THE QUESTBOARD',
  maxConcurrentParticles = 24,
} = {}) {
  if (!deskSurface || !document) {
    return {
      element: null,
      update() {},
      flip() {},
      flyMana() {},
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

  // Card element (button)
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'adventurer-card';
  card.id = 'adventurer-card';
  card.setAttribute('aria-label', 'บัตรประจำตัวนักผจญภัย');
  card.setAttribute('title', 'คลิกเพื่อพลิกดูสถิติ · ลากเพื่อย้าย');

  card.innerHTML = `
    <div class="adventurer-card-inner">
      <div class="adventurer-card-face front">
        <span class="adventurer-card-rune-border" aria-hidden="true"></span>
        <span class="adventurer-corner tl" aria-hidden="true"></span>
        <span class="adventurer-corner tr" aria-hidden="true"></span>
        <span class="adventurer-corner bl" aria-hidden="true"></span>
        <span class="adventurer-corner br" aria-hidden="true"></span>
        <span class="adventurer-card-sheen" aria-hidden="true"></span>
        <span class="mana-shockwave" aria-hidden="true"></span>
        <header class="adventurer-card-topbar">
          <span class="adventurer-card-board">THE QUESTBOARD</span>
          <button type="button" class="adventurer-edit-icon-btn" aria-label="แก้ไขชื่อและรูปประจำตัว" title="แก้ไขข้อมูลบัตร">
            ${icon('pen') || '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>'}
          </button>
        </header>
        <div class="adventurer-card-body-clean">
          <div class="adventurer-portrait-frame" title="คลิกเพื่อเปลี่ยนรูปประจำตัว">
            <div class="adventurer-card-seal" aria-hidden="true"></div>
          </div>
          <div class="adventurer-card-details-clean">
            <div class="adventurer-level-crest">
              <div class="adventurer-level-crest-row">
                <span class="adventurer-level-tag">LV.</span>
                <strong class="adventurer-card-level-num">1</strong>
              </div>
              <span class="adventurer-card-title">ผู้สมัครกิลด์</span>
            </div>
            <div class="adventurer-mana-tube-wrap">
              <div class="adventurer-mana-header">
                <span class="mana-lbl">LEVEL PROGRESS</span>
                <span class="adventurer-mana-text">0 / 500 XP (0%)</span>
              </div>
              <div class="adventurer-mana-tube" aria-hidden="true">
                <div class="adventurer-mana-bar"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="adventurer-card-face back" aria-hidden="true">
        <span class="adventurer-card-rune-border" aria-hidden="true"></span>
        <span class="adventurer-corner tl" aria-hidden="true"></span>
        <span class="adventurer-corner tr" aria-hidden="true"></span>
        <span class="adventurer-corner bl" aria-hidden="true"></span>
        <span class="adventurer-corner br" aria-hidden="true"></span>
        <span class="adventurer-card-sheen" aria-hidden="true"></span>
        <header class="adventurer-card-topbar">
          <span class="adventurer-card-board-back">THE QUESTBOARD GUILD</span>
          <span class="adventurer-stamp-text">CAREER DOSSIER</span>
        </header>
        <div class="adventurer-back-grid">
          <div class="adventurer-card-row">
            <span class="adventurer-card-label">ฉายานักผจญภัย</span>
            <strong class="adventurer-card-value adventurer-back-title">ผู้สมัครกิลด์</strong>
          </div>
          <div class="adventurer-card-row">
            <span class="adventurer-card-label">ระดับเลเวล</span>
            <strong class="adventurer-card-value adventurer-back-level">LEVEL 1</strong>
          </div>
          <div class="adventurer-card-row">
            <span class="adventurer-card-label">XP สะสมทั้งหมด</span>
            <strong class="adventurer-card-value adventurer-back-xp">0 XP</strong>
          </div>
          <div class="adventurer-card-row">
            <span class="adventurer-card-label">ภารกิจที่สำเร็จ</span>
            <span class="adventurer-card-value adventurer-back-done">0 เควส</span>
          </div>
          <div class="adventurer-card-row sub">
            <span class="adventurer-card-label">สู่เลเวลถัดไป</span>
            <span class="adventurer-card-value adventurer-back-tonext">อีก 500 XP</span>
          </div>
        </div>
        <footer class="adventurer-back-footer">
          <button type="button" class="adventurer-back-edit-btn">
            ${icon('pen') || '✎'} แก้ไขชื่อและรูป
          </button>
          <span class="adventurer-flip-hint">คลิกหรือกด Enter เพื่อพลิกกลับ</span>
        </footer>
      </div>
    </div>
    <span class="adventurer-card-status sr-only" role="status" aria-live="polite"></span>
  `;

  deskSurface.appendChild(card);

  // Cached DOM elements
  const cardInner = card.querySelector('.adventurer-card-inner');
  const boardEl = card.querySelector('.adventurer-card-board');
  const boardBackEl = card.querySelector('.adventurer-card-board-back');
  const sealEl = card.querySelector('.adventurer-card-seal');
  const portraitFrame = card.querySelector('.adventurer-portrait-frame');
  const levelNumEl = card.querySelector('.adventurer-card-level-num');
  const titleEl = card.querySelector('.adventurer-card-title');
  const manaBar = card.querySelector('.adventurer-mana-bar');
  const manaText = card.querySelector('.adventurer-mana-text');
  const sheenEl = card.querySelector('.adventurer-card-sheen');
  const shockwaveEl = card.querySelector('.mana-shockwave');
  const backTitle = card.querySelector('.adventurer-back-title');
  const backLevel = card.querySelector('.adventurer-back-level');
  const backXp = card.querySelector('.adventurer-back-xp');
  const backDone = card.querySelector('.adventurer-back-done');
  const backToNext = card.querySelector('.adventurer-back-tonext');
  const statusEl = card.querySelector('.adventurer-card-status');
  const editIconBtn = card.querySelector('.adventurer-edit-icon-btn');
  const backEditBtn = card.querySelector('.adventurer-back-edit-btn');

  // Internal state
  let currentSummary = xpSummary(0);
  let currentDoneCount = 0;
  let isFlipped = false;
  let absorbTimer = null;
  const activeParticles = new Set();
  const pendingTimers = new Set();

  // Position state (persisted)
  const savedCard = getState()?.adventurerCard ?? DEFAULT_ADVENTURER_CARD;
  let currentX = Number.isFinite(savedCard.x) ? savedCard.x : DEFAULT_ADVENTURER_CARD.x;
  let currentY = Number.isFinite(savedCard.y) ? savedCard.y : null;
  let useBottom = currentY === null || savedCard.docked === true || (currentX === 18 && currentY === 18);

  function applyPosition() {
    if (useBottom) {
      card.style.left = `${currentX}px`;
      card.style.bottom = '18px';
      card.style.top = 'auto';
    } else {
      card.style.left = `${currentX}px`;
      card.style.top = `${currentY}px`;
      card.style.bottom = 'auto';
    }
  }

  applyPosition();

  function updateAriaLabel() {
    if (isFlipped) {
      card.setAttribute(
        'aria-label',
        `รายละเอียดบัตร: รวม ${currentSummary.totalXp.toLocaleString()} XP, สำเร็จ ${currentDoneCount} เควส, อีก ${currentSummary.toNext.toLocaleString()} XP สู่เลเวลถัดไป - กด Enter หรือคลิกเพื่อพลิกกลับ`,
      );
    } else {
      card.setAttribute(
        'aria-label',
        `LEVEL ${currentSummary.level}, ${currentSummary.totalXp.toLocaleString()} XP (${currentSummary.title}), ลากเพื่อย้าย - กด Enter หรือคลิกเพื่อดูรายละเอียด`,
      );
    }
  }

  function flip() {
    isFlipped = !isFlipped;
    if (cardInner) {
      cardInner.style.transform = '';
    }
    card.classList.toggle('is-flipped', isFlipped);
    updateAriaLabel();
  }

  // Wire up edit button triggers
  const triggerEdit = e => {
    e.stopPropagation();
    e.preventDefault();
    onEdit?.();
  };
  editIconBtn?.addEventListener('click', triggerEdit);
  backEditBtn?.addEventListener('click', triggerEdit);
  portraitFrame?.addEventListener('click', triggerEdit);

  /**
   * Synchronizes adventurer state with current cumulative XP, card name and avatar.
   * Pure data updates; zero animation side-effects.
   */
  function update(rawXp, { doneCount = 0, emblem = 'shield', imageDataUrl = null, name = '', boardName: bName = '' } = {}) {
    currentSummary = xpSummary(rawXp);
    currentDoneCount = Math.max(0, Number(doneCount) || 0);

    const displayName = String(name || bName || boardName() || 'THE QUESTBOARD').trim() || 'THE QUESTBOARD';
    if (boardEl) boardEl.textContent = displayName;
    if (boardBackEl) boardBackEl.textContent = `${displayName} GUILD`;

    if (levelNumEl) levelNumEl.textContent = String(currentSummary.level);
    if (titleEl) titleEl.textContent = currentSummary.title;
    if (backTitle) backTitle.textContent = currentSummary.title;
    if (backLevel) backLevel.textContent = `LEVEL ${currentSummary.level}`;

    if (sealEl) {
      if (emblem === 'custom' && imageDataUrl) {
        sealEl.innerHTML = `<img src="${imageDataUrl}" alt="รูปนักผจญภัย" class="adventurer-portrait-img">`;
      } else {
        sealEl.innerHTML = `<div class="adventurer-seal-emblem">${icon(emblem === 'custom' ? 'shield' : (emblem || 'shield'))}</div>`;
      }
    }

    const pct = Math.min(100, Math.max(0, (currentSummary.intoLevel / currentSummary.perLevel) * 100));
    if (manaBar) {
      manaBar.style.width = `${pct}%`;
    }

    if (manaText) {
      manaText.textContent = `${currentSummary.intoLevel.toLocaleString()} / ${currentSummary.perLevel.toLocaleString()} XP (${Math.round(pct)}%)`;
    }

    if (backXp) backXp.textContent = `${currentSummary.totalXp.toLocaleString()} XP`;
    if (backDone) backDone.textContent = `${currentDoneCount} เควส`;
    if (backToNext) backToNext.textContent = `อีก ${currentSummary.toNext.toLocaleString()} XP`;

    updateAriaLabel();
  }

  // Dragging & Interaction State
  let dragActive = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialCardX = 0;
  let initialCardY = 0;
  let prevPointerX = 0;
  let prevPointerY = 0;
  let pointerMoveDist = 0;
  let tiltX = 0;
  let tiltY = 0;

  function getSealCenter() {
    const rect = sealEl?.getBoundingClientRect?.();
    if (rect && rect.width > 0) {
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    const cardRect = card.getBoundingClientRect();
    return { x: cardRect.left + 50, y: cardRect.top + 76 };
  }

  function startDrag(clientX, clientY) {
    if (dragActive) return;
    dragActive = true;
    pointerMoveDist = 0;
    dragStartX = clientX;
    dragStartY = clientY;
    prevPointerX = clientX;
    prevPointerY = clientY;
    tiltX = 0;
    tiltY = 0;

    // Interrupt any flying mana particles immediately
    if (activeParticles.size > 0) {
      cancelManaParticles();
      triggerManaAbsorb();
    }

    const cardRect = card.getBoundingClientRect();
    const surfaceRect = deskSurface.getBoundingClientRect();

    initialCardX = cardRect.left - surfaceRect.left;
    initialCardY = cardRect.top - surfaceRect.top;
    currentX = initialCardX;
    currentY = initialCardY;
    useBottom = false;

    // Switch card to top/left pixels during drag
    card.style.left = `${currentX}px`;
    card.style.top = `${currentY}px`;
    card.style.bottom = 'auto';

    card.classList.add('is-dragging');
    card.style.setProperty('--lift', '1.08');
  }

  function moveDrag(clientX, clientY) {
    if (!dragActive) return;
    const dx = clientX - dragStartX;
    const dy = clientY - dragStartY;
    pointerMoveDist += Math.hypot(clientX - prevPointerX, clientY - prevPointerY);

    const surfaceRect = deskSurface.getBoundingClientRect();
    const maxX = Math.max(10, surfaceRect.width - ADVENTURER_CARD_SIZE.width - 12);
    const maxY = Math.max(10, surfaceRect.height - ADVENTURER_CARD_SIZE.height - 12);

    currentX = Math.min(maxX, Math.max(10, initialCardX + dx));
    currentY = Math.min(maxY, Math.max(10, initialCardY + dy));

    card.style.left = `${currentX}px`;
    card.style.top = `${currentY}px`;

    // Perspective tilt up to ±6 degrees
    const vx = clientX - prevPointerX;
    const vy = clientY - prevPointerY;
    prevPointerX = clientX;
    prevPointerY = clientY;

    tiltX = Math.min(6, Math.max(-6, -vy * 0.45));
    tiltY = Math.min(6, Math.max(-6, vx * 0.45));
    if (cardInner) {
      cardInner.style.setProperty('--tilt-x', `${tiltX}deg`);
      cardInner.style.setProperty('--tilt-y', `${tiltY}deg`);
      cardInner.style.transform = isFlipped
        ? `rotateY(180deg) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`
        : `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
    }

    if (sheenEl) {
      sheenEl.style.setProperty('--sheen-angle', `${105 + tiltY * 4}deg`);
      sheenEl.style.setProperty('--sheen-opacity', `${0.25 + Math.abs(tiltX + tiltY) * 0.05}`);
    }
  }

  function endDrag() {
    if (!dragActive) return;
    dragActive = false;
    card.classList.remove('is-dragging');
    card.style.setProperty('--lift', '1');

    if (cardInner) {
      if (!isReduced() && (Math.abs(tiltX) > 0.5 || Math.abs(tiltY) > 0.5)) {
        animateTransient(
          cardInner,
          [
            { transform: isFlipped ? `rotateY(180deg) rotateX(${tiltX}deg) rotateY(${tiltY}deg)` : `rotateX(${tiltX}deg) rotateY(${tiltY}deg)` },
            { transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' },
          ],
          { duration: 210, easing: 'cubic-bezier(.2,.8,.3,1)' },
          {
            onFinish: () => {
              if (cardInner) cardInner.style.transform = '';
            },
          },
        );
      } else {
        cardInner.style.transform = '';
      }
    }
    tiltX = 0;
    tiltY = 0;

    applyPosition();
    onCue?.('paperweightDrop');
    onSavePosition({ x: Math.round(currentX), y: Math.round(currentY) });
  }

  function cancelDrag() {
    if (!dragActive) return;
    dragActive = false;
    card.classList.remove('is-dragging');
    card.style.setProperty('--lift', '1');
    currentX = initialCardX;
    currentY = initialCardY;
    applyPosition();
    if (cardInner) cardInner.style.transform = '';
    tiltX = 0;
    tiltY = 0;
  }

  // Pointer event listeners
  card.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    // If clicking directly on edit buttons, let their click handler run
    if (e.target?.closest?.('.adventurer-edit-icon-btn, .adventurer-back-edit-btn, .adventurer-portrait-frame')) {
      return;
    }
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
    const onMove = ev => moveDrag(ev.clientX, ev.clientY);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      const wasClick = pointerMoveDist <= 4;
      if (wasClick) {
        cancelDrag();
        flip();
        return;
      }
      endDrag();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  });

  // Keyboard navigation
  card.addEventListener('keydown', e => {
    if (['Enter', ' '].includes(e.key)) {
      e.preventDefault();
      flip();
      return;
    }

    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      const step = e.shiftKey ? 50 : 10;
      const surfaceRect = deskSurface.getBoundingClientRect();
      const maxX = Math.max(10, surfaceRect.width - ADVENTURER_CARD_SIZE.width - 12);
      const maxY = Math.max(10, surfaceRect.height - ADVENTURER_CARD_SIZE.height - 12);

      if (useBottom) {
        useBottom = false;
        currentX = 18;
        currentY = surfaceRect.height - ADVENTURER_CARD_SIZE.height - 18;
      }

      if (e.key === 'ArrowLeft') currentX = Math.max(10, currentX - step);
      if (e.key === 'ArrowRight') currentX = Math.min(maxX, currentX + step);
      if (e.key === 'ArrowUp') currentY = Math.max(10, currentY - step);
      if (e.key === 'ArrowDown') currentY = Math.min(maxY, currentY + step);

      applyPosition();
      onCue?.('paperweightDrop');
      onSavePosition({ x: Math.round(currentX), y: Math.round(currentY) });
      return;
    }

    if (e.key === 'Escape') {
      if (dragActive) {
        e.preventDefault();
        cancelDrag();
      }
    }
  });

  /**
   * Triggers physical blue mana particle flight on quest completion.
   * Staggers 3..12 luminous particles from stamp contact to the card's seal.
   */
  function flyMana({ origin = null, deltaXp = 0 } = {}) {
    const count = manaCount(deltaXp);
    if (count <= 0) return;

    if (isReduced()) {
      triggerManaAbsorb();
      return;
    }

    const availableSlots = Math.max(0, maxConcurrentParticles - activeParticles.size);
    const toSpawn = Math.min(count, availableSlots);
    if (toSpawn <= 0) return;

    const startX = origin && Number.isFinite(origin.x) ? origin.x : (window?.innerWidth || 800) / 2;
    const startY = origin && Number.isFinite(origin.y) ? origin.y : (window?.innerHeight || 600) / 2;

    for (let i = 0; i < toSpawn; i++) {
      const timerId = setTimeout(() => {
        pendingTimers.delete(timerId);
        // If card was moved/dragged, reacquire current seal center
        const target = getSealCenter();
        spawnSingleParticle(startX, startY, target.x, target.y, i === toSpawn - 1);
      }, i * 45);
      pendingTimers.add(timerId);
    }
  }

  function spawnSingleParticle(x0, y0, x1, y1, isLast) {
    if (!document?.body) return;

    const particle = document.createElement('div');
    particle.className = 'mana-particle';
    document.body.appendChild(particle);
    activeParticles.add(particle);

    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);

    // Initial antigravity mana lift (-35px to -70px)
    const lift = Math.min(90, Math.max(35, dist * 0.18)) + (Math.random() - 0.5) * 20;

    const steps = 7;
    const keyframes = [];

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      // Inward curved flight with accelerating velocity
      const progress = t * t;
      const currentX = x0 + dx * progress - 5;
      const currentY = y0 + dy * progress - 4 * lift * t * (1 - t) - 5;
      const stretch = t > 0.2 && t < 0.85 ? 1.6 : 1.0;
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const opacity = t > 0.88 ? Math.max(0, 1 - (t - 0.88) / 0.12) : Math.min(1, t * 4);

      keyframes.push({
        transform: `translate(${currentX.toFixed(1)}px, ${currentY.toFixed(1)}px) rotate(${angle.toFixed(1)}deg) scaleX(${stretch})`,
        opacity,
      });
    }

    const duration = 520 + Math.floor(Math.random() * 80);

    animateTransient(
      particle,
      keyframes,
      {
        duration,
        easing: 'cubic-bezier(.22, .8, .24, 1)',
        fill: 'forwards',
      },
      {
        remove: true,
        onFinish: () => {
          activeParticles.delete(particle);
          triggerManaAbsorb();
          if (isLast) {
            onCue?.('paperweightDrop');
          }
        },
      },
    );
  }

  function triggerManaAbsorb() {
    if (!sealEl) return;
    if (isReduced()) {
      reducedMotionCrossfade(sealEl, { duration: MOTION_DURATION.reducedFade });
      return;
    }

    sealEl.classList.remove('is-absorbing');
    card.classList.remove('is-mana-absorbing');
    // Force reflow
    void sealEl.offsetWidth;
    sealEl.classList.add('is-absorbing');
    card.classList.add('is-mana-absorbing');

    clearTimeout(absorbTimer);
    absorbTimer = setTimeout(() => {
      sealEl?.classList.remove('is-absorbing');
      card?.classList.remove('is-mana-absorbing');
    }, MOTION_DURATION.manaAbsorb);
  }

  function cancelManaParticles() {
    for (const timerId of pendingTimers) {
      clearTimeout(timerId);
    }
    pendingTimers.clear();

    for (const particle of activeParticles) {
      cancelMotion(particle);
      try {
        particle.remove();
      } catch {}
    }
    activeParticles.clear();
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

    // Mana shockwave ring expanding outward from the seal
    if (shockwaveEl) {
      animateTransient(
        shockwaveEl,
        [
          { transform: 'scale(1)', opacity: 0.9 },
          { transform: 'scale(5.5)', opacity: 0 },
        ],
        {
          duration: 750,
          easing: 'ease-out',
        },
      );
    }

    // Card metallic lift and settle (~900ms)
    animateTransient(
      card,
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

    // Specular golden sheen sweep across face
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

    // New level numeral etched into brass with stamp-in impact (380ms)
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
   * Cancels all pending timers, flying particles, and active WAAPI animations.
   */
  function cancelAll() {
    cancelManaParticles();
    clearTimeout(absorbTimer);
    sealEl?.classList.remove('is-absorbing');
    card?.classList.remove('is-mana-absorbing');

    cancelMotion(card);
    if (cardInner) {
      cancelMotion(cardInner);
      cardInner.style.transform = '';
    }
    if (sheenEl) cancelMotion(sheenEl);
    if (shockwaveEl) cancelMotion(shockwaveEl);
    if (levelNumEl) cancelMotion(levelNumEl);
  }

  function destroy() {
    cancelAll();
    try {
      card.remove();
    } catch {}
  }

  return {
    get element() {
      return card;
    },
    update,
    flip,
    flyMana,
    celebrateLevelUp,
    cancelAll,
    destroy,
  };
}
