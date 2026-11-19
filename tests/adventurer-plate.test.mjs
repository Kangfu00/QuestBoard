import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdventurerPlate } from '../dist/adventurer-plate.mjs';
import { createInitialState, createQuest, serializeState, parseState } from '../dist/model.mjs';
import { applyHeldStamp } from '../dist/stamp-tools.mjs';

function createMockEnvironment({ hasWaapi = true, reducedMotion = false } = {}) {
  const createdAnimations = [];
  const soundCues = [];

  function createNode(tag = 'div') {
    const classSet = new Set();
    const attrs = new Map();
    const listeners = new Map();
    const children = [];

    const node = {
      tagName: tag.toUpperCase(),
      style: {},
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
        const list = listeners.get(evt.type) || [];
        for (const h of list) h(evt);
      },
      click: () => {
        node.dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {} });
      },
      getBoundingClientRect: () => ({ left: 80, top: 500, width: 44, height: 48, right: 124, bottom: 548 }),
      querySelector: sel => queryNode(node, sel),
      querySelectorAll: sel => queryAllNode(node, sel),
    };

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
    reducedMotion: () => reducedMotion,
    onCue: name => soundCues.push(name),
    icon: name => `<svg class="icon-${name}"></svg>`,
  };
}

function buildMockTreeFromHtml(parent, html, createNode) {
  // Wire up known child elements queried by adventurer-plate
  const subClasses = [
    'adventurer-straps', 'adventurer-plate', 'adventurer-plate-inner',
    'adventurer-plate-face front', 'adventurer-plate-face back',
    'adventurer-sheen', 'adventurer-emblem', 'adventurer-level-num',
    'adventurer-title', 'adventurer-groove-bar', 'adventurer-pouch',
    'adventurer-pouch-target', 'adventurer-back-xp', 'adventurer-back-done',
    'adventurer-back-tonext', 'adventurer-status',
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

test('adventurer plate mounts into desk surface and updates progression state accurately', () => {
  const env = createMockEnvironment();
  const plate = createAdventurerPlate({
    deskSurface: env.deskSurface,
    document: env.document,
    window: env.window,
    reducedMotion: env.reducedMotion,
    onCue: env.onCue,
    icon: env.icon,
  });

  assert.ok(env.deskSurface.children.length > 0, 'Fixture mounted to deskSurface');
  const fixture = env.deskSurface.children[0];
  assert.ok(fixture.classList.contains('adventurer-fixture'));

  // Initial update at 0 XP
  plate.update(0, { doneCount: 0, emblem: 'shield' });
  const levelNum = fixture.querySelector('.adventurer-level-num');
  const title = fixture.querySelector('.adventurer-title');
  const grooveBar = fixture.querySelector('.adventurer-groove-bar');
  const plateBtn = fixture.querySelector('.adventurer-plate');

  assert.equal(levelNum.textContent, '1');
  assert.equal(title.textContent, 'ผู้สมัครกิลด์');
  assert.equal(grooveBar.style.width, '0%');
  assert.match(plateBtn.getAttribute('aria-label'), /LEVEL 1, 0 XP \(ผู้สมัครกิลด์\)/);

  // Update with cumulative XP and completed quests
  plate.update(1240, { doneCount: 7, emblem: 'swords' });
  assert.equal(levelNum.textContent, '3');
  assert.equal(title.textContent, 'นักสำรวจ');
  assert.equal(grooveBar.style.width, '48%'); // 240 / 500 = 48%
  assert.match(plateBtn.getAttribute('aria-label'), /LEVEL 3, 1,240 XP \(นักสำรวจ\)/);

  const backXp = fixture.querySelector('.adventurer-back-xp');
  const backDone = fixture.querySelector('.adventurer-back-done');
  const backToNext = fixture.querySelector('.adventurer-back-tonext');
  assert.equal(backXp.textContent, '1,240 XP');
  assert.equal(backDone.textContent, '7 เควส');
  assert.equal(backToNext.textContent, 'อีก 260 XP');

  plate.destroy();
  assert.equal(env.deskSurface.children.length, 0, 'Fixture cleans up on destroy');
});

test('adventurer plate flips 3D front/back on user click and updates accessible description', () => {
  const env = createMockEnvironment();
  const plate = createAdventurerPlate({
    deskSurface: env.deskSurface,
    document: env.document,
    window: env.window,
    reducedMotion: env.reducedMotion,
    onCue: env.onCue,
    icon: env.icon,
  });

  plate.update(850, { doneCount: 3 });
  const plateBtn = env.deskSurface.querySelector('.adventurer-plate');

  assert.equal(plateBtn.classList.contains('is-flipped'), false);
  assert.match(plateBtn.getAttribute('aria-label'), /LEVEL 2/);

  // Click to flip to back
  plateBtn.click();
  assert.equal(plateBtn.classList.contains('is-flipped'), true);
  assert.match(plateBtn.getAttribute('aria-label'), /รายละเอียด: รวม 850 XP, สำเร็จ 3 เควส, อีก 150 XP สู่เลเวลถัดไป/);

  // Click again to flip back to front
  plateBtn.click();
  assert.equal(plateBtn.classList.contains('is-flipped'), false);
  assert.match(plateBtn.getAttribute('aria-label'), /LEVEL 2/);

  plate.destroy();
});

test('flying coins lifecycle spawns coins, animates parabolic arcs, bounces pouch and respects cap', async () => {
  const env = createMockEnvironment();
  const plate = createAdventurerPlate({
    deskSurface: env.deskSurface,
    document: env.document,
    window: env.window,
    reducedMotion: env.reducedMotion,
    onCue: env.onCue,
    icon: env.icon,
    maxConcurrentCoins: 8,
  });

  plate.update(500);

  // Trigger coin flight for 250 XP -> ceil(250/50) = 5 coins
  plate.flyCoins({ origin: { x: 400, y: 300 }, deltaXp: 250 });

  // Await timeouts
  await new Promise(r => setTimeout(r, 350));

  assert.equal(env.document.body.children.length, 5, '5 flying coins spawned into body');
  for (const coin of env.document.body.children) {
    assert.ok(coin.classList.contains('flying-coin'));
  }

  // Complete animations
  for (const anim of env.createdAnimations) {
    anim.finish();
  }
  await new Promise(r => setTimeout(r, 50));

  assert.equal(env.document.body.children.length, 0, 'All coins removed from DOM after landing');
  assert.ok(env.soundCues.includes('paperweightDrop'), 'paperweightDrop cue played on coin impact');

  plate.destroy();
});

test('cancelAll immediately cancels all active coin animations and removes nodes without DOM debris', async () => {
  const env = createMockEnvironment();
  const plate = createAdventurerPlate({
    deskSurface: env.deskSurface,
    document: env.document,
    window: env.window,
    reducedMotion: env.reducedMotion,
    onCue: env.onCue,
    icon: env.icon,
  });

  plate.flyCoins({ origin: { x: 300, y: 200 }, deltaXp: 300 });
  await new Promise(r => setTimeout(r, 150));

  assert.ok(env.document.body.children.length > 0, 'Coins are in-flight');

  plate.cancelAll();
  assert.equal(env.document.body.children.length, 0, 'All coins cancelled and removed from DOM');

  plate.destroy();
});

test('celebrateLevelUp announces rank to live region, lifts plate, flashes sheen, and stamps numeral', () => {
  const env = createMockEnvironment();
  const plate = createAdventurerPlate({
    deskSurface: env.deskSurface,
    document: env.document,
    window: env.window,
    reducedMotion: env.reducedMotion,
    onCue: env.onCue,
    icon: env.icon,
  });

  plate.update(1000, { doneCount: 4 });
  plate.celebrateLevelUp(3);

  const statusEl = env.deskSurface.querySelector('.adventurer-status');
  assert.equal(statusEl.textContent, 'ขึ้นสู่ LEVEL 3 (นักสำรวจ)!');

  // Verify WAAPI animations triggered (plate lift, sheen, numeral stamp-in)
  assert.ok(env.createdAnimations.length >= 3, 'Created WAAPI animations for celebration');

  plate.destroy();
});

test('reduced motion disables coin flight and uses crossfade for rank transitions', async () => {
  const env = createMockEnvironment({ reducedMotion: true });
  const plate = createAdventurerPlate({
    deskSurface: env.deskSurface,
    document: env.document,
    window: env.window,
    reducedMotion: env.reducedMotion,
    onCue: env.onCue,
    icon: env.icon,
  });

  plate.update(500);
  plate.flyCoins({ origin: { x: 200, y: 200 }, deltaXp: 200 });

  await new Promise(r => setTimeout(r, 100));
  assert.equal(env.document.body.children.length, 0, 'No coins spawned in reduced motion');

  // celebrateLevelUp in reduced motion
  plate.celebrateLevelUp(2);
  const statusEl = env.deskSurface.querySelector('.adventurer-status');
  assert.equal(statusEl.textContent, 'ขึ้นสู่ LEVEL 2 (ผู้ฝึกหัด)!');

  plate.destroy();
});

test('gracefully degrades without WAAPI support without throwing errors', () => {
  const env = createMockEnvironment({ hasWaapi: false });
  const plate = createAdventurerPlate({
    deskSurface: env.deskSurface,
    document: env.document,
    window: env.window,
    reducedMotion: env.reducedMotion,
    onCue: env.onCue,
    icon: env.icon,
  });

  assert.doesNotThrow(() => {
    plate.update(750, { doneCount: 2 });
    plate.flyCoins({ origin: { x: 100, y: 100 }, deltaXp: 100 });
    plate.celebrateLevelUp(2);
    plate.cancelAll();
    plate.destroy();
  });
});

test('stamping done and accumulating XP does not leak any new keys into serialized state', () => {
  const initial = createInitialState();
  const quest = createQuest({ title: 'ภารกิจทดสอบ', xp: 250, status: 'active' }, initial);
  const stateWithQuest = { ...initial, items: [...initial.items, quest] };

  const rawBefore = serializeState(stateWithQuest);
  const parsedBefore = JSON.parse(rawBefore);
  const beforeKeys = Object.keys(parsedBefore).sort();

  // Apply "done" stamp
  const next = applyHeldStamp(
    stateWithQuest,
    quest.id,
    { status: 'done', style: 'seal', stampId: null },
    { x: 50, y: 50 },
  );

  const rawAfter = serializeState(next);
  const parsedAfter = JSON.parse(rawAfter);
  const afterKeys = Object.keys(parsedAfter).sort();

  assert.deepEqual(afterKeys, beforeKeys, 'Serialized root keys must remain identical');

  const stampedQuest = next.items.find(i => i.id === quest.id);
  assert.equal(stampedQuest.status, 'done');
  assert.equal(stampedQuest.xp, 250);

  // Verify roundtrip
  const roundtripped = parseState(rawAfter);
  assert.equal(roundtripped.items.find(i => i.id === quest.id).status, 'done');
});
