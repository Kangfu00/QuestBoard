/**
 * The Questboard — Guild Quest Reception Counter
 * Interactive Turn-in Tray & Counter Receptionist Service Bell.
 */

import { pickReceptionistQuote, canReceiveQuest } from './quest-reception-model.mjs';
import { animateTransient, cancelMotion } from './desk-motion.mjs';

/**
 * Creates and mounts the Guild Quest Reception Counter.
 * @param {object} options
 * @param {HTMLElement} [options.surface] - Mounting parent (e.g. #board-scroll or #desk-surface).
 * @param {Document} [options.document] - DOM document.
 * @param {Window} [options.window] - DOM window.
 * @param {Function} [options.icon] - Icon helper function icon(name).
 * @param {Function} [options.onCue] - Sound playback callback onCue(name).
 * @param {Function} [options.onTurnIn] - Callback when quest submission is confirmed: onTurnIn(quest, { origin }).
 * @param {Function} [options.onWithdraw] - Callback when resting quest is withdrawn: onWithdraw(quest).
 * @param {Function} [options.reducedMotion] - Predicate returning true when reduced motion is requested.
 * @param {Function} [options.getScale] - Scale getter returning current desk scale.
 */
export function createQuestReception({
  surface = globalThis.document?.getElementById('desk-surface'),
  document = globalThis.document,
  window = globalThis.window,
  icon = () => '',
  onCue = () => {},
  onTurnIn = () => {},
  onWithdraw = () => {},
  reducedMotion = () => false,
  getScale = () => 1,
} = {}) {
  if (!surface || !document) {
    return {
      element: null,
      checkDrop: () => false,
      placeQuest: () => false,
      withdrawQuest: () => null,
      ringBell: () => {},
      setScale: () => {},
      get hasQuest() { return false; },
      get currentQuest() { return null; },
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

  let currentQuest = null;
  let isSubmitting = false;
  let speechTimer = null;
  let currentScale = (typeof getScale === 'function' ? getScale() : 1) || 1;

  // Root container
  const container = document.createElement('div');
  container.className = 'guild-reception';
  container.id = 'guild-reception';
  container.setAttribute('aria-label', 'เคาน์เตอร์ส่งงานกิลด์');
  container.style.setProperty('--card-scale', String(currentScale));

  const shieldRuneIcon = icon('shield') || '<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';

  container.innerHTML = `
    <div class="reception-tray" data-reception-dropzone aria-label="ถาดทองเหลืองส่งงานกิลด์" tabindex="0">
      <div class="reception-tray-inner">
        <div class="reception-tray-velvet" aria-hidden="true">
          <span class="reception-tray-rune">${shieldRuneIcon}</span>
          <span class="reception-tray-label">GUILD SUBMISSION</span>
        </div>
        <div class="reception-slot" data-slot></div>
      </div>
    </div>
    <button type="button" class="reception-bell" id="reception-bell" aria-label="สั่นกระดิ่งเคาน์เตอร์กิลด์" title="กดกระดิ่งเพื่อส่งมอบภารกิจ หรือเรียกพนักงานกิลด์">
      <div class="bell-assembly" aria-hidden="true">
        <span class="bell-plunger"></span>
        <span class="bell-dome"></span>
        <span class="bell-base"></span>
      </div>
    </button>
    <div class="reception-speech-bubble" id="reception-speech" aria-live="polite" hidden></div>
  `;

  surface.appendChild(container);

  const trayEl = container.querySelector('.reception-tray');
  const slotEl = container.querySelector('.reception-slot');
  const bellBtn = container.querySelector('.reception-bell');
  const speechBubble = container.querySelector('.reception-speech-bubble');

  function setScale(newScale) {
    if (typeof newScale === 'number' && Number.isFinite(newScale) && newScale > 0) {
      currentScale = newScale;
      container.style.setProperty('--card-scale', String(newScale));
    }
  }

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

  function placeQuest(quest) {
    if (!canReceiveQuest(quest) || isSubmitting) return false;
    currentQuest = quest;

    slotEl.innerHTML = `
      <div class="reception-paper-preview" data-reception-quest="${quest.id}" role="button" tabindex="0" aria-label="เควส ${quest.title || 'ไม่มีชื่อ'} รอส่งมอบ คลิกกระดิ่งเพื่อส่ง หรือคลิกที่นี่เพื่อนำกลับ">
        <div class="reception-paper-top">
          <span>QUEST SUBMISSION</span>
          <span class="reception-paper-xp">+${quest.xp || 50} XP</span>
        </div>
        <div class="reception-paper-title">${quest.title || 'เควสไม่ระบุชื่อ'}</div>
        <div class="reception-paper-footer">
          <span class="reception-paper-withdraw">คลิกเพื่อนำกลับ</span>
          <span>กดกระดิ่ง 🛎️ ส่ง</span>
        </div>
      </div>
    `;

    bellBtn.classList.add('has-quest');
    onCue?.('paperDrop');

    // Click preview to withdraw
    const previewEl = slotEl.querySelector('.reception-paper-preview');
    previewEl?.addEventListener('click', e => {
      e.stopPropagation();
      withdrawQuest();
    });

    previewEl?.addEventListener('keydown', e => {
      if (['Enter', ' '].includes(e.key)) {
        e.preventDefault();
        withdrawQuest();
      }
    });

    return true;
  }

  function withdrawQuest() {
    if (!currentQuest || isSubmitting) return null;
    const quest = currentQuest;
    currentQuest = null;
    slotEl.innerHTML = '';
    bellBtn.classList.remove('has-quest');
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
        // Overlay giant guild stamp
        const stampOverlay = document.createElement('div');
        stampOverlay.className = 'reception-stamp-impact';
        stampOverlay.innerHTML = '<span class="reception-stamp-mark">GUILD ACCEPTED</span>';
        previewEl.appendChild(stampOverlay);

        onCue?.('receptionStamp');

        // Trigger mana surge arcing to adventurer card
        const origin = getStampCenter();
        onTurnIn?.(quest, { origin });

        setTimeout(() => {
          previewEl.classList.add('is-archiving');
          setTimeout(() => {
            currentQuest = null;
            slotEl.innerHTML = '';
            bellBtn.classList.remove('has-quest');
            isSubmitting = false;
          }, 480);
        }, 360);
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

  trayEl.addEventListener('click', () => {
    if (currentQuest) {
      ringBell();
    }
  });

  trayEl.addEventListener('keydown', e => {
    if (['Enter', ' '].includes(e.key)) {
      e.preventDefault();
      ringBell();
    }
  });

  function checkDrop(point) {
    if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') return false;
    const rect = trayEl.getBoundingClientRect();
    return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
  }

  function setDropTarget(isTarget) {
    container.classList.toggle('is-drop-target', Boolean(isTarget));
  }

  function destroy() {
    if (speechTimer) {
      clearTimeout(speechTimer);
      speechTimer = null;
    }
    cancelMotion(container);
    try {
      container.remove();
    } catch {}
  }

  return {
    element: container,
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
