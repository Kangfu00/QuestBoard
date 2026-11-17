import test from 'node:test';
import assert from 'node:assert/strict';

const {createDeskWindows} = await import('../dist/desk-windows.mjs').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {createDeskWindows() { assert.fail('The floating document window manager is missing'); }};
});

// A small DOM boundary for the real controller: bubbling/capture, geometry and
// pointer ownership are exercised without a browser or external dependencies.
class Target {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, callback, options) {
    const capture = options === true || !!options?.capture;
    const listeners = this.listeners.get(type) ?? [];
    listeners.push({callback, capture}); this.listeners.set(type, listeners);
  }
  removeEventListener(type, callback, options) {
    const capture = options === true || !!options?.capture;
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter(item => item.callback !== callback || item.capture !== capture));
  }
  get listenerCount() { return [...this.listeners.values()].reduce((sum, list) => sum + list.length, 0); }
  fire(type, init = {}) {
    const event = {type, target:this, button:0, isPrimary:true, pointerId:1, clientX:120, clientY:90,
      defaultPrevented:false, preventDefault(){ this.defaultPrevented = true; },
      stopPropagation(){ this.stopped = true; }, stopImmediatePropagation(){ this.stopped = this.immediate = true; }, ...init};
    const path = []; for (let node = this; node; node = node.parentNode) path.push(node);
    const dispatch = (node, capture) => {
      event.currentTarget = node;
      for (const item of [...(node.listeners.get(type) ?? [])]) {
        if (item.capture === capture) item.callback(event);
        if (event.immediate) break;
      }
    };
    for (const node of [...path].reverse()) { dispatch(node, true); if (event.stopped) return event; }
    for (const node of path) { dispatch(node, false); if (event.stopped) break; }
    return event;
  }
}
class Node extends Target {
  constructor(tag = 'section', rect = {}) {
    super(); this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attrs = new Map();
    this.hidden = false; this.isConnected = true; this.rect = {left:100, top:80, width:300, height:250, ...rect};
    this.style = {setProperty(name, value){ this[name] = value; }, removeProperty(name){ delete this[name]; }};
    this.classes = new Set(); this.classList = {add:(...names)=>names.forEach(name=>this.classes.add(name)),
      remove:(...names)=>names.forEach(name=>this.classes.delete(name)),
      contains:name=>this.classes.has(name), toggle:(name, force)=>{if(force ?? !this.classes.has(name))this.classes.add(name);else this.classes.delete(name);}};
    this.captures = new Set(); this.released = [];
  }
  append(node) { node.parentNode = this; this.children.push(node); return node; }
  contains(node) { for (; node; node = node.parentNode) if (node === this) return true; return false; }
  setAttribute(name, value) { this.attrs.set(name, String(value)); if(name === 'tabindex')this.tabIndex = Number(value); }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  hasAttribute(name) { return this.attrs.has(name); }
  removeAttribute(name) { this.attrs.delete(name); }
  matches(selector) {
    return selector.split(',').some(part => {
      const value = part.trim();
      if (value === ':modal') return !!this.modal;
      if (value.startsWith('.')) return this.classes.has(value.slice(1));
      if (value.startsWith('[')) {
        const [,name,match] = value.match(/^\[([^=\]]+)(?:=["']?([^"'\]]*)["']?)?\]$/) ?? [];
        return name && this.hasAttribute(name) && (match === undefined || this.getAttribute(name) === match);
      }
      return value.toUpperCase() === this.tagName;
    });
  }
  querySelector(selector) { for(const child of this.children) { if(child.matches(selector)) return child; const match = child.querySelector(selector); if(match)return match; } return null; }
  getBoundingClientRect() {
    const left = Number.parseFloat(this.style.left), top = Number.parseFloat(this.style.top);
    return {...this.rect, left:Number.isFinite(left)?left:this.rect.left, top:Number.isFinite(top)?top:this.rect.top};
  }
  get offsetWidth() { return this.rect.width; }
  get offsetHeight() { return this.rect.height; }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); this.released.push(id); }
  focus() { this.focused = true; this.fire('focusin'); }
}
function harness(options = {}) {
  const window = new Target(); window.innerWidth = 1000; window.innerHeight = 800;
  const document = new Target(); document.parentNode = window;
  document.documentElement = {clientWidth:1000, clientHeight:800};
  document.body = new Node('body'); document.body.parentNode = document;
  document.querySelector = selector => {
    assert.equal(selector, 'dialog:modal'); if(options.unsupportedModalSelector)throw new SyntaxError('Unsupported selector');
    return document.modal ?? null;
  };
  const manager = createDeskWindows({document, window, canHandleEscape:options.canHandleEscape});
  function panel({tag = 'section', rect, key, onEscape} = {}) {
    const node = document.body.append(new Node(tag, rect));
    if(tag === 'dialog')node.open = true;
    const handle = node.append(new Node('header', {left:100, top:80, width:300, height:40})); handle.classList.add('handle');
    const content = node.append(new Node('div'));
    const registration = manager.register(node, {handle:'.handle', key, onEscape});
    return {node, handle, content, registration};
  }
  return {window, document, manager, panel};
}
const point = node => [Number.parseFloat(node.style.left), Number.parseFloat(node.style.top)];

test('a paper-sized drag surface moves from printed paper while nested corner and writing controls remain interactive',()=>{
  const h=harness(),panel=h.document.body.append(new Node('dialog'));panel.open=true;
  const paper=panel.append(new Node('div')),printed=paper.append(new Node('span'));
  const corner=paper.append(new Node('button')),icon=corner.append(new Node('span'));
  const notes=paper.append(new Node('textarea')),check=paper.append(new Node('input')),label=paper.append(new Node('label'));
  const registration=h.manager.register(panel,{handle:paper});
  const before=point(panel);
  for(const control of [corner,icon,notes,check,label]){
    const down=control.fire('pointerdown');assert.equal(down.defaultPrevented,false);
    h.window.fire('pointermove',{clientX:170,clientY:140});assert.deepEqual(point(panel),before);
  }
  printed.fire('pointerdown');h.window.fire('pointermove',{clientX:160,clientY:120});
  assert.deepEqual(point(panel),[before[0]+40,before[1]+30]);h.window.fire('pointerup');
  registration.destroy();h.manager.destroy();
});

test('documents cascade, activate independently on pointer or focus, and only the dragged window moves', () => {
  const h = harness(), a = h.panel(), b = h.panel();
  assert.equal(h.manager.size, 2); assert.equal(h.manager.top, b.node);
  assert.notDeepEqual(point(a.node), point(b.node));
  const before = point(a.node), other = point(b.node);
  const start = a.handle.fire('pointerdown'); assert.equal(start.defaultPrevented, true);
  assert.equal(h.manager.top, a.node); assert.ok(Number(a.node.style.zIndex) > Number(b.node.style.zIndex));
  h.window.fire('pointermove', {clientX:160, clientY:120});
  assert.deepEqual(point(a.node), [before[0] + 40, before[1] + 30]); assert.deepEqual(point(b.node), other);
  h.window.fire('pointerup');
  b.content.focus(); assert.equal(h.manager.top, b.node); assert.equal(b.node.classes.has('is-window-active'), true);
  assert.equal(a.node.classes.has('is-window-active'), false);
  b.node.hidden = true; assert.equal(h.manager.top, a.node);
  a.node.isConnected = false; assert.equal(h.manager.top, null);
  h.manager.destroy();
});

test('controls and editable descendants keep their pointer actions while secondary pointers cannot drag', () => {
  const h = harness(), a = h.panel(), before = point(a.node);
  for (const tag of ['button', 'input', 'textarea', 'select', 'a', 'label']) {
    const control = a.handle.append(new Node(tag)); if(tag === 'a')control.setAttribute('href', '#');
    const nested = control.append(new Node('span')), event = nested.fire('pointerdown');
    h.window.fire('pointermove', {clientX:400, clientY:400});
    assert.deepEqual(point(a.node), before, tag); assert.equal(event.defaultPrevented, false, tag);
  }
  const editable = a.handle.append(new Node('div')); editable.setAttribute('contenteditable', 'true');
  editable.append(new Node('span')).fire('pointerdown'); h.window.fire('pointermove', {clientX:400, clientY:400});
  assert.deepEqual(point(a.node), before);
  for (const init of [{button:2}, {isPrimary:false}, {defaultPrevented:true}]) {
    a.handle.fire('pointerdown', init); h.window.fire('pointermove', {clientX:400, clientY:400}); assert.deepEqual(point(a.node), before);
  }
  assert.equal(a.handle.captures.size, 0); h.manager.destroy();
});

test('pointer cancellation, blur and explicit cancellation restore the start; release commits and drops capture', () => {
  const h = harness(), a = h.panel(), start = point(a.node);
  for (const cancel of [()=>h.window.fire('pointercancel'), ()=>h.window.fire('blur'), ()=>a.registration.cancelDrag()]) {
    a.handle.fire('pointerdown'); assert.equal(a.handle.captures.has(1), true);
    h.window.fire('pointermove', {clientX:260, clientY:230}); assert.notDeepEqual(point(a.node), start);
    cancel(); assert.deepEqual(point(a.node), start); assert.equal(a.handle.captures.size, 0);
    h.window.fire('pointermove', {clientX:500, clientY:500}); assert.deepEqual(point(a.node), start);
  }
  a.handle.fire('pointerdown'); h.window.fire('pointermove', {pointerId:99, clientX:900, clientY:900}); assert.deepEqual(point(a.node), start);
  h.window.fire('pointermove', {clientX:170, clientY:140}); h.window.fire('pointerup');
  assert.deepEqual(point(a.node), [start[0] + 50, start[1] + 50]); assert.equal(a.handle.captures.size, 0);
  a.handle.fire('pointerdown'); h.window.fire('pointermove', {clientX:230, clientY:200}); a.handle.fire('lostpointercapture');
  assert.deepEqual(point(a.node), [start[0] + 50, start[1] + 50]);
  h.manager.destroy();
});

test('viewport limits keep oversized headers reachable and resize reclamps parked documents', () => {
  const h = harness(), a = h.panel(); a.handle.fire('pointerdown');
  h.window.fire('pointermove', {clientX:-1000, clientY:-1000}); assert.deepEqual(point(a.node), [12, 12]);
  h.window.fire('pointermove', {clientX:5000, clientY:5000}); assert.deepEqual(point(a.node), [688, 538]); h.window.fire('pointerup');
  h.window.innerWidth = 400; h.window.innerHeight = 300; h.window.fire('resize'); assert.deepEqual(point(a.node), [88, 38]);
  a.node.rect.width = 900; a.node.rect.height = 950; h.window.fire('resize'); assert.deepEqual(point(a.node), [12, 12]);
  h.manager.destroy();
});

test('Escape is consumed by only the front visible document and yields to native modal forms', () => {
  const h = harness(), closes = [], a = h.panel({onEscape:()=>closes.push('a')}), b = h.panel({tag:'dialog', onEscape:()=>{closes.push('b');return false;}});
  const first = h.document.fire('keydown', {key:'Escape'}); assert.deepEqual(closes, ['b']); assert.equal(first.defaultPrevented, true);
  assert.equal(h.manager.top, b.node, 'a close refusal leaves that document frontmost');
  h.document.modal = {}; const modalEvent = h.document.fire('keydown', {key:'Escape'}); assert.equal(modalEvent.defaultPrevented, false); assert.deepEqual(closes, ['b']);
  h.document.modal = null; b.node.open = false;
  h.document.fire('keydown', {key:'Escape', defaultPrevented:true}); assert.deepEqual(closes, ['b']);
  h.document.fire('keydown', {key:'Escape'}); assert.deepEqual(closes, ['b','a']);
  b.node.open = true; b.node.modal = true; assert.equal(h.manager.top, a.node, 'native top-layer dialogs are outside the desk stack');
  h.manager.destroy();
});

test('Escape still works where :modal selector support is unavailable', () => {
  const h = harness({unsupportedModalSelector:true}); let closes = 0; h.panel({onEscape:()=>closes++});
  assert.doesNotThrow(()=>h.document.fire('keydown', {key:'Escape'})); assert.equal(closes, 1); h.manager.destroy();
});

test('the application can reserve Escape for an active paper drag before any document closes', () => {
  let dragging = true, closes = 0;
  const h = harness({canHandleEscape:()=>!dragging}); h.panel({onEscape:()=>closes++});
  assert.equal(h.document.fire('keydown', {key:'Escape'}).defaultPrevented, false); assert.equal(closes, 0);
  dragging = false; assert.equal(h.document.fire('keydown', {key:'Escape'}).defaultPrevented, true); assert.equal(closes, 1);
  h.manager.destroy();
});

test('destroy restores owned presentation and cleans all listeners without hiding or removing documents', () => {
  const h = harness(), a = h.panel(), b = h.panel(); a.handle.fire('pointerdown'); h.window.fire('pointermove', {clientX:180, clientY:150});
  a.registration.destroy(); assert.equal(h.manager.size, 1); assert.equal(a.node.parentNode, h.document.body); assert.equal(a.node.hidden, false);
  assert.equal(a.handle.captures.size, 0); assert.equal(a.node.listenerCount + a.handle.listenerCount, 0);
  assert.equal(a.node.hasAttribute('data-desk-window'), false); assert.equal(a.node.classes.has('is-window-active'), false);
  h.manager.destroy(); h.manager.destroy();
  assert.equal(h.manager.size, 0); assert.equal(h.manager.top, null);
  assert.equal(h.window.listenerCount + h.document.listenerCount + b.node.listenerCount + b.handle.listenerCount, 0);
  assert.equal(b.node.parentNode, h.document.body); assert.equal(b.node.hidden, false);
});

test('keyed positions survive closing and manager replacement without persisting document data', () => {
  const h = harness(), a = h.panel({key:'quest:one'}); a.handle.fire('pointerdown'); h.window.fire('pointermove', {clientX:230, clientY:200}); h.window.fire('pointerup');
  const parked = point(a.node); a.registration.destroy();
  const reopened = h.panel({key:'quest:one'}); assert.deepEqual(point(reopened.node), parked); h.manager.destroy();
  const replacement = createDeskWindows({document:h.document, window:h.window});
  const next = h.document.body.append(new Node()); const handle = next.append(new Node('header'));
  replacement.register(next, {handle, key:'quest:one'}); assert.deepEqual(point(next), parked); replacement.destroy();
});

test('a focusable toolbar moves with arrow keys while descendant controls retain their keyboard behavior', () => {
  const h = harness(), a = h.panel(), before = point(a.node);
  assert.equal(a.handle.getAttribute('tabindex'), '0');
  assert.equal(a.handle.fire('keydown', {key:'ArrowRight'}).defaultPrevented, true);
  a.handle.fire('keydown', {key:'ArrowDown', shiftKey:true}); assert.deepEqual(point(a.node), [before[0] + 10, before[1] + 1]);
  const input = a.handle.append(new Node('input')); assert.equal(input.fire('keydown', {key:'ArrowLeft'}).defaultPrevented, false);
  assert.deepEqual(point(a.node), [before[0] + 10, before[1] + 1]); h.manager.destroy();
});

test('default factory arguments use the current browser globals', () => {
  const h = harness(); h.manager.destroy();
  const before = ['document','window'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  Object.defineProperty(globalThis, 'document', {configurable:true, value:h.document});
  Object.defineProperty(globalThis, 'window', {configurable:true, value:h.window});
  try {
    const manager = createDeskWindows(), panel = h.document.body.append(new Node()), handle = panel.append(new Node('header'));
    manager.register(panel, {handle}); const start = point(panel);
    handle.fire('pointerdown'); h.window.fire('pointermove', {clientX:150, clientY:110}); h.window.fire('pointerup');
    assert.equal(manager.top, panel); assert.deepEqual(point(panel), [start[0] + 30, start[1] + 20]); manager.destroy();
  } finally {
    for (const [name, descriptor] of before) { if(descriptor)Object.defineProperty(globalThis, name, descriptor);else delete globalThis[name]; }
  }
});
