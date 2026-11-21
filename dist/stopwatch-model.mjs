/**
 * The Questboard — The Overdrive Pocket Stopwatch Model
 * Pure business logic for the antique brass fantasy chronometer on the guild desk.
 * Supports both Pomodoro Focus Countdown and Mission Stopwatch modes.
 */

export const DEFAULT_STOPWATCH = Object.freeze({
  x: 840,
  y: 120,
  mode: 'pomodoro', // 'pomodoro' | 'stopwatch'
  status: 'idle', // 'idle' | 'running' | 'paused' | 'completed'
  duration: 1500, // 25 minutes default for Pomodoro (in seconds)
  accumulatedMs: 0,
  startedAt: null,
  pinnedQuestId: null,
});

export const PRESET_DURATIONS = Object.freeze([
  { label: '15 นาที (ภารกิจด่วน)', seconds: 15 * 60 },
  { label: '25 นาที (โฟกัสมาตรฐาน)', seconds: 25 * 60 },
  { label: '50 นาที (ภารกิจลึก)', seconds: 50 * 60 },
]);

function record(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} ต้องเป็นออบเจกต์`);
  }
  return value;
}

function number(value, name, min = -Infinity, max = Infinity) {
  if (typeof value !== 'number' || Number.isNaN(value) || value < min || value > max) {
    throw new Error(`${name} ต้องเป็นตัวเลขระหว่าง ${min} ถึง ${max}`);
  }
  return value;
}

function oneOf(value, allowed, name) {
  if (!allowed.includes(value)) {
    throw new Error(`${name} ต้องเป็นหนึ่งใน: ${allowed.join(', ')}`);
  }
  return value;
}

/**
 * Normalizes stopwatch data safely, ensuring compatibility with legacy backups.
 */
export function normalizeStopwatch(raw, items = []) {
  if (raw === undefined || raw === null) return { ...DEFAULT_STOPWATCH };
  record(raw, 'นาฬิกาพกโอเวอร์ไดรฟ์');

  const x = number(raw.x ?? DEFAULT_STOPWATCH.x, 'พิกัดนาฬิกา x', 0, 5000);
  const y = number(raw.y ?? DEFAULT_STOPWATCH.y, 'พิกัดนาฬิกา y', 0, 5000);
  const mode = oneOf(raw.mode ?? DEFAULT_STOPWATCH.mode, ['pomodoro', 'stopwatch'], 'โหมดนาฬิกา');
  const status = oneOf(raw.status ?? DEFAULT_STOPWATCH.status, ['idle', 'running', 'paused', 'completed'], 'สถานะนาฬิกา');
  const duration = number(raw.duration ?? DEFAULT_STOPWATCH.duration, 'ระยะเวลาโฟกัส', 10, 86400);
  const accumulatedMs = Math.max(0, number(raw.accumulatedMs ?? 0, 'เวลาสะสม', 0, 864000000));
  
  let startedAt = null;
  if (raw.startedAt != null) {
    const num = Number(raw.startedAt);
    if (!Number.isNaN(num) && num > 0) startedAt = num;
  }

  let pinnedQuestId = null;
  if (raw.pinnedQuestId != null) {
    const qid = String(raw.pinnedQuestId);
    if (items.some(i => i.id === qid && i.type === 'quest')) {
      pinnedQuestId = qid;
    }
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    mode,
    status,
    duration,
    accumulatedMs,
    startedAt,
    pinnedQuestId,
  };
}

/**
 * Calculates current runtime values (elapsed, remaining, display text, and hand rotations).
 */
export function getStopwatchTime(stopwatch, now = Date.now()) {
  const currentSegment = (stopwatch.status === 'running' && stopwatch.startedAt)
    ? Math.max(0, now - stopwatch.startedAt)
    : 0;
  const totalElapsedMs = (stopwatch.accumulatedMs || 0) + currentSegment;

  let displayMs = 0;
  let isFinished = false;

  if (stopwatch.mode === 'stopwatch') {
    displayMs = totalElapsedMs;
    isFinished = false;
  } else {
    const targetMs = (stopwatch.duration || 1500) * 1000;
    const remainingMs = Math.max(0, targetMs - totalElapsedMs);
    displayMs = remainingMs;
    isFinished = totalElapsedMs >= targetMs;
  }

  const totalSec = stopwatch.mode === 'pomodoro'
    ? Math.ceil(displayMs / 1000)
    : Math.floor(displayMs / 1000);

  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  // Clock hands rotations
  // Second hand: 360 deg per 60 seconds (6 deg per sec)
  const secondHandDeg = (seconds + (displayMs % 1000) / 1000) * 6;
  
  // Minute hand: in pomodoro mode, points directly to remaining minutes (out of 60)
  // in stopwatch mode, points to elapsed minutes (out of 60)
  const minuteHandDeg = (minutes % 60) * 6 + (seconds / 60) * 6;

  // Hour hand: subtle progress indicator
  const hourHandDeg = ((minutes / 60) % 12) * 30;

  return {
    totalElapsedMs,
    displayMs,
    isFinished,
    minutes,
    seconds,
    formatted: `${mm}:${ss}`,
    secondHandDeg: Math.round(secondHandDeg * 10) / 10,
    minuteHandDeg: Math.round(minuteHandDeg * 10) / 10,
    hourHandDeg: Math.round(hourHandDeg * 10) / 10,
  };
}

export function startStopwatch(stopwatch, now = Date.now()) {
  if (stopwatch.status === 'running') return stopwatch;
  return {
    ...stopwatch,
    status: 'running',
    startedAt: now,
  };
}

export function pauseStopwatch(stopwatch, now = Date.now()) {
  if (stopwatch.status !== 'running') return stopwatch;
  const delta = stopwatch.startedAt ? Math.max(0, now - stopwatch.startedAt) : 0;
  return {
    ...stopwatch,
    status: 'paused',
    accumulatedMs: (stopwatch.accumulatedMs || 0) + delta,
    startedAt: null,
  };
}

export function resetStopwatch(stopwatch) {
  return {
    ...stopwatch,
    status: 'idle',
    accumulatedMs: 0,
    startedAt: null,
  };
}

export function switchMode(stopwatch, targetMode = null) {
  const nextMode = targetMode || (stopwatch.mode === 'pomodoro' ? 'stopwatch' : 'pomodoro');
  return {
    ...stopwatch,
    mode: nextMode,
    status: 'idle',
    accumulatedMs: 0,
    startedAt: null,
  };
}

export function setDuration(stopwatch, seconds) {
  const sec = Math.max(10, Math.min(86400, Number(seconds) || 1500));
  return {
    ...stopwatch,
    duration: sec,
    status: 'idle',
    accumulatedMs: 0,
    startedAt: null,
  };
}

export function finishStopwatch(stopwatch) {
  return {
    ...stopwatch,
    status: 'completed',
    startedAt: null,
  };
}

export function pinQuest(stopwatch, questId) {
  return {
    ...stopwatch,
    pinnedQuestId: questId ? String(questId) : null,
  };
}

export function updateStopwatch(state, patch) {
  record(patch, 'ข้อมูลอัปเดตนาฬิกาพก');
  const previous = state.stopwatch ?? DEFAULT_STOPWATCH;
  const stopwatch = normalizeStopwatch({ ...previous, ...patch }, state.items);
  return { ...state, stopwatch };
}
