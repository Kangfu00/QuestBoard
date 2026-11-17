import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addStamp, createFolder, createLabel, createQuest, deleteItem, moveQuestToFolder,
  parseState, serializeState, setArchived, setItemStatus, updateItem, validateState,
} from '../dist/model.mjs';
import { applyHeldStamp, chooseStampTool } from '../dist/stamp-tools.mjs';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0WQAAAAASUVORK5CYII=';

function boardWithQuest(input = {}) {
  const state = {
    version: 1, items: [], stamps: [],
    settings: { stampStyle: 'seal', theme: 'walnut', boardName: 'Stamp positions' },
  };
  state.items.push(createQuest({ title: 'Read a book', xp: 40, ...input }, state));
  return state;
}

test('quest creation stores exact fractional and boundary stamp positions independently of its input', () => {
  const state = boardWithQuest();
  assert.equal(state.items[0].stampPosition, null);
  for (const point of [{ x: 0, y: 0 }, { x: 300, y: 350 }, { x: 72.125, y: 241.875 }]) {
    const quest = createQuest({ title: 'Stamped quest', status: 'done', stampPosition: point }, state);
    assert.deepEqual(quest.stampPosition, point);
    assert.notEqual(quest.stampPosition, point);
  }
});

test('stamp positions survive a version-one backup round trip without losing precision', () => {
  const state = boardWithQuest({ status: 'paused', stampPosition: { x: 123.4567, y: 288.7654 } });
  const restored = parseState(serializeState(state));
  assert.deepEqual(restored.items[0].stampPosition, { x: 123.4567, y: 288.7654 });
  assert.equal(restored.version, 1);
  assert.deepEqual(restored, state);
});

test('legacy backups and explicit null positions keep the default stamp placement', () => {
  const state = boardWithQuest({ status: 'done' });
  delete state.items[0].stampPosition;
  state.items.push(createLabel({ text: 'Heading' }, state));
  const restored = parseState(JSON.stringify(state));
  assert.equal(restored.items[0].stampPosition, null);
  assert.equal(Object.hasOwn(state.items[0], 'stampPosition'), false);
  assert.equal(Object.hasOwn(restored.items[1], 'stampPosition'), false);
  assert.equal(parseState(JSON.stringify({ ...state, items: [{ ...state.items[0], stampPosition: null }] })).items[0].stampPosition, null);
});

test('malformed or out-of-paper positions are rejected on every write boundary without changing the board', () => {
  const state = boardWithQuest({ status: 'done', stampPosition: { x: 120, y: 190 } });
  const id = state.items[0].id;
  const tool = chooseStampTool('paused');
  const before = structuredClone(state);
  const invalid = [
    false, 0, '120,190', [], {}, { x: 10 }, { y: 10 },
    { x: '10', y: 20 }, { x: null, y: 20 }, { x: 10, y: undefined },
    { x: NaN, y: 20 }, { x: 10, y: Infinity }, { x: -Infinity, y: 20 },
    { x: -0.01, y: 20 }, { x: 300.01, y: 20 },
    { x: 10, y: -0.01 }, { x: 10, y: 350.01 },
  ];
  for (const stampPosition of invalid) {
    assert.throws(() => createQuest({ title: 'Invalid position', status: 'done', stampPosition }, state));
    assert.throws(() => updateItem(state, id, { stampPosition }));
    assert.throws(() => setItemStatus(state, id, 'done', null, 'seal', stampPosition));
    assert.throws(() => applyHeldStamp(state, id, tool, stampPosition));
    const imported = { ...state, items: [{ ...state.items[0], stampPosition }] };
    assert.throws(() => validateState(imported));
    assert.throws(() => parseState(JSON.stringify(imported)));
    assert.deepEqual(state, before);
  }
});

test('active status clears a valid stored position on creation, edits, status changes and import', () => {
  const state = boardWithQuest({ status: 'done', stampPosition: { x: 110, y: 205 } });
  const id = state.items[0].id;
  assert.equal(createQuest({ title: 'Active', stampPosition: { x: 110, y: 205 } }, state).stampPosition, null);
  assert.equal(updateItem(state, id, { status: 'active' }).items[0].stampPosition, null);
  assert.equal(setItemStatus(state, id, 'active').items[0].stampPosition, null);
  assert.equal(setItemStatus(state, id, 'active', null, 'seal', { x: 20, y: 30 }).items[0].stampPosition, null);
  assert.equal(validateState({ ...state, items: [{ ...state.items[0], status: 'active' }] }).items[0].stampPosition, null);
  assert.deepEqual(state.items[0].stampPosition, { x: 110, y: 205 });
});

test('active status cannot conceal an invalid position in a creation, update or backup', () => {
  const state = boardWithQuest();
  const invalid = { x: 301, y: 20 };
  assert.throws(() => createQuest({ title: 'Invalid active', stampPosition: invalid }, state));
  assert.throws(() => updateItem(state, state.items[0].id, { status: 'active', stampPosition: invalid }));
  assert.throws(() => setItemStatus(state, state.items[0].id, 'active', null, 'seal', invalid));
  assert.throws(() => validateState({ ...state, items: [{ ...state.items[0], stampPosition: invalid }] }));
});

test('omitting a position preserves the ink for dialog and keyboard stamping while null resets it', () => {
  const state = boardWithQuest({ status: 'done', stampPosition: { x: 250, y: 45 } });
  const id = state.items[0].id;
  const dialog = setItemStatus(state, id, 'failed', null, 'rectangle');
  assert.deepEqual(dialog.items[0].stampPosition, { x: 250, y: 45 });
  const keyboard = applyHeldStamp(dialog, id, chooseStampTool('paused', 'banner'));
  assert.deepEqual(keyboard.items[0].stampPosition, { x: 250, y: 45 });
  assert.equal(setItemStatus(keyboard, id, 'done', null, 'seal', null).items[0].stampPosition, null);
  assert.equal(applyHeldStamp(keyboard, id, chooseStampTool('done'), null).items[0].stampPosition, null);
  const legacy = boardWithQuest({ status: 'done' });
  delete legacy.items[0].stampPosition;
  assert.equal(applyHeldStamp(legacy, legacy.items[0].id, chooseStampTool('done')).items[0].stampPosition, null);
});

test('dragging, archiving and filing a quest preserve its paper-local stamp position', () => {
  const state = boardWithQuest({ status: 'done', stampPosition: { x: 45.5, y: 310.25 } });
  const id = state.items[0].id;
  const folder = createFolder({ name: 'Finished work' }, state);
  state.items.push(folder);
  const dragged = updateItem(state, id, { x: 1600, y: 1200, rotation: 17, z: 5 });
  const archived = setArchived(dragged, id, true);
  const restored = setArchived(archived, id, false);
  const filed = moveQuestToFolder(restored, id, folder.id);
  const unfiled = setArchived(filed, id, false);
  const released = deleteItem(filed, folder.id);
  for (const result of [dragged, archived, restored, filed, unfiled, released]) {
    assert.deepEqual(result.items[0].stampPosition, { x: 45.5, y: 310.25 });
  }
});

test('regular and custom held stamps apply their click position and preserve custom stamp validation', () => {
  const custom = { id: 'custom-done', name: 'Completed', status: 'done', dataUrl: PNG };
  const state = addStamp(boardWithQuest(), custom);
  const id = state.items[0].id;
  const regular = applyHeldStamp(state, id, chooseStampTool('failed', 'rectangle'), { x: 40, y: 70 });
  assert.deepEqual(regular.items[0].stampPosition, { x: 40, y: 70 });
  const tool = chooseStampTool('done', 'banner', custom);
  const stamped = applyHeldStamp(regular, id, tool, { x: 220, y: 310 });
  assert.deepEqual(stamped.items[0].stampPosition, { x: 220, y: 310 });
  assert.equal(stamped.items[0].stampId, 'custom-done');
  assert.equal(stamped.items[0].stampStyle, 'banner');
  assert.equal(stamped.items[0].status, 'done');
  assert.throws(() => applyHeldStamp(state, id, { ...tool, stampId: 'missing' }, { x: 220, y: 310 }));
  assert.equal(state.items[0].status, 'active');
  assert.equal(state.items[0].stampPosition, null);
});

test('repeated stamping replaces the location without duplicating earned XP', () => {
  const state = boardWithQuest();
  const id = state.items[0].id;
  const tool = chooseStampTool('done');
  const first = applyHeldStamp(state, id, tool, { x: 20, y: 30 });
  const repeated = applyHeldStamp(first, id, tool, { x: 270, y: 310 });
  assert.deepEqual(first.items[0].stampPosition, { x: 20, y: 30 });
  assert.deepEqual(repeated.items[0].stampPosition, { x: 270, y: 310 });
  assert.equal(repeated.items.filter(item => item.status === 'done').reduce((sum, item) => sum + item.xp, 0), 40);
  assert.equal(repeated.items.length, 1);
});

test('position arguments do not bypass the held-tool and target gates', () => {
  const state = boardWithQuest();
  state.items.push(createLabel({ text: 'Heading' }, state));
  state.items.push(createFolder({ name: 'Folder' }, state));
  const archived = setArchived(state, state.items[0].id, true);
  const tool = chooseStampTool('done');
  const invalid = { x: 999, y: 999 };
  assert.equal(applyHeldStamp(state, state.items[0].id, null, invalid), state);
  for (const id of [archived.items[0].id, archived.items[1].id, archived.items[2].id, 'missing']) {
    assert.equal(applyHeldStamp(archived, id, tool, invalid), archived);
  }
});
