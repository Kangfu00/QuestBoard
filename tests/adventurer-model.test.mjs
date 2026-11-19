import test from 'node:test';
import assert from 'node:assert/strict';
import { XP_PER_LEVEL, ADVENTURER_TITLES, xpSummary, coinCount } from '../dist/adventurer-model.mjs';

test('XP_PER_LEVEL is 500 and titles cover ranks 1 through 8+', () => {
  assert.equal(XP_PER_LEVEL, 500);
  assert.equal(ADVENTURER_TITLES[1], 'ผู้สมัครกิลด์');
  assert.equal(ADVENTURER_TITLES[2], 'ผู้ฝึกหัด');
  assert.equal(ADVENTURER_TITLES[3], 'นักสำรวจ');
  assert.equal(ADVENTURER_TITLES[4], 'นักผจญภัย');
  assert.equal(ADVENTURER_TITLES[5], 'ผู้กล้า');
  assert.equal(ADVENTURER_TITLES[6], 'ผู้เชี่ยวชาญ');
  assert.equal(ADVENTURER_TITLES[7], 'ผู้พิทักษ์');
  assert.equal(ADVENTURER_TITLES[8], 'ตำนานแห่งกิลด์');
});

test('xpSummary correctly calculates level, progress and title for standard milestones', () => {
  // Level 1: 0 - 499
  assert.deepEqual(xpSummary(0), {
    level: 1,
    intoLevel: 0,
    perLevel: 500,
    toNext: 500,
    title: 'ผู้สมัครกิลด์',
    totalXp: 0,
  });

  assert.deepEqual(xpSummary(499), {
    level: 1,
    intoLevel: 499,
    perLevel: 500,
    toNext: 1,
    title: 'ผู้สมัครกิลด์',
    totalXp: 499,
  });

  // Level 2: 500 - 999
  assert.deepEqual(xpSummary(500), {
    level: 2,
    intoLevel: 0,
    perLevel: 500,
    toNext: 500,
    title: 'ผู้ฝึกหัด',
    totalXp: 500,
  });

  assert.deepEqual(xpSummary(999), {
    level: 2,
    intoLevel: 499,
    perLevel: 500,
    toNext: 1,
    title: 'ผู้ฝึกหัด',
    totalXp: 999,
  });

  // Level 3: 1000
  assert.deepEqual(xpSummary(1000), {
    level: 3,
    intoLevel: 0,
    perLevel: 500,
    toNext: 500,
    title: 'นักสำรวจ',
    totalXp: 1000,
  });

  // Higher Ranks
  assert.equal(xpSummary(1500).title, 'นักผจญภัย'); // Level 4
  assert.equal(xpSummary(2000).title, 'ผู้กล้า'); // Level 5
  assert.equal(xpSummary(2500).title, 'ผู้เชี่ยวชาญ'); // Level 6
  assert.equal(xpSummary(3000).title, 'ผู้พิทักษ์'); // Level 7
  assert.equal(xpSummary(3500).title, 'ตำนานแห่งกิลด์'); // Level 8
  assert.equal(xpSummary(10000).title, 'ตำนานแห่งกิลด์'); // Level 21 (caps title gracefully)
  assert.equal(xpSummary(10000).level, 21);
});

test('xpSummary safely handles negative, NaN, null and non-numeric inputs', () => {
  assert.deepEqual(xpSummary(-50), {
    level: 1,
    intoLevel: 0,
    perLevel: 500,
    toNext: 500,
    title: 'ผู้สมัครกิลด์',
    totalXp: 0,
  });

  assert.deepEqual(xpSummary(NaN), {
    level: 1,
    intoLevel: 0,
    perLevel: 500,
    toNext: 500,
    title: 'ผู้สมัครกิลด์',
    totalXp: 0,
  });

  assert.deepEqual(xpSummary(null), {
    level: 1,
    intoLevel: 0,
    perLevel: 500,
    toNext: 500,
    title: 'ผู้สมัครกิลด์',
    totalXp: 0,
  });

  assert.deepEqual(xpSummary(undefined), {
    level: 1,
    intoLevel: 0,
    perLevel: 500,
    toNext: 500,
    title: 'ผู้สมัครกิลด์',
    totalXp: 0,
  });

  assert.deepEqual(xpSummary('not-a-number'), {
    level: 1,
    intoLevel: 0,
    perLevel: 500,
    toNext: 500,
    title: 'ผู้สมัครกิลด์',
    totalXp: 0,
  });

  // String numbers are parsed safely
  assert.deepEqual(xpSummary('1250'), {
    level: 3,
    intoLevel: 250,
    perLevel: 500,
    toNext: 250,
    title: 'นักสำรวจ',
    totalXp: 1250,
  });
});

test('coinCount correctly converts delta XP to physical coin count', () => {
  // Non-positive or invalid returns 0
  assert.equal(coinCount(0), 0);
  assert.equal(coinCount(-100), 0);
  assert.equal(coinCount(NaN), 0);
  assert.equal(coinCount(null), 0);
  assert.equal(coinCount('invalid'), 0);

  // 1 to 50 XP gives 1 coin
  assert.equal(coinCount(1), 1);
  assert.equal(coinCount(25), 1);
  assert.equal(coinCount(50), 1);

  // 51 to 100 XP gives 2 coins
  assert.equal(coinCount(51), 2);
  assert.equal(coinCount(100), 2);

  // Increments
  assert.equal(coinCount(101), 3);
  assert.equal(coinCount(150), 3);
  assert.equal(coinCount(200), 4);
  assert.equal(coinCount(250), 5);
  assert.equal(coinCount(300), 6);
  assert.equal(coinCount(350), 7);
  assert.equal(coinCount(400), 8);

  // Clamped at 8 maximum coins
  assert.equal(coinCount(450), 8);
  assert.equal(coinCount(500), 8);
  assert.equal(coinCount(1000), 8);
  assert.equal(coinCount(9999), 8);
});
