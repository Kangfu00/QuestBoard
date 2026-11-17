import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../dist/model.mjs';
import {PAPER} from '../dist/paper-format.mjs';
import {
  BOARD, STATUS, CATEGORIES, uid, createInitialState, createQuest, createLabel,
  clampPosition, updateItem, deleteItem, setItemStatus, filterQuests,
  validateState, serializeState, parseState, loadState, saveState,
} from '../dist/model.mjs';

function emptyState() {
  return { version: 1, items: [], stamps: [], settings: { stampStyle: 'seal', theme: 'walnut', boardName: 'กระดานนักผจญภัย' } };
}

function stateWithQuest() {
  const state = emptyState();
  state.items.push(createQuest({ title: 'อ่านหนังสือ 20 หน้า', xp: 40 }, state));
  return state;
}

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0WQAAAAASUVORK5CYII=';

test('seed contains six usable quests, two headings, and distinct identifiers', () => {
  const state = createInitialState();
  assert.equal(state.items.filter(i => i.type === 'quest').length, 6);
  assert.equal(state.items.filter(i => i.type === 'label').length, 2);
  assert.equal(state.items.filter(i => i.status === 'done').length, 1);
  assert.equal(state.items.filter(i => i.status === 'paused').length, 1);
  assert.equal(new Set(state.items.map(i => i.id)).size, 8);
  assert.deepEqual(validateState(state), state);
  assert.notEqual(uid(), uid());
  assert.equal(BOARD.width, 1180);
  assert.equal(Object.keys(STATUS).length, 4);
  assert.equal(CATEGORIES.length, 3);
});

test('initial A4 quest rows and section headings leave clear space around their rotated edges',()=>{
  const state=createInitialState();
  const extent=item=>{
    const width=item.type==='quest'?PAPER.width:230,height=item.type==='quest'?PAPER.height:70;
    const angle=item.rotation*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
    const corners=[[0,0],[width,0],[width,height],[0,height]].map(([x,y])=>({
      x:item.x+width/2+(x-width/2)*cos-(y-height/2)*sin,
      y:item.y+height/2+(x-width/2)*sin+(y-height/2)*cos,
    }));
    return {item,left:Math.min(...corners.map(p=>p.x)),right:Math.max(...corners.map(p=>p.x)),
      top:Math.min(...corners.map(p=>p.y)),bottom:Math.max(...corners.map(p=>p.y))};
  };
  const quests=state.items.filter(item=>item.type==='quest').map(extent);
  const labels=state.items.filter(item=>item.type==='label').map(extent);
  const sameColumn=(a,b)=>a.left<b.right&&a.right>b.left;
  for(const first of quests)for(const second of quests){
    if(first.item.y<second.item.y&&sameColumn(first,second))
      assert.ok(first.bottom+16<=second.top,'rotated quest rows must not cover each other');
  }
  for(const label of labels)for(const quest of quests){
    if(!sameColumn(label,quest))continue;
    assert.ok(label.bottom+16<=quest.top||quest.bottom+16<=label.top,
      `heading "${label.item.text}" must clear the full quest sheet, including its footer`);
  }
});

test('creation trims text, rejects empty titles, applies defaults and places above existing items', () => {
  const state = stateWithQuest();
  const quest = createQuest({ title: '  ทำอาหาร  ', description: '  มื้อเย็น  ', x: 9000, y: -5 }, state);
  assert.equal(quest.title, 'ทำอาหาร');
  assert.equal(quest.description, 'มื้อเย็น');
  assert.equal(quest.status, 'active');
  assert.equal(quest.category, 'งานหลัก');
  assert.equal(quest.z, 2);
  assert.deepEqual({ x: quest.x, y: quest.y }, { x: 9000, y: 0 });
  assert.throws(() => createQuest({ title: '   ' }, state));
  assert.equal(state.items.length, 1);
  const label = createLabel({ text: '  เรื่องเล็ก ๆ  ', color: 'sage' }, state);
  assert.equal(label.text, 'เรื่องเล็ก ๆ');
  assert.equal(label.color, 'sage');
  assert.equal(label.type, 'label');
  assert.throws(() => createLabel({ text: '' }, state));
});

test('position clamping keeps both papers and headings inside the board', () => {
  assert.deepEqual(clampPosition(-40, 1200), { x: 0, y: 1000-PAPER.height });
  assert.deepEqual(clampPosition(1000, 980, 'label'), { x: 950, y: 930 });
  assert.deepEqual(clampPosition(112.5, 76.25), { x: 112.5, y: 76.25 });
  assert.throws(() => clampPosition(NaN, 0));
  assert.throws(() => clampPosition(0, Infinity));
});

test('status changes are immutable, replace the status and cannot double earned XP', () => {
  const original = stateWithQuest();
  const id = original.items[0].id;
  const done = setItemStatus(original, id, 'done');
  const repeated = setItemStatus(done, id, 'done');
  const earned = repeated.items.filter(i => i.status === 'done').reduce((sum, i) => sum + i.xp, 0);
  assert.equal(earned, 40);
  assert.equal(original.items[0].status, 'active');
  assert.notEqual(done.items[0], original.items[0]);
  assert.equal(setItemStatus(done, id, 'paused').items[0].status, 'paused');
  assert.equal(setItemStatus(done, id, 'failed').items[0].status, 'failed');
  assert.throws(() => setItemStatus(done, id, 'unknown'));
});

test('reopening a stamped quest clears the custom stamp', () => {
  const state = stateWithQuest();
  state.stamps.push({ id: 'stamp-one', name: 'ตราสำเร็จ', status: 'done', dataUrl: PNG });
  const stamped = setItemStatus(state, state.items[0].id, 'done', 'stamp-one', 'rectangle');
  assert.equal(stamped.items[0].stampId, 'stamp-one');
  assert.equal(stamped.items[0].stampStyle, 'rectangle');
  assert.equal(setItemStatus(stamped, state.items[0].id, 'active').items[0].stampId, null);
  assert.throws(() => setItemStatus(state, state.items[0].id, 'done', 'missing'));
});

test('item edits validate values, preserve identity and leave other items untouched', () => {
  const state = stateWithQuest();
  state.items.push(createLabel({ text: 'เป้าหมายวันนี้' }, state));
  const edited = updateItem(state, state.items[0].id, { title: '  อ่านต่อ  ', x: -20, y: 2000 });
  assert.equal(edited.items[0].title, 'อ่านต่อ');
  assert.equal(edited.items[0].id, state.items[0].id);
  assert.deepEqual({ x: edited.items[0].x, y: edited.items[0].y }, { x: 0, y: 2000 });
  assert.equal(edited.items[1], state.items[1]);
  assert.throws(() => updateItem(state, state.items[0].id, { xp: -1 }));
  assert.throws(() => updateItem(state, state.items[0].id, { due: '2026-02-30' }));
  assert.throws(() => updateItem(state, state.items[0].id, { status: 'invented' }));
  assert.throws(() => updateItem(state, state.items[0].id, { id: 'replacement' }));
  const deleted = deleteItem(state, state.items[0].id);
  assert.equal(deleted.items.length, 1);
  assert.equal(state.items.length, 2);
});

test('filter combines Thai text, category and status and never returns headings', () => {
  const state = emptyState();
  state.items = [
    createQuest({ title: 'อ่านหนังสือ', description: 'ภาษาไทย', category: 'พัฒนาตัวเอง', status: 'done' }, state),
    createQuest({ title: 'อ่านบทความ', description: 'เทคโนโลยี', category: 'งานหลัก' }, state),
    createLabel({ text: 'อ่านหนังสือ' }, state),
  ];
  assert.equal(filterQuests(state.items, { search: '  อ่าน  ' }).length, 2);
  assert.deepEqual(filterQuests(state.items, { status: 'done', category: 'พัฒนาตัวเอง', search: 'ภาษาไทย' }).map(i => i.title), ['อ่านหนังสือ']);
  assert.equal(filterQuests(state.items, { category: 'ชีวิตประจำวัน' }).length, 0);
});

test('empty boards round-trip without restoring seed data', () => {
  const empty = emptyState();
  assert.deepEqual(parseState(serializeState(empty)), empty);
  assert.deepEqual(parseState(serializeState(createInitialState())).settings, empty.settings);
});

test('imports reject malformed structures, duplicate ids, invalid enums and unsafe numeric values', () => {
  for (const bad of [null, [], {}, { ...emptyState(), version: 2 }, { ...emptyState(), items: {} }, { ...emptyState(), settings: null }]) {
    assert.throws(() => validateState(bad));
  }
  const state = stateWithQuest();
  assert.throws(() => validateState({ ...state, items: [state.items[0], state.items[0]] }));
  for (const patch of [
    { xp: Infinity }, { xp: -10 }, { xp: '40' }, { title: 'x'.repeat(121) },
    { title: '' }, { status: 'deleted' }, { category: 'unknown' },
    { x: '15' }, { y: NaN }, { rotation: 1000 }, { z: -1 }, { stampId: 'missing' },
    { due: '2026-13-01' }, { due: '2026-02-30' },
  ]) assert.throws(() => validateState({ ...state, items: [{ ...state.items[0], ...patch }] }));
  assert.throws(() => parseState('{bad json'));
});

test('imports accept raster stamp data and reject SVG, HTML, forged and oversized images', () => {
  const state = emptyState();
  const stamp = { id: 'stamp-one', name: 'ตราของฉัน', status: 'done', dataUrl: PNG };
  assert.deepEqual(validateState({ ...state, stamps: [stamp] }).stamps, [stamp]);
  for (const dataUrl of [
    'data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,PHNjcmlwdD4=',
    'https://example.com/image.png', 'data:image/png;base64,PHN2Zz4=',
    `data:image/png;base64,iVBORw0KGgo${'A'.repeat(2_800_000)}`,
  ]) assert.throws(() => validateState({ ...state, stamps: [{ ...stamp, dataUrl }] }));
});

test('unavailable storage fails visibly rather than silently returning a new board', async () => {
  if (globalThis.indexedDB) return;
  await assert.rejects(loadState());
  await assert.rejects(saveState(emptyState()));
});

test('a full board rejects its 501st quest or heading without changing the existing board', () => {
  const state = stateWithQuest();
  const prototype = state.items[0];
  state.items = Array.from({ length: 500 }, (_, index) => ({ ...prototype, id: `quest-${index}`, z: index + 1 }));
  const before = structuredClone(state);
  assert.throws(() => createQuest({ title: 'อีกภารกิจหนึ่ง' }, state), /500/);
  assert.throws(() => createLabel({ text: 'อีกหัวข้อหนึ่ง' }, state), /500/);
  assert.deepEqual(state, before);
  assert.equal(validateState(state).items.length, 500);
});

test('adding stamps validates input and refuses duplicate ids without changing existing state', () => {
  assert.equal(typeof model.addStamp, 'function');
  const state = stateWithQuest();
  const input = { id: 'stamp-one', name: '  ตราของฉัน  ', status: 'done', dataUrl: PNG };
  const added = model.addStamp(state, input);
  assert.equal(state.stamps.length, 0);
  assert.equal(added.stamps[0].name, 'ตราของฉัน');
  assert.equal(input.name, '  ตราของฉัน  ');
  assert.equal(added.items, state.items);
  assert.throws(() => model.addStamp(added, input), /รหัสซ้ำ/);
  assert.throws(() => model.addStamp(state, { ...input, id: state.items[0].id }), /รหัสซ้ำ/);
  assert.throws(() => model.addStamp(state, { ...input, dataUrl: 'data:text/html;base64,PHN2Zz4=' }));
  assert.equal(added.stamps.length, 1);
});

test('a full stamp library rejects its 31st stamp and remains exportable', () => {
  assert.equal(typeof model.addStamp, 'function');
  const state = emptyState();
  state.stamps = Array.from({ length: 30 }, (_, index) => ({ id: `stamp-${index}`, name: 'ตราของฉัน', status: 'done', dataUrl: PNG }));
  const before = structuredClone(state);
  assert.throws(() => model.addStamp(state, { id: 'stamp-31', name: 'ตราใหม่', status: 'done', dataUrl: PNG }), /30/);
  assert.deepEqual(state, before);
  assert.equal(parseState(serializeState(state)).stamps.length, 30);
});

test('maximum representative fields and counts survive backup round-trip within the shared byte budget', () => {
  assert.equal(typeof model.MAX_BACKUP_BYTES, 'number');
  const state = stateWithQuest();
  const prototype = { ...state.items[0], title: 'ก'.repeat(120), description: 'ก'.repeat(1500), xp: 10000, x: 880, y: 650, rotation: 180, z: 1e6 };
  state.items = Array.from({ length: 500 }, (_, index) => ({ ...prototype, id: `quest-${index}` }));
  state.stamps = Array.from({ length: 30 }, (_, index) => ({ id: `stamp-${index}`, name: 'ก'.repeat(60), status: 'done', dataUrl: PNG }));
  state.settings.boardName = 'ก'.repeat(80);
  const json = serializeState(state);
  const size = new TextEncoder().encode(json).byteLength;
  assert.ok(size < model.MAX_BACKUP_BYTES);
  // Account for thirty maximum-size base64 rasters without allocating them.
  const maximumImageText = 30 * (Math.ceil(2 * 1024 * 1024 / 3) * 4 + 40);
  assert.ok(size + maximumImageText < model.MAX_BACKUP_BYTES);
  assert.deepEqual(parseState(json), state);
});

test('archiving and retrieving preserve original quest position, stamp and status', () => {
  assert.equal(typeof model.setArchived, 'function');
  const state = stateWithQuest();
  state.items[0] = { ...state.items[0], x: 214, y: 329, rotation: -3.25, status: 'done', stampStyle: 'banner' };
  state.items.push(createLabel({ text: 'หัวข้อ' }, state));
  const original = structuredClone(state);
  const archived = model.setArchived(state, state.items[0].id, true);
  assert.equal(archived.items[0].archived, true);
  assert.deepEqual(state, original);
  assert.deepEqual(model.setArchived(archived, state.items[0].id, false), original);
  assert.throws(() => model.setArchived(state, state.items[0].id, 'true'));
  assert.throws(() => model.setArchived(state, state.items[1].id, true));
  assert.throws(() => model.setArchived(state, 'missing', true));
});

test('archive search returns only archived quests and board search excludes them', () => {
  const state = emptyState();
  state.items = [
    createQuest({ title: 'อ่านหนังสือเก่า', archived: true, status: 'done', category: 'พัฒนาตัวเอง' }, state),
    createQuest({ title: 'อ่านหนังสือใหม่', archived: false, category: 'พัฒนาตัวเอง' }, state),
    createQuest({ title: 'งานเก่า', archived: true, status: 'paused' }, state),
    createLabel({ text: 'อ่านหนังสือ' }, state),
  ];
  assert.deepEqual(filterQuests(state.items, { search: 'อ่าน' }).map(i => i.title), ['อ่านหนังสือใหม่']);
  assert.deepEqual(filterQuests(state.items, { archived: true, search: 'อ่าน', status: 'done', category: 'พัฒนาตัวเอง' }).map(i => i.title), ['อ่านหนังสือเก่า']);
  assert.equal(filterQuests(state.items, { archived: true }).length, 2);
});

test('legacy version-one quests migrate to unarchived papers without a photo', () => {
  const legacy = stateWithQuest();
  delete legacy.items[0].archived;
  delete legacy.items[0].imageDataUrl;
  const imported = parseState(JSON.stringify(legacy));
  assert.equal(imported.items[0].archived, false);
  assert.equal(imported.items[0].imageDataUrl, null);
  assert.equal(legacy.items[0].archived, undefined);
  assert.equal(filterQuests(legacy.items).length, 1);
  assert.equal(filterQuests(imported.items).length, 1);
});

test('quest photos survive edits and backups and can be removed explicitly', () => {
  const state = emptyState();
  const quest = createQuest({ title: 'บันทึกความทรงจำ', imageDataUrl: PNG }, state);
  assert.equal(quest.imageDataUrl, PNG);
  assert.equal(quest.archived, false);
  state.items.push(quest);
  const edited = updateItem(state, quest.id, { title: 'ความทรงจำใหม่' });
  assert.equal(edited.items[0].imageDataUrl, PNG);
  assert.equal(parseState(serializeState(edited)).items[0].imageDataUrl, PNG);
  assert.equal(updateItem(edited, quest.id, { imageDataUrl: null }).items[0].imageDataUrl, null);
  assert.equal(edited.items[0].imageDataUrl, PNG);
});

test('quest photos and archive flags reject malformed and unsupported data on creation, edit and import', () => {
  const state = stateWithQuest();
  for (const imageDataUrl of [
    '', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,PHNjcmlwdD4=',
    'https://example.com/image.png', 'data:image/png;base64,PHN2Zz4=',
    `data:image/png;base64,iVBORw0KGgo${'A'.repeat(2_800_000)}`,
  ]) {
    assert.throws(() => createQuest({ title: 'รูปใหม่', imageDataUrl }, state));
    assert.throws(() => updateItem(state, state.items[0].id, { imageDataUrl }));
    assert.throws(() => validateState({ ...state, items: [{ ...state.items[0], imageDataUrl }] }));
  }
  for (const archived of ['true', 1, null]) {
    assert.throws(() => createQuest({ title: 'ภารกิจ', archived }, state));
    assert.throws(() => updateItem(state, state.items[0].id, { archived }));
    assert.throws(() => validateState({ ...state, items: [{ ...state.items[0], archived }] }));
  }
});

test('aggregate photo budget rejects imports and additions before an unexportable state is accepted', () => {
  // Share one 2 MiB image across records, so this fixture stays small in memory.
  const bytes = Buffer.alloc(2 * 1024 * 1024);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const largeImage = `data:image/png;base64,${bytes.toString('base64')}`;
  const state = stateWithQuest();
  const prototype = state.items[0];
  state.items = Array.from({ length: 32 }, (_, index) => ({ ...prototype, id: `photo-${index}`, imageDataUrl: largeImage }));
  const validated = validateState(state);
  assert.equal(validated.items.length, 32);
  const stamp = { id: 'large-stamp', name: 'ตราใหญ่', status: 'done', dataUrl: largeImage };
  assert.throws(() => createQuest({ title: 'ภาพที่ 33', imageDataUrl: largeImage }, validated), /90|ขนาด|พื้นที่/);
  assert.throws(() => model.addStamp(validated, stamp), /90|ขนาด|พื้นที่/);
  const withBlank = { ...validated, items: [...validated.items, { ...prototype, id: 'blank-photo', imageDataUrl: null }] };
  assert.throws(() => updateItem(withBlank, 'blank-photo', { imageDataUrl: largeImage }), /90|ขนาด|พื้นที่/);
  assert.throws(() => validateState({ ...validated, stamps: [stamp] }), /90|ขนาด|พื้นที่/);
  assert.equal(validated.items.length, 32);
  assert.equal(validated.stamps.length, 0);
  assert.equal(withBlank.items.at(-1).imageDataUrl, null);

  const stampOnly = emptyState();
  stampOnly.stamps = Array.from({ length: 30 }, (_, index) => ({ ...stamp, id: `stamp-${index}` }));
  assert.equal(validateState(stampOnly).stamps.length, 30);

  // Fill the remaining budget with one smaller photo, leaving <4 bytes free.
  // The image strings are shared, so no 90 MB backup is allocated by this test.
  const tight = { ...validated, items: [...validated.items, { ...prototype, id: 'last-photo', imageDataUrl: PNG }] };
  const metadata = { ...tight, items: tight.items.map(item => ({ ...item, imageDataUrl: '' })) };
  const metadataBytes = new TextEncoder().encode(JSON.stringify(metadata, null, 2)).byteLength;
  const prefix = 'data:image/png;base64,';
  const base64Length = Math.floor((model.MAX_BACKUP_BYTES - metadataBytes - 32 * largeImage.length - prefix.length) / 4) * 4;
  const lastImage = Buffer.alloc(base64Length / 4 * 3);
  lastImage.set([137, 80, 78, 71, 13, 10, 26, 10]);
  tight.items.at(-1).imageDataUrl = prefix + lastImage.toString('base64');
  assert.equal(validateState(tight).items.length, 33);
  assert.equal(typeof model.createFolder, 'function');
  assert.throws(() => model.createFolder({ name: 'แฟ้มที่ไม่มีพื้นที่พอ' }, tight), /90|ขนาด|พื้นที่/);
  assert.equal(tight.items.length, 33);
});

test('explicit canvas bounds keep papers and headings inside an expanded viewport', () => {
  assert.deepEqual(clampPosition(1600, 1200, 'quest', { width: 2400, height: 1800 }), { x: 1600, y: 1200 });
  assert.deepEqual(clampPosition(3000, 2000, 'quest', { width: 2400, height: 1800 }), { x: 2100, y: 1800-PAPER.height });
  assert.deepEqual(clampPosition(3000, 2000, 'label', { width: 2400, height: 1800 }), { x: 2170, y: 1730 });
  assert.deepEqual(clampPosition(-10, -20, 'quest', { width: 2400, height: 1800 }), { x: 0, y: 0 });
  assert.deepEqual(clampPosition(10, 20, 'quest', { width: PAPER.width, height: PAPER.height }), { x: 0, y: 0 });
  assert.throws(()=>clampPosition(10,20,'quest',{width:300,height:350}));
});

test('expanded positions survive creation, edits, normalization and backup import', () => {
  const state = emptyState();
  const quest = createQuest({ title: 'ภารกิจบนพื้นที่ใหม่', x: 1600, y: 1200 }, state);
  assert.deepEqual({ x: quest.x, y: quest.y }, { x: 1600, y: 1200 });
  state.items.push(quest);
  state.items.push(createLabel({ text: 'หัวข้อด้านขวา', x: 2100, y: 1500 }, state));
  const edited = updateItem(state, quest.id, { x: 1800, y: 1400 });
  const imported = parseState(serializeState(edited));
  assert.deepEqual({ x: imported.items[0].x, y: imported.items[0].y }, { x: 1800, y: 1400 });
  assert.deepEqual({ x: imported.items[1].x, y: imported.items[1].y }, { x: 2100, y: 1500 });
  assert.deepEqual(validateState(state), state);
});

test('stamping and archiving retain positions outside the initial canvas', () => {
  const state = stateWithQuest();
  state.items[0] = { ...state.items[0], x: 1600, y: 1200 };
  const id = state.items[0].id;
  const stamped = setItemStatus(state, id, 'done');
  const archived = model.setArchived(stamped, id, true);
  const restored = model.setArchived(archived, id, false);
  for (const next of [stamped, archived, restored]) {
    assert.deepEqual({ x: next.items[0].x, y: next.items[0].y }, { x: 1600, y: 1200 });
    assert.equal(next.items[0].status, 'done');
  }
  assert.equal(state.items[0].status, 'active');
});

test('canvas bounds reject invalid dimensions and stored coordinates respect the document limit', () => {
  assert.deepEqual(model.BOARD_LIMIT, { width: 20000, height: 20000 });
  for (const bounds of [
    null, {}, { width: '2400', height: 1800 }, { width: NaN, height: 1800 },
    { width: 2400, height: Infinity }, { width: 299, height: 1800 },
    { width: 2400, height: 349 }, { width: 20001, height: 1800 },
    { width: 2400, height: 20001 },
  ]) assert.throws(() => clampPosition(10, 20, 'quest', bounds));
  const state = stateWithQuest();
  const bounded = updateItem(state, state.items[0].id, { x: 999999, y: 999999 });
  assert.deepEqual({ x: bounded.items[0].x, y: bounded.items[0].y }, { x: 19700, y: 19575.714285714286 });
  assert.deepEqual(clampPosition(999999, 999999, 'label', model.BOARD_LIMIT), { x: 19770, y: 19930 });
  assert.throws(() => clampPosition(NaN, 10, 'quest', model.BOARD_LIMIT));
  assert.throws(() => clampPosition(10, Infinity, 'quest', model.BOARD_LIMIT));
});

test('legacy tray boundary loads into the taller sheet footprint while saved ink keeps its version-one space',()=>{
  const state=stateWithQuest(),quest=state.items[0];
  const legacy={...state,items:[{...quest,status:'done',x:19700,y:19650,archived:true,storagePosition:{x:19700,y:19650},stampPosition:{x:300,y:350}}]};
  const restored=parseState(JSON.stringify(legacy));
  assert.equal(restored.version,1);
  assert.deepEqual({x:restored.items[0].x,y:restored.items[0].y},{x:19700,y:19575.714285714286});
  assert.deepEqual(restored.items[0].storagePosition,{x:19700,y:19575.714285714286});
  assert.deepEqual(restored.items[0].stampPosition,{x:300,y:350});
  assert.throws(()=>updateItem(restored,quest.id,{stampPosition:{x:300,y:PAPER.height}}));
  assert.throws(()=>updateItem(restored,quest.id,{storagePosition:{x:19700,y:19650.01}}));
});

test('folder and label tray coordinates can reach their own shorter footprints and survive reload',()=>{
  const state=stateWithQuest(),folder=model.createFolder({name:'Boundary'},state),label=createLabel({text:'Boundary'},state);
  state.items.push(folder,label);
  let next=updateItem(state,folder.id,{storagePosition:{x:19700,y:19790}});
  next=updateItem(next,label.id,{storagePosition:{x:19770,y:19930}});
  const restored=parseState(serializeState(next));
  assert.deepEqual(restored.items.find(item=>item.id===folder.id).storagePosition,{x:19700,y:19790});
  assert.deepEqual(restored.items.find(item=>item.id===label.id).storagePosition,{x:19770,y:19930});
  assert.throws(()=>updateItem(next,folder.id,{storagePosition:{x:19700,y:19790.01}}));
});

test('folders default to the drawer, trim their name and use their own paper dimensions', () => {
  assert.equal(typeof model.createFolder, 'function');
  const state = stateWithQuest();
  const folder = model.createFolder({ name: '  เรื่องสำคัญ  ', color: 'sage', x: 1600, y: 1200 }, state);
  assert.equal(folder.type, 'folder');
  assert.equal(folder.name, 'เรื่องสำคัญ');
  assert.equal(folder.color, 'sage');
  assert.equal(folder.archived, true);
  assert.equal(folder.z, 2);
  assert.deepEqual({ x: folder.x, y: folder.y }, { x: 1600, y: 1200 });
  assert.deepEqual(clampPosition(5000, 5000, 'folder'), { x: 880, y: 790 });
  assert.deepEqual(clampPosition(5000, 5000, 'folder', { width: 2400, height: 1800 }), { x: 2100, y: 1590 });
  assert.equal(model.createFolder({ name: 'บนกระดาน', archived: false }, state).archived, false);
  for (const input of [{ name: '  ' }, { name: 'ก'.repeat(61) }, { name: 'แฟ้ม', color: 'blue' }, { name: 'แฟ้ม', archived: null }]) {
    assert.throws(() => model.createFolder(input, state));
  }
  assert.equal(state.items.length, 1);
});

test('moving quests into folders and dragging them out preserves their content and status', () => {
  assert.equal(typeof model.moveQuestToFolder, 'function');
  const state = stateWithQuest();
  state.items[0] = { ...state.items[0], x: 1600, y: 1200, status: 'done', imageDataUrl: PNG };
  const quest = state.items[0];
  const folder = model.createFolder({ name: 'แฟ้มอ่านหนังสือ' }, state);
  state.items.push(folder);
  const packed = model.moveQuestToFolder(state, quest.id, folder.id);
  assert.equal(packed.items[0].archived, true);
  assert.equal(packed.items[0].folderId, folder.id);
  assert.equal(state.items[0].archived, false);
  assert.equal(state.items[0].folderId, null);
  assert.deepEqual(packed.items[1], folder);
  const restored = model.setArchived(packed, quest.id, false);
  assert.deepEqual(restored.items[0], quest);
  const loose = model.setArchived(packed, quest.id, true);
  assert.equal(loose.items[0].archived, true);
  assert.equal(loose.items[0].folderId, null);
  assert.equal(loose.items[0].status, 'done');
  assert.equal(loose.items[0].imageDataUrl, PNG);
  assert.deepEqual({ x: loose.items[0].x, y: loose.items[0].y }, { x: 1600, y: 1200 });
  assert.throws(() => model.moveQuestToFolder(state, folder.id, folder.id));
  assert.throws(() => model.moveQuestToFolder(state, quest.id, quest.id));
  assert.throws(() => model.moveQuestToFolder(state, 'missing', folder.id));
  assert.throws(() => model.moveQuestToFolder(state, quest.id, 'missing'));
});

test('moving a folder between drawer and board leaves contained quests inside it', () => {
  assert.equal(typeof model.createFolder, 'function');
  let state = stateWithQuest();
  const folder = model.createFolder({ name: 'แฟ้ม', x: 1800, y: 1300 }, state);
  state.items.push(folder);
  state = model.moveQuestToFolder(state, state.items[0].id, folder.id);
  const board = model.setArchived(state, folder.id, false);
  assert.equal(board.items[1].archived, false);
  assert.equal(board.items[0], state.items[0]);
  assert.equal(board.items[0].folderId, folder.id);
  assert.equal(board.items[0].archived, true);
  const drawer = model.setArchived(board, folder.id, true);
  assert.deepEqual(drawer, state);
  const edited = updateItem(board, folder.id, { name: '  ชื่อใหม่  ', color: 'red' });
  assert.equal(edited.items[1].name, 'ชื่อใหม่');
  assert.equal(edited.items[1].color, 'red');
  assert.equal(edited.items[0], board.items[0]);
});

test('deleting a folder releases its quests into the loose archive without deleting them', () => {
  assert.equal(typeof model.createFolder, 'function');
  let state = stateWithQuest();
  state.items.push(createQuest({ title: 'ภารกิจอื่น' }, state));
  const folder = model.createFolder({ name: 'แฟ้มที่จะลบ' }, state);
  state.items.push(folder);
  state = model.moveQuestToFolder(state, state.items[0].id, folder.id);
  const deleted = deleteItem(state, folder.id);
  assert.equal(deleted.items.length, 2);
  assert.deepEqual(deleted.items[0], { ...state.items[0], archived: true, folderId: null });
  assert.equal(deleted.items[1], state.items[1]);
  assert.equal(state.items[0].folderId, folder.id);
  assert.equal(state.items.length, 3);
  assert.deepEqual(validateState(deleted), deleted);
});

test('folder search excludes loose archive quests and default search excludes folder contents', () => {
  assert.equal(typeof model.createFolder, 'function');
  let state = stateWithQuest();
  const folder = model.createFolder({ name: 'แฟ้มหนังสือ' }, state);
  state.items.push(folder);
  state.items.push(createQuest({ title: 'อ่านบทความเก่า', archived: true }, state));
  state.items.push(createQuest({ title: 'อ่านบทความใหม่' }, state));
  state = model.moveQuestToFolder(state, state.items[0].id, folder.id);
  state = setItemStatus(state, state.items[0].id, 'done');
  assert.deepEqual(filterQuests(state.items).map(i => i.title), ['อ่านบทความใหม่']);
  assert.deepEqual(filterQuests(state.items, { archived: true }).map(i => i.title), ['อ่านบทความเก่า']);
  assert.deepEqual(filterQuests(state.items, { folderId: folder.id, search: 'อ่าน', status: 'done', category: 'งานหลัก' }).map(i => i.title), ['อ่านหนังสือ 20 หน้า']);
  assert.equal(filterQuests(state.items, { folderId: folder.id, status: 'active' }).length, 0);
});

test('folder references validate on creation, edits and imports while legacy quests gain null references', () => {
  assert.equal(typeof model.createFolder, 'function');
  const state = stateWithQuest();
  const folder = model.createFolder({ name: 'แฟ้ม' }, state);
  state.items.push(folder);
  const member = createQuest({ title: 'ในแฟ้ม', archived: true, folderId: folder.id }, state);
  assert.equal(member.folderId, folder.id);
  state.items.push(member);
  assert.deepEqual(parseState(serializeState(state)), state);
  const legacy = stateWithQuest();
  delete legacy.items[0].folderId;
  assert.equal(parseState(JSON.stringify(legacy)).items[0].folderId, null);
  for (const patch of [{ folderId: 'missing', archived: true }, { folderId: state.items[0].id, archived: true }, { folderId: folder.id, archived: false }]) {
    assert.throws(() => createQuest({ title: 'ผิดแฟ้ม', ...patch }, state));
    assert.throws(() => updateItem(state, state.items[0].id, patch));
    assert.throws(() => validateState({ ...state, items: [{ ...state.items[0], ...patch }, ...state.items.slice(1)] }));
  }
  const oldFolder = { ...folder };
  delete oldFolder.archived;
  assert.equal(validateState({ ...state, items: [state.items[0], oldFolder] }).items[1].archived, true);
});

test('folders share the 500-item limit and impose no separate 60-folder limit', () => {
  assert.equal(typeof model.createFolder, 'function');
  const state = emptyState();
  const prototype = model.createFolder({ name: 'แฟ้มงาน' }, state);
  state.items = Array.from({ length: 61 }, (_, index) => ({ ...prototype, id: `folder-${index}` }));
  assert.equal(validateState(state).items.length, 61);
  assert.equal(model.createFolder({ name: 'แฟ้มที่ 62' }, state).type, 'folder');
  state.items = Array.from({ length: 500 }, (_, index) => ({ ...prototype, id: `folder-${index}` }));
  assert.throws(() => model.createFolder({ name: 'เกินจำนวน' }, state), /500/);
  assert.throws(() => createQuest({ title: 'เกินจำนวน' }, state), /500/);
  assert.throws(() => createLabel({ text: 'เกินจำนวน' }, state), /500/);
  assert.equal(state.items.length, 500);
});
