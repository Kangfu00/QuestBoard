import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdventurerCard } from '../dist/adventurer-card.mjs';
import { createInitialState, createQuest, serializeState, parseState, updateAdventurerCard, normalizeAdventurerCard, DEFAULT_ADVENTURER_CARD, ADVENTURER_CARD_SIZE } from '../dist/model.mjs';
import { applyHeldStamp } from '../dist/stamp-tools.mjs';

function createMockEnvironment({ hasWaapi = true, reducedMotion = false } = {}) {
  const createdAnimations = [];
  const soundCues = [];
  const savedPositions = [];

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
        if (node.classList.contains('adventurer-card-seal')) {
          return { left: 32, top: 620, width: 66, height: 66, right: 98, bottom: 686 };
        }
        if (node.getAttribute('id') === 'desk-surface' || node.getAttribute('id') === 'board-scroll') {
          return { left: 0, top: 0, width: 1024, height: 768, right: 1024, bottom: 768 };
        }
        return { left: 18, top: 548, width: 320, height: 202, right: 338, bottom: 750 };
      },
      querySelector: sel => queryNode(node, sel),
      querySelectorAll: sel => queryAllNode(node, sel),
    };

    if (tag.toLowerCase() === 'dialog') {
      node.open = false;
      node.showModal = () => { node.open = true; node.setAttribute('open', ''); };
      node.close = () => { node.open = false; node.removeAttribute('open'); };
    }

    if (hasWaapi) {
      node.animate = (keyframes, options) => {
        let finishPromiseResolve;
        const finished = new Promise(resolve => {
          finishPromiseResolve = resolve;
        });
        const anim = {
          element: node,
          keyframes,
          options,
          cancelled: false,
          finished,
          cancel() {
            this.cancelled = true;
          },
          finish() {
            if (!this.cancelled) finishPromiseResolve();
          },
        };
        createdAnimations.push(anim);
        return anim;
      };
    }

    let _innerHTML = '';
    let _textContent = '';

    Object.defineProperty(node, 'id', {
      get() { return attrs.get('id') || ''; },
      set(val) {
        if (val) attrs.set('id', String(val));
        else attrs.delete('id');
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
        buildMockTreeFromHtml(node, html, createNode);
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

  const listeners = new Map();
  const windowListeners = new Map();

  const document = {
    body: createNode('body'),
    createElement: tag => createNode(tag),
    getElementById: id => (id === 'desk-surface' ? deskSurface : null),
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
  };

  const window = {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: (evt, handler) => {
      if (!windowListeners.has(evt)) windowListeners.set(evt, []);
      windowListeners.get(evt).push(handler);
    },
    removeEventListener: (evt, handler) => {
      const list = windowListeners.get(evt);
      if (list) {
        const idx = list.indexOf(handler);
        if (idx !== -1) list.splice(idx, 1);
      }
    },
    dispatchEvent: evt => {
      const list = windowListeners.get(evt.type) || [];
      for (const h of list) h(evt);
    },
  };

  return {
    document,
    window,
    deskSurface,
    createdAnimations,
    soundCues,
    savedPositions,
    reducedMotion: () => reducedMotion,
    onCue: name => soundCues.push(name),
    icon: name => `<svg class="icon-${name}"></svg>`,
    onSavePosition: pos => savedPositions.push(pos),
  };
}

function buildMockTreeFromHtml(parent, html, createNode) {
  const subClasses = [
    'adventurer-card-inner', 'adventurer-card-face front', 'adventurer-card-face back',
    'adventurer-card-rune-border', 'adventurer-card-sheen', 'mana-shockwave',
    'adventurer-card-header', 'adventurer-card-board', 'adventurer-card-board-back',
    'adventurer-card-topbar', 'adventurer-edit-icon-btn', 'adventurer-card-body-clean',
    'adventurer-card-type', 'adventurer-card-divider', 'adventurer-card-body',
    'adventurer-card-left', 'adventurer-portrait-frame', 'adventurer-card-seal',
    'adventurer-rank-banner', 'adventurer-rank-label', 'adventurer-card-title',
    'adventurer-card-right', 'adventurer-card-details-clean', 'adventurer-right-top',
    'adventurer-level-crest', 'adventurer-level-crest-row', 'adventurer-level-tag',
    'adventurer-card-level-num', 'adventurer-badge-done', 'adventurer-front-done',
    'adventurer-mana-tube-wrap', 'adventurer-mana-header', 'adventurer-mana-text',
    'adventurer-mana-tube', 'adventurer-mana-bar', 'adventurer-front-stats',
    'adventurer-front-xp', 'adventurer-front-tonext', 'adventurer-back-grid',
    'adventurer-card-row', 'adventurer-card-label',
    'adventurer-card-value adventurer-back-title', 'adventurer-card-value adventurer-back-level',
    'adventurer-card-value adventurer-back-xp', 'adventurer-card-value adventurer-back-done',
    'adventurer-card-value adventurer-back-tonext', 'adventurer-back-footer',
    'adventurer-back-edit-btn', 'adventurer-topbar-actions', 'adventurer-inspect-icon-btn',
    'adventurer-back-inspect-btn', 'adventurer-card-viewer-dialog', 'adventurer-viewer-wrap',
    'adventurer-viewer-card', 'adventurer-viewer-controls', 'adventurer-modal-flip-btn',
    'adventurer-modal-edit-btn', 'adventurer-viewer-close', 'adventurer-card-status sr-only',
  ];

  for (const c of subClasses) {
    if (html.includes(c)) {
      const child = createNode('div');
      c.split(' ').forEach(name => child.classList.add(name));
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
    } else if (p.toUpperCase() === node.tagName) {
      return true;
    }
  }
  return false;
}

test('adventurer card mounts into desk surface and updates progression state accurately', () => {
  const env = createMockEnvironment();
  const card = createAdventurerCard({
    deskSurface: env.deskSurface,
    document: env.document,
    window: env.window,
    reducedMotion: env.reducedMotion,
    onCue: env.onCue,
    icon: env.icon,
    onSavePosition: env.onSavePosition,
    boardName: () => 'THE QUESTBOARD',
  });

  assert.ok(env.deskSurface.children.length >= 1, 'Card mounted to deskSurface');
  const cardEl = env.deskSurface.children.find(c => c.classList.contains('adventurer-card'));

  assert.ok(cardEl, 'Adventurer card mounted');
  assert.equal(cardEl.getAttribute('id'), 'adventurer-card');

  // Initial update at 0 XP
  card.update(0, { doneCount: 0, emblem: 'shield', boardName: 'GUILD HQ' });
  const levelNum = cardEl.querySelector('.adventurer-card-level-num');
  const title = cardEl.querySelector('.adventurer-card-title');
  const manaBar = cardEl.querySelector('.adventurer-mana-bar');
  const boardEl = cardEl.querySelector('.adventurer-card-board');

  assert.equal(levelNum.textContent, '1');
  assert.equal(title.textContent, 'ผู้สมัครกิลด์');
  assert.equal(manaBar.style.width, '0%');
  assert.equal(boardEl.textContent, 'GUILD HQ');
  assert.match(cardEl.getAttribute('aria-label'), /LEVEL 1, 0 XP \(ผู้สมัครกิลด์\)/);

  // Update with cumulative XP, completed quests, and custom card name
  card.update(1240, { doneCount: 7, emblem: 'swords', name: 'KANGFU' });
  assert.equal(levelNum.textContent, '3');
  assert.equal(title.textContent, 'นักสำรวจ');
  assert.equal(boardEl.textContent, 'KANGFU');
  assert.equal(manaBar.style.width, '48%'); // 240 / 500 = 48%
  assert.match(cardEl.getAttribute('aria-label'), /LEVEL 3, 1,240 XP \(นักสำรวจ\)/);

  const backXp = cardEl.querySelector('.adventurer-back-xp');
  const backDone = cardEl.querySelector('.adventurer-back-done');
  const backToNext = cardEl.querySelector('.adventurer-back-tonext');
  assert.equal(backXp.textContent, '1,240 XP');
  assert.equal(backDone.textContent, '7 เควส');
  assert.equal(backToNext.textContent, 'อีก 260 XP');

  card.destroy();
  assert.equal(env.deskSurface.children.length, 0, 'Card cleans up on destroy');
});

test('adventurer card flips 3D front/back and updates accessible description', () => {
  const env = createMockEnvironment();
  const card = createAdventurerCard({
    deskSurface: env.deskSurface,
    document: env.document,
    window: env.window,
    reducedMotion: env.reducedMotion,
    onCue: env.onCue,
    icon: env.icon,
    onSavePosition: env.onSavePosition,
  });

  card.update(850, { doneCount: 3 });
  const cardEl = env.deskSurface.querySelector('.adventurer-card');

  assert.equal(cardEl.classList.contains('is-flipped'), false);
  assert.match(cardEl.getAttribute('aria-label'), /LEVEL 2/);

  // Flip method
  card.flip();
  assert.equal(cardEl.classList.contains('is-flipped'), true);
  assert.match(cardEl.getAttribute('aria-label'), /รายละเอียดบัตร: รวม 850 XP, สำเร็จ 3 เควส, อีก 150 XP สู่เลเวลถัดไป/);

  // Flip back
  card.flip();
  assert.equal(cardEl.classList.contains('is-flipped'), false);
  assert.match(cardEl.getAttribute('aria-label'), /LEVEL 2/);

  // Pointer click on card triggers flip without triggering 2D upside-down rotate(180deg) animation
  const cardInner = cardEl.querySelector('.adventurer-card-inner');
  const animCountBefore = env.createdAnimations.length;
  cardEl.dispatchEvent({ type: 'pointerdown', button: 0, clientX: 50, clientY: 600, preventDefault() {} });
  env.window.dispatchEvent({ type: 'pointerup' });
  assert.equal(cardEl.classList.contains('is-flipped'), true, 'Pointer click flipped card');
  assert.equal(cardInner.style.transform || '', '', 'cardInner transform is clean without 2D upside-down rotate()');
  const animsOnInner = env.createdAnimations.slice(animCountBefore).filter(a => a.element === cardInner);
  assert.equal(animsOnInner.length, 0, 'No upside-down animation triggered on cardInner on click');

  card.destroy();
});

test('keyboard navigation moves card by 10px / 50px with Shift and flips on Enter/Space', () => {
  const env = createMockEnvironment();
  const card = createAdventurerCard({
    deskSurface: env.deskSurface,
    document: env.document,
    window: env.window,
    reducedMotion: env.reducedMotion,
    onCue: env.onCue,
    icon: env.icon,
    onSavePosition: env.onSavePosition,
  });

  card.update(500);
  const cardEl = env.deskSurface.querySelector('.adventurer-card');

  // Space flips card
  cardEl.dispatchEvent({ type: 'keydown', key: ' ', preventDefault() {} });
  assert.equal(cardEl.classList.contains('is-flipped'), true);

  // Enter flips card back
  cardEl.dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault() {} });
  assert.equal(cardEl.classList.contains('is-flipped'), false);

  // Arrow keys move card
  // First arrow undocks card and moves by 10px
  cardEl.dispatchEvent({ type: 'keydown', key: 'ArrowRight', shiftKey: false, preventDefault() {} });
  assert.ok(env.savedPositions.length > 0);
  const lastSaved = env.savedPositions[env.savedPositions.length - 1];
  assert.equal(typeof lastSaved.x, 'number');
  assert.equal(typeof lastSaved.y, 'number');

  // Shift + Arrow moves by 50px
  const countBefore = env.savedPositions.length;
  cardEl.dispatchEvent({ type: 'keydown', key: 'ArrowRight', shiftKey: true, preventDefault() {} });
  assert.equal(env.savedPositions.length, countBefore + 1);

  card.destroy();
});

test('flying mana light lifecycle spawns particles, animates keyframes and triggers seal absorb', async () => {
  const env = createMockEnvironment();
  const card = createAdventurerCard({
    deskSurface: env.deskSurface,
    document: env.document,
    window: env.window,
    reducedMotion: env.reducedMotion,
    onCue: env.onCue,
    icon: env.icon,
    onSavePosition: env.onSavePosition,
    maxConcurrentParticles: 8,
  });

  card.update(500);

  // 250 XP -> ceil(250/60) = 5 mana particles
  card.flyMana({ origin: { x: 400, y: 300 }, deltaXp: 250 });

  // Await particle spawn stagger (5 * 45ms = ~225ms)
  await new Promise(r => setTimeout(r, 280));

  assert.equal(env.document.body.children.length, 5, '5 mana particles spawned into body');
  for (const p of env.document.body.children) {
    assert.ok(p.classList.contains('mana-particle'));
  }

  // Complete animations
  for (const anim of env.createdAnimations) {
    anim.finish();
  }
  await new Promise(r => setTimeout(r, 50));

  assert.equal(env.document.body.children.length, 0, 'All particles removed from DOM after absorption');
  assert.ok(env.soundCues.includes('cardDrop'), 'cardDrop cue played on mana absorption');

  card.destroy();
});

test('cancelAll immediately cancels flying mana particles and clears DOM', async () => {
  const env = createMockEnvironment();
  const card = createAdventurerCard({
    deskSurface: env.deskSurface,
    document: env.document,
    window: env.window,
    reducedMotion: env.reducedMotion,
    onCue: env.onCue,
    icon: env.icon,
    onSavePosition: env.onSavePosition,
  });

  card.flyMana({ origin: { x: 300, y: 200 }, deltaXp: 300 });
  await new Promise(r => setTimeout(r, 120));

  assert.ok(env.document.body.children.length > 0, 'Particles are in-flight');

  card.cancelAll();
  assert.equal(env.document.body.children.length, 0, 'All particles cancelled and removed from DOM');

  card.destroy();
});

test('celebrateLevelUp announces rank to live region, lifts card, flashes sheen and shocks wave', () => {
  const env = createMockEnvironment();
  const card = createAdventurerCard({
    deskSurface: env.deskSurface,
    document: env.document,
    window: env.window,
    reducedMotion: env.reducedMotion,
    onCue: env.onCue,
    icon: env.icon,
    onSavePosition: env.onSavePosition,
  });

  card.update(1000, { doneCount: 4 });
  card.celebrateLevelUp(3);

  const statusEl = env.deskSurface.querySelector('.adventurer-card-status');
  assert.equal(statusEl.textContent, 'ขึ้นสู่ LEVEL 3 (นักสำรวจ)!');

  // Verify WAAPI animations triggered (shockwave, card lift, sheen flash, numeral stamp-in)
  assert.ok(env.createdAnimations.length >= 3, 'Created WAAPI animations for celebration');

  card.destroy();
});

test('reduced motion disables particle flight and uses crossfade for rank transitions', async () => {
  const env = createMockEnvironment({ reducedMotion: true });
  const card = createAdventurerCard({
    deskSurface: env.deskSurface,
    document: env.document,
    window: env.window,
    reducedMotion: env.reducedMotion,
    onCue: env.onCue,
    icon: env.icon,
    onSavePosition: env.onSavePosition,
  });

  card.update(500);
  card.flyMana({ origin: { x: 200, y: 200 }, deltaXp: 200 });

  await new Promise(r => setTimeout(r, 100));
  assert.equal(env.document.body.children.length, 0, 'No particles spawned in reduced motion');

  // celebrateLevelUp in reduced motion
  card.celebrateLevelUp(2);
  const statusEl = env.deskSurface.querySelector('.adventurer-card-status');
  assert.equal(statusEl.textContent, 'ขึ้นสู่ LEVEL 2 (ผู้ฝึกหัด)!');

  card.destroy();
});

test('gracefully degrades without WAAPI support without throwing errors', () => {
  const env = createMockEnvironment({ hasWaapi: false });
  const card = createAdventurerCard({
    deskSurface: env.deskSurface,
    document: env.document,
    window: env.window,
    reducedMotion: env.reducedMotion,
    onCue: env.onCue,
    icon: env.icon,
    onSavePosition: env.onSavePosition,
  });

  assert.doesNotThrow(() => {
    card.update(750, { doneCount: 2 });
    card.flyMana({ origin: { x: 100, y: 100 }, deltaXp: 100 });
    card.celebrateLevelUp(2);
    card.flip();
    card.cancelAll();
    card.destroy();
  });
});

test('model adventurerCard normalization, persistence and legacy backup import', () => {
  const initial = createInitialState();
  // Optional field: undefined by default to preserve zero legacy key leakage
  assert.equal(initial.adventurerCard, undefined);
  assert.deepEqual(initial.adventurerCard ?? DEFAULT_ADVENTURER_CARD, DEFAULT_ADVENTURER_CARD);

  // Normalization validates coordinates, name, emblem, and imageDataUrl
  const normalized = normalizeAdventurerCard({ x: 250, y: 350, name: 'นักรบแห่งแสง', emblem: 'swords' });
  assert.equal(normalized.x, 250);
  assert.equal(normalized.y, 350);
  assert.equal(normalized.name, 'นักรบแห่งแสง');
  assert.equal(normalized.emblem, 'swords');
  assert.equal(normalized.imageDataUrl, null);

  // Default values when optional fields are omitted
  const defaults = normalizeAdventurerCard({ x: 18, y: 18 });
  assert.equal(defaults.name, '');
  assert.equal(defaults.emblem, 'shield');
  assert.equal(defaults.imageDataUrl, null);

  // Throws if out of bounds
  assert.throws(() => normalizeAdventurerCard({ x: -10, y: 50 }));
  assert.throws(() => normalizeAdventurerCard({ x: 50, y: 99999 }));

  // updateAdventurerCard updates state cleanly
  const updated = updateAdventurerCard(initial, { x: 120, y: 340, name: 'จอมเวทคาร์ล', emblem: 'feather' });
  assert.equal(updated.adventurerCard.x, 120);
  assert.equal(updated.adventurerCard.y, 340);
  assert.equal(updated.adventurerCard.name, 'จอมเวทคาร์ล');
  assert.equal(updated.adventurerCard.emblem, 'feather');

  // Legacy backup import without adventurerCard key parses cleanly without adding redundant key
  const serialized = serializeState(initial);
  const parsed = JSON.parse(serialized);
  delete parsed.adventurerCard;
  const legacyJson = JSON.stringify(parsed);

  const imported = parseState(legacyJson);
  assert.equal(imported.adventurerCard, undefined, 'Missing adventurerCard remains undefined in parsed state');
  assert.deepEqual(imported.adventurerCard ?? DEFAULT_ADVENTURER_CARD, DEFAULT_ADVENTURER_CARD, 'Fallback to default matches DEFAULT_ADVENTURER_CARD');
});

test('clicking edit button, portrait, or back edit button invokes onEdit callback', () => {
  const env = createMockEnvironment();
  let editCount = 0;
  const card = createAdventurerCard({
    deskSurface: env.deskSurface,
    document: env.document,
    window: env.window,
    reducedMotion: env.reducedMotion,
    onCue: env.onCue,
    icon: env.icon,
    onSavePosition: env.onSavePosition,
    onEdit: () => { editCount++; },
  });

  const cardEl = env.deskSurface.querySelector('.adventurer-card');
  const editIconBtn = cardEl.querySelector('.adventurer-edit-icon-btn');
  const portraitFrame = cardEl.querySelector('.adventurer-portrait-frame');
  const backEditBtn = cardEl.querySelector('.adventurer-back-edit-btn');

  assert.ok(editIconBtn, 'Front edit icon button rendered');
  assert.ok(portraitFrame, 'Front portrait frame rendered');
  assert.ok(backEditBtn, 'Back edit button rendered');

  editIconBtn.click();
  assert.equal(editCount, 1, 'Clicking edit icon button triggers onEdit');

  portraitFrame.click();
  assert.equal(editCount, 2, 'Clicking portrait frame triggers onEdit');

  backEditBtn.click();
  assert.equal(editCount, 3, 'Clicking back edit button triggers onEdit');

  card.destroy();
});

test('enlarged inspection viewer opens on inspect button / dblclick and plays cardDrop cue', () => {
  const env = createMockEnvironment();
  const card = createAdventurerCard({
    deskSurface: env.deskSurface,
    document: env.document,
    window: env.window,
    reducedMotion: env.reducedMotion,
    onCue: env.onCue,
    icon: env.icon,
    onSavePosition: env.onSavePosition,
  });

  assert.equal(ADVENTURER_CARD_SIZE.width, 320);
  assert.equal(ADVENTURER_CARD_SIZE.height, 202);

  card.update(750, { name: 'KANGFU', emblem: 'swords' });

  const cardEl = env.deskSurface.querySelector('.adventurer-card');
  const inspectBtn = cardEl.querySelector('.adventurer-inspect-icon-btn');
  assert.ok(inspectBtn, 'Inspect button rendered in topbar');

  // Inspect button opens viewer
  assert.equal(card.isViewerOpen, false);
  inspectBtn.click();
  assert.equal(card.isViewerOpen, true, 'Viewer is open after clicking inspect');
  assert.ok(env.soundCues.includes('cardDrop'), 'cardDrop cue played on viewer open');

  const dialog = env.document.body.querySelector('.adventurer-card-viewer-dialog');
  assert.ok(dialog, 'Viewer dialog appended to document.body');

  // Close viewer via close method
  card.closeViewer();
  assert.equal(card.isViewerOpen, false, 'Viewer is closed');

  // Double click on card opens viewer
  cardEl.dispatchEvent({ type: 'dblclick', preventDefault() {}, stopPropagation() {} });
  assert.equal(card.isViewerOpen, true, 'Viewer is open after dblclick');

  // Escape closes viewer
  dialog.dispatchEvent({ type: 'keydown', key: 'Escape', preventDefault() {} });
  assert.equal(card.isViewerOpen, false, 'Viewer closed on Escape key');

  // Flipping card plays cardDrop cue
  const cueCount = env.soundCues.filter(c => c === 'cardDrop').length;
  card.flip();
  assert.ok(env.soundCues.filter(c => c === 'cardDrop').length > cueCount, 'cardDrop cue played on card flip');

  card.destroy();
  assert.equal(card.isViewerOpen, false);
});

test('card dragging lifts with --lift 3.2, tracks tactile sway and tilts, and settles with cardDrop on release', () => {
  const env = createMockEnvironment();
  const card = createAdventurerCard({
    deskSurface: env.deskSurface,
    document: env.document,
    window: env.window,
    reducedMotion: env.reducedMotion,
    onCue: env.onCue,
    icon: env.icon,
    onSavePosition: env.onSavePosition,
  });

  const cardEl = env.deskSurface.querySelector('.adventurer-card');
  const cardInner = cardEl.querySelector('.adventurer-card-inner');

  // Resting state: lift is 1, not dragging
  assert.equal(cardEl.classList.contains('is-dragging'), false);
  assert.equal(cardEl.style.getPropertyValue('--lift') || '1', '1');

  // Pointerdown at (100, 200)
  cardEl.dispatchEvent({ type: 'pointerdown', button: 0, clientX: 100, clientY: 200, preventDefault() {} });
  assert.equal(cardEl.classList.contains('is-dragging'), false, 'Not dragging yet before movement threshold');

  // Move by 30px to (130, 220) -> crosses 4px threshold
  env.window.dispatchEvent({ type: 'pointermove', clientX: 130, clientY: 220 });

  assert.equal(cardEl.classList.contains('is-dragging'), true, 'Enters is-dragging state');
  assert.equal(cardEl.style.getPropertyValue('--lift'), '3.2', 'Desk elevation lift increases to 3.2 for expanded shadow');
  assert.match(cardInner.style.transform, /scale\(1\.028\)/, 'Card inner scales up to lift off table');
  assert.match(cardInner.style.transform, /rotate\(/, 'Card inner has rotational sway');

  // Pointerup releases card onto desk
  const animsBefore = env.createdAnimations.length;
  const cuesBefore = env.soundCues.filter(c => c === 'cardDrop').length;
  env.window.dispatchEvent({ type: 'pointerup' });

  assert.equal(cardEl.classList.contains('is-dragging'), false, 'Exits is-dragging state');
  assert.equal(cardEl.style.getPropertyValue('--lift'), '1', 'Desk elevation lift returns to 1');
  assert.ok(env.soundCues.filter(c => c === 'cardDrop').length > cuesBefore, 'cardDrop cue played on landing');
  assert.ok(env.savedPositions.length > 0, 'New position committed');

  // Settle animation keyframes triggered on cardInner
  const settleAnims = env.createdAnimations.slice(animsBefore).filter(a => a.element === cardInner);
  assert.equal(settleAnims.length, 1, 'WAAPI settle animation triggered on cardInner');
  assert.ok(settleAnims[0].keyframes.length >= 4, 'Settle keyframes include anticipation and rebound');

  card.destroy();
});
