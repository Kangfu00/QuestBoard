import test from 'node:test';
import assert from 'node:assert/strict';
import { XP_PER_LEVEL, ADVENTURER_TITLES, xpSummary, manaCount } from '../dist/adventurer-model.mjs';

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

test('manaCount correctly converts delta XP to blue mana particle count', () => {
  // Non-positive or invalid returns 0
  assert.equal(manaCount(0), 0);
  assert.equal(manaCount(-100), 0);
  assert.equal(manaCount(NaN), 0);
  assert.equal(manaCount(null), 0);
  assert.equal(manaCount('invalid'), 0);

  // Minimum floor clamp is 3 particles for any positive XP
  assert.equal(manaCount(1), 3);
  assert.equal(manaCount(25), 3);
  assert.equal(manaCount(60), 3);
  assert.equal(manaCount(61), 3);
  assert.equal(manaCount(120), 3);
  assert.equal(manaCount(180), 3);

  // Increments past 180 XP (ceil(delta / 60))
  assert.equal(manaCount(181), 4);
  assert.equal(manaCount(240), 4);
  assert.equal(manaCount(300), 5);
  assert.equal(manaCount(360), 6);
  assert.equal(manaCount(420), 7);
  assert.equal(manaCount(480), 8);
  assert.equal(manaCount(540), 9);
  assert.equal(manaCount(600), 10);
  assert.equal(manaCount(660), 11);
  assert.equal(manaCount(720), 12);

  // Clamped at 12 maximum particles
  assert.equal(manaCount(721), 12);
  assert.equal(manaCount(800), 12);
  assert.equal(manaCount(1000), 12);
  assert.equal(manaCount(9999), 12);
});
