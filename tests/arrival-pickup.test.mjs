import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createQuest, updateItem } from '../dist/model.mjs';
import { rotatedOrigin, dragPosition, rotatedClampPosition, drawerForDraggedItem } from '../dist/interactions.mjs';
import { grabPoint, ghostPose, dragTilt } from '../dist/desk-motion.mjs';
import { stampPoint } from '../dist/stamp-placement.mjs';
import {paperGripPose} from '../dist/paper-grip.mjs';

const source = await readFile(new URL('../dist/app.mjs', import.meta.url), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));

function paper(initialClasses = []) {
  const classes = new Set(initialClasses);
  return {
    dataset: { id: 'quest' }, offsetWidth: 300, offsetHeight: 350, isConnected: true,
    style: { left: '80px', top: '100px', zIndex: 1, setProperty(name, value) { this[name] = value; } },
    classList: {
      contains: name => classes.has(name),
      add(...names) { names.forEach(name => classes.add(name)); },
      remove(...names) { names.forEach(name => classes.delete(name)); },
    },
    removeAttribute() {}, setAttribute() {}, querySelectorAll: () => [],
    cloneNode() { return paper([...classes]); },
    remove() { this.isConnected = false; },
  };
}

function pickup({ arriving = true,reduced=true } = {}) {
  const item = paper(['board-item', ...(arriving ? ['paper-arriving'] : [])]);
  const listeners = new Map(), ghosts = [], saved = [];
  let captured = null;
  const handle = {
    focus() {}, setPointerCapture(id) { captured = id; }, hasPointerCapture: id => captured === id,
    releasePointerCapture() { captured = null; },
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); },
    closest: selector => selector === '.drag-handle' ? handle : selector === '.board-item' ? item : null,
  };
  item.getBoundingClientRect = () => item.classList.contains('paper-arriving')
    ? { left: 200, top: 100, width: 27, height: 14 }
    : { left: Number.parseFloat(item.style.left) * .5, top: Number.parseFloat(item.style.top) * .5, width: 150, height: 175 };
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  const state = { version: 1, items: [], stamps: [], settings: { stampStyle: 'seal', theme: 'walnut', boardName: 'Arrival pickup' } };
  state.items.push({ ...createQuest({ title: 'Arriving paper', x: 80, y: 100 }, state), id: 'quest' });
  const context = {
    heldStamp: null, drag: null, storedDrag: null, stampCues: new Map(), currentScale: .5, canvasBounds: { width: 1180, height: 1000 }, state,
    window: { getSelection: () => null }, document: { body: { append(ghost) { ghosts.push(ghost); } } },
    $: selector => selector === '#board-canvas' ? canvas : selector === '[data-id="quest"]' ? item : null,
    getComputedStyle: element => ({ transform: element.classList.contains('paper-arriving') ? 'matrix(0.18, 0, 0, 0.08, 0, 0)' : 'none' }),
    DOMMatrix: class { constructor() { this.a = .18; this.b = 0; this.c = 0; this.d = .08; this.e = 0; this.f = 0; } },
    paperEffects: { cancelEntry(element) { element.classList.remove('paper-arriving'); } },
    cancelMotion() {}, rotatedOrigin, grabPoint, ghostPose, dragTilt,paperGripPose, stampPoint, dragPosition, rotatedClampPosition, drawerForDraggedItem, updateItem,
    activeDrawerId: () => null, activateStorageDrawer() {}, setActiveDrawer() {}, sound: { play() {} },
    followStorageHandle() {}, folderTargetAt: () => null, highlightFolder() {}, overStorageTray: () => false, highlightStorageTray() {}, clearStorageFeedback() {},
    reducedMotion: () => reduced,requestAnimationFrame:()=>1,cancelAnimationFrame(){}, performance: { now: () => 100 }, suppressClickUntil: 0, settlePaper() {},
    persist() { saved.push(structuredClone(context.state)); },
  };
  context.questPhotos??=null;context.photoViewer??=null;vm.createContext(context);
  vm.runInContext([
    section('function updateHeldGhost(', 'function settlePaper('),
    section('function startDrag(', 'function moveWithKeyboard('),
  ].join('\n'), context);
  // This is paper-local (80, 28), displayed by scaleX .18, scaleY .08 and desk zoom .5.
  const pointer = { target: handle, button: 0, pointerId: 7, clientX: arriving ? 207.2 : 80, clientY: arriving ? 101.12 : 64, preventDefault() {} };
  context.startDrag(pointer);
  return {
    context, item, ghosts, saved, listeners, handle, pointer,
    move(dx = 12, dy = 8) { listeners.get('pointermove')({ ...pointer, clientX: pointer.clientX + dx, clientY: pointer.clientY + dy }); },
    release() { listeners.get('pointerup')(pointer); },
    cancel() { listeners.get('pointercancel')(pointer); },
  };
}

function closeTo(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `expected ${actual} to be within 1e-8 of ${expected}`);
}

function assertReleased(h) {
  assert.equal(h.context.drag, null);
  assert.equal(h.handle.hasPointerCapture(7), false);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.item.classList.contains('dragging'), false);
}

test('picking up a compressed arriving paper keeps its visible grip under the pointer at desk zoom', () => {
  const h = pickup();
  closeTo(Number.parseFloat(h.item.style.left), 334.4);
  closeTo(Number.parseFloat(h.item.style.top), 174.24);
  closeTo((Number.parseFloat(h.item.style.left) + 80) * .5, 207.2);
  closeTo((Number.parseFloat(h.item.style.top) + 28) * .5, 101.12);
  assert.equal(h.item.classList.contains('paper-arriving'), false);
  assert.equal(h.context.state.items[0].x, 80, 'pickup alone must not commit the provisional position');
  assert.equal(h.saved.length, 0);
});

test('crossing the drag threshold keeps the arrival grip as the real ghost anchor', () => {
  const h = pickup();
  h.move();
  assert.equal(h.ghosts.length, 1);
  assert.equal(h.ghosts[0].style.transformOrigin, '80px 28px');
  assert.doesNotMatch(h.ghosts[0].style.transform,/perspective|rotateX|rotateY/);
  closeTo(Number.parseFloat(h.ghosts[0].style.left) + 80, 219.2);
  closeTo(Number.parseFloat(h.ghosts[0].style.top) + 28, 109.12);
  assert.equal(h.ghosts[0].classList.contains('paper-arriving'), false);
});

test('the actual board drag shape receives corner lift without requiring a stored item object',()=>{
  const h=pickup({reduced:false});h.move();
  assert.match(h.ghosts[0].style.transform,/perspective\(1000px\)/);
  assert.equal(h.ghosts[0].style.transformOrigin,'80px 28px');
  h.cancel();assertReleased(h);
});

test('releasing an arriving paper without another pointer movement saves its visible pickup position', () => {
  const h = pickup();
  h.release();
  assertReleased(h);
  closeTo(h.context.state.items[0].x, 334.4);
  closeTo(h.context.state.items[0].y, 174.24);
  closeTo(Number.parseFloat(h.item.style.left), 334.4);
  closeTo(Number.parseFloat(h.item.style.top), 174.24);
  assert.equal(h.saved.length, 1);
  closeTo(h.saved[0].items[0].x, 334.4);
  closeTo(h.saved[0].items[0].y, 174.24);
});

test('cancelling an arrival pickup after lifting restores the original board location without saving', () => {
  const h = pickup();
  h.move();
  h.cancel();
  assertReleased(h);
  assert.equal(h.item.style.left, '80px');
  assert.equal(h.item.style.top, '100px');
  assert.equal(h.context.state.items[0].x, 80);
  assert.equal(h.context.state.items[0].y, 100);
  assert.equal(h.saved.length, 0);
  assert.equal(h.ghosts[0].isConnected, false);
});

test('clicking and releasing an ordinary paper retains its location without saving a drag', () => {
  const h = pickup({ arriving: false });
  h.release();
  assertReleased(h);
  assert.equal(h.context.state.items[0].x, 80);
  assert.equal(h.context.state.items[0].y, 100);
  assert.equal(h.item.style.left, '80px');
  assert.equal(h.item.style.top, '100px');
  assert.equal(h.saved.length, 0);
});
