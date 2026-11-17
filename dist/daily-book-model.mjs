export const DAILY_BOOK_SIZE = Object.freeze({ width: 256, height: 320 });
export const MAX_DAILY_TASKS = 80;
export const MAX_DAILY_TALLY = 9999;
export const DAILY_BOOK_COLORS = Object.freeze(['gold', 'sage', 'red', 'navy']);

const DEFAULT_TASKS = Object.freeze([
  { id: 'daily-dishes', title: 'ล้างจาน', note: 'หลังมื้ออาหาร', count: 0, totalCount: 0, lastTalliedAt: '' },
  { id: 'daily-sweep', title: 'กวาดห้อง', note: 'ดูแลพื้นที่พักผ่อนให้สะอาด', count: 0, totalCount: 0, lastTalliedAt: '' },
  { id: 'daily-desk', title: 'จัดโต๊ะทำงาน', note: 'เก็บของเข้าที่ก่อนเริ่มงาน', count: 0, totalCount: 0, lastTalliedAt: '' },
]);

function record(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} ต้องเป็นข้อมูลแบบ object`);
  return value;
}

function text(value, name, max, allowEmpty = false) {
  if (typeof value !== 'string') throw new Error(`${name} ต้องเป็นข้อความ`);
  const normalized = value.trim();
  if ((!allowEmpty && !normalized) || normalized.length > max) {
    throw new Error(`${name} ต้องมีความยาว ${allowEmpty ? 0 : 1}–${max} ตัวอักษร`);
  }
  return normalized;
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
  const id = text(value, 'รหัสรายการในสมุด', 100);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('รหัสรายการในสมุดมีอักขระที่ไม่รองรับ');
  return id;
}

function optionalDate(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('วันที่ขีดนับไม่ถูกต้อง');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('วันที่ขีดนับไม่ถูกต้อง');
  return value;
}

export function todayIsoDate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeDailyTask(raw) {
  record(raw, 'งานประจำในสมุด');
  const count = number(raw.count ?? 0, 'จำนวนขีดนับ', 0, MAX_DAILY_TALLY, true);
  const totalCount = Math.max(count, number(raw.totalCount ?? count, 'จำนวนขีดสะสมรวม', 0, MAX_DAILY_TALLY * 10, true));
  return {
    id: identifier(raw.id),
    title: text(raw.title, 'ชื่องานประจำ', 80),
    note: text(raw.note ?? '', 'หมายเหตุงานประจำ', 160, true),
    count,
    totalCount,
    lastTalliedAt: optionalDate(raw.lastTalliedAt),
  };
}

export function normalizeDailyBook(raw, boardLimit = { width: 20000, height: 20000 }) {
  record(raw, 'สมุดงานประจำวัน');
  const color = raw.color ?? 'gold';
  if (!DAILY_BOOK_COLORS.includes(color)) throw new Error('สีปกสมุดไม่ถูกต้อง');
  const maxX = Math.max(0, boardLimit.width - DAILY_BOOK_SIZE.width);
  const maxY = Math.max(0, boardLimit.height - DAILY_BOOK_SIZE.height);
  const x = Math.max(0, Math.min(maxX, number(raw.x ?? 855, 'ตำแหน่งสมุด x', -1e6, 1e6)));
  const y = Math.max(0, Math.min(maxY, number(raw.y ?? 24, 'ตำแหน่งสมุด y', -1e6, 1e6)));
  const rotation = number(raw.rotation ?? -1.2, 'มุมเอียงสมุด', -180, 180);
  const z = number(raw.z ?? 12, 'ลำดับชั้นสมุด', 0, 1e6, true);
  const archived = boolean(raw.archived === undefined ? false : raw.archived, 'การเก็บสมุดเข้าลิ้นชัก');
  let storagePosition;
  if (raw.storagePosition != null) {
    record(raw.storagePosition, 'ตำแหน่งสมุดในลิ้นชัก');
    storagePosition = {
      x: Math.max(0, Math.min(maxX, number(raw.storagePosition.x, 'ตำแหน่งสมุดในลิ้นชัก x', 0, boardLimit.width))),
      y: Math.max(0, Math.min(maxY, number(raw.storagePosition.y, 'ตำแหน่งสมุดในลิ้นชัก y', 0, boardLimit.height))),
    };
  }
  const tasksRaw = raw.tasks === undefined ? [] : raw.tasks;
  if (!Array.isArray(tasksRaw) || tasksRaw.length > MAX_DAILY_TASKS) {
    throw new Error(`สมุดงานประจำวันมีรายการได้ไม่เกิน ${MAX_DAILY_TASKS} รายการ`);
  }
  const ids = new Set();
  const tasks = tasksRaw.map(item => {
    const task = normalizeDailyTask(item);
    if (ids.has(task.id)) throw new Error('รหัสงานประจำในสมุดซ้ำกัน');
    ids.add(task.id);
    return task;
  });
  return {
    title: text(raw.title ?? 'สมุดงานประจำวัน', 'ชื่อสมุด', 60),
    subtitle: text(raw.subtitle ?? 'ขีดนับกิจวัตรประจำวันของนักผจญภัย', 'คำโปรยสมุด', 100, true),
    color,
    x,
    y,
    rotation,
    z,
    archived,
    ...(storagePosition === undefined ? {} : { storagePosition }),
    tasks,
  };
}

export function createDefaultDailyBook(overrides = {}) {
  return normalizeDailyBook({
    title: 'สมุดงานประจำวัน',
    subtitle: 'ขีดนับงานที่ทำซ้ำทุกวันทีละขีด',
    color: 'gold',
    x: 855,
    y: 24,
    rotation: -1.2,
    z: 12,
    archived: false,
    tasks: DEFAULT_TASKS.map(task => ({ ...task })),
    ...overrides,
  });
}

export function ensureDailyBook(state) {
  if (state?.dailyBook) return state;
  const highestZ = (state?.items ?? []).reduce((max, item) => Math.max(max, item.z ?? 0), 0);
  return {
    ...state,
    dailyBook: createDefaultDailyBook({ z: highestZ + 1 }),
  };
}

export function updateDailyBookMeta(state, patch) {
  record(patch, 'ข้อมูลแก้ไขสมุด');
  const base = ensureDailyBook(state);
  const dailyBook = normalizeDailyBook({ ...base.dailyBook, ...patch });
  return { ...base, dailyBook };
}

export function addDailyTask(state, input, makeId = () => `daily-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`) {
  record(input, 'ข้อมูลงานประจำ');
  const base = ensureDailyBook(state);
  if (base.dailyBook.tasks.length >= MAX_DAILY_TASKS) {
    throw new Error(`สมุดงานประจำวันมีรายการได้ไม่เกิน ${MAX_DAILY_TASKS} รายการ`);
  }
  const task = normalizeDailyTask({
    id: input.id ?? makeId(),
    title: input.title,
    note: input.note ?? '',
    count: input.count ?? 0,
    totalCount: input.totalCount ?? input.count ?? 0,
    lastTalliedAt: input.lastTalliedAt ?? '',
  });
  const dailyBook = normalizeDailyBook({
    ...base.dailyBook,
    tasks: [...base.dailyBook.tasks, task],
  });
  return { ...base, dailyBook };
}

export function updateDailyTask(state, taskId, patch) {
  record(patch, 'ข้อมูลแก้ไขงานประจำ');
  const base = ensureDailyBook(state);
  const index = base.dailyBook.tasks.findIndex(task => task.id === taskId);
  if (index < 0) throw new Error('ไม่พบรายการงานประจำนี้ในสมุด');
  const current = base.dailyBook.tasks[index];
  const updated = normalizeDailyTask({
    ...current,
    ...patch,
    id: current.id,
  });
  const tasks = base.dailyBook.tasks.slice();
  tasks[index] = updated;
  return { ...base, dailyBook: normalizeDailyBook({ ...base.dailyBook, tasks }) };
}

export function deleteDailyTask(state, taskId) {
  const base = ensureDailyBook(state);
  if (!base.dailyBook.tasks.some(task => task.id === taskId)) throw new Error('ไม่พบรายการงานประจำนี้ในสมุด');
  const tasks = base.dailyBook.tasks.filter(task => task.id !== taskId);
  return { ...base, dailyBook: normalizeDailyBook({ ...base.dailyBook, tasks }) };
}

export function tallyDailyTask(state, taskId, delta = 1, date = todayIsoDate()) {
  if (!Number.isInteger(delta) || delta === 0) throw new Error('จำนวนขีดที่เปลี่ยนต้องเป็นจำนวนเต็มที่ไม่ใช่ศูนย์');
  const base = ensureDailyBook(state);
  const index = base.dailyBook.tasks.findIndex(task => task.id === taskId);
  if (index < 0) throw new Error('ไม่พบรายการงานประจำนี้ในสมุด');
  const current = base.dailyBook.tasks[index];
  const nextCount = Math.max(0, Math.min(MAX_DAILY_TALLY, current.count + delta));
  const actualDelta = nextCount - current.count;
  const nextTotal = Math.max(nextCount, Math.max(0, current.totalCount + actualDelta));
  const updated = normalizeDailyTask({
    ...current,
    count: nextCount,
    totalCount: nextTotal,
    lastTalliedAt: delta > 0 ? date : current.lastTalliedAt,
  });
  const tasks = base.dailyBook.tasks.slice();
  tasks[index] = updated;
  return { ...base, dailyBook: normalizeDailyBook({ ...base.dailyBook, tasks }) };
}

export function resetDailyTaskCount(state, taskId) {
  const base = ensureDailyBook(state);
  const index = base.dailyBook.tasks.findIndex(task => task.id === taskId);
  if (index < 0) throw new Error('ไม่พบรายการงานประจำนี้ในสมุด');
  const current = base.dailyBook.tasks[index];
  const tasks = base.dailyBook.tasks.slice();
  tasks[index] = normalizeDailyTask({ ...current, count: 0 });
  return { ...base, dailyBook: normalizeDailyBook({ ...base.dailyBook, tasks }) };
}

export function resetAllDailyTaskCounts(state) {
  const base = ensureDailyBook(state);
  const tasks = base.dailyBook.tasks.map(task => normalizeDailyTask({ ...task, count: 0 }));
  return { ...base, dailyBook: normalizeDailyBook({ ...base.dailyBook, tasks }) };
}

export function splitTallyBundles(count) {
  const safe = Math.max(0, Math.floor(Number(count) || 0));
  const fullBundles = Math.floor(safe / 5);
  const remainder = safe % 5;
  const bundles = Array.from({ length: fullBundles }, () => 5);
  if (remainder > 0) bundles.push(remainder);
  return bundles;
}
