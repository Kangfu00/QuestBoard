import {PAPER,STAMP_SPACE} from './paper-format.mjs';
import {normalizePhotoLayout} from './photo-layout.mjs';
import {normalizePrerequisiteIds,validateDependencies,dependencyInfo} from './quest-dependencies.mjs';

export const BOARD = Object.freeze({ width: 1180, height: 1000 });
export const BOARD_LIMIT = Object.freeze({ width: 20000, height: 20000 });
export const STATUS = Object.freeze({
  active: { label: 'กำลังทำ', en: 'IN PROGRESS', color: '#8b713e' },
  done: { label: 'สำเร็จแล้ว', en: 'COMPLETED', color: '#4f6d4d' },
  failed: { label: 'ไม่สำเร็จ', en: 'FAILED', color: '#994d3f' },
  paused: { label: 'พักไว้ก่อน', en: 'ON HOLD', color: '#93723b' },
});
export const CATEGORIES = Object.freeze(['งานหลัก', 'ชีวิตประจำวัน', 'พัฒนาตัวเอง']);
export const MAX_BACKUP_BYTES = 90_000_000;
export const MAX_SUBQUESTS=80;
export const MAX_QUEST_NOTES=8000;

export function normalizeQuestBack(raw){
  record(raw,'บันทึกด้านหลัง');
  const notes=raw.notes===undefined?'':raw.notes;
  if(typeof notes!=='string'||notes.length>MAX_QUEST_NOTES)throw new Error(`บันทึกยาวได้ไม่เกิน ${MAX_QUEST_NOTES} ตัวอักษร`);
  const subquests=raw.subquests===undefined?[]:raw.subquests;
  if(!Array.isArray(subquests)||subquests.length>MAX_SUBQUESTS)throw new Error(`เพิ่มเควสย่อยได้ไม่เกิน ${MAX_SUBQUESTS} ข้อ`);
  const ids=new Set();
  return {notes,subquests:subquests.map(task=>{
    record(task,'เควสย่อย');const id=identifier(task.id);
    if(ids.has(id))throw new Error('รหัสเควสย่อยซ้ำ');ids.add(id);
    return {id,text:text(task.text,'เควสย่อย',240),done:boolean(task.done,'สถานะเควสย่อย')};
  })};
}

const STYLES = ['seal', 'rectangle', 'banner'];
const THEMES = ['walnut', 'midnight', 'parchment'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_ITEMS = 500;
const MAX_STAMPS = 30;
const SETTINGS = { stampStyle: 'seal', theme: 'walnut', boardName: 'กระดานนักผจญภัย' };

export function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function record(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} ต้องเป็นข้อมูลแบบ object`);
  return value;
}

function text(value, name, max, allowEmpty = false) {
  if (typeof value !== 'string') throw new Error(`${name} ต้องเป็นข้อความ`);
  const normalized = value.trim();
  if ((!allowEmpty && !normalized) || normalized.length > max) throw new Error(`${name} ต้องมีความยาว ${allowEmpty ? 0 : 1}–${max} ตัวอักษร`);
  return normalized;
}

function oneOf(value, choices, name) {
  if (!choices.includes(value)) throw new Error(`${name} ไม่ถูกต้อง`);
  return value;
}

function number(value, name, min, max, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`${name} ต้องเป็นตัวเลขระหว่าง ${min}–${max}`);
  }
  return value;
}

function boolean(value, name) {
  if (typeof value !== 'boolean') throw new Error(`${name} ต้องเป็น true หรือ false`);
  return value;
}

function identifier(value) {
  const id = text(value, 'รหัส', 100);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('รหัสมีอักขระที่ไม่รองรับ');
  return id;
}

function dueDate(value) {
  if (value === '') return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('วันที่ไม่ถูกต้อง');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('วันที่ไม่ถูกต้อง');
  return value;
}

function normalizeStampPosition(value) {
  if (value == null) return null;
  record(value, 'ตำแหน่งตราประทับ');
  return {
    x: number(value.x, 'ตำแหน่งตราประทับ x', 0, STAMP_SPACE.width),
    y: number(value.y, 'ตำแหน่งตราประทับ y', 0, STAMP_SPACE.height),
  };
}

export function clampPosition(x, y, type = 'quest', bounds = BOARD) {
  number(x, 'ตำแหน่ง x', -1e6, 1e6);
  number(y, 'ตำแหน่ง y', -1e6, 1e6);
  oneOf(type, ['quest', 'label', 'folder'], 'ชนิดกระดาษ');
  const width = type === 'label' ? 230 : PAPER.width;
  const height = type === 'label' ? 70 : type === 'folder' ? 210 : PAPER.height;
  record(bounds, 'ขอบเขตกระดาน');
  const boardWidth = number(bounds.width, 'ความกว้างกระดาน', width, BOARD_LIMIT.width);
  const boardHeight = number(bounds.height, 'ความสูงกระดาน', height, BOARD_LIMIT.height);
  return { x: Math.max(0, Math.min(boardWidth - width, x)), y: Math.max(0, Math.min(boardHeight - height, y)) };
}

function normalizeItem(raw) {
  record(raw, 'รายการ');
  const type = oneOf(raw.type, ['quest', 'label', 'folder'], 'ชนิดรายการ');
  let storagePosition;
  if(raw.storagePosition!=null){
    record(raw.storagePosition,'ตำแหน่งในลิ้นชัก');
    const max=clampPosition(BOARD_LIMIT.width,BOARD_LIMIT.height,type,BOARD_LIMIT);
    // Version-one trays allowed the former quest footprint all the way to
    // their edge. Accept that range, then fit each current item to its size.
    storagePosition={
      x:Math.min(max.x,number(raw.storagePosition.x,'ตำแหน่งลิ้นชัก x',0,Math.max(BOARD_LIMIT.width-STAMP_SPACE.width,max.x))),
      y:Math.min(max.y,number(raw.storagePosition.y,'ตำแหน่งลิ้นชัก y',0,Math.max(BOARD_LIMIT.height-STAMP_SPACE.height,max.y))),
    };
  }
  const common = {
    id: identifier(raw.id), type,
    ...clampPosition(raw.x, raw.y, type, BOARD_LIMIT),
    rotation: number(raw.rotation, 'มุมเอียง', -180, 180),
    z: number(raw.z, 'ลำดับชั้น', 0, 1e6, true),
    ...(storagePosition===undefined?{}:{storagePosition}),
  };
  if (type === 'label') return { ...common, text: text(raw.text, 'ข้อความหัวข้อ', 60), color: oneOf(raw.color, ['gold', 'sage', 'red'], 'สีหัวข้อ') };
  if (type === 'folder') return {
    ...common,
    name: text(raw.name, 'ชื่อแฟ้ม', 60),
    color: oneOf(raw.color, ['gold', 'sage', 'red'], 'สีแฟ้ม'),
    archived: boolean(raw.archived === undefined ? true : raw.archived, 'การเก็บเข้าลิ้นชัก'),
  };
  const status = oneOf(raw.status, Object.keys(STATUS), 'สถานะ');
  const stampId = raw.stampId === null ? null : identifier(raw.stampId);
  const stampPosition = normalizeStampPosition(raw.stampPosition);
  const archived = boolean(raw.archived === undefined ? false : raw.archived, 'การเก็บเข้าลิ้นชัก');
  const folderId = raw.folderId == null ? null : identifier(raw.folderId);
  if (!archived && folderId !== null) throw new Error('ภารกิจในแฟ้มต้องเก็บอยู่ในแฟ้ม ไม่ใช่บนกระดาน');
  const imageDataUrl = raw.imageDataUrl == null ? null : normalizeRaster(raw.imageDataUrl, 'รูปภาพภารกิจ');
  const photoLayout = raw.photoLayout===undefined ? undefined : normalizePhotoLayout(raw.photoLayout);
  const prerequisiteIds = normalizePrerequisiteIds(raw.prerequisiteIds);
  return {
    ...common,
    title: text(raw.title, 'ชื่อภารกิจ', 120),
    description: text(raw.description, 'รายละเอียด', 1500, true),
    category: oneOf(raw.category, CATEGORIES, 'หมวดหมู่'),
    priority: oneOf(raw.priority, ['high', 'normal', 'low'], 'ความสำคัญ'),
    due: dueDate(raw.due), xp: number(raw.xp, 'ค่าประสบการณ์', 0, 10000, true),
    status, stampId: status === 'active' ? null : stampId,
    stampStyle: oneOf(raw.stampStyle, STYLES, 'รูปแบบตราประทับ'),
    stampPosition: status === 'active' ? null : stampPosition,
    archived, folderId,
    ...(raw.notes===undefined&&raw.subquests===undefined?{}:normalizeQuestBack(raw)),
    imageDataUrl,
    ...(photoLayout===undefined?{}:{photoLayout:imageDataUrl===null?null:photoLayout}),
    ...(prerequisiteIds===undefined?{}:{prerequisiteIds}),
  };
}

function placement(input, state, type) {
  if (state.items.length >= MAX_ITEMS) throw new Error(`กระดานมีรายการได้ไม่เกิน ${MAX_ITEMS} ชิ้น`);
  const offset = state.items.filter(i => i.type === type).length % 9;
  const z = state.items.reduce((highest, item) => Math.max(highest, item.z), 0) + 1;
  return {
    id: uid(), type,
    x: input.x ?? 55 + offset * 16,
    y: input.y ?? (type === 'label' ? 25 : 85) + offset * 18,
    rotation: input.rotation ?? 0, z,
  };
}

export function createQuest(input, state) {
  record(input, 'ภารกิจ');
  const quest = normalizeItem({
    ...placement(input, state, 'quest'),
    title: input.title,
    description: input.description ?? '',
    category: input.category ?? CATEGORIES[0],
    priority: input.priority ?? 'normal',
    due: input.due ?? '', xp: input.xp ?? 50,
    status: input.status ?? 'active', stampId: input.stampId ?? null,
    stampStyle: input.stampStyle ?? state.settings?.stampStyle ?? 'seal',
    stampPosition: input.stampPosition ?? null,
    archived: input.archived,
    folderId: input.folderId,
    imageDataUrl: input.imageDataUrl,
    ...(input.photoLayout===undefined?{}:{photoLayout:input.photoLayout}),
    ...(input.notes===undefined&&input.subquests===undefined?{}:{notes:input.notes,subquests:input.subquests}),
    ...(input.prerequisiteIds===undefined?{}:{prerequisiteIds:input.prerequisiteIds}),
  });
  checkStampReference(quest, state.stamps);
  checkFolderReference(quest, state.items);
  const items=[...state.items,quest];
  validateDependencies(items);
  checkCompletionPrerequisites(quest,items);
  checkBackupBudget({ ...state, items });
  return quest;
}

export function createLabel(input, state) {
  record(input, 'หัวข้อ');
  const label = normalizeItem({ ...placement(input, state, 'label'), text: input.text, color: input.color ?? 'gold' });
  checkBackupBudget({ ...state, items: [...state.items, label] });
  return label;
}

export function createFolder(input, state) {
  record(input, 'แฟ้ม');
  const folder = normalizeItem({
    ...placement(input, state, 'folder'),
    name: input.name, color: input.color ?? 'gold', archived: input.archived,
  });
  checkBackupBudget({ ...state, items: [...state.items, folder] });
  return folder;
}

function checkStampReference(item, stamps) {
  if (item.type === 'quest' && item.stampId !== null && !stamps.some(stamp => stamp.id === item.stampId)) {
    throw new Error('ไม่พบตราประทับที่อ้างถึง');
  }
}

function checkFolderReference(item, items) {
  if (item.type === 'quest' && item.folderId !== null && !items.some(folder => folder.id === item.folderId && folder.type === 'folder')) {
    throw new Error('ไม่พบแฟ้มที่ภารกิจอ้างถึง');
  }
}

function checkCompletionPrerequisites(item,items){
  if(item.type==='quest'&&item.status==='done'&&dependencyInfo(items,item).pending.length){
    throw new Error('ต้องทำภารกิจเงื่อนไขให้สำเร็จครบทุกภารกิจก่อนประทับตราสำเร็จ');
  }
}

export function updateItem(state, id, patch) {
  record(patch, 'ข้อมูลแก้ไข');
  const index = state.items.findIndex(item => item.id === id);
  if (index < 0) throw new Error('ไม่พบรายการนี้');
  const old = state.items[index];
  if ((Object.hasOwn(patch, 'id') && patch.id !== old.id) || (Object.hasOwn(patch, 'type') && patch.type !== old.type)) {
    throw new Error('ไม่สามารถเปลี่ยนรหัสหรือชนิดรายการ');
  }
  const imageChanged=old.type==='quest'&&Object.hasOwn(patch,'imageDataUrl')&&patch.imageDataUrl!==old.imageDataUrl;
  const updated = normalizeItem({ ...old, ...patch, ...(imageChanged&&patch.photoLayout===undefined&&old.photoLayout!==undefined?{photoLayout:null}:{}) });
  checkStampReference(updated, state.stamps);
  checkFolderReference(updated, state.items);
  const items = state.items.slice();
  items[index] = updated;
  validateDependencies(items);
  if(old.status!=='done')checkCompletionPrerequisites(updated,items);
  const next = { ...state, items };
  checkBackupBudget(next);
  return next;
}

export function deleteItem(state, id) {
  const target = state.items.find(item => item.id === id);
  const items = state.items.filter(item => item.id !== id).map(item => {
    let updated=item;
    if(target?.type==='folder'&&item.type==='quest'&&item.folderId===id)updated={...updated,archived:true,folderId:null};
    if(item.type==='quest'&&item.prerequisiteIds?.includes(id))updated={...updated,prerequisiteIds:item.prerequisiteIds.filter(prerequisiteId=>prerequisiteId!==id)};
    return updated;
  });
  validateDependencies(items);
  const next = { ...state, items };
  checkBackupBudget(next);
  return next;
}

export function setItemStatus(state, id, status, stampId = null, stampStyle = 'seal', stampPosition = undefined) {
  oneOf(status, Object.keys(STATUS), 'สถานะ');
  const item = state.items.find(item => item.id === id);
  if (!item || item.type !== 'quest') throw new Error('ไม่พบภารกิจนี้');
  return updateItem(state, id, {
    status, stampId: status === 'active' ? null : stampId, stampStyle,
    ...(stampPosition === undefined ? {} : { stampPosition }),
  });
}

export function setArchived(state, id, archived) {
  boolean(archived, 'การเก็บเข้าลิ้นชัก');
  const item = state.items.find(item => item.id === id);
  if (!item || !['quest', 'folder'].includes(item.type)) throw new Error('ไม่พบภารกิจหรือแฟ้มนี้');
  return updateItem(state, id, item.type === 'quest' ? { archived, folderId: null } : { archived });
}

export function moveQuestToFolder(state, questId, folderId) {
  const quest = state.items.find(item => item.id === questId);
  const folder = state.items.find(item => item.id === folderId);
  if (!quest || quest.type !== 'quest') throw new Error('ไม่พบภารกิจนี้');
  if (!folder || folder.type !== 'folder') throw new Error('ไม่พบแฟ้มนี้');
  return updateItem(state, questId, { archived: true, folderId });
}

export function filterQuests(items, { status = 'all', category = 'all', search = '', archived = false, folderId = null } = {}) {
  const query = String(search).trim().toLocaleLowerCase('th');
  const inArchive = folderId !== null ? true : archived;
  return items.filter(item => item.type === 'quest'
    && (item.archived ?? false) === inArchive
    && (item.folderId ?? null) === folderId
    && (status === 'all' || item.status === status)
    && (category === 'all' || item.category === category)
    && (!query || `${item.title}\n${item.description}\n${item.category}`.toLocaleLowerCase('th').includes(query)));
}

function normalizeRaster(dataUrl, name) {
  if (typeof dataUrl !== 'string' || dataUrl.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 40) throw new Error(`${name}ต้องมีขนาดไม่เกิน 2 MB`);
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match || match[2].length % 4 !== 0) throw new Error('รองรับรูป PNG, JPEG และ WebP เท่านั้น');
  const padding = match[2].endsWith('==') ? 2 : match[2].endsWith('=') ? 1 : 0;
  const byteLength = match[2].length / 4 * 3 - padding;
  if (byteLength > MAX_IMAGE_BYTES) throw new Error(`${name}ต้องมีขนาดไม่เกิน 2 MB`);
  let bytes;
  // Decode only the signature: editing a paper should not decode its entire photo.
  try { bytes = atob(match[2].slice(0, 32)); } catch { throw new Error('ข้อมูลรูปภาพไม่ถูกต้อง'); }
  const isPng = bytes.startsWith('\x89PNG\r\n\x1a\n');
  const isJpeg = bytes.startsWith('\xff\xd8\xff');
  const isWebp = bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP';
  if (!({ png: isPng, jpeg: isJpeg, webp: isWebp })[match[1]]) throw new Error('ชนิดข้อมูลรูปไม่ตรงกับไฟล์');
  return dataUrl;
}

function normalizeStamp(raw) {
  record(raw, 'ตราประทับ');
  return {
    id: identifier(raw.id), name: text(raw.name, 'ชื่อตราประทับ', 60),
    status: oneOf(raw.status, ['done', 'failed', 'paused'], 'สถานะตราประทับ'),
    dataUrl: normalizeRaster(raw.dataUrl, 'รูปตราประทับ'),
  };
}

function checkBackupBudget(state) {
  let imageBytes = 0;
  const items = state.items.map(item => {
    if (item.type !== 'quest' || !item.imageDataUrl) return item;
    imageBytes += item.imageDataUrl.length;
    return { ...item, imageDataUrl: '' };
  });
  const stamps = state.stamps.map(stamp => {
    imageBytes += stamp.dataUrl.length;
    return { ...stamp, dataUrl: '' };
  });
  // Validated data URLs are ASCII without JSON escapes. Count their exact bytes
  // separately to avoid allocating a huge backup string on every board edit.
  const metadata = JSON.stringify({ ...state, items, stamps }, null, 2);
  const metadataBytes = new TextEncoder().encode(metadata).byteLength;
  if (imageBytes + metadataBytes > MAX_BACKUP_BYTES) {
    throw new Error('ข้อมูลกระดานมีขนาดเกิน 90 MB กรุณาลบรูปภาพหรือตราประทับบางส่วน');
  }
}

export function addStamp(state, input) {
  if (state.stamps.length >= MAX_STAMPS) throw new Error(`มีตราประทับได้ไม่เกิน ${MAX_STAMPS} ชิ้น`);
  const stamp = normalizeStamp(input);
  if (state.stamps.some(existing => existing.id === stamp.id) || state.items.some(item => item.id === stamp.id)) {
    throw new Error('ข้อมูลมีรหัสซ้ำกัน');
  }
  const next = { ...state, stamps: [...state.stamps, stamp] };
  checkBackupBudget(next);
  return next;
}

export function validateState(raw) {
  record(raw, 'ข้อมูลกระดาน');
  if (raw.version !== 1) throw new Error('ไม่รองรับเวอร์ชันข้อมูลนี้');
  if (!Array.isArray(raw.items) || raw.items.length > MAX_ITEMS) throw new Error(`ข้อมูลกระดานต้องมีรายการไม่เกิน ${MAX_ITEMS} ชิ้น`);
  if (!Array.isArray(raw.stamps) || raw.stamps.length > MAX_STAMPS) throw new Error(`ข้อมูลกระดานต้องมีตราประทับไม่เกิน ${MAX_STAMPS} ชิ้น`);
  record(raw.settings, 'การตั้งค่า');
  const settings = {
    stampStyle: oneOf(raw.settings.stampStyle, STYLES, 'รูปแบบตราประทับ'),
    theme: oneOf(raw.settings.theme, THEMES, 'ธีมกระดาน'),
    boardName: text(raw.settings.boardName, 'ชื่อกระดาน', 80),
  };
  const stamps = raw.stamps.map(normalizeStamp);
  const items = raw.items.map(normalizeItem);
  const ids = new Set();
  for (const entry of [...items, ...stamps]) {
    if (ids.has(entry.id)) throw new Error('ข้อมูลมีรหัสซ้ำกัน');
    ids.add(entry.id);
  }
  // Validate original references before normalization clears active quest stamps.
  for (const item of raw.items) checkStampReference(item, stamps);
  for (const item of items) checkFolderReference(item, items);
  validateDependencies(items);
  const normalized = { version: 1, items, stamps, settings };
  checkBackupBudget(normalized);
  return normalized;
}

export function serializeState(state) {
  return JSON.stringify(validateState(state), null, 2);
}

export function parseState(json) {
  if (typeof json !== 'string' || json.length > MAX_BACKUP_BYTES || new TextEncoder().encode(json).byteLength > MAX_BACKUP_BYTES) {
    throw new Error('ไฟล์สำรองมีขนาดใหญ่เกินไป');
  }
  return validateState(JSON.parse(json));
}

export function createInitialState() {
  const state = { version: 1, items: [], stamps: [], settings: { ...SETTINGS } };
  const seeds = [
    { title: 'สร้างสิ่งเล็ก ๆ ที่ยิ่งใหญ่', description: 'เริ่มโปรเจกต์ที่อยากทำมานาน\nวันนี้ขอแค่ก้าวแรกก็เพียงพอ', category: 'งานหลัก', priority: 'high', xp: 120, rotation: -1.3 },
    { title: 'อ่านหนังสือ 20 หน้า', description: 'พักจากหน้าจอ แล้วออกเดินทาง\nผ่านเรื่องราวบทใหม่', category: 'พัฒนาตัวเอง', xp: 60, rotation: 1.2 },
    { title: 'ออกไปผจญภัยข้างนอก', description: 'เดินเล่น สูดอากาศ และมองหา\nสิ่งสวยงามระหว่างทาง', category: 'ชีวิตประจำวัน', xp: 80, rotation: -1 },
    { title: 'จัดมุมทำงานให้น่าอยู่', description: 'เก็บของที่ไม่จำเป็น เพิ่มพื้นที่\nให้ความคิดใหม่ ๆ ได้เติบโต', category: 'ชีวิตประจำวัน', status: 'done', xp: 50, rotation: 1.4 },
    { title: 'ฝึกทักษะใหม่วันละนิด', description: 'แบ่งเวลา 30 นาทีให้สิ่งที่สนใจ\nความชำนาญเริ่มจากการลอง', category: 'พัฒนาตัวเอง', xp: 100, rotation: -1.5 },
    { title: 'วางแผนทริปเล็ก ๆ', description: 'จดสถานที่ที่อยากไปไว้ก่อน\nพร้อมเมื่อไรค่อยออกเดินทาง', category: 'ชีวิตประจำวัน', priority: 'low', status: 'paused', xp: 70, rotation: 1 },
  ];
  const headingY=25,headingHeight=70,gap=24; // Includes clearance for the seeds' slight rotations.
  const firstRowY=headingY+headingHeight+gap;
  const secondHeadingY=firstRowY+PAPER.height+gap;
  const secondRowY=secondHeadingY+headingHeight+gap;
  seeds.forEach((seed, index) => state.items.push(createQuest({ ...seed, x: [55, 425, 795][index % 3], y: index < 3 ? firstRowY : secondRowY }, state)));
  state.items.push(createLabel({ text: 'ภารกิจประจำวัน', x: 55, y: headingY, color: 'gold', rotation: -0.5 }, state));
  state.items.push(createLabel({ text: 'ทุกก้าวมีความหมาย', x: 55, y: secondHeadingY, color: 'sage', rotation: 0.6 }, state));
  return state;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('เบราว์เซอร์นี้ไม่รองรับการบันทึก IndexedDB'));
    const request = globalThis.indexedDB.open('questboard', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('board')) request.result.createObjectStore('board');
    };
    request.onerror = () => reject(request.error ?? new Error('เปิดพื้นที่บันทึกไม่สำเร็จ'));
    request.onblocked = () => reject(new Error('กรุณาปิดแท็บกระดานอื่นแล้วลองอีกครั้ง'));
    request.onsuccess = () => resolve(request.result);
  });
}

export async function loadState() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('board', 'readonly');
    const request = transaction.objectStore('board').get('current');
    let state;
    let validationError;
    request.onsuccess = () => {
      try { state = request.result === undefined ? null : validateState(request.result); }
      catch (error) { validationError = error; }
    };
    transaction.oncomplete = () => {
      database.close();
      if (validationError) reject(validationError);
      else resolve(state);
    };
    transaction.onerror = transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? request.error ?? new Error('อ่านข้อมูลไม่สำเร็จ'));
    };
  });
}

export async function saveState(state) {
  const normalized = validateState(state);
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('board', 'readwrite');
    const request = transaction.objectStore('board').put(normalized, 'current');
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? request.error ?? new Error('บันทึกข้อมูลไม่สำเร็จ'));
    };
  });
}
