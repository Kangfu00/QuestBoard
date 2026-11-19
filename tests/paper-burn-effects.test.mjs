import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPaperEffects } from '../dist/paper-effects.mjs';

function createElement({ width = 300, height = 420 } = {}) {
  const classes = new Set();
  const attributes = {};
  const children = [];
  const node = {
    children,
    parentNode: null,
    get className() { return [...classes].join(' '); },
    set className(val) {
      classes.clear();
      String(val || '').split(/\s+/).filter(Boolean).forEach(c => classes.add(c));
    },
    style: {
      setProperty(k, v) { this[k] = v; },
      getPropertyValue(k) { return this[k] ?? ''; },
      removeProperty(k) { delete this[k]; },
    },
    classList: {
      add(...names) { names.forEach(n => classes.add(n)); node.className = [...classes].join(' '); },
      remove(...names) { names.forEach(n => classes.delete(n)); node.className = [...classes].join(' '); },
      contains(n) { return classes.has(n); },
    },
    offsetWidth: width,
    offsetHeight: height,
    isConnected: true,
    attributes,
    setAttribute(k, v) {
      attributes[k] = String(v);
      if (k === 'class') {
        classes.clear();
        v.split(/\s+/).filter(Boolean).forEach(c => classes.add(c));
        node.className = v;
      }
    },
    getAttribute(k) { return attributes[k] ?? null; },
    removeAttribute(k) { delete attributes[k]; },
    append(child) {
      if (child.parentNode) child.parentNode.children.splice(child.parentNode.children.indexOf(child), 1);
      children.push(child);
      child.parentNode = node;
      child.isConnected = node.isConnected;
    },
    remove() {
      node.isConnected = false;
      for (const c of children) c.isConnected = false;
      if (node.parentNode) {
        node.parentNode.children.splice(node.parentNode.children.indexOf(node), 1);
        node.parentNode = null;
      }
    },
    animations: [],
    animate(keyframes, options) {
      let resolve, reject;
      const animation = {
        keyframes,
        options,
        cancelled: false,
        finished: new Promise((yes, no) => { resolve = yes; reject = no; }),
        finish() { resolve(); },
        cancel() { this.cancelled = true; reject(new Error('Cancelled')); },
      };
      this.animations.push(animation);
      return animation;
    },
  };
  return node;
}

function setupDesk({ reduced = false } = {}) {
  const createdElements = [];
  const document = {
    body: createElement(),
    createElement(tag) {
      const el = createElement();
      el.tagName = tag.toUpperCase();
      createdElements.push(el);
      return el;
    },
  };
  const window = {
    innerWidth: 1200,
    innerHeight: 900,
    getComputedStyle: node => node.style,
  };
  const effects = createPaperEffects({
    document,
    window,
    reducedMotion: () => reduced,
  });
  const paper = createElement();
  document.body.append(paper);
  return { effects, paper, document, createdElements };
}

test('extinguish creates a transient ghost layer with burn stage and variant attributes', async () => {
  const { effects, paper, createdElements } = setupDesk();
  const extinguishPromise = effects.extinguish(paper, { stage: 3, variant: 2 });

  // A transient ghost element should be created and appended
  assert.equal(createdElements.length, 1);
  const ghost = createdElements[0];
  assert.equal(ghost.classList.contains('paper-burn'), true);
  assert.equal(ghost.classList.contains('paper-burn-extinguishing'), true);
  assert.equal(ghost.attributes['aria-hidden'], 'true');
  assert.equal(ghost.attributes['data-burn'], '3');
  assert.equal(ghost.attributes['data-burn-variant'], '2');
  assert.equal(ghost.parentNode, paper);

  // Keyframes and options verification
  assert.equal(ghost.animations.length, 1);
  const anim = ghost.animations[0];
  assert.deepEqual(anim.keyframes, [
    { opacity: 1, filter: 'brightness(1.2)' },
    { opacity: 0, filter: 'brightness(0.7)' },
  ]);
  assert.equal(anim.options.duration, 360);
  assert.equal(anim.options.easing, 'cubic-bezier(.22,.8,.24,1)');

  // When animation finishes, ghost element should be removed from DOM
  anim.finish();
  await extinguishPromise;
  assert.equal(ghost.isConnected, false);
  assert.equal(paper.children.length, 0);
});

test('cancelAll and cancelEntry cleanly abort extinguish animation and remove ghost immediately', async () => {
  const { effects, paper, createdElements } = setupDesk();
  const p1 = effects.extinguish(paper, { stage: 2, variant: 1 });
  const ghost = createdElements[0];
  assert.equal(ghost.isConnected, true);

  effects.cancelEntry(paper);
  await p1;
  assert.equal(ghost.isConnected, false);
  assert.equal(ghost.animations[0].cancelled, true);

  // Repeat for cancelAll
  const { effects: e2, paper: paper2, createdElements: c2 } = setupDesk();
  const p2 = e2.extinguish(paper2, { stage: 4, variant: 0 });
  const ghost2 = c2[0];
  assert.equal(ghost2.isConnected, true);

  e2.cancelAll();
  await p2;
  assert.equal(ghost2.isConnected, false);
});

test('extinguish respects reduced-motion preference without animating or appending elements', async () => {
  const { effects, paper, createdElements } = setupDesk({ reduced: true });
  await effects.extinguish(paper, { stage: 3, variant: 1 });

  assert.equal(createdElements.length, 0);
  assert.equal(paper.children.length, 0);
});

test('paper-burn.css is linked in index.html and defines all required tokens, variants, and fallbacks', async () => {
  const indexHtml = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.ok(indexHtml.includes('paper-burn.css'), 'dist/index.html must link paper-burn.css');

  const css = await readFile(new URL('../dist/paper-burn.css', import.meta.url), 'utf8');

  // Must bind --burn-mask for variants 0 to 3
  for (let v = 0; v < 4; v++) {
    assert.ok(css.includes(`data-burn-variant="${v}"`), `Missing selector for variant ${v}`);
  }

  // Must declare styles for stages 1 to 4
  for (let s = 1; s <= 4; s++) {
    assert.ok(css.includes(`data-burn="${s}"`), `Missing styling for stage ${s}`);
  }

  // Must include ember keyframes and rekindle keyframes
  assert.ok(css.includes('@keyframes burn-ember'), 'Missing burn-ember keyframes');
  assert.ok(css.includes('@keyframes burn-rekindle'), 'Missing burn-rekindle keyframes');

  // Must pause during drag
  assert.ok(css.includes('.quest-paper.dragging .paper-burn::after'), 'Missing drag pause rule');

  // Must support prefers-reduced-motion and forced-colors
  assert.ok(css.includes('prefers-reduced-motion: reduce'), 'Missing prefers-reduced-motion media query');
  assert.ok(css.includes('forced-colors: active'), 'Missing forced-colors media query');
});
