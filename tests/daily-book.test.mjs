import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  validateState,
  serializeState,
  parseState,
  ensureDailyBook,
  updateDailyBookMeta,
  addDailyTask,
  updateDailyTask,
  deleteDailyTask,
  tallyDailyTask,
  resetDailyTaskCount,
  resetAllDailyTaskCounts,
  DAILY_BOOK_SIZE,
  splitTallyBundles,
} from '../dist/model.mjs';
import { storageTrayAccepts, drawerForDraggedItem } from '../dist/interactions.mjs';
import { renderTallyMarks, renderDailyBookCover, createDailyBookWindow } from '../dist/daily-book.mjs';

const dataKey = name => name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
class TestElement {
  constructor(tagName = 'div', document) {
    this.tagName = tagName;
    this.ownerDocument = document;
    this.children = [];
    this.parentNode = null;
    this.attrs = new Map();
    this.dataset = {};
    this.listeners = new Map();
    this.style = { display: '' };
    this.hidden = false;
    this.classList = {
      contains: name => (this.attrs.get('class') ?? '').split(/\s+/).includes(name),
      add: (...names) => {
        const cur = (this.attrs.get('class') ?? '').split(/\s+/).filter(Boolean);
        this.attrs.set('class', [...new Set([...cur, ...names])].join(' '));
      },
      remove: (...names) => {
        const cur = (this.attrs.get('class') ?? '').split(/\s+/).filter(Boolean);
        this.attrs.set('class', cur.filter(n => !names.includes(n)).join(' '));
      },
    };
  }
  get className() { return this.attrs.get('class') ?? ''; }
  set className(value) { this.attrs.set('class', value); }
  get id() { return this.attrs.get('id') ?? ''; }
  set id(value) { this.attrs.set('id', value); }
  get isConnected() { return this === this.ownerDocument?.body || Boolean(this.parentNode?.isConnected); }
  setAttribute(name, value) {
    this.attrs.set(name, String(value));
    if (name.startsWith('data-')) this.dataset[dataKey(name)] = String(value);
    if (name === 'hidden') this.hidden = true;
  }
  getAttribute(name) {
    if (name.startsWith('data-')) return this.dataset[dataKey(name)] ?? null;
    return this.attrs.get(name) ?? null;
  }
  removeAttribute(name) {
    this.attrs.delete(name);
    if (name.startsWith('data-')) delete this.dataset[dataKey(name)];
    if (name === 'hidden') this.hidden = false;
  }
  matches(selector) {
    if (selector.includes(',')) return selector.split(',').some(p => this.matches(p.trim()));
    const tag = selector.match(/^[a-z]+/i)?.[0];
    if (tag && tag !== this.tagName) return false;
    for (const name of selector.matchAll(/\.([\w-]+)/g)) if (!this.className.split(/\s+/).includes(name[1])) return false;
    const id = selector.match(/#([\w-]+)/)?.[1];
    if (id && this.id !== id) return false;
    for (const [, name, value] of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
      if (value === undefined ? this.getAttribute(name) === null : this.getAttribute(name) !== value) return false;
    }
    return true;
  }
  closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) ?? null; }
  querySelectorAll(selector) {
    const all = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
    return selector === '*' ? all : all.filter(child => child.matches(selector));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  append(child) { child.remove(); this.children.push(child); child.parentNode = this; }
  remove() {
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(c => c !== this);
    this.parentNode = null;
  }
  replaceChildren(...children) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    for (const child of children) this.append(child);
  }
  set innerHTML(html) {
    this.html = html;
    this.replaceChildren();
    const stack = [this], voids = new Set(['input', 'img', 'br', 'hr']);
    for (const match of html.matchAll(/<\/?([a-z][\w-]*)([^>]*)>/gi)) {
      if (match[0][1] === '/') { if (stack.length > 1) stack.pop(); continue; }
      const node = new TestElement(match[1], this.ownerDocument);
      for (const [, name, , value] of match[2].matchAll(/([\w:-]+)(?:=(['"])(.*?)\2)?/g)) node.setAttribute(name, value ?? '');
      stack.at(-1).append(node);
      if (!voids.has(node.tagName) && !match[0].endsWith('/>')) stack.push(node);
    }
  }
  get innerHTML() { return this.html ?? ''; }
  addEventListener(name, fn) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(fn);
  }
  removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
  fire(name, extra = {}) {
    const event = { target: this, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...extra };
    for (let node = this; node; node = node.parentNode) {
      for (const fn of node.listeners.get(name) ?? []) fn(event);
      if (event.stopped) break;
    }
    return event;
  }
  focus() { this.ownerDocument.activeElement = this; }
  getBoundingClientRect() { return { left: 50, top: 50, width: 900, height: 600 }; }
}

function createTestDom() {
  const doc = {
    createElement: tag => new TestElement(tag, doc),
    querySelector: sel => doc.body.querySelector(sel),
    activeElement: null,
  };
  doc.body = new TestElement('body', doc);
  return doc;
}

test('ensureDailyBook initializes one default ledger book with starter daily tasks and round-trips through backup JSON', () => {
  const initial = createInitialState();
  assert.equal(initial.dailyBook, undefined);

  const withBook = ensureDailyBook(initial);
  assert.ok(withBook.dailyBook);
  assert.equal(withBook.dailyBook.title, 'สมุดงานประจำวัน');
  assert.equal(withBook.dailyBook.archived, false);
  assert.ok(withBook.dailyBook.tasks.some(t => t.title === 'ล้างจาน'));
  assert.ok(withBook.dailyBook.tasks.some(t => t.title === 'กวาดห้อง'));

  const roundTripped = parseState(serializeState(withBook));
  assert.deepEqual(roundTripped, withBook);
});

test('adding, tallying by strokes, undoing, resetting, editing, and deleting daily tasks update counts accurately', () => {
  let state = ensureDailyBook(createInitialState());
  state = addDailyTask(state, { id: 'daily-laundry', title: '  ซักผ้า  ', note: '  ตากระเบียง  ' });
  const laundry = state.dailyBook.tasks.find(t => t.id === 'daily-laundry');
  assert.equal(laundry.title, 'ซักผ้า');
  assert.equal(laundry.note, 'ตากระเบียง');
  assert.equal(laundry.count, 0);
  assert.equal(laundry.totalCount, 0);

  for (let i = 0; i < 7; i++) {
    state = tallyDailyTask(state, 'daily-laundry', 1, '2026-11-17');
  }
  let updated = state.dailyBook.tasks.find(t => t.id === 'daily-laundry');
  assert.equal(updated.count, 7);
  assert.equal(updated.totalCount, 7);
  assert.equal(updated.lastTalliedAt, '2026-11-17');

  state = tallyDailyTask(state, 'daily-laundry', -1, '2026-11-17');
  updated = state.dailyBook.tasks.find(t => t.id === 'daily-laundry');
  assert.equal(updated.count, 6);
  assert.equal(updated.totalCount, 6);

  state = resetDailyTaskCount(state, 'daily-laundry');
  updated = state.dailyBook.tasks.find(t => t.id === 'daily-laundry');
  assert.equal(updated.count, 0);
  assert.equal(updated.totalCount, 6);

  state = tallyDailyTask(state, 'daily-laundry', 1, '2026-11-18');
  updated = state.dailyBook.tasks.find(t => t.id === 'daily-laundry');
  assert.equal(updated.count, 1);
  assert.equal(updated.totalCount, 7);

  state = updateDailyTask(state, 'daily-laundry', { title: 'ซักผ้าและพับผ้า', count: 5 });
  assert.equal(state.dailyBook.tasks.find(t => t.id === 'daily-laundry').title, 'ซักผ้าและพับผ้า');
  assert.equal(state.dailyBook.tasks.find(t => t.id === 'daily-laundry').count, 5);

  state = resetAllDailyTaskCounts(state);
  assert.ok(state.dailyBook.tasks.every(t => t.count === 0));
  assert.equal(state.dailyBook.tasks.find(t => t.id === 'daily-laundry').totalCount, 7);

  state = deleteDailyTask(state, 'daily-laundry');
  assert.equal(state.dailyBook.tasks.some(t => t.id === 'daily-laundry'), false);
});

test('splitTallyBundles and renderTallyMarks group strokes into bundles of 5 with diagonal 5th slash', () => {
  assert.deepEqual(splitTallyBundles(0), []);
  assert.deepEqual(splitTallyBundles(3), [3]);
  assert.deepEqual(splitTallyBundles(5), [5]);
  assert.deepEqual(splitTallyBundles(12), [5, 5, 2]);

  const emptyHtml = renderTallyMarks(0);
  assert.match(emptyHtml, /daily-tally-empty/);

  const twelveHtml = renderTallyMarks(12, { fresh: true });
  assert.equal((twelveHtml.match(/class="tally-bundle"/g) || []).length, 3);
  assert.equal((twelveHtml.match(/class="tally-slash/g) || []).length, 2);
  assert.match(twelveHtml, /is-fresh-stroke/);
});

test('renderDailyBookCover and updateDailyBookMeta render book cover and validate metadata', () => {
  let state = ensureDailyBook(createInitialState());
  state = updateDailyBookMeta(state, { title: 'สมุดงานบ้าน', color: 'sage', archived: true });
  assert.equal(state.dailyBook.title, 'สมุดงานบ้าน');
  assert.equal(state.dailyBook.color, 'sage');
  assert.equal(state.dailyBook.archived, true);

  const html = renderDailyBookCover(state.dailyBook, { icon: () => '<svg></svg>' });
  assert.match(html, /สมุดงานบ้าน/);
  assert.match(html, /book-sage/);
  assert.match(html, /data-edit-daily-book/);
  assert.match(html, /data-open-daily-book/);
  assert.doesNotMatch(html, /ล้างจาน/);

  assert.throws(() => validateState({ ...state, dailyBook: { ...state.dailyBook, color: 'invalid' } }));
});

test('createDailyBookWindow open and close lifecycle: closes via close button and escape, toggling visibility correctly', () => {
  const doc = createTestDom();
  let state = ensureDailyBook(createInitialState());
  let cues = [];
  let registeredEscape = null;
  const windows = {
    register(panel, { onEscape }) {
      registeredEscape = onEscape;
      return {
        raise() {},
        cancelDrag() {},
      };
    },
  };

  const bookWindow = createDailyBookWindow({
    document: doc,
    windows,
    getState: () => state,
    onCommit: next => { state = next; },
    icon: () => '<svg></svg>',
    onCue: name => cues.push(name),
    reducedMotion: () => true,
  });

  assert.equal(bookWindow.isOpen, false);

  // 1. Open the window
  const panel = bookWindow.open({ focus: false });
  assert.equal(bookWindow.isOpen, true);
  assert.equal(panel.hidden, false);
  assert.equal(panel.style.display, '');

  // 2. Close via left header close button
  const leftCloseBtn = panel.querySelector('[data-daily-action="close"]');
  assert.ok(leftCloseBtn, 'Left header close button exists');
  leftCloseBtn.fire('click');

  assert.equal(bookWindow.isOpen, false, 'Book window is closed after clicking left close button');
  assert.equal(panel.hidden, true);
  assert.equal(panel.style.display, 'none');
  assert.ok(cues.includes('folderClose'));

  // 3. Reopen
  bookWindow.open({ focus: false });
  assert.equal(bookWindow.isOpen, true);
  assert.equal(panel.hidden, false);
  assert.equal(panel.style.display, '');

  // 4. Close via right sheet header close button
  const allCloseBtns = panel.querySelectorAll('[data-daily-action="close"]');
  assert.equal(allCloseBtns.length, 2, 'Two close buttons exist (left and right headers)');
  const rightCloseBtn = allCloseBtns[1];
  rightCloseBtn.fire('click');

  assert.equal(bookWindow.isOpen, false, 'Book window is closed after clicking right close button');
  assert.equal(panel.hidden, true);
  assert.equal(panel.style.display, 'none');

  // 5. Reopen and close via escape
  bookWindow.open({ focus: false });
  assert.equal(bookWindow.isOpen, true);
  assert.ok(registeredEscape, 'onEscape callback was registered');
  registeredEscape();

  assert.equal(bookWindow.isOpen, false, 'Book window is closed after onEscape');
  assert.equal(panel.hidden, true);
  assert.equal(panel.style.display, 'none');
});

test('daily book size is equal or larger than quest paper and accepted by quest storage drawer', () => {
  assert.ok(DAILY_BOOK_SIZE.width >= 300, 'Daily book width is equal or larger than paper width (300)');
  assert.ok(DAILY_BOOK_SIZE.height >= 424, 'Daily book height is equal or larger than paper height (424.29)');
  assert.equal(storageTrayAccepts('daily-book', 'quest-drawer'), true, 'Storage tray accepts daily-book');
  assert.equal(storageTrayAccepts('daily-book', 'folder-drawer'), false, 'Folder drawer does not accept daily-book');
  assert.equal(drawerForDraggedItem('daily-book', 'quest-drawer'), 'quest-drawer', 'drawerForDraggedItem routes daily-book to quest-drawer');
});

test('daily book window contains 3D swinging cover with outer and inner faces for folio-like opening animation', () => {
  const doc = createTestDom();
  const state = ensureDailyBook(createInitialState());
  const bookWindow = createDailyBookWindow({
    document: doc,
    windows: { register() { return { raise() {}, cancelDrag() {} }; } },
    getState: () => state,
    onCommit() {},
    icon: () => '<svg></svg>',
    reducedMotion: () => true,
  });

  const panel = bookWindow.open({ focus: false });
  const cover = panel.querySelector('.daily-book-window-cover');
  assert.ok(cover, '3D window cover exists inside open panel');
  const outer = cover.querySelector('.daily-book-cover-outer');
  assert.ok(outer, 'Cover has outer face for 3D unfold/refold');
  const inner = cover.querySelector('.daily-book-cover-inner');
  assert.ok(inner, 'Cover has inner face for 3D backface');
  const unfoldingTitle = cover.querySelector('#daily-book-unfolding-title');
  assert.ok(unfoldingTitle, 'Unfolding title exists on outer cover face');
  assert.equal(unfoldingTitle.textContent, state.dailyBook.title, 'Unfolding title matches book title');
});

test('daily task row interactions: left click increments tally, right click decrements tally, edit and delete callbacks fire', () => {
  const doc = createTestDom();
  let state = ensureDailyBook(createInitialState());
  let editedTaskId = null;
  let deletedTaskId = null;

  const bookWindow = createDailyBookWindow({
    document: doc,
    windows: { register() { return { raise() {}, cancelDrag() {} }; } },
    getState: () => state,
    onCommit: next => { state = next; },
    onEditTask: id => { editedTaskId = id; },
    onDeleteTask: id => { deletedTaskId = id; },
    icon: () => '<svg></svg>',
    reducedMotion: () => true,
  });

  const panel = bookWindow.open({ focus: false });
  const firstTask = state.dailyBook.tasks[0];
  assert.ok(firstTask, 'Initial task exists');
  const initialCount = firstTask.count;

  // 1. Left click on task row step button increases tally (+1)
  const stepBtn = panel.querySelector('[data-tally-step]');
  assert.ok(stepBtn, 'Tally step button exists');
  stepBtn.fire('click');
  assert.equal(state.dailyBook.tasks[0].count, initialCount + 1, 'Count increased by 1 on left click');

  // 2. Right click (contextmenu) on task row step button decreases tally (-1) and prevents default
  const ctxEvent = stepBtn.fire('contextmenu');
  assert.equal(ctxEvent.defaultPrevented, true, 'contextmenu was prevented');
  assert.equal(state.dailyBook.tasks[0].count, initialCount, 'Count decreased by 1 on right click');

  // 3. Edit pencil button fires onEditTask
  const editBtn = panel.querySelector(`[data-tally-edit="${firstTask.id}"]`);
  assert.ok(editBtn, 'Edit button exists');
  editBtn.fire('click');
  assert.equal(editedTaskId, firstTask.id, 'onEditTask fired with correct task ID');

  // 4. Delete cross button fires onDeleteTask
  const deleteBtn = panel.querySelector(`[data-tally-delete="${firstTask.id}"]`);
  assert.ok(deleteBtn, 'Delete button exists');
  deleteBtn.fire('click');
  assert.equal(deletedTaskId, firstTask.id, 'onDeleteTask fired with correct task ID');
});
