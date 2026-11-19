import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RECEPTIONIST_IDLE_QUOTES,
  RECEPTIONIST_TURNIN_QUOTES,
  pickReceptionistQuote,
  canReceiveQuest,
} from '../dist/quest-reception-model.mjs';
import { createQuestReception } from '../dist/quest-reception.mjs';

// =========================================================================
// 1. Model Unit Tests
// =========================================================================

test('pickReceptionistQuote returns idle quotes when isSubmission is false', () => {
  for (let i = 0; i < RECEPTIONIST_IDLE_QUOTES.length; i++) {
    const seed = i / RECEPTIONIST_IDLE_QUOTES.length;
    const quote = pickReceptionistQuote(false, seed);
    assert.ok(RECEPTIONIST_IDLE_QUOTES.includes(quote), 'Returns valid idle quote');
  }
});

test('pickReceptionistQuote returns turnin quotes when isSubmission is true', () => {
  for (let i = 0; i < RECEPTIONIST_TURNIN_QUOTES.length; i++) {
    const seed = i / RECEPTIONIST_TURNIN_QUOTES.length;
    const quote = pickReceptionistQuote(true, seed);
    assert.ok(RECEPTIONIST_TURNIN_QUOTES.includes(quote), 'Returns valid turnin quote');
  }
});

test('canReceiveQuest validates item eligibility', () => {
  assert.equal(canReceiveQuest(null), false);
  assert.equal(canReceiveQuest(undefined), false);
  assert.equal(canReceiveQuest('quest'), false);
  assert.equal(canReceiveQuest({ type: 'folder' }), false);
  assert.equal(canReceiveQuest({ type: 'daily-book' }), false);
  assert.equal(canReceiveQuest({ type: 'quest', archived: true }), false, 'Archived quest cannot be received');
  assert.equal(canReceiveQuest({ type: 'quest', archived: false }), true, 'Active unarchived quest can be received');
  assert.equal(canReceiveQuest({ type: 'quest' }), true, 'Quest without archived flag defaults to active');
});

// =========================================================================
// 2. Component DOM Mock Environment
// =========================================================================

function createMockEnvironment({ reducedMotion = false } = {}) {
  const createdAnimations = [];
  const soundCues = [];
  const turnedIn = [];
  const withdrawn = [];

  function createNode(tag = 'div') {
    const classSet = new Set();
    const attrs = new Map();
    const listeners = new Map();
    const children = [];
    const customProps = new Map();

    const node = {
      tagName: tag.toUpperCase(),
      offsetWidth: tag.toLowerCase() === 'aside' ? 392 : 348,
      offsetHeight: 650,
      style: {
        setProperty: (k, v) => customProps.set(k, String(v)),
        getPropertyValue: k => customProps.get(k) || '',
        removeProperty: k => customProps.delete(k),
      },
      setPointerCapture: () => {},
      hasPointerCapture: () => false,
      releasePointerCapture: () => {},
      parentNode: null,
      children,
      classList: {
        add: (...names) => names.forEach(n => classSet.add(n)),
        remove: (...names) => names.forEach(n => classSet.delete(n)),
        contains: n => classSet.has(n),
        toggle: (n, force) => {
          const has = classSet.has(n);
          const next = force !== undefined ? Boolean(force) : !has;
          if (next) classSet.add(n); else classSet.delete(n);
          return next;
        },
      },
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: k => attrs.get(k) ?? null,
      hasAttribute: k => attrs.has(k),
      removeAttribute: k => attrs.delete(k),
      appendChild: child => {
        if (child.parentNode) child.parentNode.removeChild(child);
        child.parentNode = node;
        children.push(child);
        return child;
      },
      removeChild: child => {
        const idx = children.indexOf(child);
        if (idx !== -1) children.splice(idx, 1);
        child.parentNode = null;
        return child;
      },
      remove: () => {
        if (node.parentNode) node.parentNode.removeChild(node);
      },
      addEventListener: (evt, handler) => {
        if (!listeners.has(evt)) listeners.set(evt, []);
        listeners.get(evt).push(handler);
      },
      removeEventListener: (evt, handler) => {
        const list = listeners.get(evt);
        if (list) {
          const idx = list.indexOf(handler);
          if (idx !== -1) list.splice(idx, 1);
        }
      },
      dispatchEvent: evt => {
        if (!evt.target) evt.target = node;
        const list = listeners.get(evt.type) || [];
        for (const h of list) h(evt);
      },
      click: () => {
        node.dispatchEvent({ type: 'click', button: 0, preventDefault() {}, stopPropagation() {} });
      },
      closest: sel => {
        let cur = node;
        while (cur) {
          if (matches(cur, sel)) return cur;
          cur = cur.parentNode;
        }
        return null;
      },
      getBoundingClientRect: () => {
        if (node.classList.contains('reception-tray')) {
          return { left: 16, top: 85, width: 318, height: 500, right: 334, bottom: 585 };
        }
        if (node.classList.contains('reception-slot')) {
          return { left: 20, top: 90, width: 310, height: 490, right: 330, bottom: 580 };
        }
        if (node.classList.contains('reception-drawer-handle')) {
          return { left: 348, top: 48, width: 44, height: 150, right: 392, bottom: 198 };
        }
        return { left: 0, top: 18, width: 392, height: 650, right: 392, bottom: 668 };
      },
      querySelector: sel => queryNode(node, sel),
      querySelectorAll: sel => queryAllNode(node, sel),
    };

    node.animate = (keyframes, options) => {
      let finishPromiseResolve;
      const finished = new Promise(resolve => { finishPromiseResolve = resolve; });
      const anim = {
        element: node,
        keyframes,
        options,
        cancelled: false,
        finished,
        cancel() { this.cancelled = true; },
        finish() { if (!this.cancelled) finishPromiseResolve(); },
      };
      createdAnimations.push(anim);
      return anim;
    };

    let _innerHTML = '';
    let _textContent = '';

    Object.defineProperty(node, 'id', {
      get() { return attrs.get('id') || ''; },
      set(val) {
        if (val) attrs.set('id', String(val));
        else attrs.delete(val);
      },
    });

    Object.defineProperty(node, 'className', {
      get() { return Array.from(classSet).join(' '); },
      set(val) {
        classSet.clear();
        String(val).split(/\s+/).filter(Boolean).forEach(n => classSet.add(n));
      },
    });

    Object.defineProperty(node, 'innerHTML', {
      get() { return _innerHTML; },
      set(html) {
        _innerHTML = html;
        buildMockTree(node, html, createNode);
      },
    });

    Object.defineProperty(node, 'textContent', {
      get() {
        if (_textContent !== '') return _textContent;
        return children.map(c => c.textContent).join('');
      },
      set(text) {
        _textContent = String(text);
        children.length = 0;
      },
    });

    Object.defineProperty(node, 'hidden', {
      get() { return attrs.has('hidden'); },
      set(val) {
        if (val) attrs.set('hidden', '');
        else attrs.delete('hidden');
      },
    });

    return node;
  }

  const rootSurface = createNode('body');

  const document = {
    body: rootSurface,
    createElement: tag => createNode(tag),
    getElementById: id => (id === 'reception-drawer' ? rootSurface.querySelector('#reception-drawer') : null),
  };

  const window = {
    innerWidth: 1024,
    innerHeight: 768,
  };

  return {
    document,
    window,
    rootSurface,
    createdAnimations,
    soundCues,
    turnedIn,
    withdrawn,
    onCue: name => soundCues.push(name),
    onTurnIn: (quest, meta) => turnedIn.push({ quest, meta }),
    onWithdraw: quest => withdrawn.push(quest),
    reducedMotion: () => reducedMotion,
  };
}

function buildMockTree(parent, html, createNode) {
  const elements = [
    { class: 'reception-drawer-body', tag: 'div', id: 'reception-drawer-content' },
    { class: 'reception-header', tag: 'header' },
    { class: 'reception-header-title', tag: 'div' },
    { class: 'reception-close-btn', tag: 'button' },
    { class: 'reception-counter-bar', tag: 'div' },
    { class: 'reception-bell-wrap', tag: 'div' },
    { class: 'reception-bell', tag: 'button', id: 'reception-bell' },
    { class: 'bell-assembly', tag: 'div' },
    { class: 'bell-plunger', tag: 'span' },
    { class: 'bell-dome', tag: 'span' },
    { class: 'bell-base', tag: 'span' },
    { class: 'reception-bell-hint', tag: 'span' },
    { class: 'reception-speech-bubble', tag: 'div', id: 'reception-speech' },
    { class: 'reception-tray-container', tag: 'div' },
    { class: 'reception-tray', tag: 'div', attrs: { 'data-reception-dropzone': '' } },
    { class: 'reception-tray-inner', tag: 'div' },
    { class: 'reception-tray-velvet', tag: 'div' },
    { class: 'reception-tray-rune', tag: 'span' },
    { class: 'reception-tray-label', tag: 'span' },
    { class: 'reception-tray-instruction', tag: 'span' },
    { class: 'reception-slot', tag: 'div', attrs: { 'data-slot': '' } },
    { class: 'reception-drawer-handle', tag: 'button', id: 'reception-drawer-handle' },
    { class: 'reception-handle-icon', tag: 'div' },
    { class: 'reception-handle-text', tag: 'span' },
    { class: 'reception-handle-badge', tag: 'b', id: 'reception-badge' },
    { class: 'reception-paper-preview', tag: 'div' },
    { class: 'reception-placed-sheet', tag: 'div' },
    { class: 'reception-paper-stage', tag: 'div' },
    { class: 'quest-paper', tag: 'article' },
    { class: 'reception-sheet-actions', tag: 'div' },
    { class: 'reception-withdraw-prompt', tag: 'span' },
    { class: 'reception-paper-header', tag: 'div' },
    { class: 'reception-paper-tag', tag: 'span' },
    { class: 'reception-paper-xp', tag: 'span' },
    { class: 'reception-paper-body', tag: 'div' },
    { class: 'reception-paper-title', tag: 'h3' },
    { class: 'reception-paper-desc', tag: 'p' },
    { class: 'reception-paper-footer', tag: 'div' },
    { class: 'reception-withdraw-btn', tag: 'button' },
    { class: 'reception-paper-prompt', tag: 'span' },
    { class: 'reception-stamp-impact', tag: 'div' },
    { class: 'reception-stamp-mark', tag: 'span' },
  ];

  for (const item of elements) {
    if (html.includes(item.class) || (item.id && html.includes(item.id))) {
      const child = createNode(item.tag);
      item.class.split(' ').forEach(c => child.classList.add(c));
      if (item.class === 'quest-paper') {
        const classMatch = html.match(/class=["']([^"']*quest-paper[^"']*)["']/);
        if (classMatch) {
          classMatch[1].split(/\s+/).filter(Boolean).forEach(c => child.classList.add(c));
        }
      }
      if (item.id) child.setAttribute('id', item.id);
      if (item.attrs) {
        for (const [k, v] of Object.entries(item.attrs)) {
          child.setAttribute(k, v);
        }
      }
      parent.appendChild(child);
    }
  }
}

function queryNode(root, sel) {
  const all = queryAllNode(root, sel);
  return all.length ? all[0] : null;
}

function queryAllNode(root, sel) {
  const result = [];
  function walk(node) {
    for (const child of node.children) {
      if (matches(child, sel)) result.push(child);
      walk(child);
    }
  }
  walk(root);
  return result;
}

function matches(node, sel) {
  const parts = sel.split(',').map(s => s.trim());
  for (const p of parts) {
    if (p.startsWith('.')) {
      if (node.classList.contains(p.slice(1))) return true;
    } else if (p.startsWith('#')) {
      if (node.getAttribute('id') === p.slice(1)) return true;
    } else if (p.startsWith('[') && p.endsWith(']')) {
      const attr = p.slice(1, -1);
      if (node.hasAttribute(attr)) return true;
    } else if (p.toUpperCase() === node.tagName) {
      return true;
    }
  }
  return false;
}

// =========================================================================
// 3. Component Interaction Tests
// =========================================================================

test('createQuestReception mounts left drawer into surface and toggles open/close', () => {
  const env = createMockEnvironment();
  const reception = createQuestReception({
    surface: env.rootSurface,
    document: env.document,
    window: env.window,
    onCue: env.onCue,
    onTurnIn: env.onTurnIn,
    onWithdraw: env.onWithdraw,
  });

  assert.ok(reception.element, 'Drawer container created');
  assert.equal(env.rootSurface.children.length, 1, 'Drawer mounted to surface');
  assert.equal(reception.isOpen, false, 'Drawer initially closed');

  const handle = reception.element.querySelector('.reception-drawer-handle');
  assert.ok(handle, 'Drawer handle exists');

  // Toggle open
  handle.click();
  assert.equal(reception.isOpen, true, 'Drawer opened on handle click');
  assert.equal(reception.element.classList.contains('is-open'), true, 'Drawer has is-open class');
  assert.ok(env.soundCues.includes('drawerOpen'), 'drawerOpen sound played');

  // Toggle close
  handle.click();
  assert.equal(reception.isOpen, false, 'Drawer closed on handle click');
  assert.equal(reception.element.classList.contains('is-open'), false, 'is-open removed');
  assert.ok(env.soundCues.includes('drawerClose'), 'drawerClose sound played');

  reception.destroy();
  assert.equal(env.rootSurface.children.length, 0, 'Drawer removed after destroy');
});

test('clicking bell when empty rings bell sound and shows idle dialogue bubble', () => {
  const env = createMockEnvironment();
  const reception = createQuestReception({
    surface: env.rootSurface,
    document: env.document,
    window: env.window,
    onCue: env.onCue,
  });

  const bellBtn = reception.element.querySelector('.reception-bell');
  bellBtn.click();

  assert.ok(env.soundCues.includes('bell'), 'bell sound cue triggered');
  const bubble = reception.element.querySelector('.reception-speech-bubble');
  assert.equal(bubble.hidden, false, 'Speech bubble is visible');
  assert.ok(RECEPTIONIST_IDLE_QUOTES.includes(bubble.textContent), 'Displays an idle quote');

  reception.destroy();
});

test('checkDrop detects drop coordinates over tray or drawer handle', () => {
  const env = createMockEnvironment();
  const reception = createQuestReception({
    surface: env.rootSurface,
    document: env.document,
    window: env.window,
  });

  // Tray bounds: left: 16, top: 85, width: 318, height: 500 (right: 334, bottom: 585)
  assert.equal(reception.checkDrop({ x: 50, y: 150 }), true, 'Point inside tray accepted');
  assert.equal(reception.checkDrop({ x: 16, y: 85 }), true, 'Top-left of tray accepted');
  assert.equal(reception.checkDrop({ x: 334, y: 585 }), true, 'Bottom-right of tray accepted');

  // Handle bounds: left: 348, top: 48, right: 392, bottom: 198
  assert.equal(reception.checkDrop({ x: 360, y: 100 }), true, 'Point over handle accepted');

  // Far points rejected
  assert.equal(reception.checkDrop({ x: 600, y: 300 }), false, 'Point in center desk rejected');
  assert.equal(reception.checkDrop(null), false, 'Null point safely rejected');

  reception.destroy();
});

test('setDropTarget opens drawer and marks .is-drop-target', () => {
  const env = createMockEnvironment();
  const reception = createQuestReception({
    surface: env.rootSurface,
    document: env.document,
    window: env.window,
  });

  reception.setDropTarget(true);
  assert.equal(reception.isOpen, true, 'Drawer automatically opens when hovered as drop target');
  assert.equal(reception.element.classList.contains('is-drop-target'), true, 'Drawer has is-drop-target class');

  reception.setDropTarget(false);
  assert.equal(reception.element.classList.contains('is-drop-target'), false, 'is-drop-target removed');

  reception.destroy();
});

test('placeQuest displays full quest parchment, opens drawer, removes drag ghost, and withdrawQuest clears slot', () => {
  const env = createMockEnvironment();
  const reception = createQuestReception({
    surface: env.rootSurface,
    document: env.document,
    window: env.window,
    onCue: env.onCue,
    onWithdraw: env.onWithdraw,
  });

  let ghostRemoved = false;
  const mockGhost = {
    remove() {
      ghostRemoved = true;
    },
  };

  const quest = {
    id: 'quest-303',
    type: 'quest',
    title: 'สำรวจปราสาทโบราณ',
    description: 'ค้นหาโบราณวัตถุที่ซ่อนอยู่ในห้องใต้ดิน',
    category: 'adventure',
    xp: 200,
  };

  const placed = reception.placeQuest(quest, mockGhost);
  assert.equal(placed, true, 'Quest successfully placed');
  assert.equal(ghostRemoved, true, 'Drag ghost removed cleanly on placement to prevent freezing');
  assert.equal(reception.isOpen, true, 'Drawer opens to display placed quest');
  assert.equal(reception.hasQuest, true, 'hasQuest is true');
  assert.equal(reception.currentQuest?.id, 'quest-303', 'Holds quest reference');
  assert.ok(env.soundCues.includes('paperDrop'), 'paperDrop sound cue played');

  const bellBtn = reception.element.querySelector('.reception-bell');
  assert.equal(bellBtn.classList.contains('has-quest'), true, 'Bell marked with has-quest shimmer');

  const badge = reception.element.querySelector('.reception-handle-badge');
  assert.equal(badge.hidden, false, 'Handle badge visible');
  assert.equal(badge.textContent, '1', 'Handle badge displays 1 quest');

  // Withdraw quest
  const withdrawn = reception.withdrawQuest();
  assert.equal(withdrawn?.id, 'quest-303', 'Withdrawn quest matches');
  assert.equal(reception.hasQuest, false, 'hasQuest is false after withdraw');
  assert.equal(bellBtn.classList.contains('has-quest'), false, 'has-quest removed from bell');
  assert.equal(badge.hidden, true, 'Badge hidden after withdraw');
  assert.ok(env.soundCues.includes('cardDrop'), 'cardDrop sound played on withdraw');
  assert.equal(env.withdrawn.length, 1, 'onWithdraw callback called');

  reception.destroy();
});

test('ringing bell with quest triggers turnin, stamp impact, mana origin, and dissolves paper', () => {
  const env = createMockEnvironment();
  const reception = createQuestReception({
    surface: env.rootSurface,
    document: env.document,
    window: env.window,
    onCue: env.onCue,
    onTurnIn: env.onTurnIn,
  });

  const quest = {
    id: 'quest-404',
    type: 'quest',
    title: 'ปราบมังกรเพลิง',
    category: 'boss',
    xp: 500,
  };

  reception.placeQuest(quest);
  reception.ringBell();

  assert.ok(env.soundCues.includes('bell'), 'bell chime cue triggered');
  assert.ok(env.soundCues.includes('receptionStamp'), 'receptionStamp heavy stamp cue triggered');

  const bubble = reception.element.querySelector('.reception-speech-bubble');
  assert.equal(bubble.hidden, false, 'Speech bubble visible');
  assert.ok(RECEPTIONIST_TURNIN_QUOTES.includes(bubble.textContent), 'Displays a turn-in quote');

  assert.equal(env.turnedIn.length, 1, 'onTurnIn callback called');
  assert.equal(env.turnedIn[0].quest.id, 'quest-404', 'Turned in quest matches');
  assert.ok(env.turnedIn[0].meta?.origin, 'Origin point passed for blue mana arc');

  reception.destroy();
});

test('dragging reception drawer handle pulls open and pushes closed', () => {
  const env = createMockEnvironment();
  const reception = createQuestReception({
    surface: env.rootSurface,
    document: env.document,
    window: env.window,
    onCue: env.onCue,
  });

  const handle = reception.element.querySelector('.reception-drawer-handle');
  assert.equal(reception.isOpen, false, 'Initially closed');

  // 1. Pull open past 45% threshold (travel is 392 - 44 = 348px; 45% is ~157px; pull by 200px)
  handle.dispatchEvent({ type: 'pointerdown', button: 0, pointerId: 1, clientX: 0 });
  assert.equal(reception.element.classList.contains('is-pulling'), true, 'Marked is-pulling while dragging');

  handle.dispatchEvent({ type: 'pointermove', pointerId: 1, clientX: 200 });
  assert.equal(reception.element.style.getPropertyValue('--reception-reveal'), '200px', 'Sets reveal CSS variable');

  handle.dispatchEvent({ type: 'pointerup', pointerId: 1, clientX: 200 });
  assert.equal(reception.element.classList.contains('is-pulling'), false, 'is-pulling removed on release');
  assert.equal(reception.isOpen, true, 'Drawer snapped open');
  assert.ok(env.soundCues.includes('drawerOpen'), 'drawerOpen sound cue triggered');

  // 2. Drag to close (push left from 348 to 80px, which is < 45% threshold)
  handle.dispatchEvent({ type: 'pointerdown', button: 0, pointerId: 2, clientX: 348 });
  handle.dispatchEvent({ type: 'pointermove', pointerId: 2, clientX: 80 });
  handle.dispatchEvent({ type: 'pointerup', pointerId: 2, clientX: 80 });
  assert.equal(reception.isOpen, false, 'Drawer snapped closed');
  assert.ok(env.soundCues.includes('drawerClose'), 'drawerClose sound cue triggered');

  // 3. Small pull below threshold (pull by 50px < 157px) snaps back to closed
  handle.dispatchEvent({ type: 'pointerdown', button: 0, pointerId: 3, clientX: 0 });
  handle.dispatchEvent({ type: 'pointermove', pointerId: 3, clientX: 50 });
  handle.dispatchEvent({ type: 'pointerup', pointerId: 3, clientX: 50 });
  assert.equal(reception.isOpen, false, 'Drawer remained closed because pull was below 45%');

  // 4. Cancelled pointer restores previous state
  reception.open();
  assert.equal(reception.isOpen, true);
  handle.dispatchEvent({ type: 'pointerdown', button: 0, pointerId: 4, clientX: 348 });
  handle.dispatchEvent({ type: 'pointermove', pointerId: 4, clientX: 50 });
  handle.dispatchEvent({ type: 'pointercancel', pointerId: 4 });
  assert.equal(reception.isOpen, true, 'Drawer remains open when gesture cancelled');

  reception.destroy();
});

test('placeQuest uses provided renderQuest callback to retain authentic quest sheet appearance', () => {
  const env = createMockEnvironment();
  let renderedQuest = null;
  const reception = createQuestReception({
    surface: env.rootSurface,
    document: env.document,
    window: env.window,
    renderQuest: q => {
      renderedQuest = q;
      return `<article class="quest-paper board-item custom-rendered-quest" data-id="${q.id}"><span class="paper-wear"></span><h3 class="quest-title">${q.title}</h3></article>`;
    },
  });

  const quest = {
    id: 'quest-505',
    type: 'quest',
    title: 'วาดครอบครัวสตอเบอร์รี่',
    category: 'งานหลัก',
    xp: 100,
  };

  reception.placeQuest(quest);
  assert.equal(renderedQuest?.id, 'quest-505', 'renderQuest callback was invoked with quest');

  const paper = reception.element.querySelector('.quest-paper');
  assert.ok(paper, 'Quest paper mounted in slot');
  assert.equal(paper.classList.contains('custom-rendered-quest'), true, 'Rendered with authentic quest markup');
  assert.equal(paper.classList.contains('board-item'), false, 'board-item class removed to allow relative tray flow');
  assert.equal(paper.classList.contains('in-reception-tray'), true, 'in-reception-tray class applied');

  const withdrawBtn = reception.element.querySelector('.reception-withdraw-btn');
  assert.ok(withdrawBtn, 'Withdraw button exists below paper');

  reception.destroy();
});
