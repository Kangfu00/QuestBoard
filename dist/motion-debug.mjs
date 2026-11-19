/**
 * Opt-in frame & long-task monitor activated only when `?motion-debug` is in
 * the page URL. Zero runtime cost when inactive.
 */
export function isMotionDebugEnabled(location = globalThis.location) {
  try {
    const search = String(location?.search ?? '');
    return new URLSearchParams(search).has('motion-debug');
  } catch {
    return false;
  }
}

export function createMotionDebug({
  document = globalThis.document,
  window = globalThis.window,
  location = window?.location ?? globalThis.location,
  performance = window?.performance ?? globalThis.performance,
  requestAnimationFrame = window?.requestAnimationFrame?.bind(window) ?? globalThis.requestAnimationFrame,
  cancelAnimationFrame = window?.cancelAnimationFrame?.bind(window) ?? globalThis.cancelAnimationFrame,
  PerformanceObserver = window?.PerformanceObserver ?? globalThis.PerformanceObserver,
} = {}) {
  if (!isMotionDebugEnabled(location) || !document?.body) {
    return { active: false, destroy() {} };
  }

  let frameId = null;
  let lastTime = 0;
  let frameCount = 0;
  let sampleStart = 0;
  let fps = 0;
  let maxFrameMs = 0;
  let droppedFrames = 0;
  let longTasks = 0;
  let lastLongTaskMs = 0;
  let observer = null;

  const hud = document.createElement('aside');
  hud.id = 'motion-debug-hud';
  hud.setAttribute('aria-label', 'Motion debug overlay');
  Object.assign(hud.style, {
    position: 'fixed',
    left: '10px',
    bottom: '10px',
    zIndex: '99999',
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid #c3ae7866',
    background: '#1e1c17e6',
    color: '#e7e3d5',
    font: '11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
    pointerEvents: 'none',
    boxShadow: '0 6px 18px #120b0688',
    whiteSpace: 'pre',
  });
  document.body.append(hud);

  if (typeof PerformanceObserver === 'function') {
    try {
      observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          longTasks += 1;
          lastLongTaskMs = Math.max(lastLongTaskMs, Math.round(entry.duration));
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch {
      observer = null;
    }
  }

  function renderHud() {
    const activeWaapi = typeof document.getAnimations === 'function' ? document.getAnimations().length : 0;
    const reduced = Boolean(window?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
    hud.textContent = [
      `MOTION DEBUG`,
      `FPS: ${fps} | Max frame: ${maxFrameMs}ms | Drops(>24ms): ${droppedFrames}`,
      `Long tasks: ${longTasks} (peak ${lastLongTaskMs}ms)`,
      `WAAPI active: ${activeWaapi} | Reduced: ${reduced ? 'on' : 'off'}`,
    ].join('\n');
  }

  function tick(now) {
    if (!sampleStart) sampleStart = now;
    if (lastTime) {
      const delta = now - lastTime;
      if (delta > maxFrameMs) maxFrameMs = Math.round(delta);
      if (delta > 24) droppedFrames += 1;
    }
    lastTime = now;
    frameCount += 1;
    if (now - sampleStart >= 500) {
      fps = Math.round((frameCount * 1000) / (now - sampleStart));
      frameCount = 0;
      sampleStart = now;
      renderHud();
      maxFrameMs = 0;
    }
    frameId = requestAnimationFrame?.(tick) ?? null;
  }

  renderHud();
  if (typeof requestAnimationFrame === 'function') {
    frameId = requestAnimationFrame(tick);
  }

  function destroy() {
    if (frameId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    try { observer?.disconnect(); } catch {}
    observer = null;
    hud.remove();
  }

  return { active: true, destroy, get hud() { return hud; } };
}
