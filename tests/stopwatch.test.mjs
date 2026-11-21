import test from 'node:test';
import assert from 'node:assert/strict';
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
} from '../dist/stopwatch-model.mjs';
import { createStopwatch } from '../dist/stopwatch.mjs';
import { createInitialState } from '../dist/model.mjs';

// =========================================================================
// 1. Model Unit Tests
// =========================================================================

test('normalizeStopwatch applies sensible defaults and validates coordinates & boundaries', () => {
  const def = normalizeStopwatch(undefined);
  assert.equal(def.x, DEFAULT_STOPWATCH.x);
  assert.equal(def.y, DEFAULT_STOPWATCH.y);
  assert.equal(def.mode, 'pomodoro');
  assert.equal(def.status, 'idle');
  assert.equal(def.duration, 1500);

  const custom = normalizeStopwatch({
    x: 350.6,
    y: 220.2,
    mode: 'stopwatch',
    status: 'running',
    duration: 1800,
    accumulatedMs: 5000,
    startedAt: 123456789,
    pinnedQuestId: 'q-valid',
  }, [{ id: 'q-valid', type: 'quest' }]);

  assert.equal(custom.x, 351);
  assert.equal(custom.y, 220);
  assert.equal(custom.mode, 'stopwatch');
  assert.equal(custom.status, 'running');
  assert.equal(custom.duration, 1800);
  assert.equal(custom.accumulatedMs, 5000);
  assert.equal(custom.startedAt, 123456789);
  assert.equal(custom.pinnedQuestId, 'q-valid');
});

test('normalizeStopwatch discards pinnedQuestId if quest does not exist', () => {
  const norm = normalizeStopwatch({ pinnedQuestId: 'missing-quest' }, []);
  assert.equal(norm.pinnedQuestId, null);
});

test('getStopwatchTime calculates countdown and hand degrees in Pomodoro mode', () => {
  const sw = {
    mode: 'pomodoro',
    status: 'running',
    duration: 1500, // 25 min
    accumulatedMs: 0,
    startedAt: 100000,
  };

  // At start (now = 100000): remaining = 1500s (25:00)
  const t0 = getStopwatchTime(sw, 100000);
  assert.equal(t0.formatted, '25:00');
  assert.equal(t0.isFinished, false);
  assert.equal(t0.minuteHandDeg, 150); // 25 mins * 6 deg = 150 deg

  // After 60 seconds (now = 160000): remaining = 1440s (24:00)
  const t1 = getStopwatchTime(sw, 160000);
  assert.equal(t1.formatted, '24:00');
  assert.equal(t1.isFinished, false);
  assert.equal(t1.minuteHandDeg, 144); // 24 mins * 6 deg = 144 deg

  // When timer finishes (now = 100000 + 1500000 = 1600000)
  const tEnd = getStopwatchTime(sw, 1600000);
  assert.equal(tEnd.formatted, '00:00');
  assert.equal(tEnd.isFinished, true);
  assert.equal(tEnd.minuteHandDeg, 0);
});

test('getStopwatchTime calculates elapsed count-up in Stopwatch mode', () => {
  const sw = {
    mode: 'stopwatch',
    status: 'running',
    duration: 1500,
    accumulatedMs: 0,
    startedAt: 50000,
  };

  // At start
  const t0 = getStopwatchTime(sw, 50000);
  assert.equal(t0.formatted, '00:00');
  assert.equal(t0.isFinished, false);

  // After 65 seconds (1 min 5 sec)
  const t1 = getStopwatchTime(sw, 115000);
  assert.equal(t1.formatted, '01:05');
  assert.equal(t1.isFinished, false);
});

test('stopwatch state transitions: start, pause, reset, switchMode, setDuration', () => {
  let sw = { ...DEFAULT_STOPWATCH };

  // Start
  sw = startStopwatch(sw, 10000);
  assert.equal(sw.status, 'running');
  assert.equal(sw.startedAt, 10000);

  // Pause after 5 seconds
  sw = pauseStopwatch(sw, 15000);
  assert.equal(sw.status, 'paused');
  assert.equal(sw.accumulatedMs, 5000);
  assert.equal(sw.startedAt, null);

  // Resume for 3 seconds
  sw = startStopwatch(sw, 20000);
  assert.equal(sw.status, 'running');
  sw = pauseStopwatch(sw, 23000);
  assert.equal(sw.accumulatedMs, 8000);

  // Reset
  sw = resetStopwatch(sw);
  assert.equal(sw.status, 'idle');
  assert.equal(sw.accumulatedMs, 0);

  // Switch mode
  sw = switchMode(sw);
  assert.equal(sw.mode, 'stopwatch');
  sw = switchMode(sw);
  assert.equal(sw.mode, 'pomodoro');

  // Change preset duration
  sw = setDuration(sw, 50 * 60);
  assert.equal(sw.duration, 3000);

  // Pin quest
  sw = pinQuest(sw, 'quest-123');
  assert.equal(sw.pinnedQuestId, 'quest-123');
});

test('updateStopwatch safely integrates into state', () => {
  const state = createInitialState();
  const next = updateStopwatch(state, { x: 500, y: 300, mode: 'stopwatch' });
  assert.ok(next.stopwatch);
  assert.equal(next.stopwatch.x, 500);
  assert.equal(next.stopwatch.y, 300);
  assert.equal(next.stopwatch.mode, 'stopwatch');
});

// =========================================================================
// 2. Component DOM & Interaction Mock Tests
// =========================================================================

function createMockDomTree() {
  const elements = [];

  function createNode(tag = 'div') {
    const classSet = new Set();
    const attrs = new Map();
    const listeners = new Map();
    const children = [];
    const styleProps = new Map();

    const node = {
      tagName: tag.toUpperCase(),
      parentNode: null,
      children,
      dataset: {},
      style: {
        setProperty: (k, v) => styleProps.set(k, String(v)),
        getPropertyValue: k => styleProps.get(k) ?? '',
        get left() { return styleProps.get('left') || ''; },
        set left(v) { styleProps.set('left', String(v)); },
        get top() { return styleProps.get('top') || ''; },
        set top(v) { styleProps.set('top', String(v)); },
      },
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
        let stopped = false;
        evt.stopPropagation = () => { stopped = true; };
        evt.preventDefault = () => {};
        let cur = node;
        while (cur && !stopped) {
          const list = cur.listeners?.get(evt.type) || [];
          for (const h of list) {
            h(evt);
            if (stopped) break;
          }
          cur = cur.parentNode;
        }
      },
      click: () => {
        node.dispatchEvent({ type: 'click' });
      },
      closest: sel => {
        let cur = node;
        while (cur) {
          if (nodeMatches(cur, sel)) return cur;
          cur = cur.parentNode;
        }
        return null;
      },
      querySelector: sel => findInNode(node, sel),
      querySelectorAll: sel => findAllInNode(node, sel),
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
      listeners,
    };

    let rawHtml = '';
    let textVal = '';
    Object.defineProperty(node, 'innerHTML', {
      get: () => rawHtml,
      set: html => {
        rawHtml = html;
        children.length = 0;
        parseHtmlInto(node, html);
      },
    });

    Object.defineProperty(node, 'textContent', {
      get: () => textVal || rawHtml.replace(/<[^>]+>/g, ''),
      set: txt => {
        textVal = txt;
        rawHtml = txt;
        children.length = 0;
      },
    });

    elements.push(node);
    return node;
  }

  function nodeMatches(node, sel) {
    if (!sel || !node) return false;
    if (sel.startsWith('.')) return node.classList.contains(sel.slice(1));
    if (sel.startsWith('#')) return node.getAttribute('id') === sel.slice(1);
    if (sel.startsWith('[')) {
      const match = sel.match(/\[([a-zA-Z0-9_-]+)(?:="?([^"\]]*)"?)?\]/);
      if (match) {
        const [, attr, val] = match;
        if (val !== undefined) return node.getAttribute(attr) === val;
        return node.hasAttribute(attr);
      }
    }
    return node.tagName.toLowerCase() === sel.toLowerCase();
  }

  function findInNode(root, sel) {
    for (const child of root.children) {
      if (nodeMatches(child, sel)) return child;
      const found = findInNode(child, sel);
      if (found) return found;
    }
    return null;
  }

  function findAllInNode(root, sel, result = []) {
    for (const child of root.children) {
      if (nodeMatches(child, sel)) result.push(child);
      findAllInNode(child, sel, result);
    }
    return result;
  }

  function parseHtmlInto(parent, html) {
    const tagRegex = /<([a-zA-Z0-9-]+)([^>]*)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9-]+)([^>]*)\/>/g;
    let match;
    let lastIdx = 0;

    while ((match = tagRegex.exec(html)) !== null) {
      const tagName = match[1] || match[4];
      const attrStr = match[2] || match[5] || '';
      const inner = match[3] || '';

      const el = createNode(tagName);
      const attrRegex = /([a-zA-Z0-9_-]+)(?:="([^"]*)")?/g;
      let aMatch;
      while ((aMatch = attrRegex.exec(attrStr)) !== null) {
        const attrName = aMatch[1];
        const attrVal = aMatch[2] !== undefined ? aMatch[2] : '';
        if (attrName === 'class') {
          attrVal.split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c));
        } else if (attrName.startsWith('data-')) {
          el.dataset[attrName.slice(5)] = attrVal;
          el.setAttribute(attrName, attrVal);
        } else {
          el.setAttribute(attrName, attrVal);
        }
      }

      if (inner) {
        el.innerHTML = inner;
      }
      parent.appendChild(el);
      lastIdx = tagRegex.lastIndex;
    }
  }

  const doc = {
    createElement: tag => createNode(tag),
    getElementById: id => elements.find(e => e.getAttribute('id') === id) || null,
    querySelector: sel => elements.find(e => nodeMatches(e, sel)) || null,
    querySelectorAll: sel => elements.filter(e => nodeMatches(e, sel)),
  };

  return { doc, createNode };
}

test('createStopwatch component mounts onto canvas, handles crown/pusher clicks, and updates hands', () => {
  const { doc } = createMockDomTree();
  const canvas = doc.createElement('div');
  const cues = [];
  let committedState = null;

  const mockState = createInitialState();
  mockState.stopwatch = { ...DEFAULT_STOPWATCH, x: 200, y: 150 };

  const swControl = createStopwatch({
    canvas,
    document: doc,
    getState: () => committedState || mockState,
    commit: next => { committedState = next; },
    onCue: name => cues.push(name),
    icon: name => `[icon:${name}]`,
  });

  assert.ok(swControl.element !== null, 'Stopwatch element is mounted into canvas');
  assert.equal(swControl.element.style.left, '200px');
  assert.equal(swControl.element.style.top, '150px');

  // Verify elements exist
  const crown = swControl.element.querySelector('[data-action="crown"]');
  assert.ok(crown !== null, 'Crown assembly is rendered');
  const pusher = swControl.element.querySelector('[data-action="pusher"]');
  assert.ok(pusher !== null, 'Side pusher button is rendered');
  const digitalTime = swControl.element.querySelector('[data-digital-time]');
  assert.ok(digitalTime !== null, 'Digital time is rendered');

  // Crown click starts the timer
  crown.click();
  assert.ok(committedState !== null);
  assert.equal(committedState.stopwatch.status, 'running');
  assert.ok(cues.includes('paperweightDrop'));

  // Crown click again pauses the timer
  crown.click();
  assert.equal(committedState.stopwatch.status, 'paused');

  // Pusher click resets the timer
  pusher.click();
  assert.equal(committedState.stopwatch.status, 'idle');
  assert.equal(committedState.stopwatch.accumulatedMs, 0);

  // Destroy cleanup
  swControl.destroy();
  assert.equal(swControl.element, null);
});
