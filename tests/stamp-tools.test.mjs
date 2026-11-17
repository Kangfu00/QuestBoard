import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, createQuest, createLabel, createFolder, addStamp, setArchived, moveQuestToFolder, updateItem, STATUS } from '../dist/model.mjs';
import { chooseStampTool, applyHeldStamp, isStampableTarget } from '../dist/stamp-tools.mjs';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0WQAAAAASUVORK5CYII=';

function boardWithTwoQuests() {
  const state = createInitialState();
  state.items = [];
  state.items.push(createQuest({ title: 'อ่านหนังสือ', xp: 40 }, state));
  state.items.push(createQuest({ title: 'เดินเล่น', xp: 60 }, state));
  return state;
}

test('each regular status tool applies its status and chosen stamp pattern', () => {
  for (const [status, style] of [['done', 'seal'], ['failed', 'rectangle'], ['paused', 'banner']]) {
    const state = boardWithTwoQuests();
    const tool = chooseStampTool(status, style);
    assert.deepEqual(tool, { status, style, stampId: null, dataUrl: null, name: STATUS[status].label });
    const stamped = applyHeldStamp(state, state.items[0].id, tool);
    assert.equal(stamped.items[0].status, status);
    assert.equal(stamped.items[0].stampStyle, style);
    assert.equal(stamped.items[0].stampId, null);
    assert.equal(state.items[0].status, 'active');
  }
  assert.equal(chooseStampTool('done').style, 'seal');
});

test('one held tool can repeatedly stamp two quests without being consumed or duplicating XP', () => {
  const initial = boardWithTwoQuests();
  const tool = Object.freeze(chooseStampTool('done', 'rectangle'));
  const first = applyHeldStamp(initial, initial.items[0].id, tool);
  const second = applyHeldStamp(first, initial.items[1].id, tool);
  const repeated = applyHeldStamp(second, initial.items[0].id, tool);
  assert.deepEqual(repeated, second);
  assert.equal(repeated.items.filter(item => item.status === 'done').reduce((total, item) => total + item.xp, 0), 100);
  assert.equal(tool.status, 'done');
  assert.equal(tool.style, 'rectangle');
  assert.deepEqual(initial.items.map(item => item.status), ['active', 'active']);
});

test('only visible unarchived quest papers are stampable and other targets are unchanged', () => {
  let state = boardWithTwoQuests();
  state.items.push(createLabel({ text: 'หัวข้อภารกิจ' }, state));
  state = setArchived(state, state.items[1].id, true);
  const tool = chooseStampTool('failed');
  assert.equal(isStampableTarget(state.items[0]), true);
  assert.equal(isStampableTarget({ type: 'quest' }), true);
  for (const item of [state.items[1], state.items[2], null, undefined, {}, { type: 'other' }]) {
    assert.equal(isStampableTarget(item), false);
  }
  assert.equal(applyHeldStamp(state, state.items[0].id, null), state);
  assert.equal(applyHeldStamp(state, state.items[1].id, tool), state);
  assert.equal(applyHeldStamp(state, state.items[2].id, tool), state);
  assert.equal(applyHeldStamp(state, 'missing', tool), state);
});

test('invalid statuses, styles, and malformed held tools cannot stamp a quest', () => {
  const state = boardWithTwoQuests();
  for (const status of ['active', 'unknown', '', null, undefined]) assert.throws(() => chooseStampTool(status));
  for (const style of ['circle', '', null]) assert.throws(() => chooseStampTool('done', style));
  for (const tool of [{}, { status: 'active', style: 'seal' }, { status: 'done', style: 'unknown' }]) {
    assert.throws(() => applyHeldStamp(state, state.items[0].id, tool));
  }
  assert.equal(state.items[0].status, 'active');
});

test('matching custom stamps retain their preview metadata and stamp reference', () => {
  const custom = { id: 'custom-done', name: 'ตราของฉัน', status: 'done', dataUrl: PNG };
  const state = addStamp(boardWithTwoQuests(), custom);
  const tool = chooseStampTool('done', 'banner', custom);
  assert.deepEqual(tool, { status: 'done', style: 'banner', stampId: 'custom-done', dataUrl: PNG, name: 'ตราของฉัน' });
  const stamped = applyHeldStamp(state, state.items[0].id, tool);
  assert.equal(stamped.items[0].stampId, 'custom-done');
  assert.equal(stamped.items[0].stampStyle, 'banner');
  assert.equal(stamped.items[0].status, 'done');
  assert.throws(() => chooseStampTool('failed', 'seal', custom));
  assert.throws(() => chooseStampTool('done', 'seal', 'invalid'));
  const other = boardWithTwoQuests();
  assert.throws(() => applyHeldStamp(other, other.items[0].id, { ...tool, stampId: 'missing' }));
});

test('a custom tool whose stamp was removed reports the model validation error', () => {
  const state = boardWithTwoQuests();
  const tool = chooseStampTool('done', 'seal', { id: 'removed-stamp', name: 'ตราที่ถูกลบ', status: 'done', dataUrl: PNG });
  assert.throws(() => applyHeldStamp(state, state.items[0].id, tool), /ตราประทับ/);
  assert.equal(state.items[0].stampId, null);
  assert.equal(state.items[0].status, 'active');
});

test('archived quests accept each regular tool only with explicit scoped permission', () => {
  for (const [status, style] of [['done', 'seal'], ['failed', 'rectangle'], ['paused', 'banner']]) {
    let state = boardWithTwoQuests();
    const id = state.items[0].id;
    state = setArchived(state, id, true);
    const quest = state.items[0];
    const tool = chooseStampTool(status, style);
    assert.equal(isStampableTarget(quest, { allowArchived: true }), true);
    for (const allowArchived of [false, undefined, null, 0, 1, 'true', {}, []]) {
      assert.equal(isStampableTarget(quest, { allowArchived }), false);
      assert.equal(applyHeldStamp(state, id, tool, undefined, { allowArchived }), state);
    }
    assert.equal(applyHeldStamp(state, id, tool), state);
    const stamped = applyHeldStamp(state, id, tool, { x: 123, y: 234 }, { allowArchived: true });
    assert.deepEqual(stamped.items[0], {
      ...quest, status, stampStyle: style, stampId: null, stampPosition: { x: 123, y: 234 },
    });
    assert.equal(state.items[0].status, 'active');
  }
});

test('scoped archived permission still excludes labels, folders, and missing targets', () => {
  const state = boardWithTwoQuests();
  state.items.push(createLabel({ text: 'หัวข้อภารกิจ' }, state));
  state.items.push(createFolder({ name: 'แฟ้มภารกิจ' }, state));
  const tool = chooseStampTool('done');
  for (const target of [state.items[2], state.items[3], null, undefined, {}, { type: 'other', archived: true }]) {
    assert.equal(isStampableTarget(target, { allowArchived: true }), false);
  }
  for (const id of [state.items[2].id, state.items[3].id, 'missing', undefined, null]) {
    assert.equal(applyHeldStamp(state, id, tool, { x: 10, y: 20 }, { allowArchived: true }), state);
  }
  assert.equal(applyHeldStamp(state, state.items[0].id, null, undefined, { allowArchived: true }), state);
});

test('scoped custom stamping preserves archived quest location, back content, and other metadata', () => {
  for (const inFolder of [false, true]) {
    const custom = { id: 'custom-paused', name: 'พักภารกิจ', status: 'paused', dataUrl: PNG };
    let state = addStamp(boardWithTwoQuests(), custom);
    const id = state.items[0].id;
    state.items.push(createFolder({ name: 'แฟ้มภารกิจ' }, state));
    state = inFolder ? moveQuestToFolder(state, id, state.items[2].id) : setArchived(state, id, true);
    state = updateItem(state, id, {
      x: 621, y: 432, rotation: -13, z: 17,
      storagePosition: { x: 814, y: 523 },
      notes: 'บันทึกที่ต้องเก็บไว้',
      subquests: [{ id: 'first-step', text: 'อ่านบทแรก', done: true }],
      description: 'รายละเอียดภารกิจ', category: 'พัฒนาตัวเอง', priority: 'high', due: '2026-12-01',
      imageDataUrl: PNG,
    });
    const original = structuredClone(state);
    const tool = Object.freeze(chooseStampTool('paused', 'banner', custom));
    const stamped = applyHeldStamp(state, id, tool, { x: 209, y: 318 }, { allowArchived: true });
    assert.deepEqual(stamped.items[0], {
      ...original.items[0], status: 'paused', stampId: 'custom-paused', stampStyle: 'banner',
      stampPosition: { x: 209, y: 318 },
    });
    assert.deepEqual(stamped.items.slice(1), original.items.slice(1));
    assert.deepEqual(stamped.stamps, original.stamps);
    assert.deepEqual(stamped.settings, original.settings);
    assert.deepEqual(state, original);
    assert.deepEqual(applyHeldStamp(stamped, id, tool, undefined, { allowArchived: true }), stamped);
    assert.deepEqual(tool, {
      status: 'paused', style: 'banner', stampId: 'custom-paused', dataUrl: PNG, name: 'พักภารกิจ',
    });
  }
});

test('scoped archived stamping retains, replaces, or clears canonical stamp position', () => {
  let state = boardWithTwoQuests();
  const id = state.items[0].id;
  state = updateItem(state, id, {
    archived: true, status: 'done', stampStyle: 'seal', stampPosition: { x: 27, y: 41 },
  });
  const tool = chooseStampTool('failed', 'rectangle');
  const retained = applyHeldStamp(state, id, tool, undefined, { allowArchived: true });
  assert.equal(retained.items[0].status, 'failed');
  assert.deepEqual(retained.items[0].stampPosition, { x: 27, y: 41 });
  const replaced = applyHeldStamp(retained, id, tool, { x: 300, y: 350 }, { allowArchived: true });
  assert.deepEqual(replaced.items[0].stampPosition, { x: 300, y: 350 });
  const cleared = applyHeldStamp(replaced, id, tool, null, { allowArchived: true });
  assert.equal(cleared.items[0].stampPosition, null);
  assert.equal(cleared.items[0].archived, true);
});

test('scoped archived stamping keeps held tool and model validation', () => {
  let state = boardWithTwoQuests();
  const id = state.items[0].id;
  state = setArchived(state, id, true);
  for (const tool of [{}, { status: 'active', style: 'seal' }, { status: 'done', style: 'unknown' }]) {
    assert.throws(() => applyHeldStamp(state, id, tool, undefined, { allowArchived: true }));
  }
  const removed = chooseStampTool('done', 'seal', {
    id: 'removed-stamp', name: 'ตราที่ถูกลบ', status: 'done', dataUrl: PNG,
  });
  assert.throws(() => applyHeldStamp(state, id, removed, undefined, { allowArchived: true }), /ตราประทับ/);
  for (const position of [{ x: -1, y: 0 }, { x: 0, y: 351 }, { x: NaN, y: 20 }]) {
    assert.throws(() => applyHeldStamp(state, id, chooseStampTool('done'), position, { allowArchived: true }));
  }
  assert.equal(state.items[0].status, 'active');
  assert.equal(state.items[0].archived, true);
});
