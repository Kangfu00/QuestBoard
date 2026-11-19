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
      style: {
        setProperty: (k, v) => customProps.set(k, String(v)),
        getPropertyValue: k => customProps.get(k) || '',
      },
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
          return { left: 18, top: 18, width: 250, height: 160, right: 268, bottom: 178 };
        }
        if (node.classList.contains('reception-slot')) {
          return { left: 24, top: 24, width: 238, height: 148, right: 262, bottom: 172 };
        }
        return { left: 18, top: 18, width: 250, height: 240, right: 268, bottom: 258 };
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

    return node;
  }

  const deskSurface = createNode('div');
  deskSurface.setAttribute('id', 'desk-surface');

  const document = {
    body: createNode('body'),
    createElement: tag => createNode(tag),
    getElementById: id => (id === 'desk-surface' ? deskSurface : null),
  };

  const window = {
    innerWidth: 1024,
    innerHeight: 768,
  };

  return {
    document,
    window,
    deskSurface,
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
    { class: 'reception-tray', tag: 'div', attrs: { 'data-reception-dropzone': '' } },
    { class: 'reception-tray-inner', tag: 'div' },
    { class: 'reception-tray-velvet', tag: 'div' },
    { class: 'reception-tray-rune', tag: 'span' },
    { class: 'reception-tray-label', tag: 'span' },
    { class: 'reception-slot', tag: 'div', attrs: { 'data-slot': '' } },
    { class: 'reception-bell', tag: 'button', id: 'reception-bell' },
    { class: 'bell-assembly', tag: 'div' },
    { class: 'bell-plunger', tag: 'span' },
    { class: 'bell-dome', tag: 'span' },
    { class: 'bell-base', tag: 'span' },
    { class: 'reception-speech-bubble', tag: 'div', id: 'reception-speech' },
    { class: 'reception-paper-preview', tag: 'div' },
    { class: 'reception-paper-top', tag: 'div' },
    { class: 'reception-paper-xp', tag: 'span' },
    { class: 'reception-paper-title', tag: 'div' },
    { class: 'reception-paper-footer', tag: 'div' },
    { class: 'reception-paper-withdraw', tag: 'span' },
    { class: 'reception-stamp-impact', tag: 'div' },
    { class: 'reception-stamp-mark', tag: 'span' },
  ];

  for (const item of elements) {
    if (html.includes(item.class) || (item.id && html.includes(item.id))) {
      const child = createNode(item.tag);
      item.class.split(' ').forEach(c => child.classList.add(c));
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

test('createQuestReception mounts elements into desk surface', () => {
  const env = createMockEnvironment();
  const reception = createQuestReception({
    surface: env.deskSurface,
    document: env.document,
    window: env.window,
    onCue: env.onCue,
    onTurnIn: env.onTurnIn,
    onWithdraw: env.onWithdraw,
  });

  assert.ok(reception.element, 'Container element is created');
  assert.equal(env.deskSurface.children.length, 1, 'Container mounted to deskSurface');
  assert.ok(reception.element.querySelector('.reception-tray'), 'Tray element exists');
  assert.ok(reception.element.querySelector('.reception-bell'), 'Bell button exists');
  assert.ok(reception.element.querySelector('.reception-speech-bubble'), 'Speech bubble exists');
  assert.equal(reception.hasQuest, false, 'Initial state has no quest');

  reception.destroy();
  assert.equal(env.deskSurface.children.length, 0, 'Container removed after destroy');
});

test('clicking bell when empty rings bell sound and shows idle dialogue bubble', () => {
  const env = createMockEnvironment();
  const reception = createQuestReception({
    surface: env.deskSurface,
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

test('checkDrop accurately detects points within the brass turn-in tray bounds', () => {
  const env = createMockEnvironment();
  const reception = createQuestReception({
    surface: env.deskSurface,
    document: env.document,
    window: env.window,
  });

  // Tray mock bounds: left: 18, top: 18, width: 250, height: 160 -> right: 268, bottom: 178
  assert.equal(reception.checkDrop({ x: 50, y: 50 }), true, 'Point inside tray is accepted');
  assert.equal(reception.checkDrop({ x: 18, y: 18 }), true, 'Top-left edge is accepted');
  assert.equal(reception.checkDrop({ x: 268, y: 178 }), true, 'Bottom-right edge is accepted');
  assert.equal(reception.checkDrop({ x: 300, y: 50 }), false, 'Point to the right is rejected');
  assert.equal(reception.checkDrop({ x: 50, y: 250 }), false, 'Point below tray is rejected');
  assert.equal(reception.checkDrop(null), false, 'Null point safely rejected');

  reception.destroy();
});

test('setDropTarget toggles .is-drop-target on reception counter', () => {
  const env = createMockEnvironment();
  const reception = createQuestReception({
    surface: env.deskSurface,
    document: env.document,
    window: env.window,
  });

  reception.setDropTarget(true);
  assert.equal(reception.element.classList.contains('is-drop-target'), true, 'Drop target active');

  reception.setDropTarget(false);
  assert.equal(reception.element.classList.contains('is-drop-target'), false, 'Drop target inactive');

  reception.destroy();
});

test('placeQuest and withdrawQuest manage resting quest lifecycle with sounds', () => {
  const env = createMockEnvironment();
  const reception = createQuestReception({
    surface: env.deskSurface,
    document: env.document,
    window: env.window,
    onCue: env.onCue,
    onWithdraw: env.onWithdraw,
  });

  const quest = { id: 'quest-101', type: 'quest', title: 'ปราบก็อบลิน', xp: 120 };
  const placed = reception.placeQuest(quest);

  assert.equal(placed, true, 'Quest successfully placed in tray');
  assert.equal(reception.hasQuest, true, 'hasQuest is true');
  assert.equal(reception.currentQuest?.id, 'quest-101', 'currentQuest holds quest');
  assert.ok(env.soundCues.includes('paperDrop'), 'paperDrop sound cue played on placement');

  const bellBtn = reception.element.querySelector('.reception-bell');
  assert.equal(bellBtn.classList.contains('has-quest'), true, 'Bell marked with has-quest');

  // Withdraw quest
  const withdrawnQuest = reception.withdrawQuest();
  assert.equal(withdrawnQuest?.id, 'quest-101', 'Withdrawn quest matches placed quest');
  assert.equal(reception.hasQuest, false, 'hasQuest is false after withdraw');
  assert.equal(bellBtn.classList.contains('has-quest'), false, 'has-quest removed from bell');
  assert.ok(env.soundCues.includes('cardDrop'), 'cardDrop sound played on withdraw');
  assert.equal(env.withdrawn.length, 1, 'onWithdraw callback invoked');
  assert.equal(env.withdrawn[0].id, 'quest-101', 'Withdrawn quest passed to callback');

  reception.destroy();
});

test('ringing bell with a resting quest triggers full turn-in flow', () => {
  const env = createMockEnvironment();
  const reception = createQuestReception({
    surface: env.deskSurface,
    document: env.document,
    window: env.window,
    onCue: env.onCue,
    onTurnIn: env.onTurnIn,
  });

  const quest = { id: 'quest-202', type: 'quest', title: 'สำรวจถ้ำคริสตัล', xp: 250 };
  reception.placeQuest(quest);

  // Ring bell to turn in
  reception.ringBell();

  assert.ok(env.soundCues.includes('bell'), 'bell chime cue triggered');
  assert.ok(env.soundCues.includes('receptionStamp'), 'receptionStamp heavy stamp cue triggered');

  const bubble = reception.element.querySelector('.reception-speech-bubble');
  assert.equal(bubble.hidden, false, 'Speech bubble visible');
  assert.ok(RECEPTIONIST_TURNIN_QUOTES.includes(bubble.textContent), 'Displays a turn-in quote');

  assert.equal(env.turnedIn.length, 1, 'onTurnIn callback invoked');
  assert.equal(env.turnedIn[0].quest.id, 'quest-202', 'Turned in quest matches');
  assert.ok(env.turnedIn[0].meta?.origin, 'Origin point passed for mana surge animation');

  reception.destroy();
});

test('setScale updates --card-scale custom property', () => {
  const env = createMockEnvironment();
  const reception = createQuestReception({
    surface: env.deskSurface,
    document: env.document,
    window: env.window,
  });

  reception.setScale(0.85);
  assert.equal(reception.element.style.getPropertyValue('--card-scale'), '0.85', 'Scale applied');

  reception.destroy();
});
