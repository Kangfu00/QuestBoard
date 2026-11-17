import {
  ensureDailyBook,
  addDailyTask,
  tallyDailyTask,
  resetDailyTaskCount,
  resetAllDailyTaskCounts,
  splitTallyBundles,
  todayIsoDate,
} from './daily-book-model.mjs';
import { animateTransient } from './desk-motion.mjs';

const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[c]));

const PRESET_CHORES = Object.freeze([
  { title: 'ล้างจาน', note: 'หลังมื้ออาหาร' },
  { title: 'กวาดห้อง', note: 'ดูแลพื้นห้องให้สะอาด' },
  { title: 'ทิ้งขยะ', note: 'มัดถุงและนำไปทิ้ง' },
  { title: 'ซักผ้า', note: 'ซักและตากผ้า' },
  { title: 'เช็ดโต๊ะทำงาน', note: 'จัดระเบียบมุมทำงาน' },
  { title: 'ฝึกวาดรูป', note: 'สะสมชั่วโมงฝึกฝน' },
]);

export function tallyEmblemSvg() {
  return `<svg viewBox="0 0 44 26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
    <path d="M8 4v18M16 3.5v19M24 4.2v18M32 3.8v18.4"/>
    <path d="M4 20L36 6" stroke-width="2.6"/>
  </svg>`;
}

export function renderTallyBundleSvg(strokes, { freshLast = false } = {}) {
  const verticals = [
    'M7 4.5 L6.4 23.5',
    'M15 4 L15.5 23.8',
    'M23 4.4 L22.6 23.4',
    'M31 4.1 L31.4 23.6',
  ];
  const count = Math.max(1, Math.min(5, strokes));
  const verticalCount = Math.min(4, count);
  const paths = [];
  for (let i = 0; i < verticalCount; i++) {
    const isFresh = freshLast && count < 5 && i === verticalCount - 1;
    paths.push(`<path class="tally-stroke${isFresh ? ' is-fresh-stroke' : ''}" d="${verticals[i]}"/>`);
  }
  if (count === 5) {
    paths.push(`<path class="tally-slash${freshLast ? ' is-fresh-stroke' : ''}" d="M3.5 20.5 L35.5 6.2"/>`);
  }
  return `<svg class="tally-bundle" viewBox="0 0 39 28" aria-hidden="true">${paths.join('')}</svg>`;
}

export function renderTallyMarks(count, { fresh = false } = {}) {
  const bundles = splitTallyBundles(count);
  if (!bundles.length) {
    return '<span class="daily-tally-empty">ยังไม่มีรอยขีด · คลิกช่องนี้เพื่อขีดนับแรก ( | )</span>';
  }
  return bundles
    .map((strokes, index) => renderTallyBundleSvg(strokes, { freshLast: fresh && index === bundles.length - 1 }))
    .join('');
}

export function renderDailyBookCover(book, { icon }) {
  const totalCount = book.tasks.reduce((sum, task) => sum + task.count, 0);
  const preview = book.tasks.slice(0, 3);
  return `<article class="board-daily-book board-item book-${esc(book.color)}" data-daily-book="1" style="left:${book.x}px;top:${book.y}px;--rotation:${book.rotation}deg;z-index:${book.z}" aria-label="สมุดงานประจำวัน ${esc(book.title)}">
    <div class="daily-book-grip drag-handle" role="button" tabindex="0" data-daily-book-drag="1" aria-label="ลากสมุด ${esc(book.title)} หรือกด Enter เพื่อเปิดอ่าน">
      <span>${icon('grip')} สมุดบันทึกกิลด์</span>
      <small>${book.tasks.length} งาน</small>
    </div>
    <button type="button" class="daily-book-cover-btn" data-open-daily-book="1" aria-label="เปิดสมุด ${esc(book.title)}">
      <span class="daily-book-emblem">${tallyEmblemSvg()}</span>
      <strong class="daily-book-title">${esc(book.title)}</strong>
      <span class="daily-book-subtitle">${esc(book.subtitle || 'ขีดนับงานที่ทำซ้ำทุกวัน')}</span>
      <span class="daily-book-stats-pill">${book.tasks.length} รายการ · ${totalCount} ขีด</span>
      <div class="daily-book-preview-list">
        ${preview.length
          ? preview.map(task => `<div class="daily-book-preview-row"><span>• ${esc(task.title)}</span><b>${task.count} ขีด</b></div>`).join('')
          : '<div class="daily-book-preview-row"><span>คลิกเพื่อเพิ่มงานประจำวัน</span><b>+</b></div>'}
      </div>
    </button>
    <div class="daily-book-footer">
      <button type="button" data-edit-daily-book="1" aria-label="แก้ไขปกสมุด ${esc(book.title)}">${icon('edit')}ปกสมุด</button>
      <button type="button" data-toggle-daily-book-archive="1" aria-label="${book.archived ? 'นำสมุดวางบนโต๊ะ' : 'เก็บสมุดเข้าลิ้นชัก'}">${icon(book.archived ? 'restore' : 'archive')}${book.archived ? 'วางบนโต๊ะ' : 'เก็บเข้าถาด'}</button>
    </div>
  </article>`;
}

export function createDailyBookWindow({
  document = globalThis.document,
  windows,
  getState,
  onCommit,
  onEditMeta,
  onEditTask,
  onDeleteTask,
  icon,
  onCue = () => {},
  reducedMotion = () => false,
} = {}) {
  let panel = null;
  let handle = null;
  let search = '';
  let lastFreshTaskId = null;
  let colorClass = null;

  function isOpen() {
    return !!panel && !panel.hidden && panel.style.display !== 'none' && panel.isConnected !== false;
  }

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement('section');
    panel.hidden = true;
    panel.style.display = 'none';
    panel.className = 'daily-book-window';
    panel.setAttribute('aria-label', 'สมุดบันทึกงานประจำวัน');
    panel.innerHTML = `
      <section class="daily-book-page daily-book-left">
        <header class="daily-book-header">
          <div class="daily-book-heading">
            <span class="daily-book-eyebrow">DAILY TALLY LEDGER · สมุดขีดนับประจำกิลด์</span>
            <h2 id="daily-book-window-title"></h2>
            <small id="daily-book-window-subtitle"></small>
          </div>
          <div class="daily-book-header-actions">
            <button type="button" class="icon-button" data-daily-action="edit-meta" title="แก้ไขชื่อและสีปกสมุด" aria-label="แก้ไขปกสมุด">${icon('edit')}</button>
            <button type="button" class="icon-button" data-daily-action="toggle-archive" id="daily-book-archive-btn" title="สลับที่เก็บสมุด" aria-label="เก็บหรือวางสมุดบนโต๊ะ">${icon('archive')}</button>
            <button type="button" class="icon-button" data-daily-action="close" data-action="close-daily-book" title="ปิดสมุด (Esc)" aria-label="ปิดสมุด">${icon('cross')}</button>
          </div>
        </header>
        <div class="daily-book-summary">
          <div class="daily-summary-card"><span>ขีดรอบนี้รวม</span><strong id="daily-sum-current">0 ขีด</strong></div>
          <div class="daily-summary-card"><span>ทำวันนี้</span><strong id="daily-sum-today">0 งาน</strong></div>
          <div class="daily-summary-card"><span>ขีดสะสมทั้งหมด</span><strong id="daily-sum-total">0 ขีด</strong></div>
        </div>
        <form class="daily-add-form" id="daily-add-form">
          <div class="daily-add-form-row">
            <input type="text" name="title" maxlength="80" required placeholder="เพิ่มงานที่ทำซ้ำ เช่น ล้างจาน, กวาดห้อง…" aria-label="ชื่องานประจำวัน">
            <button type="submit" class="daily-btn primary-tally">${icon('plus')}เพิ่มงาน</button>
          </div>
          <div class="daily-add-form-row">
            <input type="text" name="note" maxlength="160" placeholder="หมายเหตุสั้น ๆ (เช่น หลังอาหาร, ทุกเย็น)" aria-label="หมายเหตุงานประจำวัน">
          </div>
          <div class="daily-presets" id="daily-presets"></div>
        </form>
        <label class="drawer-search">${icon('search')}<input id="daily-book-search" type="search" placeholder="ค้นหางานในสมุด…" aria-label="ค้นหางานในสมุด"></label>
        <div class="daily-left-tools">
          <small>คลิกที่ช่องขีดนับ หรือกด “+ ขีด” เพื่อขีดทีละเส้น (ครบ 5 เส้นจะคาดทับเป็นมัด 卌)</small>
          <button type="button" class="daily-btn" data-daily-action="reset-all" id="daily-reset-all-btn">${icon('restore')}ล้างขีดทั้งหมดเพื่อเริ่มรอบใหม่</button>
        </div>
      </section>
      <section class="daily-book-page daily-book-right" aria-label="หน้ากระดาษขีดนับงานประจำ">
        <div class="daily-sheet-header">
          <div class="daily-sheet-header-title">
            <strong>รายการขีดนับงานประจำวัน</strong>
            <small id="daily-sheet-count">0 รายการ</small>
          </div>
          <button type="button" class="icon-button" data-daily-action="close" data-action="close-daily-book" title="ปิดสมุด (Esc)" aria-label="ปิดสมุด">${icon('cross')}</button>
        </div>
        <div class="daily-task-list" id="daily-task-list"></div>
      </section>
    `;
    document.body.append(panel);

    const addForm = panel.querySelector('#daily-add-form');
    addForm.addEventListener('submit', event => {
      event.preventDefault();
      const formData = new FormData(addForm);
      const title = String(formData.get('title') ?? '').trim();
      const note = String(formData.get('note') ?? '').trim();
      if (!title) return;
      const next = addDailyTask(getState(), { title, note });
      addForm.reset();
      try { onCue('pen'); } catch {}
      onCommit(next, `เพิ่ม “${title}” ลงในสมุดแล้ว`);
      panel.querySelector('#daily-add-form input[name="title"]')?.focus({ preventScroll: true });
    });

    const searchInput = panel.querySelector('#daily-book-search');
    searchInput.addEventListener('input', event => {
      search = event.target.value;
      render();
    });

    panel.addEventListener('click', event => {
      const presetBtn = event.target.closest('[data-daily-preset]');
      if (presetBtn) {
        const title = presetBtn.dataset.dailyPreset;
        const note = presetBtn.dataset.dailyPresetNote || '';
        const next = addDailyTask(getState(), { title, note });
        try { onCue('pen'); } catch {}
        onCommit(next, `เพิ่ม “${title}” ลงในสมุดแล้ว`);
        return;
      }

      const addBtn = event.target.closest('[data-tally-add]');
      if (addBtn) {
        const taskId = addBtn.dataset.tallyAdd;
        lastFreshTaskId = taskId;
        const next = tallyDailyTask(getState(), taskId, 1, todayIsoDate());
        try { onCue('pen'); } catch {}
        onCommit(next);
        lastFreshTaskId = null;
        return;
      }

      const subBtn = event.target.closest('[data-tally-sub]');
      if (subBtn) {
        const taskId = subBtn.dataset.tallySub;
        lastFreshTaskId = null;
        const next = tallyDailyTask(getState(), taskId, -1, todayIsoDate());
        try { onCue('paperSlide'); } catch {}
        onCommit(next);
        return;
      }

      const resetBtn = event.target.closest('[data-tally-reset]');
      if (resetBtn) {
        const taskId = resetBtn.dataset.tallyReset;
        lastFreshTaskId = null;
        const next = resetDailyTaskCount(getState(), taskId);
        try { onCue('paperFlip'); } catch {}
        onCommit(next, 'ล้างขีดของรายการนี้แล้ว');
        return;
      }

      const editBtn = event.target.closest('[data-tally-edit]');
      if (editBtn) {
        onEditTask?.(editBtn.dataset.tallyEdit);
        return;
      }

      const deleteBtn = event.target.closest('[data-tally-delete]');
      if (deleteBtn) {
        onDeleteTask?.(deleteBtn.dataset.tallyDelete);
        return;
      }

      const actionBtn = event.target.closest('[data-daily-action]');
      if (!actionBtn) return;
      const action = actionBtn.dataset.dailyAction;
      if (action === 'close') {
        close({ animate: true, returnFocus: true });
      } else if (action === 'edit-meta') {
        onEditMeta?.();
      } else if (action === 'toggle-archive') {
        const current = ensureDailyBook(getState()).dailyBook;
        const nextArchived = !current.archived;
        onCommit(
          { ...getState(), dailyBook: { ...current, archived: nextArchived } },
          nextArchived ? 'เก็บสมุดเข้าลิ้นชักแล้ว' : 'นำสมุดวางบนโต๊ะแล้ว',
        );
      } else if (action === 'reset-all') {
        const current = ensureDailyBook(getState()).dailyBook;
        if (!current.tasks.some(t => t.count > 0)) return;
        const next = resetAllDailyTaskCounts(getState());
        try { onCue('paperUnfold'); } catch {}
        onCommit(next, 'เริ่มรอบใหม่ · ล้างขีดบนหน้ากระดาษแล้ว (ขีดสะสมรวมยังอยู่ครบ)');
      }
    });

    return panel;
  }

  function render() {
    if (!panel) return;
    const state = ensureDailyBook(getState());
    const book = state.dailyBook;
    if (colorClass) panel.classList.remove(colorClass);
    colorClass = `book-${book.color}`;
    panel.classList.add(colorClass);

    panel.querySelector('#daily-book-window-title').textContent = book.title;
    panel.querySelector('#daily-book-window-subtitle').textContent = book.subtitle || 'ขีดนับกิจวัตรประจำวันของนักผจญภัย';

    const archiveBtn = panel.querySelector('#daily-book-archive-btn');
    archiveBtn.innerHTML = icon(book.archived ? 'restore' : 'archive');
    archiveBtn.setAttribute('title', book.archived ? 'นำสมุดขึ้นวางบนโต๊ะ' : 'เก็บสมุดเข้าลิ้นชัก');

    const today = todayIsoDate();
    const totalCurrent = book.tasks.reduce((sum, task) => sum + task.count, 0);
    const totalLifetime = book.tasks.reduce((sum, task) => sum + task.totalCount, 0);
    const doneToday = book.tasks.filter(task => task.lastTalliedAt === today && task.count > 0).length;

    panel.querySelector('#daily-sum-current').textContent = `${totalCurrent.toLocaleString()} ขีด`;
    panel.querySelector('#daily-sum-today').textContent = `${doneToday} / ${book.tasks.length} งาน`;
    panel.querySelector('#daily-sum-total').textContent = `${totalLifetime.toLocaleString()} ขีด`;
    panel.querySelector('#daily-reset-all-btn').disabled = totalCurrent === 0;

    const existingTitles = new Set(book.tasks.map(t => t.title.trim()));
    const availablePresets = PRESET_CHORES.filter(p => !existingTitles.has(p.title));
    const presetsEl = panel.querySelector('#daily-presets');
    presetsEl.innerHTML = availablePresets.length
      ? `<small>เพิ่มด่วน:</small>` + availablePresets.map(p =>
          `<button type="button" class="daily-preset-chip" data-daily-preset="${esc(p.title)}" data-daily-preset-note="${esc(p.note)}">+ ${esc(p.title)}</button>`
        ).join('')
      : '';

    const query = search.trim().toLocaleLowerCase('th');
    const filtered = book.tasks.filter(task =>
      !query || `${task.title}\n${task.note}`.toLocaleLowerCase('th').includes(query)
    );
    panel.querySelector('#daily-sheet-count').textContent = `${filtered.length} รายการ`;

    const listEl = panel.querySelector('#daily-task-list');
    const scrollTop = listEl.scrollTop;
    if (!filtered.length) {
      listEl.innerHTML = `<div class="folder-empty">${icon('scroll')}<p>${query ? 'ไม่พบงานประจำที่ค้นหา' : 'สมุดยังไม่มีรายการงานประจำ'}</p><small>${query ? 'ลองค้นหาด้วยคำอื่น' : 'พิมพ์ชื่องานทางหน้าซ้าย เช่น ล้างจาน หรือ กวาดห้อง แล้วกดเพิ่มงานได้เลย'}</small></div>`;
    } else {
      listEl.innerHTML = filtered.map((task, idx) => {
        const isToday = task.lastTalliedAt === today && task.count > 0;
        const fresh = lastFreshTaskId === task.id && !reducedMotion();
        return `<article class="daily-task-row" data-daily-task-id="${esc(task.id)}">
          <span class="daily-task-row-number">${String(idx + 1).padStart(2, '0')}</span>
          <div class="daily-task-top">
            <div class="daily-task-title-group">
              <strong class="daily-task-title">${esc(task.title)}</strong>
              ${task.note ? `<span class="daily-task-note">· ${esc(task.note)}</span>` : ''}
            </div>
            <div class="daily-task-badges">
              ${isToday ? '<span class="daily-today-dot">✓ ขีดวันนี้แล้ว</span>' : ''}
              <span class="daily-count-badge">${task.count} ขีด</span>
              ${task.totalCount > task.count ? `<span class="daily-total-badge">(สะสม ${task.totalCount})</span>` : ''}
            </div>
          </div>
          <button type="button" class="daily-tally-canvas" data-tally-add="${esc(task.id)}" title="คลิกเพื่อขีดนับเพิ่ม 1 ขีด" aria-label="ขีดนับ ${esc(task.title)} ปัจจุบัน ${task.count} ขีด คลิกเพื่อขีดเพิ่ม">
            ${renderTallyMarks(task.count, { fresh })}
          </button>
          <div class="daily-task-controls">
            <div class="daily-task-controls-left">
              <button type="button" class="daily-btn primary-tally" data-tally-add="${esc(task.id)}">${icon('feather')}+ ขีดนับ</button>
              <button type="button" class="daily-btn" data-tally-sub="${esc(task.id)}" ${task.count === 0 ? 'disabled' : ''} title="ลด 1 ขีด">-1</button>
              <button type="button" class="daily-btn" data-tally-reset="${esc(task.id)}" ${task.count === 0 ? 'disabled' : ''} title="ล้างขีดของแถวนี้เป็น 0">ล้างขีด</button>
            </div>
            <div class="daily-task-controls-right">
              <button type="button" class="daily-btn" data-tally-edit="${esc(task.id)}" aria-label="แก้ไข ${esc(task.title)}">${icon('edit')}แก้ไข</button>
              <button type="button" class="daily-btn" data-tally-delete="${esc(task.id)}" aria-label="ลบ ${esc(task.title)}">${icon('trash')}</button>
            </div>
          </div>
        </article>`;
      }).join('');
    }
    listEl.scrollTop = scrollTop;
  }

  function open({ focus = true } = {}) {
    const el = ensurePanel();
    const wasOpen = isOpen();
    el.hidden = false;
    el.style.display = '';
    render();
    if (!handle) {
      handle = windows?.register(el, {
        key: 'daily-book',
        handle: '.daily-book-header',
        onEscape: () => close({ animate: true, returnFocus: true }),
      });
    }
    handle?.raise();
    if (!wasOpen) {
      try { onCue('folderOpen'); } catch {}
      if (!reducedMotion()) {
        animateTransient(
          el,
          [
            { transform: 'scale(0.95) translateY(8px)', opacity: 0.4 },
            { transform: 'scale(1) translateY(0)', opacity: 1 },
          ],
          { duration: 220, easing: 'cubic-bezier(.2,.8,.3,1)' },
        );
      }
    }
    if (focus) {
      el.querySelector('#daily-add-form input[name="title"]')?.focus({ preventScroll: true });
    }
    return el;
  }

  function close({ animate = false, returnFocus = false } = {}) {
    if (!isOpen()) {
      if (panel) {
        panel.hidden = true;
        panel.style.display = 'none';
      }
      return false;
    }
    handle?.cancelDrag();
    panel.hidden = true;
    panel.style.display = 'none';
    if (animate) {
      try { onCue('folderClose'); } catch {}
    }
    if (returnFocus) {
      (document.querySelector('[data-open-daily-book]') || document.querySelector('[data-action="open-daily-book"]'))?.focus({ preventScroll: true });
    }
    return true;
  }

  return {
    open,
    close,
    render,
    get isOpen() {
      return isOpen();
    },
  };
}
