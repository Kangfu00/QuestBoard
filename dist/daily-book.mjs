import {
  ensureDailyBook,
  addDailyTask,
  tallyDailyTask,
  splitTallyBundles,
  todayIsoDate,
} from './daily-book-model.mjs';
import { leatherDyeMarkup, paintLeatherDye } from './leather-colors.mjs';
import { fastForwardAnimations } from './desk-motion.mjs';

const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[c]));

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
    return '<span class="daily-tally-empty" aria-hidden="true">—</span>';
  }
  return bundles
    .map((strokes, index) => renderTallyBundleSvg(strokes, { freshLast: fresh && index === bundles.length - 1 }))
    .join('');
}

export function renderDailyBookCover(book, { icon }) {
  const dye = leatherDyeMarkup(book.color);
  return `<article class="board-daily-book board-item book-${esc(book.color)}"${dye.attributes} data-daily-book="1" ${book.archived ? 'data-storage-id="daily-book"' : ''} style="left:${book.x}px;top:${book.y}px;${dye.style}--rotation:${book.rotation}deg;z-index:${book.z}" tabindex="0" role="button" data-daily-book-drag="1" data-open-daily-book="1" aria-label="สมุดงานประจำวัน ${esc(book.title)}">
    <div class="daily-book-pages-edge" aria-hidden="true"></div>
    <div class="daily-book-front">
      <div class="daily-book-cover-frame" aria-hidden="true"></div>
      <div class="daily-book-cover-content">
        <span class="daily-book-emblem" aria-hidden="true">${tallyEmblemSvg()}</span>
        <strong class="daily-book-title">${esc(book.title)}</strong>
      </div>
      <div class="daily-book-footer">
        <button type="button" class="daily-book-action-icon-btn" data-edit-daily-book="1" title="เปลี่ยนชื่อและสีปกสมุด" aria-label="เปลี่ยนชื่อและสีปกสมุด">${icon('edit')}</button>
        <button type="button" class="daily-book-action-icon-btn" data-toggle-daily-book-archive="1" title="${book.archived ? 'นำสมุดวางบนโต๊ะ' : 'เก็บสมุดเข้าลิ้นชัก'}" aria-label="${book.archived ? 'นำสมุดวางบนโต๊ะ' : 'เก็บสมุดเข้าลิ้นชัก'}">${icon(book.archived ? 'restore' : 'archive')}</button>
      </div>
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
      <div class="daily-book-window-cover" aria-hidden="true">
        <div class="daily-book-cover-outer">
          <div class="daily-book-cover-frame"></div>
          <div class="daily-book-cover-content">
            <span class="daily-book-emblem">${tallyEmblemSvg()}</span>
            <strong class="daily-book-title" id="daily-book-unfolding-title"></strong>
          </div>
        </div>
        <div class="daily-book-cover-inner"></div>
      </div>
      <section class="daily-book-page daily-book-left">
        <header class="daily-book-header">
          <div class="daily-book-heading">
            <span class="daily-book-ink-emblem" aria-hidden="true">${tallyEmblemSvg()}</span>
            <h2 id="daily-book-window-title"></h2>
          </div>
          <div class="daily-book-header-actions">
            <button type="button" class="icon-button" data-daily-action="edit-meta" title="แก้ไขชื่อและสีปกสมุด" aria-label="แก้ไขปกสมุด">${icon('edit')}</button>
            <button type="button" class="icon-button" data-daily-action="toggle-archive" id="daily-book-archive-btn" title="สลับที่เก็บสมุด" aria-label="เก็บหรือวางสมุดบนโต๊ะ">${icon('archive')}</button>
            <button type="button" class="icon-button" data-daily-action="close" data-action="close-daily-book" title="ปิดสมุด (Esc)" aria-label="ปิดสมุด">${icon('cross')}</button>
          </div>
        </header>
        <form class="daily-add-form" id="daily-add-form">
          <label for="daily-new-task">จดงานลงสมุด</label>
          <div class="daily-add-form-row">
            <input id="daily-new-task" type="text" name="title" maxlength="80" required placeholder="ชื่องาน…">
            <button type="submit" class="daily-btn">${icon('edit')}จดลงสมุด</button>
          </div>
        </form>
        <label class="daily-book-search">${icon('search')}<input id="daily-book-search" type="search" placeholder="ค้นหาในสมุด…" aria-label="ค้นหาในสมุด"></label>
        <div class="daily-left-tools">
          <small>คลิกซ้ายเพิ่มขีด · คลิกขวาลบขีด</small>
        </div>
      </section>
      <section class="daily-book-page daily-book-right" aria-label="หน้ากระดาษขีดนับงานประจำ">
        <div class="daily-sheet-header">
          <div class="daily-sheet-header-title">
            <h3>บันทึกขีดนับ</h3>
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
      if (!title) return;
      const next = addDailyTask(getState(), { title });
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

    panel.addEventListener('contextmenu', event => {
      const stepTarget = event.target.closest('[data-tally-step]');
      if (stepTarget) {
        event.preventDefault();
        event.stopPropagation();
        const taskId = stepTarget.dataset.taskId || stepTarget.closest('[data-daily-task-id]')?.dataset.dailyTaskId;
        if (!taskId) return;
        lastFreshTaskId = null;
        const next = tallyDailyTask(getState(), taskId, -1, todayIsoDate());
        try { onCue('paperSlide'); } catch {}
        onCommit(next);
      }
    });

    panel.addEventListener('click', event => {
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

      const stepTarget = event.target.closest('[data-tally-step]');
      if (stepTarget) {
        const taskId = stepTarget.dataset.taskId || stepTarget.closest('[data-daily-task-id]')?.dataset.dailyTaskId;
        if (!taskId) return;
        lastFreshTaskId = taskId;
        const next = tallyDailyTask(getState(), taskId, 1, todayIsoDate());
        try { onCue('pen'); } catch {}
        onCommit(next);
        lastFreshTaskId = null;
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
    paintLeatherDye(panel, book.color);

    panel.querySelector('#daily-book-window-title').textContent = book.title;
    const unfoldingTitle = panel.querySelector('#daily-book-unfolding-title');
    if (unfoldingTitle) unfoldingTitle.textContent = book.title;

    const archiveBtn = panel.querySelector('#daily-book-archive-btn');
    if (archiveBtn) {
      archiveBtn.innerHTML = icon(book.archived ? 'restore' : 'archive');
      archiveBtn.setAttribute('title', book.archived ? 'นำสมุดขึ้นวางบนโต๊ะ' : 'เก็บสมุดเข้าลิ้นชัก');
    }

    const query = search.trim().toLocaleLowerCase('th');
    const filtered = book.tasks.filter(task =>
      !query || `${task.title}\n${task.note}`.toLocaleLowerCase('th').includes(query)
    );
    panel.querySelector('#daily-sheet-count').textContent = `${filtered.length} รายการ`;

    const listEl = panel.querySelector('#daily-task-list');
    const scrollTop = listEl.scrollTop;
    if (!filtered.length) {
      listEl.innerHTML = `<div class="daily-book-empty">${icon(query ? 'search' : 'scroll')}<p>${query ? 'ไม่พบงานในสมุด' : 'ยังไม่มีงานในสมุด'}</p><small>${query ? 'ลองค้นหาด้วยคำอื่น' : 'จดงานแรกเพื่อเริ่มขีดนับ'}</small></div>`;
    } else {
      listEl.innerHTML = filtered.map(task => {
        const fresh = lastFreshTaskId === task.id && !reducedMotion();
        return `<article class="daily-task-row" data-daily-task-id="${esc(task.id)}">
          <button type="button" class="daily-task-name-btn" data-tally-step="1" data-task-id="${esc(task.id)}" title="คลิกซ้าย: +1 ขีด · คลิกขวา: -1 ขีด" aria-label="${esc(task.title)} ปัจจุบัน ${task.count} ขีด">
            <span class="daily-task-name">${esc(task.title)}</span>
          </button>
          <div class="daily-task-tally" data-tally-step="1" data-task-id="${esc(task.id)}" title="คลิกซ้าย: +1 ขีด · คลิกขวา: -1 ขีด">
            ${renderTallyMarks(task.count, { fresh })}
          </div>
          <div class="daily-task-actions">
            <button type="button" class="icon-button daily-task-action-btn" data-tally-edit="${esc(task.id)}" title="เปลี่ยนชื่อ ${esc(task.title)}" aria-label="เปลี่ยนชื่อ">${icon('edit')}</button>
            <button type="button" class="icon-button daily-task-action-btn delete-action" data-tally-delete="${esc(task.id)}" title="ลบ ${esc(task.title)}" aria-label="ลบ">${icon('cross')}</button>
          </div>
        </article>`;
      }).join('');
    }
    listEl.scrollTop = scrollTop;
  }

  function open({ focus = true } = {}) {
    const el = ensurePanel();
    const wasOpen = isOpen();
    render();
    if (!wasOpen && !reducedMotion()) {
      el.classList.add('is-unfolding');
    }
    el.hidden = false;
    el.style.display = '';
    if (!handle) {
      handle = windows?.register(el, {
        key: 'daily-book',
        handle: '.daily-book-header',
        onEscape: () => close({ animate: true, returnFocus: true }),
      });
    }
    handle?.raise();
    if (!wasOpen) {
      try { onCue('cordUntie'); } catch {}
      try { onCue('folderOpen', { delay: 180 }); } catch {}
      if (!reducedMotion()) {
        setTimeout(() => el.classList.remove('is-unfolding'), 740);
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
        panel.classList.remove('is-unfolding');
      }
      return false;
    }
    if (panel.classList.contains('is-unfolding')) {
      fastForwardAnimations(panel, 4);
    }
    handle?.cancelDrag();
    if (animate && !reducedMotion() && typeof panel.animate === 'function' && document?.body) {
      try { onCue('folderClose'); } catch {}
      try { onCue('cordTie', { delay: 480 }); } catch {}
      const rect = panel.getBoundingClientRect();
      const ghost = panel.cloneNode(true);
      ghost.inert = true;
      ghost.setAttribute('aria-hidden', 'true');
      ghost.classList.remove('is-unfolding');
      ghost.classList.add('daily-book-closing-ghost');
      Object.assign(ghost.style, {
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: '0',
        pointerEvents: 'none',
        zIndex: '9999',
      });
      document.body.append(ghost);
      setTimeout(() => ghost.remove(), 700);
    } else if (animate) {
      try { onCue('folderClose'); } catch {}
    }
    panel.hidden = true;
    panel.style.display = 'none';
    panel.classList.remove('is-unfolding');
    if (returnFocus) {
      document.querySelector('[data-open-daily-book]')?.focus({ preventScroll: true });
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
