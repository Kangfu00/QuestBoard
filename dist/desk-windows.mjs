// Desk geometry is session UI state. It never enters a quest or backup record.
const sessionPositions = new WeakMap();
const controlledStyles = ['position', 'inset', 'left', 'top', 'margin', 'zIndex'];
const controlSelector = 'button,input,textarea,select,option,a,label,summary,[role="button"],[role="link"]';
const gutter = 12;

function isModal(panel) {
  try { return !!panel.matches?.(':modal'); } catch { return false; }
}
function isVisible(panel) {
  return !panel.hidden && panel.isConnected !== false && panel.style?.display !== 'none'
    && (panel.tagName?.toLowerCase() !== 'dialog' || panel.open === true) && !isModal(panel);
}
function isControl(target, handle) {
  for (let node = target; node; node = node.parentElement ?? node.parentNode) {
    if (node.matches?.(controlSelector) || node.isContentEditable
      || (node.hasAttribute?.('contenteditable') && node.getAttribute('contenteditable') !== 'false')) return true;
    if (node === handle) break;
  }
  return false;
}
function preserveAttribute(node, name) {
  const before = node.getAttribute?.(name);
  return () => { if (before == null) node.removeAttribute?.(name); else node.setAttribute?.(name, before); };
}

/** Position and stack nonmodal document views. Showing, hiding and saving belong
 * to each view's controller. canHandleEscape lets app drag modes take priority. */
export function createDeskWindows({document = globalThis.document, window = globalThis.window, baseZ = 240, canHandleEscape = () => true} = {}) {
  const positionsOwner = window ?? document;
  if (!sessionPositions.has(positionsOwner)) sessionPositions.set(positionsOwner, new Map());
  const positions = sessionPositions.get(positionsOwner);
  const entries = new Map(), order = [];
  let destroyed = false, drag = null, opened = 0;

  function restack() {
    const front = [...order].reverse().find(entry => isVisible(entry.panel));
    order.forEach((entry, index) => {
      entry.panel.style.zIndex = String(baseZ + index);
      entry.panel.classList.toggle('is-window-active', entry === front);
    });
    return front;
  }
  function remember(entry) {
    if (entry.key != null) positions.set(entry.key, {x:entry.x, y:entry.y});
  }
  function place(entry, x = entry.x, y = entry.y, save = true) {
    const rect = entry.panel.getBoundingClientRect?.() ?? {};
    const width = entry.panel.offsetWidth || rect.width || 0;
    const height = entry.panel.offsetHeight || rect.height || 0;
    const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || width + gutter * 2;
    const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || height + gutter * 2;
    entry.x = Math.min(Math.max(gutter, viewportWidth - width - gutter), Math.max(gutter, x));
    entry.y = Math.min(Math.max(gutter, viewportHeight - height - gutter), Math.max(gutter, y));
    entry.panel.style.left = `${entry.x}px`;
    entry.panel.style.top = `${entry.y}px`;
    if (save) remember(entry);
  }
  function raise(entry) {
    if (!entries.has(entry.panel) || !isVisible(entry.panel)) return;
    const index = order.indexOf(entry); order.splice(index, 1); order.push(entry);
    place(entry); restack();
  }
  function detachDragListeners() {
    window.removeEventListener('pointermove', pointerMove, true);
    window.removeEventListener('pointerup', pointerUp, true);
    window.removeEventListener('pointercancel', pointerCancel, true);
  }
  function endDrag(restore = false) {
    if (!drag) return;
    const previous = drag; drag = null;
    detachDragListeners();
    previous.entry.panel.classList.remove('is-window-dragging');
    if (restore) place(previous.entry, previous.x, previous.y);
    else remember(previous.entry);
    try {
      if (previous.entry.handle.hasPointerCapture?.(previous.pointerId)) previous.entry.handle.releasePointerCapture(previous.pointerId);
    } catch { /* Removed handles may already have lost their capture. */ }
  }
  function pointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!isVisible(drag.entry.panel)) { endDrag(true); return; }
    event.preventDefault();
    place(drag.entry, drag.x + event.clientX - drag.pointerX, drag.y + event.clientY - drag.pointerY, false);
  }
  function pointerUp(event) { if (drag && event.pointerId === drag.pointerId) endDrag(); }
  function pointerCancel(event) { if (drag && event.pointerId === drag.pointerId) endDrag(true); }
  function blur() { endDrag(true); }
  function resize() {
    endDrag(true);
    for (const entry of entries.values()) place(entry);
    restack();
  }
  function keydown(event) {
    if (event.key !== 'Escape' || event.defaultPrevented || !canHandleEscape()) return;
    try { if (document.querySelector?.('dialog:modal')) return; } catch { /* Older selector engines lack :modal. */ }
    const front = restack();
    if (!front || typeof front.onEscape !== 'function') return;
    // Consume before invoking a close callback: save failure may refuse the close,
    // but must not let Escape close another document or clear board selection.
    event.preventDefault(); event.stopPropagation();
    endDrag(true);
    front.onEscape(event);
    restack();
  }

  document.addEventListener('keydown', keydown, true);
  window.addEventListener('blur', blur);
  window.addEventListener('resize', resize);

  function register(panel, {handle = panel, onEscape, key} = {}) {
    if (destroyed) throw new Error('The desk window manager has been destroyed');
    if (entries.has(panel)) return entries.get(panel).registration;
    if (typeof handle === 'string') handle = panel.querySelector(handle);
    if (!handle) throw new TypeError('A desk window needs a drag handle');
    const rect = panel.getBoundingClientRect?.() ?? {};
    const remembered = key == null ? null : positions.get(key);
    const cascade = (opened++ % 8) * 24;
    const entry = {panel, handle, key, onEscape,
      x:remembered?.x ?? (Number.isFinite(rect.left) ? rect.left : 36) + cascade,
      y:remembered?.y ?? (Number.isFinite(rect.top) ? rect.top : 36) + cascade};
    const stylesBefore = Object.fromEntries(controlledStyles.map(name => [name, panel.style[name] ?? '']));
    const restoreAttributes = [preserveAttribute(panel, 'data-desk-window'), preserveAttribute(handle, 'data-desk-window-handle'),
      preserveAttribute(handle, 'tabindex'), preserveAttribute(handle, 'title')];
    panel.setAttribute('data-desk-window', '');
    handle.setAttribute('data-desk-window-handle', '');
    if (!handle.hasAttribute('tabindex')) handle.setAttribute('tabindex', '0');
    if (!handle.hasAttribute('title')) handle.setAttribute('title', 'ลากเพื่อย้ายหน้าต่าง · ปุ่มลูกศรย้าย · Shift ย้ายทีละพิกเซล');
    Object.assign(panel.style, {position:'fixed', inset:'auto', margin:'0'});

    function activate() { raise(entry); }
    function start(event) {
      if (event.defaultPrevented || event.button !== 0 || event.isPrimary === false || !isVisible(panel) || isControl(event.target, handle)) return;
      endDrag(true); raise(entry);
      event.preventDefault(); event.stopPropagation();
      drag = {entry, pointerId:event.pointerId, pointerX:event.clientX, pointerY:event.clientY, x:entry.x, y:entry.y};
      panel.classList.add('is-window-dragging');
      window.addEventListener('pointermove', pointerMove, {capture:true, passive:false});
      window.addEventListener('pointerup', pointerUp, true);
      window.addEventListener('pointercancel', pointerCancel, true);
      try { handle.setPointerCapture?.(event.pointerId); } catch { /* Global pointer listeners also support capture-less environments. */ }
    }
    function lostCapture(event) { if (drag?.entry === entry && event.pointerId === drag.pointerId) endDrag(true); }
    function moveByKeyboard(event) {
      if (event.defaultPrevented || event.target !== handle || event.altKey || event.ctrlKey || event.metaKey || !isVisible(panel)) return;
      const direction = {ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1]}[event.key];
      if (!direction) return;
      event.preventDefault(); event.stopPropagation();
      endDrag(true); raise(entry);
      const step = event.shiftKey ? 1 : 10;
      place(entry, entry.x + direction[0] * step, entry.y + direction[1] * step);
    }
    panel.addEventListener('pointerdown', activate, true);
    panel.addEventListener('focusin', activate);
    handle.addEventListener('pointerdown', start);
    handle.addEventListener('lostpointercapture', lostCapture);
    handle.addEventListener('keydown', moveByKeyboard);
    entry.registration = {
      raise:() => raise(entry),
      cancelDrag() { if (drag?.entry === entry) endDrag(true); },
      destroy() {
        if (!entries.has(panel)) return;
        if (drag?.entry === entry) endDrag(true);
        remember(entry);
        panel.removeEventListener('pointerdown', activate, true);
        panel.removeEventListener('focusin', activate);
        handle.removeEventListener('pointerdown', start);
        handle.removeEventListener('lostpointercapture', lostCapture);
        handle.removeEventListener('keydown', moveByKeyboard);
        entries.delete(panel); order.splice(order.indexOf(entry), 1);
        panel.classList.remove('is-window-active', 'is-window-dragging');
        restoreAttributes.forEach(restore => restore());
        Object.assign(panel.style, stylesBefore);
        restack();
      },
    };
    entries.set(panel, entry); order.push(entry);
    place(entry); restack();
    return entry.registration;
  }
  return {
    register,
    get top() { return restack()?.panel ?? null; },
    get size() { return entries.size; },
    destroy() {
      if (destroyed) return;
      destroyed = true; endDrag(true);
      for (const entry of [...entries.values()]) entry.registration.destroy();
      document.removeEventListener('keydown', keydown, true);
      window.removeEventListener('blur', blur);
      window.removeEventListener('resize', resize);
    },
  };
}
