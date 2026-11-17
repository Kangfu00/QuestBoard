import test from 'node:test';
import assert from 'node:assert/strict';

import { createDaypartAmbience } from '../dist/daypart-ambience.mjs';
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

// Only browser audio, network, and time boundaries are replaced. Player decisions are real.
function rig(options = {}) {
  let milliseconds = 0, nextTimer = 0;
  const timers = new Map(), events = new EventTarget();
  const calls = { contexts: [], sources: [], gains: [], fetches: [], resumes: 0, suspends: 0, closes: 0, decodes: 0 };
  const document = { hidden: false, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events) };
  const window = { navigator: { userActivation: { isActive: true } } };
  const parameter = () => {
    let automation = [];
    const parameter = {
      value: 0, scheduled: [],
      at(time) {
        let previous = { time: 0, value: 0 };
        for (const event of automation) {
          if (event.time > time) return event.type === 'ramp' ? previous.value + (event.value - previous.value) * (time - previous.time) / (event.time - previous.time) : previous.value;
          previous = event;
        }
        return previous.value;
      },
      cancelScheduledValues(time) { automation = automation.filter(event => event.time < time); this.scheduled.push(['cancel', time]); },
      setValueAtTime(value, time) { automation.push({ type: 'set', value, time }); this.value = value; this.scheduled.push(['set', value, time]); },
      linearRampToValueAtTime(value, time) { automation.push({ type: 'ramp', value, time }); this.value = value; this.scheduled.push(['ramp', value, time]); },
    };
    if (!options.noHold) parameter.cancelAndHoldAtTime = function(time) {
      const value = this.at(time); automation = automation.filter(event => event.time < time); automation.push({ type: 'set', value, time });
      this.scheduled.push(['hold', time]);
    };
    return parameter;
  };
  const node = () => ({ disconnected: false, connections: [], connect(other) { this.connections.push(other); }, disconnect() { this.disconnected = true; } });
  class AudioContext {
    constructor() { if (options.constructFails) throw new Error('Audio unavailable'); this.state = 'suspended'; this.destination = {}; calls.contexts.push(this); }
    get currentTime() { return milliseconds / 1000; }
    createGain() { const gain = { ...node(), gain: parameter() }; calls.gains.push(gain); return gain; }
    createBufferSource() { const source = { ...node(), started: false, stopped: false, loop: false, onended: null, start() { if (options.startFails) throw new Error('Cannot start'); assert.ok(this.buffer?.duration > 0); this.started = true; }, stop() { this.stopped = true; } }; calls.sources.push(source); return source; }
    decodeAudioData(bytes) { calls.decodes++; return options.decode?.(bytes) ?? Promise.resolve({ duration: 60, phase: bytes.phase }); }
    resume() { calls.resumes++; if (options.resumeFails) return Promise.reject(new Error('Gesture required')); this.state = 'running'; return options.resume?.(this) ?? Promise.resolve(); }
    suspend() { calls.suspends++; if (options.suspend) return options.suspend(this); this.state = 'suspended'; return Promise.resolve(); }
    close() { calls.closes++; this.state = 'closed'; return Promise.resolve(); }
  }
  const player = () => createDaypartAmbience({ document, window, AudioContext, onStatus: options.onStatus,
    fetch: async (url, init) => { calls.fetches.push({ url: String(url), signal: init?.signal }); if (options.fetch) return options.fetch(url, init); return response(String(url).split('/').at(-1).slice(0, -4)); },
    setTimeout(callback, delay) { timers.set(++nextTimer, { at: milliseconds + delay, callback }); return nextTimer; }, clearTimeout(id) { timers.delete(id); },
  });
  return { calls, document, window, player,
    hide(hidden) { document.hidden = hidden; events.dispatchEvent(new Event('visibilitychange')); },
    advance(ms) { milliseconds += ms; for (const [id, timer] of [...timers]) if (timer.at <= milliseconds) { timers.delete(id); timer.callback(); } },
    get pending() { return timers.size; }, get now() { return milliseconds / 1000; }, active: () => calls.sources.filter(source => source.started && !source.stopped),
  };
}
function response(phase) { return { ok: true, arrayBuffer: async () => Object.assign(new ArrayBuffer(8), { phase }) }; }
const gainOf = source => source.connections[0].gain;
function pathGain(source, time) {
  let value = 1, node = source.connections[0];
  while (node?.gain) { value *= time === undefined ? node.gain.value : node.gain.at(time); node = node.connections[0]; }
  return value;
}

test('defaults off and only an active user gesture can start the requested local clock recording', async () => {
  assert.equal(typeof createDaypartAmbience, 'function', 'the daypart player factory must exist');
  const r = rig(), player = r.player();
  assert.deepEqual(player.getStatus(), { soundscape: 'off' });
  player.setPhase('morning'); player.setSettings({ soundscape: 'auto' }); await flush();
  assert.deepEqual(player.getStatus(), { soundscape: 'waiting' }); assert.equal(r.calls.contexts.length, 0);
  r.window.navigator.userActivation.isActive = false;
  assert.equal(player.unlock(), false); assert.equal(r.calls.contexts.length, 0);
  r.window.navigator.userActivation.isActive = true;
  assert.equal(player.unlock(), true); assert.equal(r.calls.resumes, 1, 'resume must run synchronously inside the gesture'); await flush();
  assert.equal(r.active().length, 1); assert.equal(r.active()[0].buffer.phase, 'morning'); assert.equal(r.active()[0].loop, true);
  assert.ok(r.calls.fetches[0].url.endsWith('/dist/audio/ambience/morning.wav'));
  assert.equal(player.getStatus().soundscape, 'playing');
  assert.ok(pathGain(r.active()[0]) >= .12 && pathGain(r.active()[0]) <= .15, 'default mix stays audible with conservative headroom');
  player.destroy();
});

test('manual previews follow their own setting while auto always uses the latest real clock phase', async () => {
  const r = rig(), player = r.player(); player.setPhase('morning'); player.setSettings({ soundscape: 'night' }); player.unlock(); await flush();
  const night = r.active()[0]; assert.equal(night.buffer.phase, 'night');
  player.setPhase('day'); player.setPhase('evening'); await flush();
  assert.deepEqual(r.active(), [night]); assert.equal(r.calls.fetches.length, 1);
  player.setSettings({ soundscape: 'auto' }); await flush();
  assert.ok(r.active().some(source => source.buffer.phase === 'evening'));
  player.setPhase('invalid'); player.setSettings({ soundscape: 'invalid', volume: NaN, soundscapeVolume: '0' }); await flush();
  r.advance(2600); assert.equal(r.active().length, 1); assert.equal(r.active()[0].buffer.phase, 'evening');
  player.destroy();
});

test('keeps the old recording audible until the incoming buffer is ready and then crossfades for about 2.5 seconds', async () => {
  const gate = deferred(), r = rig({ fetch: url => String(url).endsWith('day.wav') ? gate.promise : response('morning') }), player = r.player();
  player.setPhase('morning'); player.setSettings({ soundscape: 'auto' }); player.unlock(); await flush(); r.advance(300);
  const morning = r.active()[0]; player.setPhase('day'); await flush(); r.advance(5000);
  assert.equal(player.getStatus().soundscape, 'loading'); assert.deepEqual(r.active(), [morning]); assert.ok(gainOf(morning).value > 0);
  gate.resolve(response('day')); await flush();
  assert.equal(r.active().length, 2); const day = r.active().find(source => source !== morning);
  assert.equal(day.buffer.phase, 'day'); assert.equal(player.getStatus().soundscape, 'playing');
  assert.ok(gainOf(day).scheduled.some(event => event[0] === 'ramp' && event[2] >= 7.7 && event[2] <= 7.9));
  r.advance(2400); assert.equal(morning.stopped, false);
  r.advance(200); assert.equal(morning.stopped, true); assert.equal(morning.disconnected, true); assert.equal(morning.connections[0].disconnected, true);
  assert.deepEqual(r.active(), [day]); assert.equal(r.pending, 0); player.destroy();
});

test('out of order loads and decodes cannot start stale phases or poison a newer request', async () => {
  const morning = deferred(), day = deferred(), decode = deferred();
  const r = rig({ fetch: url => String(url).endsWith('morning.wav') ? morning.promise : String(url).endsWith('day.wav') ? day.promise : response('night'), decode: bytes => bytes.phase === 'day' ? decode.promise : Promise.resolve({ duration: 60, phase: bytes.phase }) }), player = r.player();
  player.setPhase('morning'); player.setSettings({ soundscape: 'auto' }); player.unlock(); await flush();
  player.setPhase('day'); await flush(); assert.equal(r.calls.fetches[0].signal.aborted, true);
  day.resolve(response('day')); await flush();
  player.setPhase('night'); await flush(); assert.equal(r.active().length, 1); assert.equal(r.active()[0].buffer.phase, 'night');
  morning.reject(new Error('Obsolete network error')); decode.resolve({ duration: 60, phase: 'day' }); await flush();
  assert.equal(r.calls.sources.length, 1); assert.equal(player.getStatus().soundscape, 'playing');
  assert.equal(r.pending, 0); player.destroy();
});

test('rapid A B A reuses voices and A B C replaces the oldest voice with at most two active sources', async () => {
  const r = rig(), player = r.player(); player.setSettings({ soundscape: 'morning' }); player.unlock(); await flush(); r.advance(300);
  const morning = r.active()[0]; player.setSettings({ soundscape: 'day' }); await flush(); r.advance(500);
  const day = r.active().find(source => source !== morning);
  player.setSettings({ soundscape: 'morning' }); await flush();
  assert.equal(r.calls.sources.length, 2); assert.equal(morning.stopped, false); assert.equal(r.pending, 1);
  assert.ok(gainOf(morning).scheduled.some(event => event[0] === 'hold'), 'reversal holds the instantaneous ramp value');
  player.setSettings({ soundscape: 'evening' }); await flush();
  assert.equal(r.active().length, 2); assert.equal(day.stopped, true); assert.equal(day.disconnected, true);
  assert.equal(r.pending, 1); r.advance(2600);
  assert.equal(r.active().length, 1); assert.equal(r.active()[0].buffer.phase, 'evening'); assert.equal(r.pending, 0); player.destroy();
});

test('fallback ramp cancellation holds the interpolated value instead of jumping to the scheduled endpoint', async () => {
  const r = rig({ noHold: true }), player = r.player(); player.setSettings({ soundscape: 'morning', volume: 1 }); player.unlock(); await flush(); r.advance(300);
  const morning = r.active()[0]; player.setSettings({ soundscape: 'day' }); await flush(); r.advance(500);
  player.setSettings({ soundscape: 'morning' }); await flush();
  const sets = gainOf(morning).scheduled.filter(event => event[0] === 'set');
  assert.ok(sets.at(-1)[1] > .3 && sets.at(-1)[1] < .4, '500ms into a 2.5s fade the morning level is about 80 percent');
  player.destroy();
});

test('master and soundscape faders clamp levels, keep one loop, and zero fades quickly', async () => {
  const r = rig(), player = r.player(); player.setSettings({ soundscape: 'day', volume: 99, soundscapeVolume: .5 }); player.unlock(); await flush(); r.advance(300);
  const source = r.active()[0], before = pathGain(source);
  assert.ok(before >= .2 && before <= .25); player.setSettings({ volume: .5 });
  assert.equal(pathGain(source), before / 2); assert.equal(r.calls.sources.length, 1);
  player.setSettings({ soundscapeVolume: 0 }); assert.equal(player.getStatus().soundscape, 'quiet'); r.advance(300); await flush();
  assert.equal(source.stopped, true); assert.equal(r.pending, 0); assert.equal(r.calls.contexts[0].state, 'suspended');
  player.setSettings({ soundscapeVolume: 1 }); await flush(); assert.equal(r.active().length, 1); assert.equal(r.calls.fetches.length, 1);
  assert.doesNotThrow(() => player.setSettings(null)); player.destroy();
});

test('off mute and zero cancel pending decode without late starts and publish the actual reason', async t => {
  for (const [cancel, wanted] of [['off', 'off'], ['mute', 'muted'], ['master', 'quiet'], ['fader', 'quiet']]) await t.test(cancel, async () => {
    const gate = deferred(), r = rig({ decode: () => gate.promise }), player = r.player();
    player.setSettings({ soundscape: 'day' }); player.unlock(); await flush();
    if (cancel === 'off') player.setSettings({ soundscape: 'off' });
    else if (cancel === 'mute') player.setMuted(true);
    else player.setSettings(cancel === 'master' ? { volume: 0 } : { soundscapeVolume: 0 });
    assert.equal(player.getStatus().soundscape, wanted); assert.equal(r.calls.fetches[0].signal.aborted, true);
    gate.resolve({ duration: 60, phase: 'day' }); await flush(); r.advance(1000);
    assert.equal(r.active().length, 0); assert.equal(r.pending, 0); player.destroy();
  });
});

test('mute and off fade both crossfade voices promptly while rapid reenable reuses the requested voice', async () => {
  const r = rig(), player = r.player(); player.setSettings({ soundscape: 'day' }); player.unlock(); await flush();
  player.setSettings({ soundscape: 'night' }); await flush(); const originals = [...r.active()];
  player.setMuted(true); assert.equal(player.getStatus().soundscape, 'muted'); r.advance(50); player.setMuted(false); await flush();
  assert.equal(r.calls.sources.length, 2); r.advance(300); await flush();
  assert.equal(r.active().length, 1); assert.equal(r.active()[0].buffer.phase, 'night');
  player.setSettings({ soundscape: 'off' }); r.advance(300); await flush();
  assert.ok(originals.every(source => source.stopped && source.disconnected)); assert.equal(r.pending, 0); assert.equal(r.calls.contexts[0].state, 'suspended'); player.destroy();
});

test('muting during a crossfade replaces the long outgoing ramp with a prompt fade', async () => {
  const r = rig(), player = r.player(); player.setSettings({ soundscape: 'morning' }); player.unlock(); await flush(); r.advance(300);
  const morning = r.active()[0]; player.setSettings({ soundscape: 'day' }); await flush(); r.advance(500);
  player.setMuted(true);
  const lastRamp = gainOf(morning).scheduled.filter(event => event[0] === 'ramp').at(-1);
  assert.equal(lastRamp[1], 0); assert.ok(lastRamp[2] >= .97 && lastRamp[2] <= .99, 'mute must replace the 2.8s endpoint with a .98s endpoint');
  r.advance(300); assert.equal(r.active().length, 0); assert.equal(r.pending, 0); player.destroy();
});

test('hidden stops and aborts immediately and visibility return waits for the newest same-event clock phase', async () => {
  const gate = deferred(), r = rig({ fetch: url => String(url).endsWith('day.wav') ? gate.promise : response(String(url).split('/').at(-1).slice(0, -4)) }), player = r.player();
  player.setPhase('morning'); player.setSettings({ soundscape: 'auto' }); player.unlock(); await flush();
  player.setPhase('day'); await flush(); r.hide(true);
  assert.equal(r.active().length, 0); assert.equal(r.pending, 0); assert.equal(r.calls.fetches[1].signal.aborted, true); assert.equal(player.getStatus().soundscape, 'paused');
  await flush(); const before = r.calls.sources.length;
  r.hide(false); player.setPhase('night'); await flush();
  assert.equal(r.calls.sources.length, before + 1); assert.equal(r.active()[0].buffer.phase, 'night');
  gate.resolve(response('day')); await flush(); assert.equal(r.active().length, 1); player.destroy();
});

test('visibility return cannot briefly start the old cached phase when suspension was rejected', async () => {
  const r = rig({ suspend: () => Promise.reject(Error('Suspend unavailable')) }), player = r.player();
  player.setPhase('morning'); player.setSettings({ soundscape: 'auto' }); player.unlock(); await flush();
  r.hide(true); await flush(); assert.equal(r.calls.contexts[0].state, 'running');
  const before = r.calls.sources.length;
  r.hide(false); player.setPhase('night'); await flush();
  assert.equal(r.calls.sources.length, before + 1); assert.equal(r.active()[0].buffer.phase, 'night'); player.destroy();
});

test('failed files stay bounded across clock changes and sliders and retry only after explicit off then on', async t => {
  for (const kind of ['fetch', 'decode', 'invalid', 'start']) await t.test(kind, async () => {
    let attempts = 0;
    const r = rig({ fetch: async url => { attempts++; if (kind === 'fetch' && attempts === 1) throw new Error('Offline'); return response(String(url).split('/').at(-1).slice(0, -4)); }, decode: kind === 'decode' || kind === 'invalid' ? async bytes => { if (attempts === 1) { if (kind === 'decode') throw new Error('Invalid recording'); return { duration: 0 }; } return { duration: 60, phase: bytes.phase }; } : undefined, startFails: kind === 'start' }), player = r.player();
    player.setPhase('day'); player.setSettings({ soundscape: 'auto' }); player.unlock(); await flush();
    assert.equal(player.getStatus().soundscape, 'error');
    for (let i = 0; i < 8; i++) { player.setPhase('day'); player.setSettings({ volume: .2 + i / 100 }); player.unlock(); }
    await flush(); assert.equal(attempts, 1); assert.equal(r.pending, 0); assert.equal(r.active().length, 0);
    player.setPhase('night'); await flush(); player.setPhase('day'); await flush();
    assert.equal(attempts, 2, 'returning to a failed phase must not retry it');
    player.setSettings({ soundscape: 'off' }); r.advance(300); await flush(); player.setSettings({ soundscape: 'auto' }); await flush();
    if (kind !== 'start') { assert.equal(attempts, 3); assert.equal(player.getStatus().soundscape, 'playing'); }
    else assert.equal(player.getStatus().soundscape, 'error');
    player.destroy();
  });
});

test('failed incoming recording retains the previous playing source and exposes error without timer or retry loops', async () => {
  const r = rig({ fetch: url => String(url).endsWith('day.wav') ? Promise.reject(Error('Unavailable')) : response('morning') }), player = r.player();
  player.setSettings({ soundscape: 'morning' }); player.unlock(); await flush(); const morning = r.active()[0];
  player.setSettings({ soundscape: 'day' }); await flush(); r.advance(60000);
  assert.deepEqual(r.active(), [morning]); assert.equal(player.getStatus().soundscape, 'error'); assert.equal(r.calls.fetches.length, 2); assert.equal(r.pending, 0); player.destroy();
});

test('pending suspension serializes the next resume and never starts a source into a suspending context', async () => {
  const gate = deferred(), r = rig({ suspend: context => gate.promise.then(() => { context.state = 'suspended'; }) }), player = r.player();
  player.unlock(); await flush(); assert.equal(r.calls.suspends, 1);
  player.setSettings({ soundscape: 'night' }); await flush(); assert.equal(r.active().length, 0);
  gate.resolve(); await flush(); assert.equal(r.calls.resumes, 2); assert.equal(r.active().length, 1); assert.equal(r.calls.contexts[0].state, 'running'); player.destroy();
});

test('a rejected pending suspension releases the latest request without waiting for another UI event', async () => {
  const gate = deferred(), r = rig({ suspend: () => gate.promise }), player = r.player();
  player.unlock(); await flush(); player.setSettings({ soundscape: 'night' }); await flush();
  assert.equal(r.active().length, 0); gate.reject(Error('Suspend unavailable')); await flush();
  assert.equal(r.active().length, 1); assert.equal(r.active()[0].buffer.phase, 'night'); assert.equal(player.getStatus().soundscape, 'playing'); player.destroy();
});

test('unavailable and rejected contexts fail safely without retries until another gesture', async t => {
  for (const options of [{ constructFails: true }, { resumeFails: true }]) await t.test(JSON.stringify(options), async () => {
    const r = rig(options), player = r.player(); player.setSettings({ soundscape: 'day' }); assert.doesNotThrow(() => player.unlock()); await flush();
    for (let i = 0; i < 8; i++) player.setSettings({ volume: .2 }); await flush();
    assert.equal(player.getStatus().soundscape, 'error'); assert.equal(r.active().length, 0); assert.equal(r.pending, 0); assert.ok(r.calls.resumes <= 1); player.destroy();
  });
});

test('a resume that completes without a running context reports error instead of creating a retry loop', async () => {
  let attempts = 0;
  const r = rig({ resume: context => { context.state = 'suspended'; return ++attempts === 1 ? Promise.resolve() : Promise.reject(Error('Unexpected second resume')); } }), player = r.player();
  player.setSettings({ soundscape: 'day' }); player.unlock(); await flush();
  assert.equal(r.calls.resumes, 1); assert.equal(player.getStatus().soundscape, 'error'); assert.equal(r.active().length, 0);
  player.setSettings({ volume: .4 }); await flush(); assert.equal(r.calls.resumes, 1); player.destroy();
});

test('missing fetch reports error and suspends idle audio without throwing', async () => {
  const r = rig(); const player = createDaypartAmbience({ document: r.document, window: r.window, fetch: null, AudioContext: class {
    constructor() { this.state = 'suspended'; this.currentTime = 0; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; r.calls.suspends++; return Promise.resolve(); }
    close() { return Promise.resolve(); }
  } });
  player.setSettings({ soundscape: 'day' }); assert.doesNotThrow(() => player.unlock()); await flush();
  assert.equal(player.getStatus().soundscape, 'error'); assert.equal(r.calls.suspends, 1); player.destroy();
});

test('source end and throwing status listeners cannot leave stale playing hints or prevent cleanup', async () => {
  const statuses = [], r = rig({ onStatus(status) { statuses.push(status.soundscape); if (status.soundscape === 'playing') throw Error('UI callback'); } }), player = r.player();
  player.setSettings({ soundscape: 'day' }); player.unlock(); await flush();
  r.active()[0].onended(); assert.equal(player.getStatus().soundscape, 'waiting'); assert.equal(statuses.at(-1), 'waiting');
  player.destroy(); assert.equal(statuses.at(-1), 'off'); assert.equal(r.pending, 0);
});

test('destroy aborts fetch and closes once with no late decodes sources timers or visibility revival', async () => {
  const gate = deferred(), r = rig({ fetch: () => gate.promise }), player = r.player(); player.setSettings({ soundscape: 'day' }); player.unlock(); await flush();
  player.destroy(); player.destroy(); assert.equal(r.calls.fetches[0].signal.aborted, true); assert.equal(r.calls.closes, 1); assert.equal(r.pending, 0);
  gate.resolve(response('day')); await flush(); r.hide(true); r.hide(false); player.setSettings({ soundscape: 'night' }); player.setPhase('night'); player.setMuted(false);
  assert.equal(player.unlock(), false); await flush(); assert.equal(r.calls.sources.length, 0); assert.equal(r.calls.decodes, 0); assert.equal(r.calls.fetches.length, 1); assert.equal(player.getStatus().soundscape, 'off');
});

test('changing the selected mode reports real playing state even when it reuses the same recording', async () => {
  const statuses=[],r=rig({onStatus:status=>statuses.push({...status})}),player=r.player();
  player.setPhase('day');player.setSettings({soundscape:'auto'});player.unlock();await flush();
  assert.equal(player.getStatus().soundscape,'playing');const source=r.active()[0];statuses.length=0;
  player.setSettings({soundscape:'day'});
  assert.deepEqual(statuses,[{soundscape:'playing'}],'the selector clears its prior hint and needs fresh real feedback');
  assert.equal(r.active()[0],source);assert.equal(r.calls.sources.length,1,'same-phase preview must not restart playback');
  player.destroy();
});

test('both faders control every crossfade voice without extending cleanup, including rapid reversals', async t => {
  for (const fader of ['volume', 'soundscapeVolume']) for (const noHold of [false, true]) await t.test(`${fader} ${noHold ? 'fallback' : 'native hold'}`, async () => {
    const r = rig({ noHold }), player = r.player();
    player.setSettings({ soundscape: 'morning', volume: 1, soundscapeVolume: 1 }); player.unlock(); await flush(); r.advance(300);
    const morning = r.active()[0]; player.setSettings({ soundscape: 'day' }); await flush(); r.advance(100);
    const voices = [...r.active()]; assert.equal(voices.length, 2);
    const mixed = () => voices.reduce((sum, source) => sum + pathGain(source, r.now), 0);
    player.setSettings({ [fader]: .01 }); r.advance(180);
    assert.ok(pathGain(morning, r.now) <= .0045 + 1e-10, 'the outgoing phase must obey the reduced mix level after the short fader ramp');
    assert.ok(mixed() <= .0045 + 1e-10, 'incoming and outgoing phases share the same requested mix level');

    player.setSettings({ [fader]: .9 }); r.advance(60);
    const rising = mixed(); player.setSettings({ [fader]: .02 });
    assert.ok(Math.abs(mixed() - rising) < 1e-10, 'a rapid fader reversal holds the instantaneous mix level');
    r.advance(40); const falling = mixed(); player.setSettings({ [fader]: .8 });
    assert.ok(Math.abs(mixed() - falling) < 1e-10, 'another reversal must not compound ratios or jump');
    r.advance(180); assert.ok(Math.abs(mixed() - .36) < 1e-10, 'the final mix reaches the requested absolute level');
    player.setSettings({ [fader]: .01 }); r.advance(180);
    assert.ok(mixed() <= .0045 + 1e-10); assert.equal(r.calls.sources.length, 2); assert.equal(r.pending, 1);
    r.advance(2809 - r.now * 1000); assert.equal(morning.stopped, false, 'faders must preserve the original outgoing cleanup deadline');
    r.advance(2); assert.equal(morning.stopped, true); assert.equal(r.active().length, 1); assert.equal(r.pending, 0);
    const nodes = r.calls.gains; player.destroy(); assert.ok(nodes.every(node => node.disconnected), 'destroy disconnects the shared mix bus as well as phase gains');
  });
});
