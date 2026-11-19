import {DEFAULT_PAPERWEIGHT, PAPERWEIGHT_SIZE, updatePaperweight} from './model.mjs';
import {PAPER, STAMP_SPACE} from './paper-format.mjs';
import {resolveStampSurface, stampSurfacePoint} from './stamp-surfaces.mjs';
import {animateTransient} from './desk-motion.mjs';
import {MOTION_TIMING} from './motion-tokens.mjs';

const selector = '[data-paperweight]';
const half = PAPERWEIGHT_SIZE / 2;
const cornerInset = 24;
const directions = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};

export function clampPaperweight(x, y, bounds) {
  return {
    x: Math.max(0, Math.min(bounds.width - PAPERWEIGHT_SIZE, x)),
    y: Math.max(0, Math.min(bounds.height - PAPERWEIGHT_SIZE, y)),
  };
}

export function paperweightCornerPosition(quest, corner, bounds) {
  const x = (corner.endsWith('left') ? cornerInset : PAPER.width - cornerInset) - PAPER.width / 2;
  const y = (corner.startsWith('top') ? cornerInset : PAPER.height - cornerInset) - PAPER.height / 2;
  const angle = quest.rotation * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return clampPaperweight(
    quest.x + PAPER.width / 2 + x * cos - y * sin - half,
    quest.y + PAPER.height / 2 + x * sin + y * cos - half,
    bounds,
  );
}

export function paperweightFace(weight, icon) {
  // Raster data URLs are validated by the model or produced by the image canvas.
  return weight.emblem === 'custom' && weight.imageDataUrl
    ? `<img src="${weight.imageDataUrl}" alt="" draggable="false">`
    : icon(weight.emblem === 'custom' ? 'shield' : weight.emblem);
}

/** One liftable prop on the desk. Pointer motion is ephemeral until a valid drop. */
export function createPaperweight({canvas, viewport, getState, getLayout, save, onEdit, icon,
  onCue = () => {}, onError = () => {}, isBlocked = () => false, reducedMotion = () => false,
  document = canvas.ownerDocument, window = document.defaultView}) {
  let weightButton = null, markedPaper = null, gesture = null, frame = null, suppressUntil = 0;
  const getWeight = () => getState().paperweight ?? DEFAULT_PAPERWEIGHT;

  function render({landed = false, focus = false} = {}) {
    cancel();
    const weight = getWeight(), {bounds,scale} = getLayout();
    markedPaper?.classList.remove('paperweighted');
    markedPaper = weight.questId ? canvas.querySelector(`:scope > .quest-paper[data-id="${weight.questId}"]`) : null;
    markedPaper?.classList.add('paperweighted');
    const quest = markedPaper && getState().items.find(item => item.id === weight.questId);
    const position = quest
      ? paperweightCornerPosition(quest, weight.corner, bounds)
      : clampPaperweight(weight.x, weight.y, bounds);
    if (weight === DEFAULT_PAPERWEIGHT && viewport.clientWidth / scale < position.x + PAPERWEIGHT_SIZE) {
      Object.assign(position,clampPaperweight(viewport.clientWidth / scale - PAPERWEIGHT_SIZE - 14,16,bounds));
    }
    if (!weightButton?.isConnected) {
      weightButton = document.createElement('button');
      weightButton.type = 'button';
      weightButton.className = 'desk-paperweight';
      weightButton.dataset.paperweight = '';
      canvas.append(weightButton);
    }
    weightButton.setAttribute('aria-label', quest ? `ที่ทับกระดาษบนเควส ${quest.title} กดเพื่อเปลี่ยนตรา` : 'ที่ทับกระดาษ กดเพื่อเปลี่ยนตรา');
    weightButton.setAttribute('aria-keyshortcuts','Shift+Enter');
    weightButton.title = quest ? 'ลากออกเพื่อยกที่ทับกระดาษ · คลิกเพื่อเปลี่ยนตรา' : 'ลากไปวางบนใบเควส · คลิกเพื่อเปลี่ยนตรา';
    weightButton.classList.toggle('paperweight-on-quest', Boolean(quest));
    weightButton.style.left = `${position.x}px`;
    weightButton.style.top = `${position.y}px`;
    weightButton.style.setProperty('--paperweight-size', `${PAPERWEIGHT_SIZE}px`);
    weightButton.innerHTML = `<span class="paperweight-metal"><span class="paperweight-face">${paperweightFace(weight,icon)}</span></span>`;
    if (landed && !reducedMotion()) animateTransient(
      weightButton.querySelector('.paperweight-metal'),
      [{transform:'translateY(-8px) scale(1.04)',opacity:.88},{transform:'translateY(1px) scale(.99)',offset:.68},{transform:'none',opacity:1}],
      MOTION_TIMING.paperweightLand,
    );
    if (focus) weightButton.focus({preventScroll:true});
  }

  function positionGhost(current) {
    current.ghost.style.translate = `${current.x-current.grabX}px ${current.y-current.grabY}px`;
  }

  function edgeMotion(position, start, size) {
    const distance = position - start, end = size - distance;
    if (distance < 0 || end < 0) return 0;
    if (distance < 28) return -Math.ceil((28-distance)/3);
    if (end < 28) return Math.ceil((28-end)/3);
    return 0;
  }

  function paintCarry(current) {
    if (frame !== null) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      if (gesture !== current) return;
      const rect = viewport.getBoundingClientRect(), left = viewport.scrollLeft, top = viewport.scrollTop;
      const dx = edgeMotion(current.x,rect.left,viewport.clientWidth);
      const dy = edgeMotion(current.y,rect.top,viewport.clientHeight);
      if (dx) viewport.scrollLeft = left + dx;
      if (dy) viewport.scrollTop = top + dy;
      positionGhost(current);
      if (left !== viewport.scrollLeft || top !== viewport.scrollTop) paintCarry(current);
    });
  }

  function start(event) {
    const button = event.target.closest(selector);
    if (!button || gesture || event.button !== 0 || event.isPrimary === false || isBlocked()) return;
    const rect = button.getBoundingClientRect();
    gesture = {button,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,
      x:event.clientX,y:event.clientY,grabX:event.clientX-rect.left,grabY:event.clientY-rect.top,
      scale:getLayout().scale,ghost:null};
    button.focus({preventScroll:true});
    button.setPointerCapture(event.pointerId);
  }

  function move(event) {
    const current = gesture;
    if (!current || event.pointerId !== current.pointerId) return;
    if (!current.button.isConnected || current.scale !== getLayout().scale || isBlocked()) { cancel(); return; }
    current.x = event.clientX;
    current.y = event.clientY;
    if (!current.ghost) {
      if (Math.hypot(current.x-current.startX,current.y-current.startY) < 5) return;
      const ghost = current.button.cloneNode(true);
      ghost.removeAttribute('data-paperweight');
      ghost.classList.add('paperweight-in-hand');
      ghost.inert = true;
      ghost.setAttribute('aria-hidden','true');
      ghost.style.left = '0px';
      ghost.style.top = '0px';
      ghost.style.scale = String(current.scale);
      current.ghost = ghost;
      positionGhost(current);
      document.body.append(ghost);
      current.button.classList.add('paperweight-source');
      if (getWeight().questId) onCue('paperSlide');
    }
    paintCarry(current);
  }

  function cancel(event) {
    const current = gesture;
    if (!current || (event?.pointerId !== undefined && event.pointerId !== current.pointerId)) return;
    gesture = null;
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    if (current.ghost) {
      suppressUntil = window.performance.now() + 400;
      current.ghost.remove();
      current.button.classList.remove('paperweight-source');
    }
    if (current.button.hasPointerCapture(current.pointerId)) current.button.releasePointerCapture(current.pointerId);
  }

  function end(event) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    move(event);
    const current = gesture;
    if (!current?.ghost) { cancel(event); return; }
    // The carrying source and ghost let the pointer hit the real surface below.
    const hit = document.elementFromPoint(event.clientX,event.clientY);
    cancel(event);
    if (!hit || !viewport.contains(hit)) return;
    const {bounds,scale} = getLayout(), origin = canvas.getBoundingClientRect();
    const freePosition = clampPaperweight((event.clientX-current.grabX-origin.left)/scale,(event.clientY-current.grabY-origin.top)/scale,bounds);
    dropAt(hit,{x:event.clientX,y:event.clientY},freePosition);
  }

  function dropAt(hit, point, freePosition) {
    try {
      const target = resolveStampSurface(hit?.closest('.quest-paper'));
      let patch = freePosition && {...freePosition,questId:null,corner:null};
      if (target?.kind === 'board' && target.host === canvas) {
        const local = stampSurfacePoint(target,point,{getComputedStyle:window.getComputedStyle.bind(window),Matrix:window.DOMMatrix});
        const corner = `${local.y < STAMP_SPACE.height / 2 ? 'top' : 'bottom'}-${local.x < STAMP_SPACE.width / 2 ? 'left' : 'right'}`;
        const quest = getState().items.find(item => item.id === target.id);
        if (quest) patch = {...paperweightCornerPosition(quest,corner,getLayout().bounds),questId:quest.id,corner};
      }
      if (!patch) { onError('เลื่อนที่ทับกระดาษไปเหนือใบเควสก่อน'); return; }
      save(updatePaperweight(getState(),patch),{landed:true,focus:true});
      onCue('paperweightDrop');
    } catch (error) { onError(error.message); }
  }

  function click(event) {
    if (!event.target.closest(selector) || isBlocked()) return;
    if (event.detail !== 0 && window.performance.now() < suppressUntil) return;
    onEdit();
  }

  function keyboard(event) {
    if (event.key === 'Escape' && gesture) {
      event.preventDefault();
      event.stopPropagation();
      cancel();
      return;
    }
    if (event.target !== weightButton || isBlocked() || gesture) return;
    if (event.shiftKey && event.key === 'Enter') {
      event.preventDefault();
      const rect = weightButton.getBoundingClientRect();
      const point = {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
      const hit = document.elementsFromPoint(point.x,point.y).find(node => !node.closest(selector));
      dropAt(hit,point,null);
      return;
    }
    const step = directions[event.key];
    if (!Array.isArray(step)) return;
    event.preventDefault();
    const distance = event.shiftKey ? 25 : 8;
    const {bounds} = getLayout();
    const pos = clampPaperweight(parseFloat(weightButton.style.left)+step[0]*distance,parseFloat(weightButton.style.top)+step[1]*distance,bounds);
    try { save(updatePaperweight(getState(),{...pos,questId:null,corner:null}),{focus:true}); }
    catch (error) { onError(error.message); }
  }

  canvas.addEventListener('pointerdown',start);
  canvas.addEventListener('pointermove',move);
  canvas.addEventListener('pointerup',end);
  canvas.addEventListener('pointercancel',cancel);
  canvas.addEventListener('lostpointercapture',cancel);
  canvas.addEventListener('click',click);
  document.addEventListener('keydown',keyboard,true);
  window.addEventListener('blur',cancel);
  window.addEventListener('pagehide',cancel);
  return {render,cancel,get dragging(){return gesture !== null;}};
}
