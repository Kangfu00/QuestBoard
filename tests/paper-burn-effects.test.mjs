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
    getBoundingClientRect() { return { left: 100, top: 120, width, height, right: 100 + width, bottom: 120 + height }; },
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

  // Images are generated by burn-model.mjs, never embedded in the stylesheet
  assert.ok(!css.includes('data:image'), 'paper-burn.css must not embed generated images');

  // Must style the burnt-out ember for stage 4
  assert.ok(css.includes('data-burn="4"'), 'Missing stage 4 styling');

  // Must include ember keyframes and rekindle keyframes
  assert.ok(css.includes('@keyframes burn-ember'), 'Missing burn-ember keyframes');
  assert.ok(css.includes('@keyframes burn-rekindle'), 'Missing burn-rekindle keyframes');

  // Must pause during drag
  assert.ok(css.includes('.quest-paper.dragging .paper-burn::after'), 'Missing drag pause rule');

  // Must support prefers-reduced-motion and forced-colors
  assert.ok(css.includes('prefers-reduced-motion: reduce'), 'Missing prefers-reduced-motion media query');
  assert.ok(css.includes('forced-colors: active'), 'Missing forced-colors media query');
});

test('shedAsh spawns 3–5 transient ash flakes for burn stages 3–4 via animateTransient and cleans up', async () => {
  const { effects, paper, document } = setupDesk();

  // Stages 0–2 do not shed ash
  assert.equal(effects.shedAsh(paper, { stage: 0, mode: 'pickup' }).length, 0);
  assert.equal(effects.shedAsh(paper, { stage: 2, mode: 'drop' }).length, 0);

  // Stage 3 pickup spawns 3 flakes, Stage 4 drop spawns 5 flakes
  const picked = effects.shedAsh(paper, { stage: 3, mode: 'pickup' });
  assert.equal(picked.length, 3);
  for (const flake of picked) {
    assert.equal(flake.classList.contains('paper-ash-flake'), true);
    assert.equal(flake.attributes['aria-hidden'], 'true');
    assert.equal(flake.parentNode, document.body);
    assert.equal(flake.animations.length, 1);
  }
  picked.forEach(f => f.animations[0].finish());
  await new Promise(r => setTimeout(r, 0));
  for (const flake of picked) {
    assert.equal(flake.isConnected, false);
  }

  const dropped = effects.shedAsh(paper, { stage: 4, mode: 'drop' });
  assert.equal(dropped.length, 5);
  effects.cancelAll();
  for (const flake of dropped) {
    assert.equal(flake.isConnected, false);
  }
});

test('shedAsh respects reduced-motion preference without spawning flakes', () => {
  const { effects, paper, createdElements } = setupDesk({ reduced: true });
  const spawned = effects.shedAsh(paper, { stage: 4, mode: 'drop' });
  assert.equal(spawned.length, 0);
  assert.equal(createdElements.length, 0);
});

test('paper-burn.css defines paper aging, smoldering wisp pauses, and ash flake rules', async () => {
  const css = await readFile(new URL('../dist/paper-burn.css', import.meta.url), 'utf8');
  assert.ok(css.includes('.quest-paper[data-age="1"]'), 'Missing data-age=1 rule');
  assert.ok(css.includes('.quest-paper[data-age="2"]'), 'Missing data-age=2 rule');
  assert.ok(css.includes('@keyframes paper-wisp-rise'), 'Missing paper-wisp-rise keyframes');
  assert.ok(css.includes('body.desk-shutter-closed .paper-wisp'), 'Missing shutter pause rule for wisps');
  assert.ok(css.includes('body.page-hidden .paper-wisp'), 'Missing hidden tab pause rule for wisps');
  assert.ok(css.includes('.paper-ash-flake'), 'Missing ash flake class');
});
