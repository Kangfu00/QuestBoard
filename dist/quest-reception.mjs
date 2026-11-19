/**
 * The Questboard — Guild Quest Reception Counter Drawer
 * Left-rim slide-out drawer with service bell & velvet turn-in tray.
 */

import { pickReceptionistQuote, canReceiveQuest } from './quest-reception-model.mjs';
import { animateTransient, cancelMotion } from './desk-motion.mjs';

/**
 * Creates and mounts the Guild Quest Reception Drawer.
 * @param {object} options
 * @param {HTMLElement} [options.surface] - Mounting parent (e.g. document.body or #desk-workspace).
 * @param {Document} [options.document] - DOM document.
 * @param {Window} [options.window] - DOM window.
 * @param {Function} [options.icon] - Icon helper function icon(name).
 * @param {Function} [options.onCue] - Sound playback callback onCue(name).
 * @param {Function} [options.onTurnIn] - Callback when quest submission is confirmed: onTurnIn(quest, { origin }).
 * @param {Function} [options.onWithdraw] - Callback when resting quest is withdrawn: onWithdraw(quest).
 * @param {Function} [options.reducedMotion] - Predicate returning true when reduced motion is requested.
 */
export function createQuestReception({
  surface = globalThis.document?.body,
  document = globalThis.document,
  window = globalThis.window,
  icon = () => '',
  onCue = () => {},
  onTurnIn = () => {},
  onWithdraw = () => {},
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
  let speechTimer = null;
  let autoCloseTimer = null;
  let isOpen = false;

  // Root Drawer Element
  const drawer = document.createElement('aside');
  drawer.className = 'quest-drawer left-reception';
  drawer.id = 'reception-drawer';
  drawer.setAttribute('aria-label', 'ลิ้นชักเคาน์เตอร์ส่งเควส');

  const shieldIcon = icon('shield') || '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
  const crossIcon = icon('cross') || '✕';

  drawer.innerHTML = `
    <div class="drawer-body reception-drawer-body" id="reception-drawer-content">
      <header class="reception-header">
        <div class="reception-header-title">
          <span class="eyebrow">THE GUILD RECEPTION</span>
          <h2>เคาน์เตอร์ส่งมอบภารกิจ</h2>
        </div>
        <button type="button" class="icon-button reception-close-btn" aria-label="ปิดลิ้นชักส่งเควส">${crossIcon}</button>
      </header>

      <div class="reception-counter-bar">
        <div class="reception-bell-wrap">
          <button type="button" class="reception-bell" id="reception-bell" aria-label="สั่นกระดิ่งเคาน์เตอร์กิลด์" title="กดกระดิ่งเพื่อส่งมอบภารกิจ หรือเรียกพนักงานกิลด์">
            <div class="bell-assembly" aria-hidden="true">
              <span class="bell-plunger"></span>
              <span class="bell-dome"></span>
              <span class="bell-base"></span>
            </div>
          </button>
          <span class="reception-bell-hint">กดกระดิ่ง 🛎️ ส่งงาน</span>
        </div>
        <div class="reception-speech-bubble" id="reception-speech" aria-live="polite" hidden></div>
      </div>

      <div class="reception-tray-container">
        <div class="reception-tray" data-reception-dropzone aria-label="ถาดทองเหลืองส่งงานกิลด์" tabindex="0">
          <div class="reception-tray-inner">
            <div class="reception-tray-velvet" aria-hidden="true">
              <span class="reception-tray-rune">${shieldIcon}</span>
              <span class="reception-tray-label">GUILD SUBMISSION TRAY</span>
              <span class="reception-tray-instruction">ลากใบเควสมาวางที่นี่เพื่อส่งมอบ</span>
            </div>
            <div class="reception-slot" data-slot></div>
          </div>
        </div>
      </div>
    </div>
    <button type="button" class="reception-drawer-handle" id="reception-drawer-handle" aria-label="เปิดลิ้นชักเคาน์เตอร์ส่งเควส" aria-expanded="false" aria-controls="reception-drawer-content">
      <div class="reception-handle-icon">${shieldIcon}</div>
      <span class="reception-handle-text">ส่งมอบเควส</span>
      <b class="reception-handle-badge" id="reception-badge" hidden>1</b>
    </button>
  `;

  surface.appendChild(drawer);

  const handleBtn = drawer.querySelector('.reception-drawer-handle');
  const closeBtn = drawer.querySelector('.reception-close-btn');
  const trayEl = drawer.querySelector('.reception-tray');
  const slotEl = drawer.querySelector('.reception-slot');
  const bellBtn = drawer.querySelector('.reception-bell');
  const speechBubble = drawer.querySelector('.reception-speech-bubble');
  const badgeEl = drawer.querySelector('.reception-handle-badge');

  function openDrawer() {
    if (isOpen) return;
    isOpen = true;
    drawer.classList.add('is-open');
    handleBtn.setAttribute('aria-expanded', 'true');
    onCue?.('drawerOpen');
  }

  function closeDrawer() {
    if (!isOpen) return;
    isOpen = false;
    drawer.classList.remove('is-open');
    handleBtn.setAttribute('aria-expanded', 'false');
    onCue?.('drawerClose');
  }

  function toggleDrawer() {
    if (isOpen) closeDrawer();
    else openDrawer();
  }

  handleBtn.addEventListener('click', e => {
    e.stopPropagation();
    toggleDrawer();
  });

  closeBtn.addEventListener('click', e => {
    e.stopPropagation();
    closeDrawer();
  });

  function showSpeechBubble(message) {
    if (!speechBubble) return;
    if (speechTimer) {
      clearTimeout(speechTimer);
      speechTimer = null;
    }
    speechBubble.textContent = message;
    speechBubble.hidden = false;
    speechBubble.style.opacity = '1';

    speechTimer = setTimeout(() => {
      speechTimer = null;
      if (!isReduced()) {
        animateTransient(
          speechBubble,
          [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-6px)' }],
          { duration: 220, easing: 'ease-out' },
          {
            onFinish: () => {
              speechBubble.hidden = true;
            },
          },
        );
      } else {
        speechBubble.hidden = true;
      }
    }, 2800);
  }

  function getStampCenter() {
    const slotRect = slotEl.getBoundingClientRect();
    return {
      x: slotRect.left + slotRect.width / 2,
      y: slotRect.top + slotRect.height / 2,
    };
  }

  function placeQuest(quest, ghostEl = null) {
    if (!canReceiveQuest(quest) || isSubmitting) return false;
    if (ghostEl) {
      try {
        ghostEl.remove();
      } catch {}
    }
    currentQuest = quest;

    const categoryText = quest.category ? String(quest.category).toUpperCase() : 'GENERAL';
    const xpText = `+${quest.xp || 50} XP`;

    slotEl.innerHTML = `
      <div class="reception-paper-preview" data-reception-quest="${quest.id}" tabindex="0" role="region" aria-label="ใบเควส ${esc(quest.title || 'ไม่มีชื่อ')} พร้อมส่งมอบ">
        <div class="reception-paper-header">
          <span class="reception-paper-tag">${categoryText}</span>
          <span class="reception-paper-xp">${xpText}</span>
        </div>
        <div class="reception-paper-body">
          <h3 class="reception-paper-title">${esc(quest.title || 'เควสไม่ระบุชื่อ')}</h3>
          ${quest.description ? `<p class="reception-paper-desc">${esc(quest.description)}</p>` : ''}
        </div>
        <div class="reception-paper-footer">
          <button type="button" class="reception-withdraw-btn" title="นำเควสกลับคืนสู่โต๊ะ">
            ${crossIcon} นำเควสกลับคืน
          </button>
          <span class="reception-paper-prompt">กดกระดิ่ง 🛎️ เพื่อส่งมอบ</span>
        </div>
      </div>
    `;

    bellBtn.classList.add('has-quest');
    badgeEl.hidden = false;
    badgeEl.textContent = '1';
    onCue?.('paperDrop');

    // Withdraw button trigger inside paper
    const withdrawBtn = slotEl.querySelector('.reception-withdraw-btn');
    withdrawBtn?.addEventListener('click', e => {
      e.stopPropagation();
      withdrawQuest();
    });

    openDrawer();
    return true;
  }

  function withdrawQuest() {
    if (!currentQuest || isSubmitting) return null;
    const quest = currentQuest;
    currentQuest = null;
    slotEl.innerHTML = '';
    bellBtn.classList.remove('has-quest');
    badgeEl.hidden = true;
    onCue?.('cardDrop');
    onWithdraw?.(quest);
    return quest;
  }

  function ringBell() {
    if (isSubmitting) return;

    // Visual button press
    bellBtn.classList.add('is-ringing');
    setTimeout(() => bellBtn.classList.remove('is-ringing'), 160);

    // Audio chime
    onCue?.('bell');

    if (currentQuest) {
      // Submitting the quest
      isSubmitting = true;
      const quest = currentQuest;
      const quote = pickReceptionistQuote(true);
      showSpeechBubble(quote);

      const previewEl = slotEl.querySelector('.reception-paper-preview');
      if (previewEl) {
        // Overlay giant guild accepted stamp
        const stampOverlay = document.createElement('div');
        stampOverlay.className = 'reception-stamp-impact';
        stampOverlay.innerHTML = '<span class="reception-stamp-mark">GUILD ACCEPTED</span>';
        previewEl.appendChild(stampOverlay);

        onCue?.('receptionStamp');

        // Trigger blue mana surge arcing to adventurer card
        const origin = getStampCenter();
        onTurnIn?.(quest, { origin });

        // Trigger paper dissolving animation
        setTimeout(() => {
          previewEl.classList.add('is-dissolving');

          setTimeout(() => {
            currentQuest = null;
            slotEl.innerHTML = '';
            bellBtn.classList.remove('has-quest');
            badgeEl.hidden = true;
            isSubmitting = false;

            // Auto close drawer gently after turn-in completion
            clearTimeout(autoCloseTimer);
            autoCloseTimer = setTimeout(() => {
              if (!currentQuest) closeDrawer();
            }, 1800);
          }, 650);
        }, 380);
      } else {
        isSubmitting = false;
      }
    } else {
      // Idle bell ring banter
      const idleQuote = pickReceptionistQuote(false);
      showSpeechBubble(idleQuote);
    }
  }

  bellBtn.addEventListener('click', e => {
    e.stopPropagation();
    ringBell();
  });

  trayEl.addEventListener('keydown', e => {
    if (['Enter', ' '].includes(e.key)) {
      e.preventDefault();
      ringBell();
    }
  });

  function checkDrop(point) {
    if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') return false;
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

  function setScale(newScale) {
    // Left drawer scales naturally with viewport
  }

  function destroy() {
    if (speechTimer) {
      clearTimeout(speechTimer);
      speechTimer = null;
    }
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }
    cancelMotion(drawer);
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
    setScale,
    get hasQuest() {
      return Boolean(currentQuest);
    },
    get currentQuest() {
      return currentQuest;
    },
    destroy,
  };
}
