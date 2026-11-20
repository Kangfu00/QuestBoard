import { xpSummary, manaCount } from './adventurer-model.mjs';
import { animateTransient, cancelMotion, reducedMotionCrossfade, dragTilt } from './desk-motion.mjs';
import { MOTION_DURATION, MOTION_EASING } from './motion-tokens.mjs';
import { DEFAULT_ADVENTURER_CARD, ADVENTURER_CARD_SIZE } from './model.mjs';

/**
 * Creates and binds the Adventurer Card on the desk surface frame.
 * @param {object} options
 * @param {HTMLElement} [options.deskSurface] - Desk surface container (#board-scroll or #desk-surface).
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
  getScale = () => 1,
} = {}) {
  if (!deskSurface || !document) {
    return {
      element: null,
      update() {},
      flip() {},
      openViewer() {},
      closeViewer() {},
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

  const zoomIcon = icon('zoom-in') || '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
  const penIcon = icon('pen') || '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';

  // Card element (button)
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'adventurer-card';
  card.id = 'adventurer-card';
  card.setAttribute('aria-label', 'บัตรประจำตัวนักผจญภัย');
  card.setAttribute('title', 'คลิกเพื่อพลิก · ดับเบิลคลิกเพื่อขยายดู · ลากเพื่อย้าย');

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
          <div class="adventurer-topbar-actions">
            <button type="button" class="adventurer-inspect-icon-btn" aria-label="ขยายดูบัตร" title="ขยายดูบัตร">
              ${zoomIcon}
            </button>
            <button type="button" class="adventurer-edit-icon-btn" aria-label="แก้ไขชื่อและรูปประจำตัว" title="แก้ไขข้อมูลบัตร">
              ${penIcon}
            </button>
          </div>
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
          <div class="adventurer-topbar-actions">
            <button type="button" class="adventurer-inspect-icon-btn" aria-label="ขยายดูบัตร" title="ขยายดูบัตร">
              ${zoomIcon}
            </button>
            <button type="button" class="adventurer-edit-icon-btn" aria-label="แก้ไขชื่อและรูปประจำตัว" title="แก้ไขข้อมูลบัตร">
              ${penIcon}
            </button>
          </div>
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
          <button type="button" class="adventurer-back-inspect-btn">
            ${zoomIcon} ขยายดูบัตร
          </button>
          <button type="button" class="adventurer-back-edit-btn">
            ${penIcon} แก้ไขชื่อและรูป
          </button>
          <span class="adventurer-flip-hint">คลิกเพื่อพลิกกลับ</span>
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
  const editIconBtns = card.querySelectorAll('.adventurer-edit-icon-btn, .adventurer-back-edit-btn');

  // Internal state
  let currentSummary = xpSummary(0);
  let currentDoneCount = 0;
  let isFlipped = false;
  let absorbTimer = null;
  let latestProps = { doneCount: 0, emblem: 'shield', imageDataUrl: null, name: '' };
  const activeParticles = new Set();
  const pendingTimers = new Set();

  let currentCardScale = (typeof getScale === 'function' ? getScale() : 1) || 1;
  card.style.setProperty('--card-scale', String(currentCardScale));

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
      card.style.transformOrigin = 'bottom left';
    } else {
      card.style.left = `${currentX}px`;
      card.style.top = `${currentY}px`;
      card.style.bottom = 'auto';
      card.style.transformOrigin = 'top left';
    }
  }

  function reclampPosition() {
    if (useBottom) {
      applyPosition();
      return;
    }
    const surfaceRect = deskSurface.getBoundingClientRect();
    const scale = currentCardScale || 1;
    const cardWidth = Math.round(ADVENTURER_CARD_SIZE.width * scale);
    const cardHeight = Math.round(ADVENTURER_CARD_SIZE.height * scale);
    const maxX = Math.max(10, surfaceRect.width - cardWidth - 12);
    const maxY = Math.max(10, surfaceRect.height - cardHeight - 12);
    currentX = Math.min(maxX, Math.max(10, currentX));
    currentY = Math.min(maxY, Math.max(10, currentY));
    applyPosition();
  }

  function setScale(newScale) {
    if (typeof newScale === 'number' && Number.isFinite(newScale) && newScale > 0) {
      currentCardScale = newScale;
      card.style.setProperty('--card-scale', String(newScale));
      reclampPosition();
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
    onCue?.('cardDrop');
    updateAriaLabel();
  }

  // Wire up edit button triggers
  const triggerEdit = e => {
    e.stopPropagation();
    e.preventDefault();
    onEdit?.();
  };
  editIconBtns.forEach(btn => btn.addEventListener('click', triggerEdit));
  portraitFrame?.addEventListener('click', triggerEdit);

  // Wire inspect button triggers
  const inspectBtns = card.querySelectorAll('.adventurer-inspect-icon-btn, .adventurer-back-inspect-btn');
  inspectBtns.forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
    openViewer();
  }));

  card.addEventListener('dblclick', e => {
    e.stopPropagation();
    e.preventDefault();
    openViewer();
  });

  // =========================================================================
  // Enlarged Card Inspection Viewer Dialog
  // =========================================================================
  let viewerDialog = null;
  let isViewerFlipped = false;

  function renderViewerContent() {
    if (!viewerDialog) return;
    const customName = latestProps.name || '';
    const boardTitle = boardName();
    const displayName = customName ? customName.toUpperCase() : (boardTitle ? boardTitle.toUpperCase() : 'THE QUESTBOARD');
    const emblem = latestProps.emblem ?? 'shield';
    const imageDataUrl = latestProps.imageDataUrl ?? null;
    const pct = Math.min(100, Math.max(0, (currentSummary.intoLevel / currentSummary.perLevel) * 100));

    const portraitHtml = (emblem === 'custom' && imageDataUrl)
      ? `<img src="${imageDataUrl}" alt="รูปนักผจญภัย" class="adventurer-portrait-img">`
      : `<div class="adventurer-seal-emblem">${icon(emblem === 'custom' ? 'shield' : (emblem || 'shield'))}</div>`;

    viewerDialog.innerHTML = `
      <div class="adventurer-viewer-wrap">
        <button type="button" class="adventurer-viewer-close" aria-label="ปิดมุมมองขยาย">✕</button>
        <div class="adventurer-viewer-card ${isViewerFlipped ? 'is-flipped' : ''}" tabindex="0" role="button" aria-label="บัตรนักผจญภัย คลิกเพื่อพลิกด้าน">
          <div class="adventurer-card-inner">
            <div class="adventurer-card-face front">
              <span class="adventurer-card-rune-border" aria-hidden="true"></span>
              <span class="adventurer-corner tl" aria-hidden="true"></span>
              <span class="adventurer-corner tr" aria-hidden="true"></span>
              <span class="adventurer-corner bl" aria-hidden="true"></span>
              <span class="adventurer-corner br" aria-hidden="true"></span>
              <span class="adventurer-card-sheen" aria-hidden="true"></span>
              <header class="adventurer-card-topbar">
                <span class="adventurer-card-board">${displayName}</span>
              </header>
              <div class="adventurer-card-body-clean">
                <div class="adventurer-portrait-frame">
                  <div class="adventurer-card-seal">${portraitHtml}</div>
                </div>
                <div class="adventurer-card-details-clean">
                  <div class="adventurer-level-crest">
                    <div class="adventurer-level-crest-row">
                      <span class="adventurer-level-tag">LV.</span>
                      <strong class="adventurer-card-level-num">${currentSummary.level}</strong>
                    </div>
                    <span class="adventurer-card-title">${currentSummary.title}</span>
                  </div>
                  <div class="adventurer-mana-tube-wrap">
                    <div class="adventurer-mana-header">
                      <span class="mana-lbl">LEVEL PROGRESS</span>
                      <span class="adventurer-mana-text">${currentSummary.intoLevel.toLocaleString()} / ${currentSummary.perLevel.toLocaleString()} XP (${Math.round(pct)}%)</span>
                    </div>
                    <div class="adventurer-mana-tube" aria-hidden="true">
                      <div class="adventurer-mana-bar" style="width: ${pct}%"></div>
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
                <span class="adventurer-card-board-back">${displayName} GUILD</span>
              </header>
              <div class="adventurer-back-grid">
                <div class="adventurer-card-row">
                  <span class="adventurer-card-label">ฉายานักผจญภัย</span>
                  <strong class="adventurer-card-value adventurer-back-title">${currentSummary.title}</strong>
                </div>
                <div class="adventurer-card-row">
                  <span class="adventurer-card-label">ระดับเลเวล</span>
                  <strong class="adventurer-card-value adventurer-back-level">LEVEL ${currentSummary.level}</strong>
                </div>
                <div class="adventurer-card-row">
                  <span class="adventurer-card-label">XP สะสมทั้งหมด</span>
                  <strong class="adventurer-card-value adventurer-back-xp">${currentSummary.totalXp.toLocaleString()} XP</strong>
                </div>
                <div class="adventurer-card-row">
                  <span class="adventurer-card-label">ภารกิจที่สำเร็จ</span>
                  <span class="adventurer-card-value adventurer-back-done">${currentDoneCount} เควส</span>
                </div>
                <div class="adventurer-card-row sub">
                  <span class="adventurer-card-label">สู่เลเวลถัดไป</span>
                  <span class="adventurer-card-value adventurer-back-tonext">อีก ${currentSummary.toNext.toLocaleString()} XP</span>
                </div>
              </div>
              <footer class="adventurer-back-footer">
                <span class="adventurer-flip-hint">คลิกหรือกด Space เพื่อพลิกกลับ</span>
              </footer>
            </div>
          </div>
        </div>
        <div class="adventurer-viewer-controls">
          <button type="button" class="adventurer-viewer-btn adventurer-modal-flip-btn">↻ พลิกด้านบัตร</button>
          <button type="button" class="adventurer-viewer-btn adventurer-modal-edit-btn">${penIcon} แก้ไขชื่อและรูป</button>
          <span class="adventurer-viewer-hint">คลิกที่บัตรหรือกด Space เพื่อพลิก</span>
        </div>
      </div>
    `;

    const viewerCard = viewerDialog.querySelector('.adventurer-viewer-card');
    viewerCard?.addEventListener('click', () => flipViewer());

    const flipBtn = viewerDialog.querySelector('.adventurer-modal-flip-btn');
    flipBtn?.addEventListener('click', e => {
      e.stopPropagation();
      flipViewer();
    });

    const editBtn = viewerDialog.querySelector('.adventurer-modal-edit-btn');
    editBtn?.addEventListener('click', e => {
      e.stopPropagation();
      closeViewer();
      onEdit?.();
    });
  }

  function flipViewer() {
    isViewerFlipped = !isViewerFlipped;
    const viewerCard = viewerDialog?.querySelector('.adventurer-viewer-card');
    if (viewerCard) {
      viewerCard.classList.toggle('is-flipped', isViewerFlipped);
    }
    onCue?.('cardDrop');
  }

  function openViewer() {
    if (viewerDialog?.open) return;
    if (!viewerDialog) {
      viewerDialog = document.createElement('dialog');
      viewerDialog.className = 'adventurer-card-viewer-dialog';
      viewerDialog.setAttribute('aria-label', 'มุมมองขยายบัตรประจำตัวนักผจญภัย');
      document.body.appendChild(viewerDialog);

      viewerDialog.addEventListener('click', e => {
        if (e.target === viewerDialog || e.target?.closest?.('.adventurer-viewer-close')) {
          closeViewer();
        }
      });

      viewerDialog.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeViewer();
        } else if (e.key === ' ' || e.key === 'Enter') {
          if (!e.target?.closest?.('button')) {
            e.preventDefault();
            flipViewer();
          }
        }
      });
    }

    isViewerFlipped = isFlipped;
    renderViewerContent();
    if (typeof viewerDialog.showModal === 'function') {
      viewerDialog.showModal();
    } else {
      viewerDialog.setAttribute('open', '');
    }
    onCue?.('cardDrop');
  }

  function closeViewer() {
    if (!viewerDialog || (!viewerDialog.open && !viewerDialog.hasAttribute('open'))) return;
    if (typeof viewerDialog.close === 'function') {
      viewerDialog.close();
    } else {
      viewerDialog.removeAttribute('open');
    }
    onCue?.('cardDrop');
    card.focus?.({ preventScroll: true });
  }

  /**
   * Synchronizes adventurer state with current cumulative XP, card name and avatar.
   * Pure data updates; zero animation side-effects.
   */
  function update(rawXp, { doneCount = 0, emblem = 'shield', imageDataUrl = null, name = '', boardName: bName = '', scale = null } = {}) {
    if (typeof scale === 'number' && Number.isFinite(scale) && scale > 0) {
      setScale(scale);
    }
    currentSummary = xpSummary(rawXp);
    currentDoneCount = Math.max(0, Number(doneCount) || 0);
    latestProps = { doneCount, emblem, imageDataUrl, name, boardName: bName };

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

    if (viewerDialog && (viewerDialog.open || viewerDialog.hasAttribute('open'))) {
      renderViewerContent();
    }
  }

  // Dragging & Interaction State
  let dragActive = false;
  let dragMoved = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialCardX = 0;
  let initialCardY = 0;
  let prevPointerX = 0;
  let prevPointerY = 0;
  let pointerMoveDist = 0;
  let tiltX = 0;
  let tiltY = 0;
  let sway = 0;
  let targetTiltX = 0;
  let targetTiltY = 0;
  let targetSway = 0;
  let motionFrame = null;
  let lastSampleTime = 0;
  let sample = null;

  const nowMs = () => (window?.performance || globalThis?.performance || Date).now?.() || Date.now();
  const raf = cb => (window?.requestAnimationFrame || globalThis?.requestAnimationFrame || setTimeout)(cb);
  const cancelRaf = id => (window?.cancelAnimationFrame || globalThis?.cancelAnimationFrame || clearTimeout)(id);

  function getSealCenter() {
    const rect = sealEl?.getBoundingClientRect?.();
    if (rect && rect.width > 0) {
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    const cardRect = card.getBoundingClientRect();
    return { x: cardRect.left + 58, y: cardRect.top + 92 };
  }

  function renderCardMotion() {
    if (isReduced()) return;
    card.style.transform = `perspective(1000px) rotate(${sway.toFixed(2)}deg) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) scale(1.028)`;
    if (sheenEl) {
      sheenEl.style.setProperty('--sheen-angle', `${(105 + (tiltY + sway) * 4).toFixed(1)}deg`);
      sheenEl.style.setProperty('--sheen-opacity', `${Math.min(0.55, 0.22 + Math.abs(tiltX + tiltY + sway) * 0.04).toFixed(3)}`);
    }
  }

  function startMotionLoop() {
    if (motionFrame || isReduced()) return;
    const tick = () => {
      if (!dragActive) {
        motionFrame = null;
        return;
      }
      const now = nowMs();
      const isStationary = now - lastSampleTime > 80;
      const desiredSway = isStationary ? 0 : targetSway;
      const desiredTiltX = isStationary ? 0 : targetTiltX;
      const desiredTiltY = isStationary ? 0 : targetTiltY;

      sway += (desiredSway - sway) * 0.22;
      tiltX += (desiredTiltX - tiltX) * 0.22;
      tiltY += (desiredTiltY - tiltY) * 0.22;

      renderCardMotion();
      motionFrame = raf(tick);
    };
    motionFrame = raf(tick);
  }

  function stopMotionLoop() {
    if (motionFrame) {
      cancelRaf(motionFrame);
      motionFrame = null;
    }
  }

  function startDrag(clientX, clientY) {
    if (dragActive) return;
    dragActive = true;
    dragMoved = true;
    prevPointerX = clientX;
    prevPointerY = clientY;
    lastSampleTime = nowMs();
    sample = { x: clientX, time: lastSampleTime };
    targetSway = 0;
    targetTiltX = 0;
    targetTiltY = 0;
    sway = 0;
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
    card.style.transformOrigin = 'top left';

    card.classList.add('is-dragging');
    card.style.setProperty('--lift', '3.2');

    cancelMotion(card);
    renderCardMotion();
    startMotionLoop();
  }

  function moveDrag(clientX, clientY) {
    if (!dragActive) return;
    const dx = clientX - dragStartX;
    const dy = clientY - dragStartY;

    const surfaceRect = deskSurface.getBoundingClientRect();
    const scale = currentCardScale || 1;
    const cardWidth = Math.round(ADVENTURER_CARD_SIZE.width * scale);
    const cardHeight = Math.round(ADVENTURER_CARD_SIZE.height * scale);
    const maxX = Math.max(10, surfaceRect.width - cardWidth - 12);
    const maxY = Math.max(10, surfaceRect.height - cardHeight - 12);

    currentX = Math.min(maxX, Math.max(10, initialCardX + dx));
    currentY = Math.min(maxY, Math.max(10, initialCardY + dy));

    card.style.left = `${currentX}px`;
    card.style.top = `${currentY}px`;

    const now = nowMs();
    const vx = clientX - prevPointerX;
    const vy = clientY - prevPointerY;
    prevPointerX = clientX;
    prevPointerY = clientY;

    if (!isReduced()) {
      if (sample) {
        targetSway = dragTilt(sample, { x: clientX, time: now });
      }
      sample = { x: clientX, time: now };
      lastSampleTime = now;

      // 3D perspective pitch (vertical) and roll (horizontal)
      targetTiltX = Math.min(5, Math.max(-5, -vy * 0.45));
      targetTiltY = Math.min(5, Math.max(-5, vx * 0.45));

      sway += (targetSway - sway) * 0.35;
      tiltX += (targetTiltX - tiltX) * 0.35;
      tiltY += (targetTiltY - tiltY) * 0.35;

      renderCardMotion();
    }
  }

  function endDrag() {
    if (!dragActive) return;
    dragActive = false;
    dragMoved = false;
    stopMotionLoop();

    card.classList.remove('is-dragging');
    card.style.setProperty('--lift', '1');

    if (!isReduced()) {
      const settleKeyframes = [
        {
          transform: `perspective(1000px) rotate(${sway * 0.35}deg) rotateX(${tiltX * 0.35}deg) rotateY(${tiltY * 0.35}deg) scale(1.028)`,
          easing: 'cubic-bezier(.2,.7,.3,1)',
        },
        {
          transform: `perspective(1000px) rotate(${sway * 0.45}deg) rotateX(${tiltX * 0.45}deg) rotateY(${tiltY * 0.45}deg) scale(1.018)`,
          offset: 0.18,
          easing: 'cubic-bezier(.4,0,.6,1)',
        },
        {
          transform: `perspective(1000px) rotate(${-sway * 0.25 - 0.2}deg) rotateX(${-tiltX * 0.2}deg) rotateY(${-tiltY * 0.2}deg) scale(0.998)`,
          offset: 0.72,
          easing: 'ease-out',
        },
        {
          transform: `perspective(1000px) rotate(${sway * 0.08}deg) scale(1.002)`,
          offset: 0.88,
          easing: 'ease-out',
        },
        {
          transform: 'perspective(1000px) rotate(0deg) scale(1)',
        },
      ];
      animateTransient(
        card,
        settleKeyframes,
        { duration: 240, easing: 'linear' },
        {
          onFinish: () => {
            card.style.transform = '';
          },
        },
      );
    } else {
      card.style.transform = '';
    }
    sway = 0;
    tiltX = 0;
    tiltY = 0;
    targetSway = 0;
    targetTiltX = 0;
    targetTiltY = 0;

    applyPosition();
    onCue?.('cardDrop');
    onSavePosition({ x: Math.round(currentX), y: Math.round(currentY) });
  }

  function cancelDrag() {
    if (!dragActive && !dragMoved) return;
    dragActive = false;
    dragMoved = false;
    stopMotionLoop();

    card.classList.remove('is-dragging');
    card.style.setProperty('--lift', '1');
    currentX = initialCardX;
    currentY = initialCardY;
    applyPosition();
    cancelMotion(card);
    card.style.transform = '';
    sway = 0;
    tiltX = 0;
    tiltY = 0;
    targetSway = 0;
    targetTiltX = 0;
    targetTiltY = 0;
  }

  // Pointer event listeners
  card.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    // If clicking directly on action buttons or portrait, let their click handler run
    if (e.target?.closest?.('.adventurer-inspect-icon-btn, .adventurer-back-inspect-btn, .adventurer-edit-icon-btn, .adventurer-back-edit-btn, .adventurer-portrait-frame')) {
      return;
    }
    e.preventDefault();
    pointerMoveDist = 0;
    dragMoved = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    prevPointerX = e.clientX;
    prevPointerY = e.clientY;
    lastSampleTime = nowMs();
    sample = { x: e.clientX, time: lastSampleTime };

    const cardRect = card.getBoundingClientRect();
    const surfaceRect = deskSurface.getBoundingClientRect();
    initialCardX = cardRect.left - surfaceRect.left;
    initialCardY = cardRect.top - surfaceRect.top;
    currentX = initialCardX;
    currentY = initialCardY;

    const onMove = ev => {
      const dist = Math.hypot(ev.clientX - dragStartX, ev.clientY - dragStartY);
      pointerMoveDist += dist;
      if (!dragMoved && dist > 4) {
        startDrag(ev.clientX, ev.clientY);
      }
      if (dragActive) {
        moveDrag(ev.clientX, ev.clientY);
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (!dragMoved) {
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
      const scale = currentCardScale || 1;
      const cardWidth = Math.round(ADVENTURER_CARD_SIZE.width * scale);
      const cardHeight = Math.round(ADVENTURER_CARD_SIZE.height * scale);
      const maxX = Math.max(10, surfaceRect.width - cardWidth - 12);
      const maxY = Math.max(10, surfaceRect.height - cardHeight - 12);

      if (useBottom) {
        useBottom = false;
        currentX = 18;
        currentY = surfaceRect.height - cardHeight - 18;
        card.style.transformOrigin = 'top left';
      }

      if (e.key === 'ArrowLeft') currentX = Math.max(10, currentX - step);
      if (e.key === 'ArrowRight') currentX = Math.min(maxX, currentX + step);
      if (e.key === 'ArrowUp') currentY = Math.max(10, currentY - step);
      if (e.key === 'ArrowDown') currentY = Math.min(maxY, currentY + step);

      applyPosition();
      onCue?.('cardDrop');
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

  // =========================================================================
  // Flying Blue Mana Particle Effects (flyMana)
  // =========================================================================

  function triggerManaAbsorb() {
    if (sealEl) {
      sealEl.classList.remove('is-absorbing');
      void sealEl.offsetWidth;
      sealEl.classList.add('is-absorbing');
    }
    if (card) {
      card.classList.remove('is-mana-absorbing');
      void card.offsetWidth;
      card.classList.add('is-mana-absorbing');
    }

    clearTimeout(absorbTimer);
    absorbTimer = setTimeout(() => {
      sealEl?.classList.remove('is-absorbing');
      card?.classList.remove('is-mana-absorbing');
    }, 420);
  }

  function cancelManaParticles() {
    for (const timer of pendingTimers) {
      clearTimeout(timer);
    }
    pendingTimers.clear();

    for (const p of activeParticles) {
      try {
        cancelMotion(p);
        p.remove();
      } catch {}
    }
    activeParticles.clear();
  }

  /**
   * Sends blue mana from a stamp or across a dissolving sheet to the card's seal.
   */
  function flyMana({ origin = null, deltaXp = 0, sourceBounds = null } = {}) {
    if (!origin || typeof origin.x !== 'number' || typeof origin.y !== 'number') return;
    const count = sourceBounds ? Math.max(9, manaCount(deltaXp)) : manaCount(deltaXp);
    if (count <= 0) return;

    if (isReduced()) {
      triggerManaAbsorb();
      return;
    }

    const availableSlots = Math.max(0, maxConcurrentParticles - activeParticles.size);
    const toSpawn = Math.min(count, availableSlots);
    if (toSpawn <= 0) {
      triggerManaAbsorb();
      return;
    }

    for (let i = 0; i < toSpawn; i++) {
      const delay = i * 45 + (sourceBounds ? MOTION_DURATION.reducedFade : 0);
      // Sweep down the dissolving sheet, alternating columns along the way.
      const startX = sourceBounds ? sourceBounds.left + sourceBounds.width * (0.17 + ((i * 3) % 7) * 0.11) : origin.x;
      const startY = sourceBounds ? sourceBounds.top + sourceBounds.height * (0.1 + 0.8 * i / toSpawn) : origin.y;

      const timerId = setTimeout(() => {
        pendingTimers.delete(timerId);
        if (dragActive) {
          triggerManaAbsorb();
          return;
        }

        const particle = document.createElement('div');
        particle.className = 'mana-particle';
        particle.setAttribute('aria-hidden', 'true');
        document.body.appendChild(particle);
        activeParticles.add(particle);

        const target = getSealCenter();
        const duration = MOTION_DURATION.manaFlight - 60 + Math.random() * 180;
        const curveOffset = (Math.random() - 0.5) * 80;
        const midX = (startX + target.x) / 2 + curveOffset;
        const midY = (startY + target.y) / 2 - Math.abs(curveOffset) * 0.8;

        const keyframes = [
          { transform: `translate3d(${startX}px, ${startY}px, 0) scale(0.4)`, opacity: 0 },
          { transform: `translate3d(${(startX + midX) / 2}px, ${(startY + midY) / 2}px, 0) scale(1.3)`, opacity: 1, offset: 0.25 },
          { transform: `translate3d(${midX}px, ${midY}px, 0) scale(1)`, opacity: 0.9, offset: 0.6 },
          { transform: `translate3d(${target.x}px, ${target.y}px, 0) scale(0.6)`, opacity: 0.8 },
        ];

        animateTransient(
          particle,
          keyframes,
          {
            duration,
            easing: 'cubic-bezier(.2,.8,.3,1)',
            fill: 'forwards',
          },
          {
            onFinish: () => {
              activeParticles.delete(particle);
              try {
                particle.remove();
              } catch {}
              triggerManaAbsorb();
              if (i === toSpawn - 1) {
                onCue?.('cardDrop');
              }
            },
          },
        );
      }, delay);

      pendingTimers.add(timerId);
    }
  }

  // =========================================================================
  // Level-Up Shockwave Celebration (celebrateLevelUp)
  // =========================================================================

  function celebrateLevelUp(newLevel) {
    const summary = xpSummary((newLevel - 1) * 500);

    if (statusEl) {
      statusEl.textContent = `ขึ้นสู่ LEVEL ${newLevel} (${summary.title})!`;
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

    // Sheen flash across the whole card
    if (sheenEl) {
      animateTransient(
        sheenEl,
        [
          { opacity: 0.2, filter: 'brightness(1)' },
          { opacity: 0.85, filter: 'brightness(2)' },
          { opacity: 0.2, filter: 'brightness(1)' },
        ],
        {
          duration: 600,
          easing: MOTION_EASING.hover,
        },
      );
    }

    // Card subtle physical lift
    animateTransient(
      card,
      [
        { transform: 'translateY(0)' },
        { transform: 'translateY(-6px)' },
        { transform: 'translateY(0)' },
      ],
      {
        duration: 480,
        easing: 'cubic-bezier(.2,.9,.3,1)',
      },
    );

    // Number stamp-in impact
    if (levelNumEl) {
      animateTransient(
        levelNumEl,
        [
          { transform: 'scale(1.9)', opacity: 0.3 },
          { transform: 'scale(0.92)', opacity: 1 },
          { transform: 'scale(1)', opacity: 1 },
        ],
        {
          duration: 380,
          easing: 'cubic-bezier(.17,.89,.32,1.28)',
        },
        {
          onFinish: () => {
            onCue?.('cardDrop');
          },
        },
      );
    }
  }

  /**
   * Immediately terminates all active mana particle flights, timers and transient motions.
   */
  function cancelAll() {
    stopMotionLoop();
    dragActive = false;
    dragMoved = false;
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
    stopMotionLoop();
    cancelAll();
    closeViewer();
    if (viewerDialog) {
      try {
        viewerDialog.remove();
      } catch {}
      viewerDialog = null;
    }
    try {
      card.remove();
    } catch {}
  }

  return {
    get element() {
      return card;
    },
    update,
    setScale,
    get scale() {
      return currentCardScale;
    },
    flip,
    openViewer,
    closeViewer,
    get isViewerOpen() {
      return Boolean(viewerDialog?.open || viewerDialog?.hasAttribute?.('open'));
    },
    flyMana,
    celebrateLevelUp,
    cancelAll,
    destroy,
  };
}
