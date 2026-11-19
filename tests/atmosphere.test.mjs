import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeskAtmosphere} from '../dist/atmosphere.mjs';

// Node supplies no DOM. These boundary doubles retain element ownership,
// event listeners, visibility, storage and the browser's pending timer queue.
class Events {
  listeners = new Map();
  addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(listener); }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  emit(type, props = {}) { const event = {type, target: this, ...props}; for (const listener of [...this.listeners.get(type) ?? []]) listener(event); return event; }
  get listenerCount() { return [...this.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0); }
}
class Element extends Events {
  constructor(tag) { super(); this.tagName = tag.toUpperCase(); this.children = []; this.parentElement = null; this.attributes = new Map(); this.dataset = {}; this.style = {setProperty(name, value) { this[name] = value; }}; this.value = ''; this.checked = false; this.hidden = false; this.text = ''; this.className = ''; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value); }
  removeAttribute(name) { this.attributes.delete(name); if (name.startsWith('data-')) delete this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())]; }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  append(...nodes) { for (const node of nodes) { node.remove(); node.parentElement = this; this.children.push(node); } }
  insertBefore(node, before) { if (!before) return this.append(node); node.remove(); const index = this.children.indexOf(before); node.parentElement = this; this.children.splice(index, 0, node); }
  remove() { if (this.parentElement) { if (this.contains(this.ownerDocument?.activeElement)) this.ownerDocument.activeElement = this.ownerDocument.body; this.parentElement.children = this.parentElement.children.filter(node => node !== this); } this.parentElement = null; }
  contains(target) { for (let node = target; node; node = node.parentElement) if (node === this) return true; return false; }
  focus() { this.ownerDocument.activeElement = this; }
  get firstChild() { return this.children[0] ?? null; }
  set textContent(value) { this.text = String(value); }
  get textContent() { return this.text + this.children.map(node => node.textContent).join(''); }
  matches(selector) { if (selector[0] === '.') return this.className.split(/\s+/).includes(selector.slice(1)); const attr = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/); return attr ? this.getAttribute(attr[1]) !== null && (attr[2] === undefined || this.getAttribute(attr[1]) === attr[2]) : this.tagName === selector.toUpperCase(); }
  querySelectorAll(selector) { return this.children.flatMap(node => [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}
function fixture(t, options = {}) {
  const document = new Events(), window = new Events(), media = new Events();
  document.createElement = tag => { const node = new Element(tag); node.ownerDocument = document; return node; }; document.body = document.createElement('body'); document.activeElement = document.body; document.querySelector = selector => document.body.querySelector(selector); document.hidden = false; document.visibilityState = 'visible';
  const desk = new Element('section'), scroll = new Element('div'), paperPlane = new Element('div'), menu = new Element('div');
  desk.className = 'desk-board'; scroll.className = 'board-scroll'; paperPlane.className = 'canvas-size'; desk.append(scroll); scroll.append(paperPlane); document.body.append(desk, menu);
  const writes = [], reads = [], timers = new Map(), audio = [], phases = []; let timerId = 0, day = options.day ?? 10, hour = options.hour ?? 12, minute = options.minute ?? 0, second = options.second ?? 0, millisecond = options.millisecond ?? 0;
  const stored = new Map(options.stored === undefined ? [] : [['guild-board-atmosphere-v1', options.stored]]);
  const storage = {getItem(key) { reads.push(key); if (options.readFails) throw Error('storage denied'); return stored.get(key) ?? null; }, setItem(key, value) { if (options.writeFails) throw Error('quota exceeded'); writes.push([key, value]); stored.set(key, value); }};
  media.matches = false; window.matchMedia = () => media;
  window.setTimeout = (callback, delay) => { const id = ++timerId; timers.set(id, {callback, delay}); return id; };
  window.clearTimeout = id => timers.delete(id);
  const controller = createDeskAtmosphere({document, window, storage, now: () => new Date(2026, 5, day, hour, minute, second, millisecond), onAudioChange(settings) { audio.push(settings); }, onPhaseChange(info) { phases.push(info); }, ...options.factory});
  t.after(() => controller.destroy());
  return {controller, document, window, media, desk, scroll, paperPlane, menu, writes, reads, stored, timers, audio, phases,
    setDay(value) { day = value; },
    setHour(value) { hour = value; },
    setClock(nextHour, nextMinute, nextSecond = 0, nextMillisecond = 0) { hour = nextHour; minute = nextMinute; second = nextSecond; millisecond = nextMillisecond; },
    tick() { for (const [id, timer] of [...timers]) { timers.delete(id); timer.callback(); } },
    visibility(hidden) { document.hidden = hidden; document.visibilityState = hidden ? 'hidden' : 'visible'; document.emit('visibilitychange'); },
    motion(matches) { media.matches = matches; media.emit('change'); },
    layer() { return scroll.querySelector('.desk-atmosphere'); },
    field(name) { return menu.querySelector(`[data-atmosphere-setting="${name}"]`); },
    status(name) { return menu.querySelector(`[data-atmosphere-status="${name}"]`); },
    phaseHint() { return menu.querySelector('.atmosphere-phase-hint'); },
    soundscapeHint() { return menu.querySelector('.atmosphere-soundscape-hint'); },
  };
}

test('local defaults opt into clock sound while manual layers remain off, and snapshots cannot mutate state', t => {
  const f = fixture(t);
  assert.deepEqual(f.controller.getSettings(), {lighting: 'auto', dust: true, rain: false, tavern: false, volume: .3, rainVolume: 1, tavernVolume: 1, soundscape: 'auto', soundscapeVolume: 1, dustDensity: .65});
  assert.deepEqual(f.reads, ['guild-board-atmosphere-v1']); assert.equal(f.writes.length, 0);
  f.controller.getSettings().rain = true;
  assert.equal(f.controller.getSettings().rain, false);
  f.controller.setSettings({lighting: 'night', rain: true, volume: 4, questSchema: 99});
  assert.deepEqual(f.controller.getSettings(), {lighting: 'night', dust: true, rain: true, tavern: false, volume: 1, rainVolume: 1, tavernVolume: 1, soundscape: 'auto', soundscapeVolume: 1, dustDensity: .65});
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0][0], 'guild-board-atmosphere-v1');
  assert.deepEqual(JSON.parse(f.writes[0][1]), {lighting: 'night', dust: true, rain: true, tavern: false, volume: 1, rainVolume: 1, tavernVolume: 1, soundscape: 'auto', soundscapeVolume: 1, dustDensity: .65});
  f.audio.at(-1).rain = false;
  assert.equal(f.controller.getSettings().rain, true);
});

test('corrupt, unavailable or invalid storage preserves sound defaults without enabling manual layers', t => {
  for (const options of [{stored: '{broken'}, {stored: 'null'}, {stored: '[]'}, {stored: '{"lighting":"invalid","dust":0,"rain":"true","tavern":1,"volume":".8"}'}, {readFails: true, writeFails: true}]) {
    const f = fixture(t, options);
    assert.deepEqual(f.controller.getSettings(), {lighting: 'auto', dust: true, rain: false, tavern: false, volume: .3, rainVolume: 1, tavernVolume: 1, soundscape: 'auto', soundscapeVolume: 1, dustDensity: .65});
    assert.doesNotThrow(() => f.controller.setSettings({rain: true, volume: -.3}));
    assert.equal(f.controller.getSettings().volume, 0);
  }
});

test('valid saved lighting and ambience preferences restore without changing their separate local key', t => {
  const f = fixture(t, {stored: '{"lighting":"off","dust":false,"rain":true,"tavern":true,"volume":0.65,"items":[{"id":"do-not-read"}]}'});
  assert.deepEqual(f.controller.getSettings(), {lighting: 'off', dust: false, rain: true, tavern: true, volume: .65, rainVolume: 1, tavernVolume: 1, soundscape: 'auto', soundscapeVolume: 1, dustDensity: .65});
  assert.deepEqual(f.audio.at(-1), {lighting: 'off', dust: false, rain: true, tavern: true, volume: .65, rainVolume: 1, tavernVolume: 1, soundscape: 'auto', soundscapeVolume: 1, dustDensity: .65});
  assert.equal(f.writes.length, 0);
});

test('invalid patches preserve previous valid values and unchanged patches cause no writes or callbacks', t => {
  const f = fixture(t); f.controller.setSettings({lighting: 'day', dust: false, rain: true, volume: .7});
  const writes = f.writes.length, notifications = f.audio.length;
  for (const patch of [null, [], 'night', {lighting: 'sunrise', dust: 'false', rain: 0, tavern: 'true', volume: NaN}, {volume: Infinity}, {lighting: 'day'}]) f.controller.setSettings(patch);
  assert.deepEqual(f.controller.getSettings(), {lighting: 'day', dust: false, rain: true, tavern: false, volume: .7, rainVolume: 1, tavernVolume: 1, soundscape: 'auto', soundscapeVolume: 1, dustDensity: .65});
  assert.equal(f.writes.length, writes); assert.equal(f.audio.length, notifications);
});

test('decorative light and bounded dust stay pointer-transparent inside the desk and mounting is idempotent', t => {
  const f = fixture(t); f.controller.mount(); const layer = f.layer();
  assert.ok(layer); assert.equal(f.scroll.firstChild, layer); assert.equal(f.scroll.children[1], f.paperPlane);
  assert.equal(layer.getAttribute('aria-hidden'), 'true'); assert.equal(layer.style.pointerEvents, 'none');
  assert.equal(layer.dataset.lighting, 'day'); assert.equal(layer.dataset.dust, 'true');
  const particles = layer.querySelectorAll('.desk-atmosphere-particle'); assert.equal(particles.length, 39);
  for (const node of layer.querySelectorAll('div')) assert.equal(node.style.pointerEvents, 'none');
  f.controller.mount(); assert.equal(f.scroll.querySelectorAll('.desk-atmosphere').length, 1);
  assert.deepEqual(Object.keys(f.paperPlane.style).filter(key => key !== 'setProperty'), []);
});

test('auto follows browser-local phases with one bounded timer; explicit light and dust remain independent', t => {
  const f = fixture(t, {hour: 5}); f.controller.mount(); assert.equal(f.layer().dataset.lighting, 'night');
  assert.equal(f.timers.size, 1); for (const timer of f.timers.values()) assert.ok(timer.delay > 0 && timer.delay <= 60_000);
  f.setHour(6); f.tick(); assert.equal(f.layer().dataset.lighting, 'morning'); assert.equal(f.timers.size, 1);
  f.setHour(18); f.tick(); assert.equal(f.layer().dataset.lighting, 'evening');
  f.controller.setSettings({lighting: 'off'}); assert.equal(f.layer().dataset.lighting, 'off'); assert.equal(f.layer().dataset.dust, 'true'); assert.equal(f.timers.size, 1);
  f.controller.setSettings({lighting: 'day', dust: false}); f.setHour(22); f.tick(); assert.equal(f.layer().dataset.lighting, 'day'); assert.equal(f.layer().dataset.dust, 'false');
});

test('hidden pages pause decorative motion and timers, then refresh local time on return', t => {
  const f = fixture(t); f.controller.mount(); f.visibility(true);
  assert.equal(f.layer().dataset.paused, 'true'); assert.equal(f.timers.size, 0);
  f.setHour(23); f.visibility(false); assert.equal(f.layer().dataset.paused, 'false'); assert.equal(f.layer().dataset.lighting, 'night'); assert.equal(f.timers.size, 1);
  f.visibility(false); assert.equal(f.timers.size, 1);
});

test('reduced motion stops dust and flicker while retaining the selected static light', t => {
  const f = fixture(t); f.controller.mount(); f.controller.setSettings({lighting: 'night'}); f.motion(true);
  assert.equal(f.layer().dataset.motion, 'still'); assert.equal(f.layer().dataset.lighting, 'night'); assert.equal(f.controller.getSettings().dust, true);
  f.motion(false); assert.equal(f.layer().dataset.motion, 'moving');
  const reduced = fixture(t, {factory: {reducedMotion: () => true}}); reduced.controller.mount(); assert.equal(reduced.layer().dataset.motion, 'still');
});

test('menu controls have native labels and change light, dust, audio and ambient volume independently', t => {
  const f = fixture(t); f.controller.mount(); f.controller.mountControls(f.menu);
  assert.match(f.menu.textContent, /บรรยากาศ/); assert.equal(f.menu.querySelector('select').children.length, 6);
  for (const name of ['lighting', 'dust', 'rain', 'tavern', 'volume', 'rainVolume', 'tavernVolume', 'dustDensity', 'soundscape', 'soundscapeVolume']) {
    const control = f.field(name); assert.ok(control, name); assert.equal(control.parentElement.tagName, 'LABEL'); assert.match(control.parentElement.textContent, /[ก-๙]/);
  }
  f.field('rain').checked = true; f.field('rain').emit('change');
  assert.equal(f.controller.getSettings().rain, true); assert.equal(f.controller.getSettings().tavern, false); assert.equal(f.controller.getSettings().dust, true);
  f.field('lighting').value = 'off'; f.field('lighting').emit('change'); assert.equal(f.layer().dataset.lighting, 'off'); assert.equal(f.controller.getSettings().rain, true);
  f.field('dust').checked = false; f.field('dust').emit('change'); assert.equal(f.controller.getSettings().dust, false); assert.equal(f.controller.getSettings().rain, true);
  f.field('tavern').checked = true; f.field('tavern').emit('change');
  f.field('volume').value = '65'; f.field('volume').emit('input'); assert.equal(f.controller.getSettings().volume, .65); assert.equal(f.audio.at(-1).tavern, true);
  f.controller.setSettings({lighting: 'night', volume: .2}); assert.equal(f.field('lighting').value, 'night'); assert.equal(f.field('volume').value, '20');
  f.controller.mountControls(f.menu); assert.equal(f.menu.querySelectorAll('fieldset').length, 1);
});

test('destroy releases layers, controls, timers and listeners and stale controls cannot persist changes', t => {
  const f = fixture(t); f.controller.mount(); f.controller.mountControls(f.menu); const oldRain = f.field('rain'); const oldTimer = [...f.timers.values()][0];
  assert.ok(f.document.listenerCount > 0); assert.ok(f.media.listenerCount > 0);
  f.controller.destroy(); f.controller.destroy();
  assert.equal(f.layer(), null); assert.equal(f.menu.children.length, 0); assert.equal(f.timers.size, 0); assert.equal(f.document.listenerCount, 0); assert.equal(f.media.listenerCount, 0);
  const writes = f.writes.length, callbacks = f.audio.length;
  oldRain.checked = true; oldRain.emit('change'); oldTimer.callback(); f.controller.setSettings({rain: true}); f.controller.mount(); f.controller.mountControls(f.menu); f.visibility(false); f.motion(true);
  assert.equal(f.writes.length, writes); assert.equal(f.audio.length, callbacks); assert.equal(f.timers.size, 0); assert.equal(f.layer(), null); assert.equal(f.menu.children.length, 0);
});

test('older preferences gain independent full-strength layer levels without an implicit storage migration', t => {
  const f = fixture(t, {stored: '{"lighting":"night","dust":false,"rain":true,"tavern":true,"volume":0.45}'});
  assert.deepEqual(f.controller.getSettings(), {lighting: 'night', dust: false, rain: true, tavern: true, volume: .45, rainVolume: 1, tavernVolume: 1, soundscape: 'auto', soundscapeVolume: 1, dustDensity: .65});
  assert.equal(f.writes.length, 0);
  f.controller.setSettings({rainVolume: .15});
  assert.deepEqual(JSON.parse(f.writes[0][1]), {lighting: 'night', dust: false, rain: true, tavern: true, volume: .45, rainVolume: .15, tavernVolume: 1, soundscape: 'auto', soundscapeVolume: 1, dustDensity: .65});
  assert.deepEqual(f.audio.at(-1), {lighting: 'night', dust: false, rain: true, tavern: true, volume: .45, rainVolume: .15, tavernVolume: 1, soundscape: 'auto', soundscapeVolume: 1, dustDensity: .65});
});

test('saved and patched layer levels clamp independently while invalid values preserve the previous levels', t => {
  const f = fixture(t, {stored: '{"rainVolume":-0.5,"tavernVolume":1.7}'});
  assert.equal(f.controller.getSettings().rainVolume, 0); assert.equal(f.controller.getSettings().tavernVolume, 1);
  f.controller.setSettings({rainVolume: .25, tavernVolume: .8});
  const writes = f.writes.length, callbacks = f.audio.length;
  f.controller.setSettings({rainVolume: '0.9', tavernVolume: NaN}); f.controller.setSettings({rainVolume: Infinity, tavernVolume: null});
  assert.equal(f.controller.getSettings().rainVolume, .25); assert.equal(f.controller.getSettings().tavernVolume, .8);
  assert.equal(f.writes.length, writes); assert.equal(f.audio.length, callbacks);
  const restored = fixture(t, {stored: '{"rainVolume":"0.5","tavernVolume":null}'});
  assert.equal(restored.controller.getSettings().rainVolume, 1); assert.equal(restored.controller.getSettings().tavernVolume, 1);
});

test('rain and tavern faders leave master volume, toggles, lighting and each other unchanged', t => {
  const f = fixture(t); f.controller.mountControls(f.menu);
  const rain = f.field('rainVolume'), tavern = f.field('tavernVolume'), master = f.field('volume');
  assert.ok(rain); assert.ok(tavern); assert.equal(rain.type, 'range'); assert.equal(tavern.type, 'range');
  assert.equal(rain.value, '100'); assert.equal(tavern.value, '100'); assert.equal(master.value, '30');
  assert.match(rain.parentElement.textContent, /ความดังฝน/); assert.match(tavern.parentElement.textContent, /ความดังโรงเตี๊ยม/); assert.match(master.parentElement.textContent, /ความดังบรรยากาศรวม/);
  rain.value = '15'; rain.emit('input');
  assert.deepEqual(f.controller.getSettings(), {lighting: 'auto', dust: true, rain: false, tavern: false, volume: .3, rainVolume: .15, tavernVolume: 1, soundscape: 'auto', soundscapeVolume: 1, dustDensity: .65});
  assert.equal(rain.parentElement.querySelector('output').textContent, '15%'); assert.equal(tavern.parentElement.querySelector('output').textContent, '100%');
  tavern.value = '80'; tavern.emit('input');
  assert.equal(f.controller.getSettings().rainVolume, .15); assert.equal(f.controller.getSettings().tavernVolume, .8); assert.equal(master.value, '30');
  assert.equal(f.audio.at(-1).rainVolume, .15); assert.equal(f.audio.at(-1).tavernVolume, .8);
});

test('only real playback status callbacks can show playing and their hints never persist as settings', t => {
  const f = fixture(t); f.controller.mountControls(f.menu);
  assert.ok(f.status('rain')); assert.ok(f.status('tavern'));
  f.field('rain').checked = true; f.field('rain').emit('change');
  f.field('tavern').checked = true; f.field('tavern').emit('change');
  assert.equal(f.status('rain').textContent, 'รอการกดเปิดเสียง'); assert.doesNotMatch(f.menu.textContent, /กำลังเล่น/);
  const writes = f.writes.length, callbacks = f.audio.length, settings = f.controller.getSettings();
  f.controller.setAudioStatus({rain: 'playing', tavern: 'error'});
  assert.equal(f.status('rain').textContent, 'กำลังเล่น'); assert.equal(f.status('tavern').textContent, 'โหลดเสียงไม่ได้ ลองปิดแล้วเปิดอีกครั้ง');
  assert.equal(f.status('rain').getAttribute('role'), 'status'); assert.equal(f.status('rain').getAttribute('aria-live'), 'polite');
  assert.equal(f.writes.length, writes); assert.equal(f.audio.length, callbacks); assert.deepEqual(f.controller.getSettings(), settings);
  for (const [status, hint] of [['waiting', 'รอการกดเปิดเสียง'], ['loading', 'กำลังโหลดเสียง'], ['muted', 'ปิดเสียงรวมอยู่'], ['paused', 'หยุดชั่วคราว'], ['quiet', 'ระดับเสียงเป็นศูนย์'], ['off', 'ปิดอยู่']]) {
    f.controller.setAudioStatus({rain: status}); assert.equal(f.status('rain').textContent, hint); assert.equal(f.status('tavern').textContent, 'โหลดเสียงไม่ได้ ลองปิดแล้วเปิดอีกครั้ง');
  }
  for (const invalid of [null, [], 'playing', {rain: 'invented'}, {rain: true}]) f.controller.setAudioStatus(invalid);
  assert.equal(f.status('rain').textContent, 'ปิดอยู่'); assert.equal(f.writes.length, writes);
});

test('status updates preserve focused controls and draft input, survive mounting, and stop after destroy', t => {
  const f = fixture(t);
  assert.equal(typeof f.controller.setAudioStatus, 'function');
  f.controller.setSettings({rain: true, tavern: true}); f.controller.setAudioStatus({rain: 'loading', tavern: 'waiting'}); f.controller.mountControls(f.menu);
  assert.equal(f.status('rain').textContent, 'กำลังโหลดเสียง');
  const rain = f.field('rainVolume'); rain.focus(); rain.value = '77'; const fieldset = rain.parentElement.parentElement;
  f.controller.setAudioStatus({rain: 'playing', tavern: 'error'});
  assert.equal(f.document.activeElement, rain); assert.equal(f.field('rainVolume'), rain); assert.equal(rain.parentElement.parentElement, fieldset); assert.equal(rain.value, '77');
  f.controller.setSettings({lighting: 'night'}); assert.equal(f.document.activeElement, rain); assert.equal(f.status('rain').textContent, 'กำลังเล่น');
  const hint = f.status('tavern'), writes = f.writes.length;
  f.controller.destroy(); f.controller.setAudioStatus({tavern: 'playing'}); rain.value = '15'; rain.emit('input');
  assert.equal(hint.textContent, 'โหลดเสียงไม่ได้ ลองปิดแล้วเปิดอีกครั้ง'); assert.equal(f.writes.length, writes); assert.equal(f.menu.children.length, 0); assert.equal(rain.listenerCount, 0);
});

test('legacy preferences gain default dust density without writing and the native density slider persists independently', t => {
  const f = fixture(t, {stored: '{"lighting":"night","dust":true,"rain":true,"tavern":true,"volume":0.45,"rainVolume":0.2,"tavernVolume":0.8}'});
  f.controller.mount(); f.controller.mountControls(f.menu);
  assert.equal(f.controller.getSettings().dustDensity, .65); assert.equal(f.writes.length, 0);
  const density = f.field('dustDensity'); assert.ok(density); assert.equal(density.type, 'range'); assert.equal(density.value, '65');
  assert.match(density.parentElement.textContent, /ความหนาแน่นฝุ่น/); assert.equal(density.min, '0'); assert.equal(density.max, '100');
  density.value = '25'; density.emit('input');
  assert.equal(f.layer().querySelectorAll('.desk-atmosphere-particle').length, 15);
  assert.deepEqual(f.controller.getSettings(), {lighting: 'night', dust: true, rain: true, tavern: true, volume: .45, rainVolume: .2, tavernVolume: .8, soundscape: 'auto', soundscapeVolume: 1, dustDensity: .25});
  assert.deepEqual(JSON.parse(f.writes.at(-1)[1]), {lighting: 'night', dust: true, rain: true, tavern: true, volume: .45, rainVolume: .2, tavernVolume: .8, soundscape: 'auto', soundscapeVolume: 1, dustDensity: .25});
  assert.equal(density.parentElement.querySelector('output').textContent, '25%');
});

test('dust density bounds yield zero through sixty particles while toggle preserves the chosen density', t => {
  const f = fixture(t); f.controller.mount(); const count = () => f.layer().querySelectorAll('.desk-atmosphere-particle').length;
  assert.equal(count(), 39);
  for (const [value, density, particles] of [[0, 0, 0], [1, 1, 60], [-1, 0, 0], [2, 1, 60], [.125, .125, 8], [.65, .65, 39]]) {
    f.controller.setSettings({dustDensity: value}); assert.equal(f.controller.getSettings().dustDensity, density); assert.equal(count(), particles);
  }
  const writes = f.writes.length;
  for (const value of ['0.8', null, NaN, Infinity]) f.controller.setSettings({dustDensity: value});
  assert.equal(count(), 39); assert.equal(f.writes.length, writes);
  f.controller.setSettings({dust: false}); assert.equal(count(), 0); assert.equal(f.controller.getSettings().dustDensity, .65);
  f.controller.setSettings({dust: true}); assert.equal(count(), 39);
  for (const [stored, want, particles] of [['{"dustDensity":3}', 1, 60], ['{"dustDensity":-1}', 0, 0], ['{"dustDensity":".8"}', .65, 39]]) {
    const restored = fixture(t, {stored}); restored.controller.mount(); assert.equal(restored.controller.getSettings().dustDensity, want); assert.equal(restored.layer().querySelectorAll('.desk-atmosphere-particle').length, particles); assert.equal(restored.writes.length, 0);
  }
});

test('particles expose finite varied paint coordinates and stable deterministic identities across unrelated updates', t => {
  const f = fixture(t), other = fixture(t); f.controller.mount(); other.controller.mount(); f.controller.setSettings({dustDensity: 1}); other.controller.setSettings({dustDensity: 1});
  const particles = f.layer().querySelectorAll('.desk-atmosphere-particle');
  const names = ['--dust-x', '--dust-y', '--dust-size', '--dust-duration', '--dust-delay', '--dust-dx', '--dust-dy'];
  const values = nodes => nodes.map(node => names.map(name => node.style[name]));
  assert.deepEqual(values(particles), values(other.layer().querySelectorAll('.desk-atmosphere-particle')));
  for (const particle of particles) {
    for (const name of names) assert.ok(Number.isFinite(parseFloat(particle.style[name])), `${name} must be finite`);
    for (const name of ['--dust-x', '--dust-y']) assert.ok(parseFloat(particle.style[name]) >= 0 && parseFloat(particle.style[name]) <= 100);
    assert.ok(parseFloat(particle.style['--dust-size']) >= .5 && parseFloat(particle.style['--dust-size']) <= 2, 'fine dust should stay below two CSS pixels');
    assert.ok(parseFloat(particle.style['--dust-duration']) >= 15 && parseFloat(particle.style['--dust-duration']) <= 60);
    assert.ok(parseFloat(particle.style['--dust-delay']) <= 0); assert.equal(particle.style.pointerEvents, 'none');
  }
  assert.ok(new Set(particles.map(node => node.style['--dust-size'])).size >= 3); assert.ok(new Set(particles.map(node => node.style['--dust-delay'])).size >= 10);
  f.controller.setSettings({volume: .7, rainVolume: .2}); f.controller.setAudioStatus({rain: 'playing'}); f.setClock(17, 35); f.tick();
  for (const [index, node] of f.layer().querySelectorAll('.desk-atmosphere-particle').entries()) assert.equal(node, particles[index]);
  f.controller.setSettings({dustDensity: .999});
  for (const [index, node] of f.layer().querySelectorAll('.desk-atmosphere-particle').entries()) assert.equal(node, particles[index]);
});

test('sunlit dust copies match base geometry and drift in the same particle order', t => {
  const f = fixture(t); f.controller.mount(); f.controller.setSettings({dustDensity: 1});
  const layer = f.layer(), dust = layer.querySelector('.desk-atmosphere-dust'), lit = layer.querySelector('.desk-atmosphere-dust-lit');
  assert.ok(lit, 'sunlit dust needs its own field for the shared beam mask');
  assert.equal(dust.parentElement, layer); assert.equal(lit.parentElement, layer);
  assert.equal(dust.children.length, 60); assert.equal(lit.children.length, 60);
  assert.equal(layer.querySelectorAll('.desk-atmosphere-particle').length, 60, 'bright copies must not add normal motes');
  assert.equal(layer.querySelectorAll('.desk-atmosphere-lit-particle').length, 60);
  const properties = ['--dust-x', '--dust-y', '--dust-size', '--dust-duration', '--dust-delay', '--dust-dx', '--dust-dy'];
  for (const [index, particle] of dust.children.entries()) {
    const bright = lit.children[index];
    assert.equal(bright.className, 'desk-atmosphere-lit-particle');
    for (const property of properties) assert.equal(bright.style[property], particle.style[property], `${property} must match particle ${index + 1}`);
    assert.equal(bright.style.pointerEvents, 'none');
  }
});

test('light, clock, sound and same-count density changes preserve both dust fields and cloud identities', t => {
  const f = fixture(t, {hour: 9, minute: 59});
  f.window.requestAnimationFrame = () => assert.fail('decorative motion must remain CSS driven');
  f.controller.mount();
  const layer = f.layer(), dust = layer.querySelector('.desk-atmosphere-dust'), lit = layer.querySelector('.desk-atmosphere-dust-lit');
  assert.ok(lit);
  const normalParticles = [...dust.children], brightParticles = [...lit.children], clouds = layer.querySelectorAll('.desk-atmosphere-cloud');
  assert.equal(clouds.length, 2);
  const updates = [
    () => { f.setClock(16, 0); f.tick(); },
    () => f.controller.setSettings({volume: .7, rain: true, rainVolume: .2}),
    () => f.controller.setAudioStatus({rain: 'playing'}),
    () => f.controller.setSettings({dustDensity: .651}),
    () => f.controller.setSettings({lighting: 'evening'}),
    () => f.controller.setSettings({lighting: 'auto'}),
    () => f.motion(true),
    () => f.visibility(true),
    () => f.visibility(false),
    () => f.controller.mount(),
  ];
  for (const update of updates) {
    update();
    assert.equal(layer.querySelector('.desk-atmosphere-dust'), dust); assert.equal(layer.querySelector('.desk-atmosphere-dust-lit'), lit);
    for (const [index, particle] of dust.children.entries()) assert.equal(particle, normalParticles[index]);
    for (const [index, particle] of lit.children.entries()) assert.equal(particle, brightParticles[index]);
    for (const [index, cloud] of layer.querySelectorAll('.desk-atmosphere-cloud').entries()) assert.equal(cloud, clouds[index]);
    assert.equal(dust.children.length, 39); assert.equal(lit.children.length, 39);
    assert.ok(f.timers.size <= 1, 'the existing minute timer is the only JS animation lifecycle');
  }
  assert.equal(layer.dataset.lighting, 'evening'); assert.equal(layer.dataset.motion, 'still'); assert.equal(layer.dataset.paused, 'false');
});

test('density and dust toggles add and remove matched pairs while retaining the surviving phases', t => {
  const f = fixture(t); f.controller.mount(); f.controller.setSettings({dustDensity: 1});
  const dust = f.layer().querySelector('.desk-atmosphere-dust'), lit = f.layer().querySelector('.desk-atmosphere-dust-lit');
  assert.ok(lit);
  const normalParticles = [...dust.children], brightParticles = [...lit.children];
  f.controller.setSettings({dustDensity: .125});
  assert.equal(dust.children.length, 8); assert.equal(lit.children.length, 8);
  for (let index = 0; index < 8; index++) { assert.equal(dust.children[index], normalParticles[index]); assert.equal(lit.children[index], brightParticles[index]); }
  for (let index = 8; index < 60; index++) { assert.equal(normalParticles[index].parentElement, null); assert.equal(brightParticles[index].parentElement, null); }
  f.controller.setSettings({dust: false});
  assert.equal(dust.children.length, 0); assert.equal(lit.children.length, 0); assert.equal(f.controller.getSettings().dustDensity, .125);
  f.controller.setSettings({dust: true});
  assert.equal(dust.children.length, 8); assert.equal(lit.children.length, 8);
  for (const [value, count] of [[0, 0], [1, 60], [-1, 0], [2, 60]]) {
    f.controller.setSettings({dustDensity: value}); assert.equal(dust.children.length, count); assert.equal(lit.children.length, count);
  }
});

test('clouds follow both dust fields and destroy detaches all added paint from lifecycle updates', t => {
  const f = fixture(t); f.controller.mount();
  const layer = f.layer(), lit = layer.querySelector('.desk-atmosphere-dust-lit'), clouds = layer.querySelectorAll('.desk-atmosphere-cloud');
  assert.ok(lit); assert.equal(clouds.length, 2);
  assert.deepEqual(layer.children.slice(-4).map(node => node.className), ['desk-atmosphere-dust', 'desk-atmosphere-dust-lit', 'desk-atmosphere-cloud', 'desk-atmosphere-cloud desk-atmosphere-cloud-far']);
  for (const node of [lit, ...lit.children, ...clouds]) assert.equal(node.style.pointerEvents, 'none');
  const oldTimer = [...f.timers.values()][0], particleCount = lit.children.length, oldPhase = layer.dataset.lighting, writes = f.writes.length, callbacks = f.audio.length;
  f.controller.destroy();
  assert.equal(layer.parentElement, null); assert.equal(f.scroll.querySelector('.desk-atmosphere-dust-lit'), null); assert.equal(f.scroll.querySelectorAll('.desk-atmosphere-cloud').length, 0);
  assert.equal(f.timers.size, 0); assert.equal(f.document.listenerCount, 0); assert.equal(f.media.listenerCount, 0);
  oldTimer.callback(); f.setClock(6, 0); f.visibility(false); f.motion(true); f.controller.setSettings({dust: false, dustDensity: 0});
  assert.equal(f.controller.mount(), null); assert.equal(layer.dataset.lighting, oldPhase); assert.equal(lit.children.length, particleCount);
  assert.equal(f.timers.size, 0); assert.equal(f.writes.length, writes); assert.equal(f.audio.length, callbacks);
});

test('all local phase boundaries resolve with the matching auto phase and two-digit time hint', t => {
  const f = fixture(t); f.controller.mount(); f.controller.mountControls(f.menu);
  assert.deepEqual(f.layer().children.map(node => node.className), ['desk-atmosphere-morning', 'desk-atmosphere-day', 'desk-atmosphere-evening', 'desk-atmosphere-night', 'desk-atmosphere-dust', 'desk-atmosphere-dust-lit', 'desk-atmosphere-cloud', 'desk-atmosphere-cloud desk-atmosphere-cloud-far']);
  const writes = f.writes.length, callbacks = f.audio.length;
  for (const [hour, minute, phase, thai, clock] of [[0,0,'night','กลางคืน','00:00'], [5,59,'night','กลางคืน','05:59'], [6,0,'morning','เช้า','06:00'], [9,59,'morning','เช้า','09:59'], [10,0,'day','กลางวัน','10:00'], [15,59,'day','กลางวัน','15:59'], [16,0,'evening','เย็น','16:00'], [18,59,'evening','เย็น','18:59'], [19,0,'night','กลางคืน','19:00'], [23,59,'night','กลางคืน','23:59']]) {
    f.setClock(hour, minute); f.tick(); assert.equal(f.layer().dataset.lighting, phase); assert.ok(f.phaseHint().textContent.includes(thai)); assert.ok(f.phaseHint().textContent.includes(clock)); assert.match(f.phaseHint().textContent, /อัตโนมัติ/); assert.equal(f.timers.size, 1);
  }
  assert.equal(f.writes.length, writes); assert.equal(f.audio.length, callbacks);
});

test('explicit morning and evening choices persist with a clear manual hint and auto resumes the current local minute', t => {
  const f = fixture(t, {hour: 23, minute: 7}); f.controller.mountControls(f.menu); assert.equal(f.timers.size, 0); f.controller.mount();
  assert.deepEqual(f.field('lighting').children.map(option => option.value), ['auto', 'morning', 'day', 'evening', 'night', 'off']);
  for (const [phase, thai] of [['morning', 'เช้า'], ['evening', 'เย็น'], ['off', 'ปิดแสง']]) {
    f.field('lighting').value = phase; f.field('lighting').emit('change'); assert.equal(f.layer().dataset.lighting, phase); assert.equal(f.controller.getSettings().lighting, phase); assert.equal(JSON.parse(f.writes.at(-1)[1]).lighting, phase);
    assert.match(f.phaseHint().textContent, /เลือกเอง/); assert.ok(f.phaseHint().textContent.includes(thai)); assert.doesNotMatch(f.phaseHint().textContent, /\d{2}:\d{2}/); assert.equal(f.timers.size, 1);
  }
  f.setClock(16, 8); f.controller.setSettings({lighting: 'auto'}); assert.equal(f.layer().dataset.lighting, 'evening'); assert.match(f.phaseHint().textContent, /16:08/); assert.equal(f.timers.size, 1);
  const restored = fixture(t, {stored: '{"lighting":"morning"}'}); restored.controller.mount(); assert.equal(restored.layer().dataset.lighting, 'morning'); assert.equal(restored.writes.length, 0);
});

test('minute and status refresh preserve native focused values while hidden return refreshes phase without audio changes', t => {
  const f = fixture(t, {hour: 9, minute: 59}); f.controller.mount(); f.controller.mountControls(f.menu);
  const density = f.field('dustDensity'), rainVolume = f.field('rainVolume'), hint = f.phaseHint(); assert.ok(density);
  density.focus(); density.value = '77'; const writes = f.writes.length, callbacks = f.audio.length, firstParticle = f.layer().querySelector('.desk-atmosphere-particle');
  f.setClock(10, 0); f.tick(); f.controller.setAudioStatus({tavern: 'loading'});
  assert.equal(f.document.activeElement, density); assert.equal(density.value, '77'); assert.equal(f.field('dustDensity'), density); assert.equal(f.phaseHint(), hint); assert.match(hint.textContent, /10:00/);
  rainVolume.focus(); rainVolume.value = '23'; f.setClock(10, 1); f.tick(); assert.equal(f.document.activeElement, rainVolume); assert.equal(rainVolume.value, '23');
  f.visibility(true); assert.equal(f.timers.size, 0); assert.equal(f.layer().dataset.paused, 'true'); f.setClock(19, 3); f.tick(); assert.equal(f.layer().dataset.lighting, 'day');
  f.visibility(false); assert.equal(f.layer().dataset.lighting, 'night'); assert.match(hint.textContent, /19:03/); assert.equal(f.timers.size, 1); assert.equal(rainVolume.value, '23');
  assert.equal(f.layer().querySelector('.desk-atmosphere-particle'), firstParticle); assert.equal(f.writes.length, writes); assert.equal(f.audio.length, callbacks);
  f.motion(true); assert.equal(f.layer().dataset.motion, 'still'); assert.equal(f.controller.getSettings().dustDensity, .65);
  const oldTimer = [...f.timers.values()][0]; f.controller.destroy(); oldTimer.callback(); density.value = '1'; density.emit('input'); assert.equal(f.timers.size, 0); assert.equal(f.writes.length, writes); assert.equal(density.listenerCount, 0);
});

test('the single auto timer targets the next local minute and remains between 250ms and sixty seconds', t => {
  const f = fixture(t, {hour: 9, minute: 59, second: 50, millisecond: 250}); f.controller.mount(); f.controller.mountControls(f.menu);
  assert.equal(f.timers.size, 1); assert.equal([...f.timers.values()][0].delay, 9750);
  f.setClock(10, 0); f.tick(); assert.equal(f.layer().dataset.lighting, 'day'); assert.match(f.phaseHint().textContent, /10:00/); assert.equal(f.timers.size, 1); assert.equal([...f.timers.values()][0].delay, 60_000);
  f.setClock(10, 0, 59, 950); f.tick(); assert.equal(f.timers.size, 1); assert.equal([...f.timers.values()][0].delay, 250);
});

test('mounting controls and changing preferences share the same clock snapshot for paint and the time hint', t => {
  let sample = 0;
  const f = fixture(t, {factory: {now: () => sample++ % 2 === 0 ? new Date(2026, 5, 10, 9, 59, 59, 999) : new Date(2026, 5, 10, 10, 0)}});
  f.controller.mount(); f.controller.mountControls(f.menu);
  assert.equal(f.layer().dataset.lighting, 'morning'); assert.equal(f.phaseHint().dataset.phase, 'morning'); assert.match(f.phaseHint().textContent, /09:59/);
  f.controller.setSettings({dustDensity: .5});
  assert.equal(f.layer().dataset.lighting, 'day'); assert.equal(f.phaseHint().dataset.phase, 'day'); assert.match(f.phaseHint().textContent, /10:00/);
});

test('actual clock phase publishes before mount and at exact boundaries without lighting or audio side effects', t => {
  const f = fixture(t, {hour: 5, minute: 59, stored: '{"lighting":"off","rain":true,"tavern":true}'});
  assert.deepEqual(f.phases, [{phase: 'night', time: '05:59'}]); assert.equal(f.timers.size, 0);
  assert.equal(f.audio.length, 1); assert.equal(f.writes.length, 0);
  f.controller.mount(); f.controller.mountControls(f.menu);
  const writes = f.writes.length, audio = f.audio.length;
  for (const [hour, minute, phase, time] of [[6,0,'morning','06:00'], [9,59,'morning','09:59'], [10,0,'day','10:00'], [15,59,'day','15:59'], [16,0,'evening','16:00'], [18,59,'evening','18:59'], [19,0,'night','19:00'], [23,59,'night','23:59']]) {
    f.setClock(hour, minute); f.tick();
    assert.deepEqual(f.phases.at(-1), {phase, time}); assert.equal(f.layer().dataset.lighting, 'off'); assert.equal(f.timers.size, 1);
    assert.equal(f.soundscapeHint().dataset.phase, phase); assert.ok(f.soundscapeHint().textContent.includes(time));
  }
  f.setDay(11); f.setClock(0, 0); f.tick(); assert.deepEqual(f.phases.at(-1), {phase: 'night', time: '00:00'});
  assert.equal(f.writes.length, writes); assert.equal(f.audio.length, audio); assert.equal(f.controller.getSettings().rain, true); assert.equal(f.controller.getSettings().tavern, true);
  assert.equal(Object.hasOwn(f.controller.getSettings(), 'phase'), false); assert.equal(Object.hasOwn(JSON.parse(f.stored.get('guild-board-atmosphere-v1')), 'phase'), false);
});

test('manual sound and lighting choices stay independent and share one timer only when either is automatic', t => {
  const f = fixture(t, {hour: 7, minute: 5}); f.controller.mount(); f.controller.mountControls(f.menu);
  const sound = f.field('soundscape'); assert.ok(sound); assert.match(sound.parentElement.textContent, /เสียงตามช่วงเวลา/);
  assert.deepEqual(sound.children.map(option => [option.value, option.textContent]), [['auto', 'ตามเวลาเครื่อง'], ['morning', 'นกนอกหน้าต่าง'], ['day', 'ลม/ใบไม้'], ['evening', 'เตาผิง'], ['night', 'แมลงยามค่ำ'], ['off', 'ปิดเสียงตามช่วงเวลา']]);
  f.controller.setSettings({lighting: 'night'}); assert.equal(f.timers.size, 1); assert.equal(f.soundscapeHint().dataset.phase, 'morning');
  f.setClock(10, 0); f.tick(); assert.equal(f.layer().dataset.lighting, 'night'); assert.equal(f.soundscapeHint().dataset.phase, 'day'); assert.deepEqual(f.phases.at(-1), {phase: 'day', time: '10:00'});
  sound.value = 'evening'; sound.emit('change'); assert.equal(f.controller.getSettings().soundscape, 'evening'); assert.equal(f.timers.size, 0);
  assert.equal(f.soundscapeHint().dataset.mode, 'manual'); assert.equal(f.soundscapeHint().dataset.phase, 'evening'); assert.match(f.soundscapeHint().textContent, /เตาผิง/); assert.doesNotMatch(f.soundscapeHint().textContent, /\d{2}:\d{2}/);
  f.setClock(19, 0); f.controller.setSettings({lighting: 'auto'}); assert.equal(f.layer().dataset.lighting, 'night'); assert.equal(f.timers.size, 1); assert.equal(f.soundscapeHint().dataset.phase, 'evening');
  f.controller.setSettings({lighting: 'off', soundscape: 'off'}); assert.equal(f.timers.size, 0); assert.equal(f.status('soundscape').dataset.state, 'off');
  f.controller.setSettings({soundscape: 'auto'}); assert.equal(f.timers.size, 1); assert.equal(f.soundscapeHint().dataset.phase, 'night'); assert.match(f.soundscapeHint().textContent, /19:00/);
});

test('soundscape preferences normalize, restore through the same key and do not migrate legacy storage implicitly', t => {
  const f = fixture(t, {stored: '{"lighting":"night","rain":true,"rainVolume":0.2,"soundscape":"morning","soundscapeVolume":0.4}'});
  assert.equal(f.controller.getSettings().soundscape, 'morning'); assert.equal(f.controller.getSettings().soundscapeVolume, .4); assert.equal(f.writes.length, 0);
  assert.deepEqual(f.reads, ['guild-board-atmosphere-v1']);
  f.controller.setSettings({soundscape: 'night', soundscapeVolume: 3}); assert.equal(f.controller.getSettings().soundscapeVolume, 1);
  f.controller.setSettings({soundscapeVolume: -1}); assert.equal(f.controller.getSettings().soundscapeVolume, 0);
  const writes = f.writes.length, audio = f.audio.length;
  for (const patch of [{soundscape: 'dawn'}, {soundscape: true}, {soundscapeVolume: '0.8'}, {soundscapeVolume: NaN}, {soundscapeVolume: Infinity}, {soundscapeVolume: null}]) f.controller.setSettings(patch);
  assert.equal(f.controller.getSettings().soundscape, 'night'); assert.equal(f.controller.getSettings().soundscapeVolume, 0); assert.equal(f.writes.length, writes); assert.equal(f.audio.length, audio);
  assert.equal(f.writes.at(-1)[0], 'guild-board-atmosphere-v1'); assert.equal(JSON.parse(f.writes.at(-1)[1]).soundscape, 'night'); assert.equal(JSON.parse(f.writes.at(-1)[1]).soundscapeVolume, 0); assert.equal(JSON.parse(f.writes.at(-1)[1]).rainVolume, .2);
  const legacy = fixture(t, {stored: '{"lighting":"off","tavern":true}'}); assert.equal(legacy.controller.getSettings().soundscape, 'auto'); assert.equal(legacy.controller.getSettings().soundscapeVolume, 1); assert.equal(legacy.writes.length, 0);
  for (const [stored, value] of [['{"soundscapeVolume":4}',1], ['{"soundscapeVolume":-1}',0], ['{"soundscape":"unknown","soundscapeVolume":".2"}',1]]) {
    const invalid = fixture(t, {stored}); assert.equal(invalid.controller.getSettings().soundscape, 'auto'); assert.equal(invalid.controller.getSettings().soundscapeVolume, value); assert.equal(invalid.writes.length, 0);
  }
});

test('soundscape status reflects only playback callbacks and changing the selection clears stale playing or error hints', t => {
  const f = fixture(t); f.controller.mountControls(f.menu); const hint = f.status('soundscape'); assert.ok(hint);
  assert.equal(hint.dataset.state, 'waiting'); assert.doesNotMatch(hint.textContent, /กำลังเล่น/); assert.equal(hint.getAttribute('role'), 'status'); assert.equal(hint.getAttribute('aria-live'), 'polite');
  const writes = f.writes.length, audio = f.audio.length;
  for (const [state, text] of [['loading','กำลังโหลดเสียง'], ['error','โหลดเสียงไม่ได้ ลองปิดแล้วเปิดอีกครั้ง'], ['muted','ปิดเสียงรวมอยู่'], ['paused','หยุดชั่วคราว'], ['quiet','ระดับเสียงเป็นศูนย์'], ['waiting','รอการกดเปิดเสียง'], ['playing','กำลังเล่น']]) {
    f.controller.setAudioStatus({soundscape: state}); assert.equal(hint.dataset.state, state); assert.equal(hint.textContent, text);
  }
  for (const status of [null, [], {soundscape: true}, {soundscape: 'invented'}]) f.controller.setAudioStatus(status);
  assert.equal(hint.dataset.state, 'playing'); assert.equal(f.writes.length, writes); assert.equal(f.audio.length, audio);
  f.controller.setSettings({soundscape: 'morning'}); assert.equal(hint.dataset.state, 'waiting'); assert.doesNotMatch(hint.textContent, /กำลังเล่น/);
  f.controller.setAudioStatus({soundscape: 'error'}); f.controller.setSettings({soundscape: 'off'}); assert.equal(hint.dataset.state, 'off');
  f.controller.setSettings({soundscape: 'auto'}); assert.equal(hint.dataset.state, 'waiting');
});

test('soundscape fader persists independently while clock, visibility and status preserve focused drafts', t => {
  const f = fixture(t, {hour: 9, minute: 59}); f.controller.mount(); f.controller.mountControls(f.menu);
  const field = f.field('soundscapeVolume'); assert.ok(field); assert.equal(field.type, 'range'); assert.equal(field.min, '0'); assert.equal(field.max, '100'); assert.equal(field.value, '100');
  field.value = '35'; field.emit('input'); assert.equal(f.controller.getSettings().soundscapeVolume, .35); assert.equal(f.audio.at(-1).soundscapeVolume, .35);
  assert.equal(f.controller.getSettings().rainVolume, 1); assert.equal(f.controller.getSettings().tavernVolume, 1); assert.equal(f.controller.getSettings().volume, .3); assert.equal(field.parentElement.querySelector('output').textContent, '35%'); assert.equal(field.getAttribute('aria-valuetext'), '35%');
  field.focus(); field.value = '73'; const hint = f.soundscapeHint(), writes = f.writes.length, audio = f.audio.length;
  f.setClock(10, 0); f.tick(); f.controller.setAudioStatus({soundscape: 'playing'});
  assert.equal(f.document.activeElement, field); assert.equal(f.field('soundscapeVolume'), field); assert.equal(field.value, '73'); assert.equal(f.soundscapeHint(), hint); assert.match(hint.textContent, /10:00/);
  f.visibility(true); assert.equal(f.timers.size, 0); const phases = f.phases.length; f.setClock(19, 2); f.tick(); assert.equal(f.phases.length, phases);
  f.visibility(false); assert.deepEqual(f.phases.at(-1), {phase: 'night', time: '19:02'}); assert.equal(f.timers.size, 1); assert.equal(field.value, '73'); assert.equal(f.document.activeElement, field);
  assert.equal(f.writes.length, writes); assert.equal(f.audio.length, audio);
  const oldTimer = [...f.timers.values()][0], status = f.status('soundscape'), callbackCount = f.phases.length;
  f.controller.destroy(); oldTimer.callback(); f.controller.setAudioStatus({soundscape: 'muted'}); field.value = '1'; field.emit('input'); f.visibility(false);
  assert.equal(f.phases.length, callbackCount); assert.equal(f.writes.length, writes); assert.equal(f.audio.length, audio); assert.equal(f.timers.size, 0); assert.equal(status.dataset.state, 'playing'); assert.equal(field.listenerCount, 0);
});

test('phase callback failures do not break control mounting or local clock updates', t => {
  const f = fixture(t, {factory: {onPhaseChange() { throw Error('consumer failed'); }}});
  assert.doesNotThrow(() => { f.controller.mount(); f.controller.mountControls(f.menu); f.setClock(16, 0); f.tick(); });
  assert.equal(f.layer().dataset.lighting, 'evening'); assert.equal(f.timers.size, 1); assert.equal(f.writes.length, 0); assert.equal(f.audio.length, 1);
});

test('setSuspended pauses atmosphere during drag and restores it upon release', t => {
  const f = fixture(t, {hour: 11}); f.controller.mount();
  const layer = f.layer(), surface = f.scroll;
  assert.equal(layer.dataset.paused, 'false');
  assert.equal(surface.getAttribute('data-atmosphere-paused'), null);
  assert.equal(f.controller.suspended, false);

  f.controller.setSuspended(true);
  assert.equal(f.controller.suspended, true);
  assert.equal(layer.dataset.paused, 'true');
  assert.equal(surface.getAttribute('data-atmosphere-paused'), 'true');

  f.controller.setSuspended(false);
  assert.equal(f.controller.suspended, false);
  assert.equal(layer.dataset.paused, 'false');
  assert.equal(surface.getAttribute('data-atmosphere-paused'), null);
});

test('directional light vectors --light-x and --light-y update on surface across dayparts', t => {
  const f = fixture(t, {hour: 7}); f.controller.mount();
  const surface = f.scroll;
  assert.equal(surface.dataset.lighting, 'morning');
  assert.equal(surface.style['--light-x'], '1.2');
  assert.equal(surface.style['--light-y'], '1.1');

  f.setClock(12, 0); f.tick();
  assert.equal(surface.dataset.lighting, 'day');
  assert.equal(surface.style['--light-x'], '0');
  assert.equal(surface.style['--light-y'], '1.2');

  f.setClock(17, 0); f.tick();
  assert.equal(surface.dataset.lighting, 'evening');
  assert.equal(surface.style['--light-x'], '-1.2');
  assert.equal(surface.style['--light-y'], '1.1');

  f.setClock(21, 0); f.tick();
  assert.equal(surface.dataset.lighting, 'night');
  assert.equal(surface.style['--light-x'], '0');
  assert.equal(surface.style['--light-y'], '0.8');

  f.controller.setSettings({lighting: 'off'});
  assert.equal(surface.dataset.lighting, 'off');
  assert.equal(surface.style['--light-x'], '0.4');
  assert.equal(surface.style['--light-y'], '1');
});
