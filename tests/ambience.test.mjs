import test from 'node:test';
import assert from 'node:assert/strict';

import { createGuildAmbience } from '../dist/ambience.mjs';
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

// Web Audio and fetch are browser boundaries. The controller and its scheduling are real.
function rig(options = {}) {
  let nextTimer = 0, milliseconds = 0;
  const timers = new Map(), events = new EventTarget();
  const calls = { contexts: [], sources: [], gains: [], fetches: [], resumes: 0, suspends: 0, closes: 0, decodes: 0 };
  const document = { hidden: false, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events) };
  const window = { navigator: { userActivation: { isActive: true } } };
  const parameter = () => ({ value: 0, scheduled: [], cancelScheduledValues(time) { this.scheduled.push(['cancel', time]); }, cancelAndHoldAtTime(time) { this.scheduled.push(['hold', time]); }, setValueAtTime(value, time) { this.value = value; this.scheduled.push(['set', value, time]); }, linearRampToValueAtTime(value, time) { this.value = value; this.scheduled.push(['ramp', value, time]); } });
  const node = () => ({ disconnected: false, connections: [], connect(other) { this.connections.push(other); }, disconnect() { this.disconnected = true; } });
  class AudioContext {
    constructor() { if (options.constructFails) throw new Error('Audio unavailable'); this.state = 'suspended'; this.destination = {}; calls.contexts.push(this); }
    get currentTime() { return milliseconds / 1000; }
    createGain() { const gain = { ...node(), gain: parameter() }; calls.gains.push(gain); return gain; }
    createBufferSource() { const source = { ...node(), started: false, stopped: false, loop: false, onended: null, start() { assert.ok(this.buffer?.duration > 0); this.started = true; }, stop() { this.stopped = true; } }; calls.sources.push(source); return source; }
    decodeAudioData(bytes) { calls.decodes++; return options.decode ? options.decode(bytes) : Promise.resolve({ duration: 60 }); }
    resume() { calls.resumes++; if (options.resumeFails) return Promise.reject(new Error('Gesture required')); this.state = 'running'; return options.resume?.(this) ?? Promise.resolve(); }
    suspend() { calls.suspends++; if (options.suspend) return options.suspend(this); this.state = 'suspended'; return Promise.resolve(); }
    close() { calls.closes++; this.state = 'closed'; return Promise.resolve(); }
  }
  const player = () => createGuildAmbience({ document, window, AudioContext,onStatus:options.onStatus,
    fetch: async (url, init) => { calls.fetches.push({ url: String(url), signal: init?.signal }); if (options.fetch) return options.fetch(url, init); return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; },
    setTimeout(callback, delay) { timers.set(++nextTimer, { at: milliseconds + delay, callback }); return nextTimer; },
    clearTimeout(id) { timers.delete(id); },
  });
  return { calls, document, window, player, hide(hidden) { document.hidden = hidden; events.dispatchEvent(new Event('visibilitychange')); }, advance(ms) { milliseconds += ms; for (const [id, timer] of [...timers]) if (timer.at <= milliseconds) { timers.delete(id); timer.callback(); } }, get pending() { return timers.size; }, active: () => calls.sources.filter(source => source.started && !source.stopped) };
}

test('settings stay silent until an explicit gesture unlock and both layers default off', async () => {
  assert.equal(typeof createGuildAmbience, 'function');
  const r = rig(), player = r.player();
  assert.equal(r.calls.contexts.length, 0);
  player.setSettings({ rain: true, volume: .3 }); await flush();
  assert.equal(r.calls.fetches.length, 0); assert.equal(r.active().length, 0);
  r.window.navigator.userActivation.isActive = false;
  assert.equal(player.unlock(), false); assert.equal(r.calls.contexts.length, 0);
  r.window.navigator.userActivation.isActive = true;
  assert.equal(player.unlock(), true); assert.equal(r.calls.resumes, 1, 'resume is invoked inside the gesture'); await flush();
  assert.equal(r.active().length, 1); assert.equal(r.active()[0].loop, true);
  assert.ok(r.calls.fetches[0].url.endsWith('/dist/audio/ambience/rain.wav'));
  player.destroy();
});

test('first gesture with default settings creates no recordings and settings reuse one voice per layer', async () => {
  const r = rig(), player = r.player(); player.unlock(); await flush();
  assert.equal(r.calls.fetches.length, 0); assert.equal(r.active().length, 0);
  player.setSettings({ rain: true, tavern: true, volume: .5 }); await flush();
  assert.equal(r.active().length, 2); assert.equal(r.calls.fetches.length, 2);
  for (let i = 0; i < 10; i++) player.setSettings({ rain: true, tavern: true, volume: .25 });
  await flush(); assert.equal(r.active().length, 2); assert.equal(r.calls.sources.length, 2); assert.equal(r.calls.fetches.length, 2);
  const layerGains = r.active().map(source => source.connections[0].gain.value);
  assert.ok(layerGains.every(gain => gain > 0 && gain <= .2));
  player.destroy();
});

test('tavern is distinct in the default mix and independent layer faders mute only their own layer',async()=>{
  const r=rig(),player=r.player();player.setSettings({rain:true,tavern:true,volume:.3});player.unlock();await flush();
  assert.equal(r.active().length,2);
  const [rain,tavern]=r.active(),level=source=>source.connections[0].gain.value;
  assert.ok(level(tavern)>=level(rain)*1.7,'tavern must stand above rain after the over-muffled mix correction');
  const tavernBefore=level(tavern);player.setSettings({rainVolume:0});r.advance(300);await flush();
  assert.equal(rain.stopped,true);assert.equal(r.active().length,1);assert.equal(level(tavern),tavernBefore);
  player.setSettings({rainVolume:.5,tavernVolume:.25});await flush();
  assert.equal(r.active().length,2);assert.equal(level(tavern),tavernBefore*.25);
  player.destroy();
});

test('actual layer status distinguishes gesture wait, loading, playing, mute and errors',async()=>{
  const gate=deferred(),statuses=[],r=rig({onStatus:status=>statuses.push({...status}),fetch:()=>gate.promise}),player=r.player();
  assert.equal(typeof player.getStatus,'function');
  player.setSettings({tavern:true});assert.equal(player.getStatus().tavern,'waiting');
  player.unlock();await flush();assert.equal(player.getStatus().tavern,'loading');
  gate.resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});await flush();
  assert.equal(player.getStatus().tavern,'playing');assert.ok(statuses.some(status=>status.tavern==='playing'));
  r.active()[0].onended();assert.equal(statuses.at(-1).tavern,player.getStatus().tavern,'a stopped source cannot leave a stale playing hint');
  player.setSettings({tavern:true});assert.equal(player.getStatus().tavern,'playing');
  player.setMuted(true);assert.equal(player.getStatus().tavern,'muted');
  player.setMuted(false);player.setSettings({tavernVolume:0});assert.equal(player.getStatus().tavern,'quiet');
  player.destroy();
});

test('a failed tavern load can retry on an explicit off-on choice without restarting working rain',async()=>{
  let attempts=0;
  const r=rig({fetch:async url=>{if(String(url).endsWith('tavern.wav')&&attempts++===0)throw Error('Temporary read error');return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};}}),player=r.player();
  player.setSettings({rain:true,tavern:true});player.unlock();await flush();assert.equal(r.active().length,1);
  const rain=r.active()[0];assert.equal(typeof player.getStatus,'function');assert.equal(player.getStatus().tavern,'error');
  for(let i=0;i<5;i++)player.setSettings({tavern:true,volume:.3});await flush();assert.equal(attempts,1);
  player.setSettings({tavern:false});player.setSettings({tavern:true});await flush();
  assert.equal(attempts,2);assert.equal(r.active().length,2);assert.equal(r.active()[0],rain);assert.equal(player.getStatus().tavern,'playing');player.destroy();
});

test('turning a layer off fades then stops and releases its nodes', async () => {
  const r = rig(), player = r.player(); player.setSettings({ rain: true }); player.unlock(); await flush();
  const source = r.active()[0], gain = source.connections[0];
  player.setSettings({ rain: false });
  assert.equal(gain.gain.value, 0); assert.ok(gain.gain.scheduled.some(call => call[0] === 'ramp' && call[1] === 0));
  r.advance(300); assert.equal(source.stopped, true); assert.equal(source.disconnected, true); assert.equal(gain.disconnected, true); assert.equal(r.pending, 0);
  player.destroy();
});

test('rapid off and on cancels fade cleanup without overlapping a duplicate loop', async () => {
  const r = rig(), player = r.player(); player.setSettings({ rain: true }); player.unlock(); await flush();
  const source = r.active()[0];
  player.setSettings({ rain: false }); r.advance(50); player.setSettings({ rain: true }); await flush(); r.advance(300);
  assert.equal(r.active().length, 1); assert.equal(r.active()[0], source); assert.equal(r.calls.sources.length, 1); assert.equal(r.pending, 0);
  player.destroy();
});

test('toggle, hide, mute, and destroy cancel late decode starts', async t => {
  for (const cancel of ['toggle', 'hide', 'mute', 'destroy']) await t.test(cancel, async () => {
    const gate = deferred(), r = rig({ decode: () => gate.promise }), player = r.player();
    player.setSettings({ rain: true }); player.unlock(); await flush();
    if (cancel === 'toggle') player.setSettings({ rain: false });
    else if (cancel === 'hide') r.hide(true);
    else if (cancel === 'mute') player.setMuted(true);
    else player.destroy();
    gate.resolve({ duration: 60 }); await flush(); r.advance(1000);
    assert.equal(r.active().length, 0); assert.equal(r.pending, 0);
    player.destroy();
  });
});

test('hiding immediately stops both recordings and returning restores only the latest requested layer', async () => {
  const r = rig(), player = r.player(); player.setSettings({ rain: true, tavern: true }); player.unlock(); await flush();
  const original = [...r.active()]; r.hide(true); await flush();
  assert.ok(original.every(source => source.stopped && source.disconnected)); assert.equal(r.active().length, 0); assert.equal(r.calls.contexts[0].state, 'suspended');
  player.setSettings({ tavern: false }); r.hide(false); await flush();
  assert.equal(r.active().length, 1); assert.equal(r.calls.fetches.length, 2, 'decoded recordings are reused');
  player.destroy();
});

test('global mute fades every voice and resumes requested layers once after unmuting', async () => {
  const r = rig(), player = r.player(); player.setSettings({ rain: true, tavern: true }); player.unlock(); await flush();
  player.setMuted(true); r.advance(300); await flush();
  assert.equal(r.active().length, 0); assert.equal(r.calls.contexts[0].state, 'suspended');
  player.setMuted(false); player.setMuted(false); await flush();
  assert.equal(r.active().length, 2); assert.equal(r.calls.fetches.length, 2);
  player.destroy();
});

test('zero volume releases voices and clamps malformed settings without throwing', async () => {
  const r = rig(), player = r.player(); player.setSettings({ rain: true }); player.unlock(); await flush();
  player.setSettings({ volume: 0 }); r.advance(300); await flush(); assert.equal(r.active().length, 0);
  player.setSettings({ volume: 99, rain: true }); await flush();
  assert.equal(r.active().length, 1); assert.ok(r.active()[0].connections[0].gain.value <= .35);
  assert.doesNotThrow(() => player.setSettings(null)); player.setSettings({ rain: 'false', volume: NaN });
  assert.equal(r.active().length, 1, 'invalid values do not change requested settings');
  player.destroy();
});

test('failed fetches and invalid or failed decodes remain bounded and do not prevent the other layer', async t => {
  for (const failure of ['fetch', 'decode', 'invalid']) await t.test(failure, async () => {
    let attempt = 0;
    const r = rig({ fetch: failure === 'fetch' ? async () => { if (attempt++ === 0) throw new Error('Offline'); return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; } : undefined,
      decode: failure !== 'fetch' ? async () => { if (attempt++ === 0) { if (failure === 'decode') throw new Error('Bad recording'); return { duration: NaN }; } return { duration: 60 }; } : undefined }), player = r.player();
    player.setSettings({ rain: true }); player.unlock(); await flush();
    for (let i = 0; i < 20; i++) { player.setSettings({ volume: .1 + i / 100 }); player.unlock(); }
    await flush(); r.advance(60000); assert.equal(r.calls.fetches.length, 1); assert.equal(r.active().length, 0); assert.equal(r.pending, 0);
    assert.equal(r.calls.contexts[0].state, 'suspended', 'an unusable recording must not keep an idle context running');
    player.setSettings({ tavern: true }); await flush(); assert.equal(r.active().length, 1);
    player.destroy();
  });
});

test('a rapid request while idle suspension is pending waits and resumes before creating a voice', async () => {
  const gate = deferred(), r = rig({ suspend: context => gate.promise.then(() => { context.state = 'suspended'; }) }), player = r.player();
  player.unlock(); await flush(); assert.equal(r.calls.suspends, 1);
  player.setSettings({ rain: true }); await flush();
  assert.equal(r.active().length, 0, 'a pending suspension must not freeze a newly started loop');
  gate.resolve(); await flush();
  assert.equal(r.calls.contexts[0].state, 'running'); assert.equal(r.active().length, 1); assert.equal(r.calls.resumes, 2);
  player.destroy();
});

test('destroy aborts pending fetch and closes audio once without late revival or event listeners', async () => {
  const gate = deferred(), r = rig({ fetch: () => gate.promise }), player = r.player(); player.setSettings({ rain: true }); player.unlock(); await flush();
  const signal = r.calls.fetches[0].signal; player.destroy(); player.destroy();
  assert.equal(signal.aborted, true); assert.equal(r.calls.closes, 1); assert.equal(r.pending, 0);
  gate.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }); await flush();
  r.hide(true); r.hide(false); player.setSettings({ tavern: true }); player.setMuted(false); assert.equal(player.unlock(), false); await flush();
  assert.equal(r.calls.sources.length, 0); assert.equal(r.calls.fetches.length, 1);
});

test('unavailable contexts and rejected resumes never throw or retry without a new gesture', async t => {
  for (const options of [{ constructFails: true }, { resumeFails: true }]) await t.test(JSON.stringify(options), async () => {
    const r = rig(options), player = r.player(); player.setSettings({ rain: true }); assert.doesNotThrow(() => player.unlock()); await flush();
    for (let i = 0; i < 5; i++) player.setSettings({ volume: .2 }); await flush();
    assert.equal(r.active().length, 0); assert.equal(r.pending, 0); assert.ok(r.calls.resumes <= 1); player.destroy();
  });
});

test('missing fetch support disables the requested layer and suspends idle audio', async () => {
  const r = rig();
  const player = createGuildAmbience({ document: r.document, window: r.window, AudioContext: class {
    constructor() { this.state = 'suspended'; this.currentTime = 0; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; r.calls.suspends++; return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }, fetch: null });
  player.setSettings({ rain: true }); assert.doesNotThrow(() => player.unlock()); await flush();
  assert.equal(r.calls.suspends, 1); player.destroy();
});
