import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  createQuest,
} from '../dist/model.mjs';
import {
  isChronicleEligible,
  chronicleQuests,
  chronicleStats,
  reopenQuest,
  markQuestTurnedIn,
} from '../dist/guild-chronicle-model.mjs';
import { createGuildChronicle } from '../dist/guild-chronicle.mjs';
import { trayItems } from '../dist/storage-tray.mjs';

// =========================================================================
// 1. Model Unit Tests
// =========================================================================

test('isChronicleEligible correctly identifies quests belonging to the Chronicle', () => {
  assert.equal(isChronicleEligible(null), false);
  assert.equal(isChronicleEligible({ type: 'folder' }), false);
  assert.equal(isChronicleEligible({ type: 'photo' }), false);
  assert.equal(isChronicleEligible({ type: 'notebook' }), false);
  assert.equal(isChronicleEligible({ type: 'quest', status: 'active' }), false);
  assert.equal(isChronicleEligible({ type: 'quest', status: 'failed' }), false);
  assert.equal(isChronicleEligible({ type: 'quest', status: 'done', turnedIn: true }), true);
  assert.equal(isChronicleEligible({ type: 'quest', status: 'done', archived: true }), true);
});

test('chronicleQuests filters and sorts completed quests accurately', () => {
  const items = [
    { id: 'q1', type: 'quest', status: 'done', turnedIn: true, title: 'กำจัดก็อบลิน', category: 'ปราบมอนสเตอร์', priority: 'high', xp: 100, turnedInAt: '2026-11-10T10:00:00Z' },
    { id: 'q2', type: 'quest', status: 'done', turnedIn: true, title: 'เก็บสมุนไพรราตรี', category: 'เก็บเกี่ยว', priority: 'normal', xp: 50, turnedInAt: '2026-11-15T12:00:00Z' },
    { id: 'q3', type: 'quest', status: 'done', turnedIn: true, title: 'ส่งจดหมายลับ', category: 'ส่งของ', priority: 'low', xp: 30, turnedInAt: '2026-11-20T14:00:00Z' },
    { id: 'q4', type: 'quest', status: 'active', title: 'เควสที่ยังทำอยู่', priority: 'high' },
  ];

  // Sorting newest to oldest
  const all = chronicleQuests(items);
  assert.equal(all.length, 3);
  assert.deepEqual(all.map(q => q.id), ['q3', 'q2', 'q1']);

  // Search by title
  const searched = chronicleQuests(items, { search: 'สมุนไพร' });
  assert.equal(searched.length, 1);
  assert.equal(searched[0].id, 'q2');

  // Filter by rank
  const rankA = chronicleQuests(items, { rank: 'A' });
  assert.equal(rankA.length, 1);
  assert.equal(rankA[0].id, 'q1');

  const rankB = chronicleQuests(items, { rank: 'B' });
  assert.equal(rankB.length, 1);
  assert.equal(rankB[0].id, 'q2');

  const rankC = chronicleQuests(items, { rank: 'C' });
  assert.equal(rankC.length, 1);
  assert.equal(rankC[0].id, 'q3');
});

test('chronicleStats calculates aggregate metrics correctly', () => {
  const items = [
    { id: 'q1', type: 'quest', status: 'done', turnedIn: true, category: 'ล่ามอนสเตอร์', priority: 'high', xp: 150 },
    { id: 'q2', type: 'quest', status: 'done', turnedIn: true, category: 'ล่ามอนสเตอร์', priority: 'normal', xp: 75 },
    { id: 'q3', type: 'quest', status: 'done', turnedIn: true, category: 'สำรวจ', priority: 'low', xp: 40 },
    { id: 'q4', type: 'quest', status: 'active', xp: 200 },
  ];

  const stats = chronicleStats(items);
  assert.equal(stats.totalQuests, 3);
  assert.equal(stats.totalXp, 265);
  assert.equal(stats.byCategory['ล่ามอนสเตอร์'], 2);
  assert.equal(stats.byCategory['สำรวจ'], 1);
  assert.equal(stats.byRank.A, 1);
  assert.equal(stats.byRank.B, 1);
  assert.equal(stats.byRank.C, 1);
});

test('markQuestTurnedIn records quest as completed, archived and turnedIn', () => {
  const state = createInitialState();
  const q = createQuest({ title: 'เควสทดสอบ' }, state);
  state.items = [q];

  const next = markQuestTurnedIn(state, q.id, '2026-11-20T16:00:00Z');
  const quest = next.items.find(i => i.id === q.id);
  assert.equal(quest.status, 'done');
  assert.equal(quest.archived, true);
  assert.equal(quest.turnedIn, true);
  assert.equal(quest.turnedInAt, '2026-11-20T16:00:00Z');
});

test('reopenQuest returns completed quest back to active board state', () => {
  const state = createInitialState();
  const q = createQuest({ title: 'เควสทดสอบ', status: 'done', archived: true, turnedIn: true, turnedInAt: '2026-11-20T16:00:00Z' }, state);
  state.items = [q];

  const next = reopenQuest(state, q.id);
  const quest = next.items.find(i => i.id === q.id);
  assert.equal(quest.status, 'active');
  assert.equal(quest.archived, false);
  assert.equal(quest.turnedIn, false);
  assert.equal(quest.turnedInAt, null);
});

test('trayItems excludes turnedIn quests from right storage drawer', () => {
  const state = {
    items: [
      { id: 'q1', type: 'quest', status: 'active', archived: true, turnedIn: false, title: 'Active in drawer' },
      { id: 'q2', type: 'quest', status: 'done', archived: true, turnedIn: true, title: 'Turned in quest' },
      { id: 'f1', type: 'folder', archived: true, title: 'Quest Folder' },
    ],
  };

  const tray = trayItems(state);
  const ids = tray.map(i => i.id);
  assert.ok(ids.includes('q1'), 'Active archived quest remains in drawer');
  assert.ok(ids.includes('f1'), 'Folder remains in drawer');
  assert.ok(!ids.includes('q2'), 'TurnedIn completed quest is isolated from right drawer');
});

// =========================================================================
// 2. Component DOM Mock Tests
// =========================================================================

function createMockDomTree() {
  const elements = [];

  function createNode(tag = 'div') {
    const classSet = new Set();
    const attrs = new Map();
    const listeners = new Map();
    const children = [];

    const node = {
      tagName: tag.toUpperCase(),
      parentNode: null,
      children,
      style: {},
      dataset: {},
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
      listeners,
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
        node.dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {} });
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
    };

    let rawHtml = '';
    Object.defineProperty(node, 'innerHTML', {
      get: () => rawHtml,
      set: html => {
        rawHtml = html;
        children.length = 0;
        parseHtmlInto(node, html);
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
    const tokenRegex = /<!--[\s\S]*?-->|<(\/)?([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
    const stack = [parent];
    const selfClosing = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    let match;

    while ((match = tokenRegex.exec(html)) !== null) {
      const [full, isClose, tag, rawAttrs, textContent] = match;
      if (full.startsWith('<!--')) continue;
      if (textContent) {
        const top = stack[stack.length - 1];
        if (top) top.textContent = (top.textContent || '') + textContent.trim();
        continue;
      }
      if (isClose) {
        const tagName = tag.toUpperCase();
        for (let i = stack.length - 1; i > 0; i--) {
          if (stack[i].tagName === tagName) {
            stack.splice(i);
            break;
          }
        }
        continue;
      }
      const el = createNode(tag);
      if (rawAttrs) {
        const attrRegex = /([a-zA-Z0-9_-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^>\s]+)))?/g;
        let am;
        while ((am = attrRegex.exec(rawAttrs)) !== null) {
          const k = am[1];
          const v = am[2] ?? am[3] ?? am[4] ?? '';
          el.setAttribute(k, v);
          if (k === 'class') {
            v.split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c));
          } else if (k === 'id') {
            el.id = v;
          } else if (k.startsWith('data-')) {
            const prop = k.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
            el.dataset[prop] = v;
          }
        }
      }
      const currentParent = stack[stack.length - 1];
      currentParent.appendChild(el);
      const isVoid = selfClosing.has(tag.toLowerCase()) || rawAttrs.trim().endsWith('/');
      if (!isVoid) {
        stack.push(el);
      }
    }
  }

  const doc = {
    body: createNode('body'),
    createElement: tag => createNode(tag),
  };

  return { doc, elements };
}

test('createGuildChronicle lifecycle: opens, renders items, showcases, and reopens', () => {
  const { doc } = createMockDomTree();
  const cues = [];
  const reopened = [];
  let committedState = null;

  const mockState = createInitialState();
  const q1 = createQuest({ id: 'q1', status: 'done', turnedIn: true, title: 'ปราบมังกรแดง', category: 'งานหลัก', priority: 'high', xp: 200, turnedInAt: '2026-11-20T10:00:00Z' }, mockState);
  const q2 = createQuest({ id: 'q2', status: 'done', turnedIn: true, title: 'ส่งข่าวสาร', category: 'ชีวิตประจำวัน', priority: 'normal', xp: 50, turnedInAt: '2026-11-19T10:00:00Z' }, mockState);
  mockState.items = [q1, q2];

  const chronicle = createGuildChronicle({
    document: doc,
    window: { setTimeout: fn => fn(), clearTimeout: () => {} },
    getState: () => committedState || mockState,
    commit: next => { committedState = next; },
    icon: name => `[icon:${name}]`,
    onCue: name => cues.push(name),
    onReopen: q => reopened.push(q),
  });

  assert.equal(chronicle.isOpen, false);

  // Open the chronicle
  chronicle.open();
  assert.equal(chronicle.isOpen, true);
  assert.ok(chronicle.element !== null);
  assert.ok(cues.includes('folderOpen'));

  const stage = chronicle.element.querySelector('[data-showcase-stage]');
  assert.ok(stage !== null);
  const seal = chronicle.element.querySelector('.chronicle-accepted-seal');
  assert.ok(seal !== null, 'Golden GUILD ACCEPTED seal is mounted');

  // Check stats
  const totalEl = chronicle.element.querySelector('[data-stat-total]');
  assert.ok(totalEl !== null);
  assert.equal(totalEl.textContent, '2 เควส');

  // Check rows
  const rows = chronicle.element.querySelectorAll('.chronicle-row');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].dataset.questId, q1.id);

  // Test item selection
  rows[1].click();
  assert.ok(cues.includes('paperSlide'));

  // Test reopen action
  const reopenBtn = chronicle.element.querySelector('[data-action="reopen"]');
  assert.ok(reopenBtn !== null);
  reopenBtn.click();

  assert.equal(reopened.length, 1);
  assert.equal(reopened[0].id, q2.id);
  assert.ok(committedState !== null);
  const reopenedQuest = committedState.items.find(i => i.id === q2.id);
  assert.equal(reopenedQuest.status, 'active');
  assert.equal(reopenedQuest.turnedIn, false);

  // Close the chronicle
  chronicle.close({ animate: true });
  assert.equal(chronicle.isOpen, false);
  assert.equal(chronicle.element, null);
  assert.ok(cues.includes('drawerClose'));
});
