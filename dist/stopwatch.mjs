/**
 * The Questboard — The Overdrive Pocket Stopwatch Component
 * Interactive antique brass chronometer for the guild desk.
 * Features 3D brass casing, skull ornament, winding crown, side pusher button,
 * floral flourish, chain links, real-time rotating hands, and inspect dialog.
 */

import {
  DEFAULT_STOPWATCH,
  PRESET_DURATIONS,
  normalizeStopwatch,
  getStopwatchTime,
  startStopwatch,
  pauseStopwatch,
  resetStopwatch,
  switchMode,
  setDuration,
  finishStopwatch,
  pinQuest,
  updateStopwatch,
} from './stopwatch-model.mjs';
import { animateTransient, cancelMotion } from './desk-motion.mjs';

const escapeHtml = value =>
  String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));

/**
 * Creates and mounts the interactive Overdrive Pocket Stopwatch on the desk.
 */
export function createStopwatch({
  canvas,
  viewport = null,
  document = canvas?.ownerDocument || globalThis.document,
  window = globalThis.window || globalThis,
  getState = () => ({ items: [] }),
  commit = () => {},
  onCue = () => {},
  reducedMotion = () => false,
  openDialog = () => {},
  closeDialog = () => {},
  icon = () => '',
} = {}) {
  if (!canvas) {
    return {
      element: null,
      update: () => {},
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

  let watchEl = null;
  let rafId = null;
  let alarmPlayed = false;

  // Dragging states
  let isDragging = false;
  let pointerStart = { x: 0, y: 0 };
  let initialPos = { x: 0, y: 0 };
  let hasMoved = false;

  function buildMarkup() {
    return `
      <!-- Brass Chain -->
      <svg class="stopwatch-chain-svg" viewBox="0 0 160 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="sw-chain-gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffe8a8"/>
            <stop offset="40%" stop-color="#d4a34b"/>
            <stop offset="75%" stop-color="#8c5a1e"/>
            <stop offset="100%" stop-color="#4d2f09"/>
          </linearGradient>
        </defs>
        <!-- Chain links flowing alongside the watch -->
        <path d="M 58 10 C 35 2 15 15 12 38 C 9 60 4 85 10 110 C 13 125 24 138 38 142" 
              stroke="url(#sw-chain-gold)" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="7 3"/>
        <path d="M 58 10 C 35 2 15 15 12 38 C 9 60 4 85 10 110 C 13 125 24 138 38 142" 
              stroke="#2e1906" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="2 8"/>
        <!-- Terminal Ring -->
        <circle cx="42" cy="142" r="7" stroke="url(#sw-chain-gold)" stroke-width="3" fill="#3a200b"/>
        <circle cx="42" cy="142" r="3.5" fill="#1b0e04"/>
      </svg>

      <!-- Side Pusher (2 o'clock) -->
      <div class="stopwatch-side-pusher" data-action="pusher" title="กดปุ่มเพื่อรีเซ็ตเวลา หรือสลับโหมด" aria-label="ปุ่มรีเซ็ต / สลับโหมด"></div>

      <!-- Top Crown & Loop Assembly (12 o'clock) -->
      <div class="stopwatch-crown-assembly" data-action="crown" title="กดเม็ดมะยมเพื่อเริ่ม / พักเวลา" aria-label="เม็ดมะยมเริ่มหรือพักเวลา">
        <div class="stopwatch-crown-loop"></div>
        <div class="stopwatch-crown-knob"></div>
      </div>

      <!-- Miniature Skull Ornament -->
      <svg class="stopwatch-skull-ornament" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M 6 12 C 6 6 18 6 18 12 C 18 14.5 16.5 16.5 15.5 17.5 L 15.5 21 L 8.5 21 L 8.5 17.5 C 7.5 16.5 6 14.5 6 12 Z" 
              fill="url(#sw-skull-brass)" stroke="#422509" stroke-width="1.2"/>
        <!-- Eye Sockets -->
        <circle cx="9.5" cy="12.5" r="2.2" fill="#201004"/>
        <circle cx="14.5" cy="12.5" r="2.2" fill="#201004"/>
        <!-- Nose Cavity -->
        <polygon points="12,15 10.8,17 13.2,17" fill="#201004"/>
        <!-- Teeth Marks -->
        <line x1="10.5" y1="18.5" x2="10.5" y2="21" stroke="#201004" stroke-width="1"/>
        <line x1="12" y1="18.5" x2="12" y2="21" stroke="#201004" stroke-width="1"/>
        <line x1="13.5" y1="18.5" x2="13.5" y2="21" stroke="#201004" stroke-width="1"/>
        <defs>
          <linearGradient id="sw-skull-brass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fff0bd"/>
            <stop offset="35%" stop-color="#dca94e"/>
            <stop offset="70%" stop-color="#9a6923"/>
            <stop offset="100%" stop-color="#54340a"/>
          </linearGradient>
        </defs>
      </svg>

      <!-- Main Watch Body -->
      <div class="stopwatch-body">
        <!-- Watch Dial Face -->
        <div class="stopwatch-dial">
          <!-- Dial SVG Background (Ring and Ticks) -->
          <svg class="stopwatch-dial-face" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="50" cy="50" r="46" stroke="#b08642" stroke-width="1.2" opacity="0.6"/>
            <circle cx="50" cy="50" r="43" stroke="#d5b068" stroke-width="0.8" stroke-dasharray="1 3.5"/>
            <!-- 12 Major Hour Ticks -->
            <line x1="50" y1="7" x2="50" y2="13" stroke="#482d12" stroke-width="2"/>
            <line x1="50" y1="87" x2="50" y2="93" stroke="#482d12" stroke-width="2"/>
            <line x1="7" y1="50" x2="13" y2="50" stroke="#482d12" stroke-width="2"/>
            <line x1="87" y1="50" x2="93" y2="50" stroke="#482d12" stroke-width="2"/>
            <line x1="20" y1="20" x2="24" y2="24" stroke="#754e20" stroke-width="1.6"/>
            <line x1="80" y1="20" x2="76" y2="24" stroke="#754e20" stroke-width="1.6"/>
            <line x1="20" y1="80" x2="24" y2="76" stroke="#754e20" stroke-width="1.6"/>
            <line x1="80" y1="80" x2="76" y2="76" stroke="#754e20" stroke-width="1.6"/>
          </svg>

          <!-- Dial Branding & Displays -->
          <span class="stopwatch-brand">OVERDRIVE</span>
          <span class="stopwatch-mode-badge" data-mode-label>POMODORO</span>
          <span class="stopwatch-digital-time" data-digital-time>25:00</span>

          <!-- Real-Time Moving Clock Hands -->
          <div class="stopwatch-hands">
            <div class="stopwatch-hand hand-hour" data-hand-hour></div>
            <div class="stopwatch-hand hand-minute" data-hand-minute></div>
            <div class="stopwatch-hand hand-second" data-hand-second></div>
            <div class="stopwatch-pivot"></div>
          </div>
        </div>
      </div>

      <!-- Lower Floral Flourish (7-8 o'clock) -->
      <svg class="stopwatch-floral-motif" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M 12 12 C 12 4 4 4 4 12 C 4 20 12 20 12 12 Z" fill="url(#sw-flourish-gold)" stroke="#3a2007" stroke-width="0.8"/>
        <path d="M 12 12 C 20 12 20 4 12 4" stroke="#e8c274" stroke-width="1.2"/>
        <path d="M 12 12 C 12 20 20 20 20 12" stroke="#e8c274" stroke-width="1.2"/>
        <circle cx="12" cy="12" r="2.5" fill="#f7e19d" stroke="#3a2007" stroke-width="0.8"/>
        <defs>
          <linearGradient id="sw-flourish-gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fff5cc"/>
            <stop offset="50%" stop-color="#cca045"/>
            <stop offset="100%" stop-color="#69400e"/>
          </linearGradient>
        </defs>
      </svg>
    `;
  }

  function renderView() {
    const state = getState();
    const sw = state.stopwatch ?? DEFAULT_STOPWATCH;

    if (!watchEl) {
      watchEl = document.createElement('div');
      watchEl.className = 'desk-stopwatch';
      watchEl.setAttribute('role', 'button');
      watchEl.setAttribute('tabindex', '0');
      watchEl.setAttribute('aria-label', 'นาฬิกาพกโอเวอร์ไดรฟ์ คลิกเพื่อเริ่ม/พัก ดับเบิลคลิกเพื่อตั้งเวลา');
      watchEl.innerHTML = buildMarkup();
      canvas.appendChild(watchEl);
      bindEvents();
    }

    watchEl.style.left = `${sw.x}px`;
    watchEl.style.top = `${sw.y}px`;
    watchEl.classList.toggle('is-running', sw.status === 'running');
    watchEl.classList.toggle('is-completed', sw.status === 'completed');

    const modeLabel = watchEl.querySelector('[data-mode-label]');
    if (modeLabel) {
      modeLabel.textContent = sw.mode === 'pomodoro' ? 'FOCUS' : 'TIMER';
    }

    updateHandsAndDigital();
  }

  function updateHandsAndDigital() {
    if (!watchEl) return;
    const state = getState();
    const sw = state.stopwatch ?? DEFAULT_STOPWATCH;
    const time = getStopwatchTime(sw, Date.now());

    // Update hands rotations
    watchEl.style.setProperty('--second-rot', `${time.secondHandDeg}deg`);
    watchEl.style.setProperty('--minute-rot', `${time.minuteHandDeg}deg`);
    watchEl.style.setProperty('--hour-rot', `${time.hourHandDeg}deg`);

    // Update digital readout
    const digitalEl = watchEl.querySelector('[data-digital-time]');
    if (digitalEl) {
      digitalEl.textContent = time.formatted;
    }

    // Check if pomodoro finished
    if (sw.mode === 'pomodoro' && sw.status === 'running' && time.isFinished) {
      if (!alarmPlayed) {
        alarmPlayed = true;
        onCue('bell');
        const next = finishStopwatch(sw);
        commit(updateStopwatch(state, next));
      }
    } else if (sw.status !== 'completed') {
      alarmPlayed = false;
    }
  }

  const raf = cb => (typeof window?.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame(cb)
    : (globalThis.requestAnimationFrame ? globalThis.requestAnimationFrame(cb) : setTimeout(cb, 16)));
  const caf = id => (typeof window?.cancelAnimationFrame === 'function'
    ? window.cancelAnimationFrame(id)
    : (globalThis.cancelAnimationFrame ? globalThis.cancelAnimationFrame(id) : clearTimeout(id)));

  function startTickLoop() {
    if (rafId) caf(rafId);
    function tick() {
      const state = getState();
      const sw = state.stopwatch ?? DEFAULT_STOPWATCH;
      if (sw.status === 'running') {
        updateHandsAndDigital();
        rafId = raf(tick);
      } else {
        rafId = null;
        updateHandsAndDigital();
      }
    }
    rafId = raf(tick);
  }

  function handleCrownAction() {
    const state = getState();
    const sw = state.stopwatch ?? DEFAULT_STOPWATCH;
    onCue('paperweightDrop');

    if (sw.status === 'running') {
      const next = pauseStopwatch(sw, Date.now());
      commit(updateStopwatch(state, next));
    } else {
      const next = startStopwatch(sw, Date.now());
      commit(updateStopwatch(state, next));
      startTickLoop();
    }
    renderView();
  }

  function handlePusherAction() {
    const state = getState();
    const sw = state.stopwatch ?? DEFAULT_STOPWATCH;
    onCue('paperSlide');

    if (sw.status === 'running' || sw.status === 'paused' || sw.status === 'completed' || sw.accumulatedMs > 0) {
      const next = resetStopwatch(sw);
      commit(updateStopwatch(state, next));
    } else {
      // Toggle mode when already at 0
      const next = switchMode(sw);
      commit(updateStopwatch(state, next));
    }
    renderView();
  }

  function openInspectionDialog() {
    const state = getState();
    const sw = state.stopwatch ?? DEFAULT_STOPWATCH;
    const time = getStopwatchTime(sw, Date.now());
    const isPomodoro = sw.mode === 'pomodoro';
    const activeQuests = (state.items || []).filter(i => i.type === 'quest' && !i.archived);

    const dialogContent = `
      <div class="dialog-body stopwatch-dialog-body" id="stopwatch-dialog">
        <!-- Mode Tabs -->
        <div class="stopwatch-mode-tabs" role="tablist">
          <button type="button" class="stopwatch-mode-tab ${isPomodoro ? 'is-active' : ''}" data-set-mode="pomodoro">
            🍅 โหมดโฟกัส Pomodoro
          </button>
          <button type="button" class="stopwatch-mode-tab ${!isPomodoro ? 'is-active' : ''}" data-set-mode="stopwatch">
            ⏱️ โหมดจับเวลาเควส
          </button>
        </div>

        <!-- Big Dial Display -->
        <div class="stopwatch-dialog-view">
          <div class="stopwatch-large-display">
            <div class="stopwatch-large-dial">
              <span class="stopwatch-large-time" id="dialog-big-time">${escapeHtml(time.formatted)}</span>
            </div>
          </div>
        </div>

        <div class="stopwatch-dialog-controls">
          ${isPomodoro ? `
            <!-- Presets -->
            <div class="stopwatch-presets">
              ${PRESET_DURATIONS.map(p => `
                <button type="button" class="stopwatch-preset-btn ${sw.duration === p.seconds ? 'is-active' : ''}" data-preset-sec="${p.seconds}">
                  ${escapeHtml(p.label)}
                </button>
              `).join('')}
            </div>
          ` : ''}

          <!-- Quest Pinning -->
          <div class="stopwatch-quest-picker">
            <label for="sw-quest-select">ผูกเวลากับเควสที่กำลังทำ:</label>
            <select id="sw-quest-select" class="stopwatch-quest-select">
              <option value="">-- ไม่ผูกกับเควสใด (จับเวลาทั่วไป) --</option>
              ${activeQuests.map(q => `
                <option value="${escapeHtml(q.id)}" ${sw.pinnedQuestId === q.id ? 'selected' : ''}>
                  ${escapeHtml(q.title)} (${escapeHtml(q.category || 'ทั่วไป')})
                </option>
              `).join('')}
            </select>
          </div>

          <!-- Action Buttons -->
          <div class="stopwatch-primary-actions">
            ${sw.status === 'running' ? `
              <button type="button" class="stopwatch-action-btn btn-pause" data-sw-action="pause">
                ${icon('pause') || '⏸'} พักเวลา
              </button>
            ` : `
              <button type="button" class="stopwatch-action-btn btn-start" data-sw-action="start">
                ${icon('play') || '▶'} เริ่มจับเวลา
              </button>
            `}
            <button type="button" class="stopwatch-action-btn btn-reset" data-sw-action="reset">
              ${icon('restore') || '↺'} รีเซ็ต
            </button>
          </div>
        </div>
      </div>
    `;

    openDialog('นาฬิกาพกโอเวอร์ไดรฟ์', 'นาฬิกาพกมนตราจับเวลาและโฟกัสประจำโต๊ะกิลด์', dialogContent);

    // Bind dialog actions
    const modalEl = document.getElementById('stopwatch-dialog');
    if (!modalEl) return;

    modalEl.querySelectorAll('[data-set-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.setMode;
        const cur = getState().stopwatch ?? DEFAULT_STOPWATCH;
        commit(updateStopwatch(getState(), switchMode(cur, mode)));
        closeDialog();
        renderView();
        openInspectionDialog();
      });
    });

    modalEl.querySelectorAll('[data-preset-sec]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sec = Number(btn.dataset.presetSec);
        const cur = getState().stopwatch ?? DEFAULT_STOPWATCH;
        commit(updateStopwatch(getState(), setDuration(cur, sec)));
        closeDialog();
        renderView();
        openInspectionDialog();
      });
    });

    modalEl.querySelector('#sw-quest-select')?.addEventListener('change', e => {
      const qid = e.target.value;
      const cur = getState().stopwatch ?? DEFAULT_STOPWATCH;
      commit(updateStopwatch(getState(), pinQuest(cur, qid)));
      renderView();
    });

    modalEl.querySelector('[data-sw-action="start"]')?.addEventListener('click', () => {
      handleCrownAction();
      closeDialog();
    });

    modalEl.querySelector('[data-sw-action="pause"]')?.addEventListener('click', () => {
      handleCrownAction();
      closeDialog();
    });

    modalEl.querySelector('[data-sw-action="reset"]')?.addEventListener('click', () => {
      const cur = getState().stopwatch ?? DEFAULT_STOPWATCH;
      commit(updateStopwatch(getState(), resetStopwatch(cur)));
      closeDialog();
      renderView();
    });
  }

  function bindEvents() {
    if (!watchEl) return;

    // Direct clicks on crown knob / pusher
    watchEl.addEventListener('click', e => {
      if (hasMoved) return;
      const crown = e.target.closest('[data-action="crown"]');
      if (crown) {
        e.stopPropagation();
        handleCrownAction();
        return;
      }
      const pusher = e.target.closest('[data-action="pusher"]');
      if (pusher) {
        e.stopPropagation();
        handlePusherAction();
        return;
      }

      // Clicking watch dial opens control dialog
      openInspectionDialog();
    });

    // Keyboard support
    watchEl.addEventListener('keydown', e => {
      const cur = getState().stopwatch ?? DEFAULT_STOPWATCH;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          openInspectionDialog();
        } else {
          handleCrownAction();
        }
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handlePusherAction();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        commit(updateStopwatch(getState(), switchMode(cur)));
        renderView();
      } else if (e.key.startsWith('Arrow') && e.shiftKey) {
        e.preventDefault();
        const step = 20;
        let dx = 0, dy = 0;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;
        const nextX = Math.max(10, Math.min(3000, cur.x + dx));
        const nextY = Math.max(10, Math.min(3000, cur.y + dy));
        commit(updateStopwatch(getState(), { x: nextX, y: nextY }));
        renderView();
      }
    });

    // Pointer Dragging
    watchEl.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      if (e.target.closest('[data-action="crown"]') || e.target.closest('[data-action="pusher"]')) {
        return;
      }

      isDragging = true;
      hasMoved = false;
      pointerStart = { x: e.clientX, y: e.clientY };
      const cur = getState().stopwatch ?? DEFAULT_STOPWATCH;
      initialPos = { x: cur.x, y: cur.y };

      watchEl.setPointerCapture(e.pointerId);
      watchEl.classList.add('is-dragging');
      watchEl.style.setProperty('--lift', '2.5');
    });

    watchEl.addEventListener('pointermove', e => {
      if (!isDragging) return;
      const dx = e.clientX - pointerStart.x;
      const dy = e.clientY - pointerStart.y;
      if (Math.hypot(dx, dy) > 4) {
        hasMoved = true;
      }

      const nextX = Math.max(10, Math.min(3000, initialPos.x + dx));
      const nextY = Math.max(10, Math.min(3000, initialPos.y + dy));
      watchEl.style.left = `${nextX}px`;
      watchEl.style.top = `${nextY}px`;
    });

    const finishDrag = e => {
      if (!isDragging) return;
      isDragging = false;
      watchEl.classList.remove('is-dragging');
      watchEl.style.setProperty('--lift', '1');

      try {
        watchEl.releasePointerCapture(e.pointerId);
      } catch {}

      if (hasMoved) {
        onCue('paperweightDrop');
        const curX = parseInt(watchEl.style.left, 10) || initialPos.x;
        const curY = parseInt(watchEl.style.top, 10) || initialPos.y;
        commit(updateStopwatch(getState(), { x: curX, y: curY }));

        if (!isReduced()) {
          animateTransient(
            watchEl,
            [
              { transform: 'translateY(-6px) scale(1.03)', opacity: 0.9 },
              { transform: 'translateY(2px) scale(0.98)', offset: 0.6 },
              { transform: 'none', opacity: 1 },
            ],
            { duration: 200, easing: 'ease-out' }
          );
        }
      }
    };

    watchEl.addEventListener('pointerup', finishDrag);
    watchEl.addEventListener('pointercancel', finishDrag);
  }

  // Initial render
  renderView();
  const initialSw = getState().stopwatch ?? DEFAULT_STOPWATCH;
  if (initialSw.status === 'running') {
    startTickLoop();
  }

  return {
    get element() {
      return watchEl;
    },
    update() {
      renderView();
      const sw = getState().stopwatch ?? DEFAULT_STOPWATCH;
      if (sw.status === 'running' && !rafId) {
        startTickLoop();
      }
    },
    destroy() {
      if (rafId) {
        caf(rafId);
        rafId = null;
      }
      if (watchEl) {
        watchEl.remove();
        watchEl = null;
      }
    },
  };
}
