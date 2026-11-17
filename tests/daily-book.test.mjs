import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  validateState,
  serializeState,
  parseState,
  ensureDailyBook,
  updateDailyBookMeta,
  addDailyTask,
  updateDailyTask,
  deleteDailyTask,
  tallyDailyTask,
  resetDailyTaskCount,
  resetAllDailyTaskCounts,
  splitTallyBundles,
} from '../dist/model.mjs';
import { renderTallyMarks, renderDailyBookCover } from '../dist/daily-book.mjs';

test('ensureDailyBook initializes one default ledger book with starter daily tasks and round-trips through backup JSON', () => {
  const initial = createInitialState();
  assert.equal(initial.dailyBook, undefined);

  const withBook = ensureDailyBook(initial);
  assert.ok(withBook.dailyBook);
  assert.equal(withBook.dailyBook.title, 'สมุดงานประจำวัน');
  assert.equal(withBook.dailyBook.archived, false);
  assert.ok(withBook.dailyBook.tasks.some(t => t.title === 'ล้างจาน'));
  assert.ok(withBook.dailyBook.tasks.some(t => t.title === 'กวาดห้อง'));

  const roundTripped = parseState(serializeState(withBook));
  assert.deepEqual(roundTripped, withBook);
});

test('adding, tallying by strokes, undoing, resetting, editing, and deleting daily tasks update counts accurately', () => {
  let state = ensureDailyBook(createInitialState());
  state = addDailyTask(state, { id: 'daily-laundry', title: '  ซักผ้า  ', note: '  ตากระเบียง  ' });
  const laundry = state.dailyBook.tasks.find(t => t.id === 'daily-laundry');
  assert.equal(laundry.title, 'ซักผ้า');
  assert.equal(laundry.note, 'ตากระเบียง');
  assert.equal(laundry.count, 0);
  assert.equal(laundry.totalCount, 0);

  for (let i = 0; i < 7; i++) {
    state = tallyDailyTask(state, 'daily-laundry', 1, '2026-11-17');
  }
  let updated = state.dailyBook.tasks.find(t => t.id === 'daily-laundry');
  assert.equal(updated.count, 7);
  assert.equal(updated.totalCount, 7);
  assert.equal(updated.lastTalliedAt, '2026-11-17');

  state = tallyDailyTask(state, 'daily-laundry', -1, '2026-11-17');
  updated = state.dailyBook.tasks.find(t => t.id === 'daily-laundry');
  assert.equal(updated.count, 6);
  assert.equal(updated.totalCount, 6);

  state = resetDailyTaskCount(state, 'daily-laundry');
  updated = state.dailyBook.tasks.find(t => t.id === 'daily-laundry');
  assert.equal(updated.count, 0);
  assert.equal(updated.totalCount, 6);

  state = tallyDailyTask(state, 'daily-laundry', 1, '2026-11-18');
  updated = state.dailyBook.tasks.find(t => t.id === 'daily-laundry');
  assert.equal(updated.count, 1);
  assert.equal(updated.totalCount, 7);

  state = updateDailyTask(state, 'daily-laundry', { title: 'ซักผ้าและพับผ้า', count: 5 });
  assert.equal(state.dailyBook.tasks.find(t => t.id === 'daily-laundry').title, 'ซักผ้าและพับผ้า');
  assert.equal(state.dailyBook.tasks.find(t => t.id === 'daily-laundry').count, 5);

  state = resetAllDailyTaskCounts(state);
  assert.ok(state.dailyBook.tasks.every(t => t.count === 0));
  assert.equal(state.dailyBook.tasks.find(t => t.id === 'daily-laundry').totalCount, 7);

  state = deleteDailyTask(state, 'daily-laundry');
  assert.equal(state.dailyBook.tasks.some(t => t.id === 'daily-laundry'), false);
});

test('splitTallyBundles and renderTallyMarks group strokes into bundles of 5 with diagonal 5th slash', () => {
  assert.deepEqual(splitTallyBundles(0), []);
  assert.deepEqual(splitTallyBundles(3), [3]);
  assert.deepEqual(splitTallyBundles(5), [5]);
  assert.deepEqual(splitTallyBundles(12), [5, 5, 2]);

  const emptyHtml = renderTallyMarks(0);
  assert.match(emptyHtml, /daily-tally-empty/);

  const twelveHtml = renderTallyMarks(12, { fresh: true });
  assert.equal((twelveHtml.match(/class="tally-bundle"/g) || []).length, 3);
  assert.equal((twelveHtml.match(/class="tally-slash/g) || []).length, 2);
  assert.match(twelveHtml, /is-fresh-stroke/);
});

test('renderDailyBookCover and updateDailyBookMeta render book cover and validate metadata', () => {
  let state = ensureDailyBook(createInitialState());
  state = updateDailyBookMeta(state, { title: 'สมุดงานบ้าน', color: 'sage', archived: true });
  assert.equal(state.dailyBook.title, 'สมุดงานบ้าน');
  assert.equal(state.dailyBook.color, 'sage');
  assert.equal(state.dailyBook.archived, true);

  const html = renderDailyBookCover(state.dailyBook, { icon: () => '<svg></svg>' });
  assert.match(html, /สมุดงานบ้าน/);
  assert.match(html, /book-sage/);
  assert.match(html, /ล้างจาน/);

  assert.throws(() => validateState({ ...state, dailyBook: { ...state.dailyBook, color: 'invalid' } }));
});
