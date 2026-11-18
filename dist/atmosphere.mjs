const STORAGE_KEY = 'guild-board-atmosphere-v1';
const DEFAULTS = Object.freeze({lighting: 'auto', dust: true, rain: false, tavern: false, volume: .3, rainVolume: 1, tavernVolume: 1, soundscape: 'auto', soundscapeVolume: 1, dustDensity: .65});
const LIGHTING = new Set(['auto', 'morning', 'day', 'evening', 'night', 'off']);
const PHASE_LABELS = Object.freeze({morning: 'เช้า', day: 'กลางวัน', evening: 'เย็น', night: 'กลางคืน', off: 'ปิดแสง'});
const SOUNDSCAPE_LABELS = Object.freeze({morning: 'นกนอกหน้าต่าง', day: 'ลม/ใบไม้', evening: 'เตาผิง', night: 'แมลงยามค่ำ', off: 'ปิดเสียงตามช่วงเวลา'});
const KEYS = Object.keys(DEFAULTS);
const AUDIO_HINTS = Object.freeze({off: 'ปิดอยู่', waiting: 'รอการกดเปิดเสียง', loading: 'กำลังโหลดเสียง', playing: 'กำลังเล่น', error: 'โหลดเสียงไม่ได้ ลองปิดแล้วเปิดอีกครั้ง', muted: 'ปิดเสียงรวมอยู่', paused: 'หยุดชั่วคราว', quiet: 'ระดับเสียงเป็นศูนย์'});

function normalize(patch, previous = DEFAULTS) {
  const settings = {...previous};
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return settings;
  if (LIGHTING.has(patch.lighting)) settings.lighting = patch.lighting;
  if (LIGHTING.has(patch.soundscape)) settings.soundscape = patch.soundscape;
  for (const key of ['dust', 'rain', 'tavern']) if (typeof patch[key] === 'boolean') settings[key] = patch[key];
  for (const key of ['volume', 'rainVolume', 'tavernVolume', 'soundscapeVolume', 'dustDensity']) if (typeof patch[key] === 'number' && Number.isFinite(patch[key])) settings[key] = Math.max(0, Math.min(1, patch[key]));
  return settings;
}

/** Local decorative paint and preferences only; the app owns audio and mute. */
export function createDeskAtmosphere({document = globalThis.document, window = globalThis.window, storage, now = () => new Date(), reducedMotion, onAudioChange = () => {}, onPhaseChange = () => {}} = {}) {
  let localStorage = storage, settings = {...DEFAULTS}, layer = null, dustLayer = null, litDustLayer = null, controls = null, phaseHint = null, soundscapeHint = null, timer = null, destroyed = false;
  const fields = new Map(), outputs = new Map(), statusHints = new Map(), audioStatus = {}, controlCleanup = [];
  let media = null, paintObserver = null;
  try { if (localStorage === undefined) localStorage = window?.localStorage; } catch {}
  try { settings = normalize(JSON.parse(localStorage?.getItem(STORAGE_KEY) ?? 'null')); } catch {}
  try { media = window?.matchMedia?.('(prefers-reduced-motion: reduce)'); } catch {}

  const getSettings = () => ({...settings});
  const hidden = () => document?.hidden === true || document?.visibilityState === 'hidden';
  const motionReduced = () => {
    if (typeof reducedMotion === 'function') return !!reducedMotion();
    return typeof reducedMotion === 'boolean' ? reducedMotion : !!media?.matches;
  };
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const decorative = className => {
    const node = element('div', className);
    node.style.pointerEvents = 'none';
    return node;
  };
  const notifyAudio = () => { try { onAudioChange(getSettings()); } catch {} };
  const notifyPhase = info => { try { onPhaseChange({...info}); } catch {} };
  const clearTimer = () => {
    if (timer !== null) window?.clearTimeout?.(timer);
    timer = null;
  };
  function readClock() {
    const value = now(), date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime()) ? date : new Date();
  }
  function clockInfo(date) {
    const hour = date.getHours();
    const phase = hour >= 6 && hour < 10 ? 'morning' : hour >= 10 && hour < 16 ? 'day' : hour >= 16 && hour < 19 ? 'evening' : 'night';
    return {phase, time: `${String(hour).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`};
  }
  function syncLightingHint(info, phase) {
    if (!phaseHint) return;
    const automatic = settings.lighting === 'auto';
    const text = automatic ? `อัตโนมัติ · ${PHASE_LABELS[phase]} · เวลาเครื่อง ${info.time}` : `เลือกเอง · ${PHASE_LABELS[phase]}`;
    phaseHint.dataset.mode = automatic ? 'auto' : 'manual';
    phaseHint.dataset.phase = phase;
    if (phaseHint.textContent !== text) phaseHint.textContent = text;
  }
  function syncSoundscapeHint(info) {
    if (!soundscapeHint) return;
    const automatic = settings.soundscape === 'auto', phase = automatic ? info.phase : settings.soundscape;
    const text = automatic ? `อัตโนมัติ · ${SOUNDSCAPE_LABELS[phase]} · เวลาเครื่อง ${info.time}` : `เลือกเอง · ${SOUNDSCAPE_LABELS[phase]}`;
    soundscapeHint.dataset.mode = automatic ? 'auto' : 'manual';
    soundscapeHint.dataset.phase = phase;
    if (soundscapeHint.textContent !== text) soundscapeHint.textContent = text;
  }
  function syncDust() {
    if (!dustLayer || !litDustLayer) return;
    const count = settings.dust ? Math.round(60 * settings.dustDensity) : 0;
    // Keep existing nodes and their animation phases when only light, sound,
    // clock, visibility or the rounded density count changes.
    while (dustLayer.children.length > count) {
      dustLayer.children[dustLayer.children.length - 1].remove();
      litDustLayer.children[litDustLayer.children.length - 1].remove();
    }
    for (let index = dustLayer.children.length; index < count; index++) {
      const particle = decorative('desk-atmosphere-particle'), bright = decorative('desk-atmosphere-lit-particle');
      const properties = {
        '--dust-x': `${1 + (index * 37 + 11) % 97}%`,
        '--dust-y': `${4 + (index * 53 + 7) % 91}%`,
        '--dust-size': `${(.7 + (index % 5) * .225).toFixed(2)}px`,
        '--dust-duration': `${24 + (index * 7) % 21}s`,
        '--dust-delay': `${-((index * 11 + 7) % 43)}s`,
        '--dust-dx': `${(index * 13) % 49 - 24}px`,
        '--dust-dy': `${-32 - (index * 11) % 45}px`,
      };
      // Both copies occupy the same nth-child slot so CSS shares their drift
      // and flicker phase; the beam mask alone reveals the brighter copy.
      for (const [name, value] of Object.entries(properties)) {
        particle.style.setProperty(name, value);
        bright.style.setProperty(name, value);
      }
      dustLayer.append(particle); litDustLayer.append(bright);
    }
  }
  function syncControls() {
    for (const [name, field] of fields) {
      if (field.type === 'checkbox') field.checked = settings[name];
      else {
        const value = field.type === 'range' ? String(Math.round(settings[name] * 100)) : settings[name];
        if (field.value !== value) field.value = value;
      }
      if (field.type === 'range') {
        const text = `${Math.round(settings[name] * 100)}%`;
        field.setAttribute('aria-valuetext', text);
        const output = outputs.get(name);
        if (output) output.textContent = text;
      }
    }
    syncAudioStatus();
  }
  function syncAudioStatus() {
    for (const [name, hint] of statusHints) {
      const enabled = name === 'soundscape' ? settings.soundscape !== 'off' : settings[name];
      const state = audioStatus[name] ?? (enabled ? 'waiting' : 'off');
      hint.dataset.state = state;
      if (hint.textContent !== AUDIO_HINTS[state]) hint.textContent = AUDIO_HINTS[state];
    }
  }
  function setAudioStatus(status) {
    if (destroyed || !status || typeof status !== 'object' || Array.isArray(status)) return;
    for (const name of ['rain', 'tavern', 'soundscape']) {
      if (typeof status[name] === 'string' && Object.hasOwn(AUDIO_HINTS, status[name])) audioStatus[name] = status[name];
    }
    // Playback updates must not rebuild controls or rewrite a focused fader's
    // current native input value. This feedback is never a saved preference.
    syncAudioStatus();
  }
  function sync() {
    if (destroyed) return;
    clearTimer();
    const date = readClock(), info = clockInfo(date), phase = settings.lighting === 'auto' ? info.phase : settings.lighting;
    if (layer) {
      layer.dataset.lighting = phase;
      layer.dataset.dust = String(settings.dust);
      layer.dataset.motion = motionReduced() ? 'still' : 'moving';
      layer.dataset.paused = String(hidden());
      syncDust();
      // One slow timer while either automatic clock layer is visible. CSS owns
      // all dust/flicker animation; there are no per-particle JS callbacks.
      if ((settings.lighting === 'auto' || settings.soundscape === 'auto') && !hidden()) {
        const delay = Math.max(250, Math.min(60_000, 60_000 - date.getSeconds() * 1000 - date.getMilliseconds()));
        timer = window?.setTimeout?.(() => { timer = null; sync(); }, delay) ?? null;
      }
    }
    // A clock/visibility refresh changes the hint, never a focused native input.
    syncLightingHint(info, phase);
    syncSoundscapeHint(info);
    // The sound clock always follows actual local time, including manual or
    // disabled lighting. It is feedback, never a persisted preference.
    notifyPhase(info);
  }
  function setSettings(patch) {
    if (destroyed) return getSettings();
    const next = normalize(patch, settings);
    if (KEYS.every(key => next[key] === settings[key])) return getSettings();
    for (const name of ['rain', 'tavern', 'soundscape']) if (next[name] !== settings[name]) delete audioStatus[name];
    settings = next;
    try { localStorage?.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
    syncControls();
    sync();
    notifyAudio();
    return getSettings();
  }
  function unobservePaint() {
    paintObserver?.disconnect();
    paintObserver = null;
    layer?.parentElement?.style.removeProperty?.('--desk-paint-height');
  }
  function syncPaintHeight() {
    const surface = layer?.parentElement;
    if (!surface || !Number.isFinite(surface.clientHeight)) return;
    const height = `${surface.clientHeight}px`;
    if (surface.style.getPropertyValue('--desk-paint-height') !== height) {
      surface.style.setProperty('--desk-paint-height', height);
    }
  }
  function mount(parent = document?.body) {
    if (destroyed || !parent) return null;
    // Keep paint inside the desk viewport. CSS layers it over normal board
    // cards while body-level expanded readers and the window manager stay above.
    const surface = parent.matches?.('.board-scroll') ? parent : parent.querySelector?.('.board-scroll');
    if (!surface) return null;
    if (!layer) {
      layer = decorative('desk-atmosphere');
      layer.setAttribute('aria-hidden', 'true');
      const morning = decorative('desk-atmosphere-morning'), day = decorative('desk-atmosphere-day'), evening = decorative('desk-atmosphere-evening'), night = decorative('desk-atmosphere-night');
      dustLayer = decorative('desk-atmosphere-dust');
      litDustLayer = decorative('desk-atmosphere-dust-lit');
      const cloud = decorative('desk-atmosphere-cloud'), farCloud = decorative('desk-atmosphere-cloud desk-atmosphere-cloud-far');
      layer.append(morning, day, evening, night, dustLayer, litDustLayer, cloud, farCloud);
    }
    if (layer.parentElement !== surface) {
      unobservePaint();
      surface.insertBefore(layer, surface.firstChild);
      if (typeof window?.ResizeObserver === 'function') {
        paintObserver = new window.ResizeObserver(syncPaintHeight);
        paintObserver.observe(surface);
      }
    }
    syncPaintHeight();
    sync();
    return layer;
  }
  function removeControls() {
    for (const cleanup of controlCleanup.splice(0)) cleanup();
    controls?.remove(); controls = null; phaseHint = null; soundscapeHint = null; fields.clear(); outputs.clear(); statusHints.clear();
  }
  function mountControls(container) {
    if (destroyed || !container) return null;
    if (controls?.parentElement === container) { syncControls(); sync(); return controls; }
    removeControls();
    controls = element('fieldset', 'atmosphere-settings');
    controls.append(element('legend', '', 'บรรยากาศกิลด์'));
    const addField = (name, title, type) => {
      const label = element('label', `atmosphere-field atmosphere-field-${name}${type === 'range' ? ' atmosphere-range' : ''}`);
      label.append(element('span', '', title));
      const field = element(type === 'select' ? 'select' : 'input');
      if (type !== 'select') field.type = type;
      field.setAttribute('data-atmosphere-setting', name);
      label.append(field); controls.append(label); fields.set(name, field);
      const event = type === 'range' ? 'input' : 'change';
      const listener = () => setSettings({[name]: type === 'checkbox' ? field.checked : type === 'range' ? Number(field.value) / 100 : field.value});
      field.addEventListener(event, listener); controlCleanup.push(() => field.removeEventListener(event, listener));
      return field;
    };
    const addAudioStatus = (name, field) => {
      const hint = element('small', 'atmosphere-audio-status');
      hint.setAttribute('data-atmosphere-status', name); hint.setAttribute('role', 'status'); hint.setAttribute('aria-live', 'polite'); hint.setAttribute('aria-atomic', 'true');
      field.parentElement.append(hint); statusHints.set(name, hint);
    };
    const addAudioToggle = (name, title) => addAudioStatus(name, addField(name, title, 'checkbox'));
    const addRange = (name, title) => {
      const field = addField(name, title, 'range');
      field.min = '0'; field.max = '100'; field.step = '1';
      const output = element('output'); output.setAttribute('aria-hidden', 'true'); field.parentElement.append(output); outputs.set(name, output);
    };
    const select = addField('lighting', 'แสงบนโต๊ะ', 'select');
    for (const [value, title] of [['auto', 'อัตโนมัติ (ตามเวลาเครื่อง)'], ['morning', 'เช้า'], ['day', 'กลางวัน'], ['evening', 'เย็น'], ['night', 'กลางคืน'], ['off', 'ปิดแสง']]) {
      const option = element('option', '', title); option.value = value; select.append(option);
    }
    phaseHint = element('small', 'atmosphere-phase-hint'); phaseHint.setAttribute('data-atmosphere-phase-hint', ''); select.parentElement.append(phaseHint);
    addField('dust', 'ฝุ่นลอยในแสง', 'checkbox');
    addRange('dustDensity', 'ความหนาแน่นฝุ่น');
    const soundSelect = addField('soundscape', 'เสียงตามช่วงเวลา', 'select');
    for (const [value, title] of [['auto', 'ตามเวลาเครื่อง'], ...Object.entries(SOUNDSCAPE_LABELS)]) {
      const option = element('option', '', title); option.value = value; soundSelect.append(option);
    }
    soundscapeHint = element('small', 'atmosphere-soundscape-hint'); soundscapeHint.setAttribute('data-atmosphere-soundscape-hint', ''); soundSelect.parentElement.append(soundscapeHint);
    addAudioStatus('soundscape', soundSelect);
    addRange('soundscapeVolume', 'ความดังเสียงตามช่วงเวลา');
    addAudioToggle('rain', 'เสียงฝน');
    addAudioToggle('tavern', 'เสียงโรงเตี๊ยมแว่วไกล');
    addRange('rainVolume', 'ความดังฝน');
    addRange('tavernVolume', 'ความดังโรงเตี๊ยม');
    addRange('volume', 'ความดังบรรยากาศรวม');
    container.append(controls); syncControls(); sync();
    return controls;
  }
  const onVisibility = () => sync(), onMotion = () => sync();
  document?.addEventListener?.('visibilitychange', onVisibility);
  if (media?.addEventListener) media.addEventListener('change', onMotion);
  else media?.addListener?.(onMotion);
  // Prime the player before its settings opt into auto, without starting a
  // minute timer until the decorative surface is mounted.
  notifyPhase(clockInfo(readClock()));
  notifyAudio();
  return {mount, mountControls, getSettings, setSettings, setAudioStatus, destroy() {
    if (destroyed) return;
    destroyed = true; clearTimer(); removeControls(); unobservePaint(); layer?.remove(); layer = null; dustLayer = null; litDustLayer = null;
    document?.removeEventListener?.('visibilitychange', onVisibility);
    if (media?.removeEventListener) media.removeEventListener('change', onMotion);
    else media?.removeListener?.(onMotion);
  }};
}
