/**
 * The Questboard — Guild Quest Reception Counter Drawer
 * Left-rim draggable slide-out drawer with service bell & velvet turn-in tray.
 */

import { canReceiveQuest } from './quest-reception-model.mjs';
import { animateTransient, cancelMotion } from './desk-motion.mjs';
import { PAPER } from './paper-format.mjs';
import { MOTION_DURATION, MOTION_EASING } from './motion-tokens.mjs';

const DUST_POINTS = [[12, 14], [73, 12], [38, 22], [89, 29], [17, 37], [60, 37],
  [36, 48], [81, 53], [12, 58], [60, 65], [36, 73], [90, 77], [15, 85], [72, 90]];

/**
 * Creates and mounts the Guild Quest Reception Drawer.
 * @param {object} options
 * @param {HTMLElement} [options.surface] - Mounting parent (e.g. document.body or #desk-workspace).
 * @param {Document} [options.document] - DOM document.
 * @param {Window} [options.window] - DOM window.
 * @param {Function} [options.icon] - Icon helper function icon(name).
 * @param {Function} [options.renderQuest] - Renderer producing authentic quest article HTML: renderQuest(quest).
 * @param {Function} [options.onCue] - Sound playback callback onCue(name).
 * @param {Function} [options.onTurnIn] - Confirms submission; return false to keep the quest staged.
 * @param {Function} [options.onMana] - Starts mana flight with the staged sheet's screen coordinates.
 * @param {Function} [options.onWithdraw] - Callback when resting quest is withdrawn: onWithdraw(quest).
 * @param {Function} [options.reducedMotion] - Predicate returning true when reduced motion is requested.
 */
export function createQuestReception({
  surface = globalThis.document?.body,
  document = globalThis.document,
  window = globalThis.window,
  icon = () => '',
  renderQuest = null,
  onCue = () => {},
  onTurnIn = () => {},
  onMana = () => {},
  onWithdraw = () => {},
  onOpenChronicle = () => {},
  reducedMotion = () => false,
} = {}) {
  if (!surface || !document) {
    return {
      element: null,
      open: () => {},
      close: () => {},
      toggle: () => {},
      isOpen: false,
      checkDrop: () => false,
      setDropTarget: () => {},
      placeQuest: () => false,
      withdrawQuest: () => null,
      ringBell: () => {},
      setScale: () => {},
      hasQuest: false,
      currentQuest: null,
      destroy: () => {},
    };
  }

  const isReduced = () => {
    try {
      return typeof reducedMotion === 'function' ? reducedMotion() : Boolean(reducedMotion);
    } catch {
      return false;
    }
  };

  const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let currentQuest = null;
  let isSubmitting = false;
  let bellTimer;
  let autoCloseTimer;
  let previewEl = null;
  let isOpen = false;
  let gesture = null;
  let suppressClickUntil = 0;

  // Root Drawer Element
  const drawer = document.createElement('aside');
  drawer.className = 'quest-drawer left-reception';
  drawer.id = 'reception-drawer';
  drawer.setAttribute('aria-label', 'ลิ้นชักส่งเควส');

  const shieldIcon = icon('shield') || '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
  const bookIcon = icon('book') || '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';

  drawer.innerHTML = `
    <div class="drawer-body reception-drawer-body" id="reception-drawer-content">
      <div class="reception-counter-bar">
        <button type="button" class="reception-bell" id="reception-bell" aria-label="กดกระดิ่งส่งเควส" title="กดกระดิ่งส่งเควส">
          <span class="bell-assembly" aria-hidden="true">
            <span class="bell-plunger"></span>
            <span class="bell-dome"></span>
            <span class="bell-base"></span>
          </span>
        </button>
        <button type="button" class="reception-chronicle-btn" id="reception-chronicle-btn" aria-label="เปิดสมุดประวัติศาสตร์เควส" title="เปิดสมุดประวัติศาสตร์ (Chronicle)">
          <span class="reception-chronicle-icon" aria-hidden="true">${bookIcon}</span>
          <span>สมุดประวัติศาสตร์</span>
        </button>
      </div>

      <div class="reception-tray-container">
        <div class="reception-tray" data-reception-dropzone aria-label="ถาดส่งเควส ลากใบเควสมาวางที่นี่" tabindex="0">
          <div class="reception-tray-inner">
            <div class="reception-tray-velvet" aria-hidden="true">
              <span class="reception-tray-rune">${shieldIcon}</span>
            </div>
            <div class="reception-slot" data-slot></div>
          </div>
        </div>
      </div>
    </div>
    <button type="button" class="reception-drawer-handle" id="reception-drawer-handle" aria-label="เปิดหรือปิดลิ้นชักส่งเควส" aria-expanded="false" aria-controls="reception-drawer-content">
      <div class="reception-handle-icon">${shieldIcon}</div>
      <span class="reception-handle-text">ส่งมอบเควส</span>
      <b class="reception-handle-badge" id="reception-badge" hidden>1</b>
    </button>
  `;

  surface.appendChild(drawer);

  const handleBtn = drawer.querySelector('.reception-drawer-handle');
  const trayEl = drawer.querySelector('.reception-tray');
  const slotEl = drawer.querySelector('.reception-slot');
  const bellBtn = drawer.querySelector('.reception-bell');
  const badgeEl = drawer.querySelector('.reception-handle-badge');
  const chronicleBtn = drawer.querySelector('.reception-chronicle-btn');

  chronicleBtn?.addEventListener('click', e => {
    e.stopPropagation();
    onOpenChronicle?.();
  });

  const travel = () => Math.max(0, (drawer.offsetWidth || 348) - 44);

  const setReveal = px => {
    drawer.style.setProperty('--reception-reveal', `${Math.round(px)}px`);
  };

  const sync = open => {
    isOpen = open;
    drawer.classList.toggle('is-open', open);
    handleBtn.setAttribute('aria-expanded', String(open));
    if (typeof drawer.style?.removeProperty === 'function') {
      drawer.style.removeProperty('--reception-reveal');
    } else if (drawer.style) {
      delete drawer.style['--reception-reveal'];
    }
  };

  function openDrawer() {
    if (isOpen) return;
    onCue?.('drawerOpen');
    sync(true);
  }

  function closeDrawer() {
    if (!isOpen) return;
    onCue?.('drawerClose');
    sync(false);
  }

  function toggleDrawer() {
    if (isOpen) closeDrawer();
    else openDrawer();
  }

  // Drag-to-pull & Drag-to-push Gesture Handling on Handle
  handleBtn.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const currentTravel = travel();
    const currentReveal = isOpen ? currentTravel : 0;
    gesture = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startReveal: currentReveal,
      currentReveal,
      moved: false,
    };
    drawer.classList.add('is-pulling');
    setReveal(currentReveal);
    try {
      handleBtn.setPointerCapture(e.pointerId);
    } catch {}
  });

  handleBtn.addEventListener('pointermove', e => {
    if (!gesture || e.pointerId !== gesture.pointerId) return;
    const dx = e.clientX - gesture.startX;
    if (Math.abs(dx) > 4) {
      gesture.moved = true;
    }
    const currentTravel = travel();
    gesture.currentReveal = Math.max(0, Math.min(currentTravel, gesture.startReveal + dx));
    setReveal(gesture.currentReveal);
  });

  const finishPull = (e, cancelled = false) => {
    if (!gesture || e.pointerId !== gesture.pointerId) return;
    const prev = gesture;
    gesture = null;
    try {
      if (handleBtn.hasPointerCapture(e.pointerId)) {
        handleBtn.releasePointerCapture(e.pointerId);
      }
    } catch {}
    drawer.classList.remove('is-pulling');

    const currentTravel = travel();
    if (prev.moved && !cancelled) {
      suppressClickUntil = performance.now() + 350;
      const shouldOpen = prev.currentReveal >= currentTravel * 0.45;
      if (shouldOpen !== isOpen) {
        onCue?.(shouldOpen ? 'drawerOpen' : 'drawerClose');
      }
      sync(shouldOpen);
    } else if (cancelled) {
      sync(isOpen);
    }
  };

  handleBtn.addEventListener('pointerup', e => finishPull(e, false));
  handleBtn.addEventListener('pointercancel', e => finishPull(e, true));

  handleBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (performance.now() < suppressClickUntil) return;
    toggleDrawer();
  });

  function fitPaper() {
    if (!previewEl) return;
    const scale = Math.min(slotEl.clientWidth / PAPER.width, slotEl.clientHeight / PAPER.height, 1);
    previewEl.style.setProperty('--reception-fit', String(scale));
  }

  const resizeObserver = window?.ResizeObserver ? new window.ResizeObserver(fitPaper) : null;
  resizeObserver?.observe(slotEl);

  function placeQuest(quest, ghostEl = null) {
    if (!canReceiveQuest(quest) || isSubmitting) return false;
    if (ghostEl) {
      try {
        ghostEl.remove();
      } catch {}
    }
    clearTimeout(autoCloseTimer);
    currentQuest = quest;

    let paperHtml = '';
    if (typeof renderQuest === 'function') {
      paperHtml = renderQuest(quest);
    } else {
      const priorities = { high: ['A', 'เควสสำคัญ'], normal: ['B', 'เควสทั่วไป'], low: ['C', 'เควสสบาย ๆ'] };
      const [rank, priority] = priorities[quest.priority] || priorities.normal;
      paperHtml = `
        <article class="quest-paper in-reception-tray" data-id="${esc(quest.id)}">
          <span class="paper-wear" aria-hidden="true"></span>
          <div class="quest-top"><span class="quest-type">${esc(quest.category || 'งานหลัก')}</span></div>
          <div class="paper-rule"><span>QUEST No. 001</span><span class="rank rank-${quest.priority || 'normal'}" title="${priority}">${rank}</span></div>
          <button class="quest-title">${esc(quest.title || 'เควสไม่ระบุชื่อ')}</button>
          <p class="quest-description">${esc(quest.description || '')}</p>
          <div class="quest-metadata"><span class="priority priority-${quest.priority || 'normal'}"><i></i>${priority}</span><span class="quest-xp">✨ ${esc(quest.xp ?? 0)} XP</span></div>
        </article>
      `;
    }

    const dust = DUST_POINTS.map(([x, y], index) =>
      `<i style="--x:${x}%;--y:${y}%;--drift:${index % 2 ? -7 : 7}px;--phase:-${index * 219}ms"></i>`).join('');
    slotEl.innerHTML = `
      <div class="reception-placed-sheet" style="--reception-paper-width:${PAPER.width}px;--reception-paper-height:${PAPER.height}px">
        <div class="reception-paper-stage" inert>${paperHtml}</div>
        <div class="reception-mana-dust" aria-hidden="true">${dust}</div>
        <output class="reception-reward">${esc((quest.xp ?? 0).toLocaleString('th-TH'))} XP</output>
        <button type="button" class="reception-withdraw-btn" aria-label="นำเควสกลับคืนสู่โต๊ะ" title="นำเควสกลับคืนสู่โต๊ะ">↶</button>
      </div>
    `;

    previewEl = slotEl.querySelector('.reception-placed-sheet');
    const paperEl = slotEl.querySelector('.quest-paper');
    if (paperEl) {
      paperEl.classList.remove('board-item');
      paperEl.classList.add('in-reception-tray');
      paperEl.removeAttribute('data-id');
      paperEl.style.left = 'auto';
      paperEl.style.top = 'auto';
      paperEl.style.transform = 'none';
      paperEl.style.setProperty('--rotation', '0deg');
      paperEl.querySelectorAll('.quest-bundle-select, .paper-turn-corner').forEach(el => el.remove());
    }
    fitPaper();
    drawer.classList.add('has-staged-quest');
    bellBtn.classList.add('has-quest');
    badgeEl.hidden = false;
    badgeEl.textContent = '1';
    onCue?.('paperDrop');

    const withdrawBtn = slotEl.querySelector('.reception-withdraw-btn');
    withdrawBtn?.addEventListener('click', e => {
      e.stopPropagation();
      bellBtn.focus();
      withdrawQuest();
    });

    openDrawer();
    return true;
  }

  function emptySlot() {
    currentQuest = null;
    previewEl = null;
    slotEl.innerHTML = '';
    drawer.classList.remove('has-staged-quest');
    bellBtn.classList.remove('has-quest');
    badgeEl.hidden = true;
  }

  function withdrawQuest() {
    if (!currentQuest || isSubmitting) return null;
    const quest = currentQuest;
    emptySlot();
    onCue?.('cardDrop');
    onWithdraw?.(quest);
    return quest;
  }

  function ringBell() {
    if (isSubmitting) return;
    bellBtn.classList.add('is-ringing');
    clearTimeout(bellTimer);
    bellTimer = setTimeout(() => bellBtn.classList.remove('is-ringing'), MOTION_DURATION.dialog);
    onCue?.('bell');
    if (!currentQuest || !previewEl) return;

    const quest = currentQuest;
    const sourceBounds = previewEl.getBoundingClientRect();
    const origin = { x: sourceBounds.left + sourceBounds.width / 2, y: sourceBounds.top + sourceBounds.height / 2 };
    isSubmitting = true;
    let accepted = false;
    try {
      accepted = onTurnIn(quest, { origin, sourceBounds }) !== false;
    } finally {
      if (!accepted) isSubmitting = false;
    }
    if (!accepted) return;

    const finishSubmission = () => {
      emptySlot();
      isSubmitting = false;
      autoCloseTimer = setTimeout(closeDrawer, 1800);
    };
    if (isReduced()) {
      finishSubmission();
    } else {
      previewEl.classList.add('is-dissolving');
      const withdraw = slotEl.querySelector('.reception-withdraw-btn');
      if (document.activeElement === withdraw) bellBtn.focus();
      withdraw.hidden = true;
      animateTransient(previewEl, [
        { opacity: 1, maskPosition: '0 100%' },
        { opacity: 1, maskPosition: '0 91%', offset: 0.14 },
        { opacity: 0.82, maskPosition: '0 40%', offset: 0.67 },
        { opacity: 0, maskPosition: '0 0%' },
      ], { duration: MOTION_DURATION.receptionDissolve, easing: MOTION_EASING.turn, fill: 'forwards' }, { onFinish: finishSubmission });
    }
    onMana(quest, { origin, sourceBounds });
  }

  bellBtn.addEventListener('click', e => {
    e.stopPropagation();
    ringBell();
  });

  trayEl.addEventListener('keydown', e => {
    if (e.target === trayEl && ['Enter', ' '].includes(e.key)) {
      e.preventDefault();
      ringBell();
    }
  });

  function checkDrop(point) {
    if (isSubmitting || !point || typeof point.x !== 'number' || typeof point.y !== 'number') return false;
    const trayRect = trayEl.getBoundingClientRect();
    const handleRect = handleBtn.getBoundingClientRect();

    const overTray = point.x >= trayRect.left && point.x <= trayRect.right && point.y >= trayRect.top && point.y <= trayRect.bottom;
    const overHandle = point.x >= handleRect.left && point.x <= handleRect.right && point.y >= handleRect.top && point.y <= handleRect.bottom;

    return overTray || overHandle;
  }

  function setDropTarget(isTarget) {
    drawer.classList.toggle('is-drop-target', Boolean(isTarget));
    if (isTarget) {
      openDrawer();
    }
  }

  function destroy() {
    resizeObserver?.disconnect();
    if (previewEl) cancelMotion(previewEl);
    clearTimeout(bellTimer);
    clearTimeout(autoCloseTimer);
    try {
      drawer.remove();
    } catch {}
  }

  return {
    element: drawer,
    open: openDrawer,
    close: closeDrawer,
    toggle: toggleDrawer,
    get isOpen() {
      return isOpen;
    },
    checkDrop,
    setDropTarget,
    placeQuest,
    withdrawQuest,
    ringBell,
    setScale: fitPaper,
    get hasQuest() {
      return Boolean(currentQuest);
    },
    get currentQuest() {
      return currentQuest;
    },
    destroy,
  };
}
