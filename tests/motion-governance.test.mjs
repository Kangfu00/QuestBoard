import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { MOTION_DURATION, MOTION_EASING, MOTION_TIMING } from '../dist/motion-tokens.mjs';
import { isMotionDebugEnabled, createMotionDebug } from '../dist/motion-debug.mjs';

const DIST_DIR = new URL('../dist/', import.meta.url);

test('every WAAPI .animate() call in dist/ routes exclusively through animateTransient in desk-motion.mjs', async () => {
  const files = (await readdir(DIST_DIR)).filter(name => name.endsWith('.mjs')).sort();
  const violations = [];
  for (const file of files) {
    if (file === 'desk-motion.mjs') continue;
    const source = await readFile(new URL(file, DIST_DIR), 'utf8');
    if (/\.\s*animate\s*\(/.test(source)) {
      violations.push(file);
    }
  }
  assert.deepEqual(
    violations,
    [],
    `Found direct .animate() calls outside desk-motion.mjs: ${violations.join(', ')}`,
  );
});

test('every dist/ module that invokes animateTransient respects reduced-motion', async () => {
  const files = (await readdir(DIST_DIR)).filter(name => name.endsWith('.mjs')).sort();
  const missingReducedCheck = [];
  for (const file of files) {
    if (file === 'desk-motion.mjs') continue;
    const source = await readFile(new URL(file, DIST_DIR), 'utf8');
    if (!/\banimateTransient\s*\(/.test(source)) continue;
    const hasReducedGuard = /reducedMotion|prefers-reduced-motion|\breduced\b|\breduce\s*\(\)|\bmotion\s*\(\)/.test(source);
    if (!hasReducedGuard) missingReducedCheck.push(file);
  }
  assert.deepEqual(
    missingReducedCheck,
    [],
    `Modules calling animateTransient without a reduced-motion guard: ${missingReducedCheck.join(', ')}`,
  );
});

test('motion-tokens.mjs, motion-tokens.css, and index.html stay synchronized', async () => {
  assert.equal(MOTION_DURATION.storeFeed, 300);
  assert.equal(MOTION_EASING.slide, 'cubic-bezier(.22,.8,.24,1)');
  assert.equal(MOTION_TIMING.paperTurn.duration, MOTION_DURATION.paperTurn);

  const css = await readFile(new URL('motion-tokens.css', DIST_DIR), 'utf8');
  for (const token of ['--ease-slide', '--ease-settle', '--ease-unfold', '--dur-store', '--dur-retrieve', '--dur-paper-turn']) {
    assert.ok(css.includes(token), `motion-tokens.css must define ${token}`);
  }

  const html = await readFile(new URL('index.html', DIST_DIR), 'utf8');
  assert.ok(html.includes('href="motion-tokens.css"'), 'dist/index.html must load motion-tokens.css');
});

test('every dist/*.mjs module is covered by package.json check script', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const files = (await readdir(DIST_DIR)).filter(name => name.endsWith('.mjs')).sort();
  const missing = files.filter(file => !pkg.scripts.check.includes(`node --check dist/${file}`));
  assert.deepEqual(missing, [], `Missing from package.json check script: ${missing.join(', ')}`);
});

test('motion-debug stays inert without ?motion-debug and mounts/cleans up cleanly when enabled', () => {
  assert.equal(isMotionDebugEnabled({ search: '' }), false);
  assert.equal(isMotionDebugEnabled({ search: '?foo=1' }), false);
  assert.equal(isMotionDebugEnabled({ search: '?motion-debug' }), true);
  assert.equal(isMotionDebugEnabled({ search: '?foo=1&motion-debug=1' }), true);

  const inactive = createMotionDebug({ location: { search: '' }, document: { body: {} } });
  assert.equal(inactive.active, false);

  const appended = [];
  let cancelledId = null;
  let disconnected = false;
  const fakeDoc = {
    body: {
      append(node) { appended.push(node); },
    },
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        style: {},
        attrs: {},
        textContent: '',
        removed: false,
        setAttribute(k, v) { this.attrs[k] = v; },
        remove() { this.removed = true; },
      };
    },
    getAnimations() { return []; },
  };
  const active = createMotionDebug({
    document: fakeDoc,
    window: { matchMedia: () => ({ matches: false }) },
    location: { search: '?motion-debug' },
    requestAnimationFrame: () => 42,
    cancelAnimationFrame: id => { cancelledId = id; },
    PerformanceObserver: class {
      observe() {}
      disconnect() { disconnected = true; }
    },
  });

  assert.equal(active.active, true);
  assert.equal(appended.length, 1);
  assert.match(appended[0].textContent, /MOTION DEBUG/);
  active.destroy();
  assert.equal(cancelledId, 42);
  assert.equal(disconnected, true);
  assert.equal(appended[0].removed, true);
});
