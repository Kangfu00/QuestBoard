const PHASES = ['morning', 'day', 'evening', 'night'];
const CROSSFADE_SECONDS = 2.5;
const FADE_SECONDS = .18;
// The local recordings peak at -12 dBFS; this leaves room for rain and tavern.
const RECORDING_GAIN = .45;

export function createDaypartAmbience({
  document = globalThis.document,
  window = globalThis.window ?? globalThis,
  AudioContext = window?.AudioContext ?? window?.webkitAudioContext,
  fetch: fetchRecording = window?.fetch?.bind(window) ?? globalThis.fetch?.bind(globalThis),
  setTimeout: schedule = window?.setTimeout?.bind(window) ?? globalThis.setTimeout,
  clearTimeout: cancelTimer = window?.clearTimeout?.bind(window) ?? globalThis.clearTimeout,
  onStatus = () => {},
} = {}) {
  const settings = { soundscape: 'off', volume: .3, soundscapeVolume: 1 };
  const recordings = Object.fromEntries(PHASES.map(phase => [phase, { phase, buffer: null, job: null, failed: false }]));
  const voices = [];
  let phase = 'day', context = null, current = null, mix = null;
  let unlocked = false, muted = false, destroyed = false, contextFailed = false;
  let resumePending = null, suspendPending = null, resumeBlocked = false, visibilityPending = false;
  let statusSignature = '';

  const target = () => recordings[settings.soundscape === 'auto' ? phase : settings.soundscape] ?? null;
  const allowed = () => !destroyed && unlocked && !muted && !document?.hidden && !visibilityPending &&
    settings.soundscape !== 'off' && settings.volume > 0 && settings.soundscapeVolume > 0;
  const usableRequested = () => allowed() && !target()?.failed && !contextFailed && !resumeBlocked;
  const mixLevel = () => settings.volume * settings.soundscapeVolume;

  function getStatus() {
    const recording = target();
    return { soundscape:
      destroyed || !recording ? 'off' : muted ? 'muted' : document?.hidden ? 'paused' :
      settings.volume === 0 || settings.soundscapeVolume === 0 ? 'quiet' :
      recording.failed || contextFailed || resumeBlocked ? 'error' :
      current?.recording === recording && current.timer === null && context?.state === 'running' && !resumePending && !suspendPending ? 'playing' :
      recording.job ? 'loading' : 'waiting'
    };
  }

  function publishStatus() {
    const status = getStatus(), signature = JSON.stringify([settings.soundscape, target()?.phase, status.soundscape]);
    if (signature === statusSignature) return;
    statusSignature = signature;
    try { onStatus(status); } catch { /* A UI hint cannot interrupt audio cleanup. */ }
  }

  function suspendIdle() {
    if (destroyed || !context || usableRequested() || voices.length || resumePending || suspendPending || context.state !== 'running') return;
    const settled = () => {
      suspendPending = null;
      // Requests queued behind suspend must continue even if the browser rejects it.
      if (!destroyed && usableRequested()) reconcile();
    };
    try {
      suspendPending = Promise.resolve(context.suspend()).then(settled, settled);
    } catch { suspendPending = null; }
  }

  function heldLevel(voice, time) {
    const envelope = voice.envelope;
    if (time >= envelope.end) return envelope.to;
    if (time <= envelope.start) return envelope.from;
    return envelope.from + (envelope.to - envelope.from) * (time - envelope.start) / (envelope.end - envelope.start);
  }

  function ramp(voice, value, seconds, replace = false) {
    if (voice.envelope.to === value && !replace) return;
    const parameter = voice.gain.gain, time = context.currentTime, held = heldLevel(voice, time);
    if (typeof parameter.cancelAndHoldAtTime === 'function') parameter.cancelAndHoldAtTime(time);
    else {
      parameter.cancelScheduledValues(time);
      // AudioParam.value can reflect a scheduled endpoint in older implementations.
      parameter.setValueAtTime(held, time);
    }
    parameter.linearRampToValueAtTime(value, time + seconds);
    voice.envelope = { from: held, to: value, start: time, end: time + seconds };
  }

  function ensureMix() {
    if (mix) return mix;
    const gain = context.createGain(), value = mixLevel(), time = context.currentTime;
    try {
      gain.gain.setValueAtTime(value, time); gain.connect(context.destination);
    } catch (error) {
      try { gain.disconnect(); } catch { /* Partial construction. */ }
      throw error;
    }
    mix = { gain, envelope: { from: value, to: value, start: time, end: time } };
    return mix;
  }

  function cancelRelease(voice) {
    if (voice.timer !== null) cancelTimer(voice.timer);
    voice.timer = null;
  }

  function dispose(voice) {
    const index = voices.indexOf(voice);
    if (index === -1) return;
    voices.splice(index, 1);
    if (current === voice) current = null;
    cancelRelease(voice);
    voice.source.onended = null;
    try { voice.source.stop(); } catch { /* Already ended. */ }
    for (const node of [voice.source, voice.gain]) {
      try { node.disconnect(); } catch { /* Already detached. */ }
    }
  }

  function release(voice, seconds = FADE_SECONDS, immediate = false) {
    if (immediate) { dispose(voice); return; }
    // Repeated settings notifications must never postpone an existing cleanup.
    if (voice.timer !== null && voice.envelope.end <= context.currentTime + seconds) return;
    cancelRelease(voice);
    try { ramp(voice, 0, seconds, true); } catch { dispose(voice); return; }
    voice.timer = schedule(() => {
      voice.timer = null;
      dispose(voice); suspendIdle(); publishStatus();
    }, seconds * 1000 + 10);
  }

  function cancelLoads(keep = null) {
    for (const recording of Object.values(recordings)) {
      if (!recording.job || recording === keep) continue;
      const job = recording.job;
      recording.job = null;
      job.controller.abort();
    }
  }

  function load(recording) {
    if (recording.buffer || recording.job || recording.failed) return;
    if (typeof fetchRecording !== 'function') { recording.failed = true; return; }
    const job = { controller: new AbortController() }, audio = context;
    recording.job = job;
    const live = () => !destroyed && recording.job === job && !job.controller.signal.aborted;
    Promise.resolve().then(async () => {
      if (!live()) return;
      const response = await fetchRecording(new URL(`./audio/ambience/${recording.phase}.wav`, import.meta.url), { signal: job.controller.signal });
      if (!live()) return;
      if (!response?.ok) throw new Error('Soundscape recording unavailable');
      const bytes = await response.arrayBuffer();
      if (!live()) return;
      const buffer = await audio.decodeAudioData(bytes);
      if (!live()) return;
      if (!buffer || !Number.isFinite(buffer.duration) || buffer.duration <= 0) throw new Error('Invalid soundscape recording');
      recording.buffer = buffer;
    }).catch(() => { if (live()) recording.failed = true; }).finally(() => {
      if (recording.job !== job) return;
      recording.job = null;
      if (!destroyed) reconcile();
    });
  }

  function transition(recording) {
    let next = voices.find(voice => voice.recording === recording);
    const previous = current;
    if (!next) {
      // Retire the old outgoing voice before creating another, even during rapid previews.
      if (voices.length === 2) dispose(voices.find(voice => voice !== current));
      let source, gain;
      try {
        source = context.createBufferSource(); gain = context.createGain();
        source.buffer = recording.buffer; source.loop = true;
        gain.gain.setValueAtTime(0, context.currentTime);
        source.connect(gain); gain.connect(ensureMix().gain);
        next = { recording, source, gain, timer: null, envelope: { from: 0, to: 0, start: context.currentTime, end: context.currentTime } };
        source.start(); voices.push(next);
        const voice = next;
        source.onended = () => { dispose(voice); suspendIdle(); publishStatus(); };
      } catch {
        recording.failed = true;
        for (const node of [source, gain]) { try { node?.disconnect(); } catch { /* Partial construction. */ } }
        try { source?.stop(); } catch { /* A failed source may never have started. */ }
        return;
      }
    }
    current = next;
    cancelRelease(next);
    try { ramp(next, RECORDING_GAIN, previous && previous !== next ? CROSSFADE_SECONDS : FADE_SECONDS); }
    catch { recording.failed = true; dispose(next); return; }
    for (const voice of [...voices]) if (voice !== next) release(voice, CROSSFADE_SECONDS);
  }

  function resume(force = false) {
    if (!context || destroyed || resumePending || suspendPending || (resumeBlocked && !force)) return;
    if (context.state === 'closed') { resumeBlocked = true; return; }
    resumeBlocked = false;
    try {
      // Synchronous invocation preserves the initiating gesture's user activation.
      resumePending = Promise.resolve(context.resume()).then(() => {
        resumePending = null;
        if (destroyed) return;
        if (context.state !== 'running' && !document?.hidden) {
          resumeBlocked = true; publishStatus(); return;
        }
        reconcile(); suspendIdle();
      }, () => { resumePending = null; resumeBlocked = true; publishStatus(); });
    } catch { resumePending = null; resumeBlocked = true; publishStatus(); }
  }

  function reconcile() {
    if (destroyed) return;
    try {
      // Shared faders change every voice without changing phase envelopes or cleanup times.
      if (mix) {
        try { ramp(mix, mixLevel(), FADE_SECONDS); }
        catch {
          contextFailed = true; cancelLoads();
          for (const voice of [...voices]) dispose(voice);
          suspendIdle(); return;
        }
      }
      if (!allowed()) {
        cancelLoads();
        for (const voice of [...voices]) release(voice, FADE_SECONDS, Boolean(document?.hidden));
        suspendIdle(); return;
      }
      const recording = target();
      cancelLoads(recording);
      if (current) {
        // Keep the old recording audible while its replacement loads.
        if (current.recording === recording) cancelRelease(current);
        if (current.envelope.to > 0 || current.recording === recording) {
          try { ramp(current, RECORDING_GAIN, FADE_SECONDS); } catch { dispose(current); }
        }
      }
      if (!context || !usableRequested()) { suspendIdle(); return; }
      if (suspendPending || resumePending || resumeBlocked) return;
      if (context.state !== 'running') { resume(); return; }
      if (current?.recording === recording) return;
      if (recording.buffer) transition(recording);
      else load(recording);
      suspendIdle();
    } finally { publishStatus(); }
  }

  function unlock() {
    if (destroyed || document?.hidden || window?.navigator?.userActivation?.isActive === false) return false;
    if (!context) {
      try {
        if (typeof AudioContext !== 'function') throw new Error('Audio unavailable');
        context = new AudioContext(); contextFailed = false;
      } catch { contextFailed = true; publishStatus(); return false; }
    }
    unlocked = true;
    if (context.state !== 'running' || resumeBlocked) resume(true);
    reconcile();
    return !resumeBlocked;
  }

  function setSettings(patch) {
    if (destroyed || !patch || typeof patch !== 'object') return;
    if (['auto', 'off', ...PHASES].includes(patch.soundscape)) {
      // Failed files retry only after an explicit off/on choice, never clock ticks or faders.
      if (settings.soundscape === 'off' && patch.soundscape !== 'off') {
        for (const recording of Object.values(recordings)) recording.failed = false;
      }
      settings.soundscape = patch.soundscape;
    }
    for (const name of ['volume', 'soundscapeVolume']) {
      if (Number.isFinite(patch[name])) settings[name] = Math.max(0, Math.min(1, patch[name]));
    }
    reconcile();
  }

  function setPhase(value) {
    if (destroyed || !PHASES.includes(value)) return;
    phase = value; reconcile();
  }

  function setMuted(value) { if (!destroyed) { muted = Boolean(value); reconcile(); } }

  const visibilityChange = () => {
    if (document?.hidden) { visibilityPending = false; reconcile(); return; }
    // The atmosphere listener refreshes the real clock later in this same event.
    visibilityPending = true;
    Promise.resolve().then(() => { visibilityPending = false; if (!destroyed) reconcile(); });
  };
  document?.addEventListener('visibilitychange', visibilityChange);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    document?.removeEventListener('visibilitychange', visibilityChange);
    cancelLoads();
    for (const voice of [...voices]) dispose(voice);
    try { mix?.gain.disconnect(); } catch { /* Already detached. */ }
    mix = null;
    for (const recording of Object.values(recordings)) recording.buffer = null;
    try { context?.close()?.catch?.(() => {}); } catch { /* Cleanup must finish even if closing fails. */ }
    publishStatus();
  }

  publishStatus();
  return { setSettings, setPhase, unlock, setMuted, getStatus, destroy };
}
