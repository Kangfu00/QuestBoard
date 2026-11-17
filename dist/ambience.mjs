// Local, pre-crossfaded recordings. One looping source per requested layer.
const RECORDINGS = {
  rain: { path: './audio/ambience/rain.wav', gain: .32 },
  tavern: { path: './audio/ambience/tavern.wav', gain: .6 },
};
const FADE_SECONDS = .18;

export function createGuildAmbience({
  document = globalThis.document,
  window = globalThis.window ?? globalThis,
  AudioContext = window?.AudioContext ?? window?.webkitAudioContext,
  fetch: fetchRecording = window?.fetch?.bind(window) ?? globalThis.fetch?.bind(globalThis),
  setTimeout: schedule = window?.setTimeout?.bind(window) ?? globalThis.setTimeout,
  clearTimeout: cancelTimer = window?.clearTimeout?.bind(window) ?? globalThis.clearTimeout,
  onStatus = () => {},
} = {}) {
  const settings = { rain: false, tavern: false, volume: .3, rainVolume: 1, tavernVolume: 1 };
  let context = null, unlocked = false, muted = false, destroyed = false;
  let statusSignature = '';
  let resumePending = null, suspendPending = null, resumeBlocked = false;
  const layers = Object.fromEntries(Object.entries(RECORDINGS).map(([name, recording]) =>
    [name, { name, ...recording, buffer: null, loading: null, failed: false, controller: null, voice: null }]));

  const allowed = () => !destroyed && unlocked && !muted && !document?.hidden && settings.volume > 0;
  const requested = layer => allowed() && settings[layer.name] && settings[`${layer.name}Volume`] > 0;
  const usableRequested = () => Object.values(layers).some(layer => requested(layer) && !layer.failed);
  const ignoreRejection = result => result?.catch?.(() => {});
  const level = layer => layer.gain * settings.volume * settings[`${layer.name}Volume`];
  function getStatus() {
    return Object.fromEntries(Object.values(layers).map(layer => [layer.name,
      destroyed || !settings[layer.name] ? 'off' : muted ? 'muted' : document?.hidden ? 'paused' :
      settings.volume === 0 || settings[`${layer.name}Volume`] === 0 ? 'quiet' : layer.failed ? 'error' :
      layer.voice && layer.voice.timer === null ? 'playing' : layer.loading ? 'loading' : 'waiting'
    ]));
  }
  function publishStatus() {
    const status = getStatus(), signature = JSON.stringify(status);
    if (signature === statusSignature) return;
    statusSignature = signature;
    try { onStatus(status); } catch { /* A hint cannot interrupt audio cleanup. */ }
  }

  function suspendIdle() {
    if (destroyed || !context || usableRequested() || resumePending || suspendPending || Object.values(layers).some(layer => layer.voice)) return;
    try {
      if (context.state !== 'running') return;
      suspendPending = Promise.resolve(context.suspend()).then(() => {
        suspendPending = null;
        // A request can arrive while the browser is still completing suspend().
        if (!destroyed && usableRequested()) reconcile();
      }, () => { suspendPending = null; });
    } catch { suspendPending = null; }
  }

  function ramp(voice, value) {
    const parameter = voice.gain.gain, time = context.currentTime;
    // Holding the instantaneous value makes rapid toggles/slider changes continuous.
    if (typeof parameter.cancelAndHoldAtTime === 'function') parameter.cancelAndHoldAtTime(time);
    else { parameter.cancelScheduledValues(time); parameter.setValueAtTime(parameter.value, time); }
    parameter.linearRampToValueAtTime(value, time + FADE_SECONDS);
  }

  function release(layer, immediate = false) {
    const voice = layer.voice;
    if (!voice) return;
    if (!immediate) {
      if (voice.timer !== null) return;
      try { ramp(voice, 0); } catch { release(layer, true); return; }
      voice.timer = schedule(() => { voice.timer = null; release(layer, true); suspendIdle(); }, FADE_SECONDS * 1000 + 10);
      return;
    }
    layer.voice = null;
    if (voice.timer !== null) cancelTimer(voice.timer);
    voice.source.onended = null;
    try { voice.source.stop(); } catch { /* Already ended. */ }
    for (const node of [voice.source, voice.gain]) { try { node.disconnect(); } catch { /* Already detached. */ } }
  }

  function load(layer) {
    if (layer.buffer || layer.loading || layer.failed) return;
    if (typeof fetchRecording !== 'function') { layer.failed = true; return; }
    const audio = context;
    layer.controller = new AbortController();
    layer.loading = Promise.resolve().then(() => {
      if (destroyed || layer.controller.signal.aborted) return null;
      return fetchRecording(new URL(layer.path, import.meta.url), { signal: layer.controller.signal });
    }).then(async response => {
      if (!response || destroyed) return null;
      if (!response.ok) throw new Error('Ambience recording unavailable');
      const bytes = await response.arrayBuffer();
      if (destroyed) return null;
      return audio.decodeAudioData(bytes);
    }).then(buffer => {
      if (destroyed) return;
      if (!buffer || !Number.isFinite(buffer.duration) || buffer.duration <= 0) throw new Error('Invalid ambience recording');
      layer.buffer = buffer;
    }).catch(() => { layer.failed = true; }).finally(() => {
      layer.loading = null; layer.controller = null;
      // Loading completion can never override the latest mute/visibility/settings.
      if (!destroyed) reconcile();
    });
  }

  function start(layer) {
    if (layer.voice || !layer.buffer || !requested(layer) || context.state !== 'running' || resumePending || suspendPending) return;
    let source, gain;
    try {
      source = context.createBufferSource(); gain = context.createGain();
      source.buffer = layer.buffer; source.loop = true;
      gain.gain.setValueAtTime(0, context.currentTime);
      source.connect(gain); gain.connect(context.destination);
      const voice = { source, gain, timer: null };
      layer.voice = voice;
      source.onended = () => { if (layer.voice === voice) { release(layer, true); suspendIdle(); publishStatus(); } };
      source.start(); ramp(voice, level(layer));
    } catch {
      layer.failed = true;
      if (layer.voice) release(layer, true);
      else for (const node of [source, gain]) { try { node?.disconnect(); } catch { /* Partial construction. */ } }
    }
  }

  function resume(force = false) {
    if (!context || destroyed || resumePending || suspendPending || (resumeBlocked && !force)) return;
    if (context.state === 'closed') { resumeBlocked = true; return; }
    resumeBlocked = false;
    try {
      // Invoke synchronously so unlock() retains the browser's user activation.
      resumePending = Promise.resolve(context.resume()).then(() => {
        resumePending = null;
        if (!destroyed) { reconcile(); suspendIdle(); }
      }, () => { resumePending = null; resumeBlocked = true; publishStatus(); });
    } catch { resumePending = null; resumeBlocked = true; publishStatus(); }
  }

  function reconcile() {
    if (destroyed) return;
    try {
    for (const layer of Object.values(layers)) {
      if (!requested(layer)) release(layer, Boolean(document?.hidden));
      else if (layer.voice) {
        if (layer.voice.timer !== null) { cancelTimer(layer.voice.timer); layer.voice.timer = null; }
        try { ramp(layer.voice, level(layer)); } catch { release(layer, true); }
      }
    }
    if (!context || !usableRequested()) { suspendIdle(); return; }
    if (suspendPending) return;
    if (resumeBlocked) return;
    if (context.state !== 'running') { resume(); return; }
    if (resumePending) return;
    for (const layer of Object.values(layers)) if (requested(layer) && !layer.failed) {
      if (layer.buffer) start(layer);
      else load(layer);
    }
    suspendIdle();
    } finally { publishStatus(); }
  }

  function unlock() {
    if (destroyed || document?.hidden || window?.navigator?.userActivation?.isActive === false) return false;
    if (!context) {
      if (typeof AudioContext !== 'function') return false;
      try { context = new AudioContext(); } catch { return false; }
    }
    unlocked = true;
    if (context.state !== 'running' || resumeBlocked) resume(true);
    reconcile();
    return !resumeBlocked;
  }

  function setSettings(patch) {
    if (destroyed || !patch || typeof patch !== 'object') return;
    for (const name of ['rain', 'tavern']) if (typeof patch[name] === 'boolean') {
      // Only an explicit off/on choice retries a failed file, never slider noise.
      if (patch[name] && !settings[name]) layers[name].failed = false;
      settings[name] = patch[name];
    }
    for (const name of ['volume','rainVolume','tavernVolume']) if (Number.isFinite(patch[name])) settings[name] = Math.max(0, Math.min(1, patch[name]));
    reconcile();
  }

  function setMuted(value) { if (!destroyed) { muted = Boolean(value); reconcile(); } }
  const visibilityChange = () => reconcile();
  document?.addEventListener('visibilitychange', visibilityChange);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    document?.removeEventListener('visibilitychange', visibilityChange);
    for (const layer of Object.values(layers)) {
      layer.controller?.abort(); release(layer, true); layer.buffer = null;
    }
    try { ignoreRejection(context?.close()); } catch { /* Closing cannot interrupt desk cleanup. */ }
    publishStatus();
  }

  publishStatus();
  return { setSettings, unlock, setMuted, getStatus, destroy };
}
