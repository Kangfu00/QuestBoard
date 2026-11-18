import {moveQuestBundle,sourceAnchor} from './quest-bundle-model.mjs';
import {ghostPose} from './desk-motion.mjs';
import {PAPER} from './paper-format.mjs';

const SOURCE='.quest-paper[data-id],.quest-paper[data-storage-id],[data-folio-paper],.folio-index-row[data-quest-id]';
const EXCLUDED='.paper-reader,.quest-bundle-ghost,[inert],[hidden]';
const INTERACTIVE='input,textarea,select,button,a,label,[contenteditable],[role="textbox"]';
const consume=event=>{event.preventDefault();event.stopImmediatePropagation();};
const safely=(fn,...args)=>{try{return fn?.(...args);}catch{return undefined;}};
const identity=()=>({a:1,b:0,c:0,d:1});

function affine(transform,window){
  if(!transform||transform==='none')return identity();
  const Matrix=window.DOMMatrix??globalThis.DOMMatrix;
  if(Matrix){const matrix=new Matrix(transform);return {a:matrix.a,b:matrix.b,c:matrix.c,d:matrix.d};}
  const match=transform.match(/^matrix(3d)?\(([^)]+)\)$/);
  if(!match)throw new RangeError('Paper transform is unavailable');
  const values=match[2].split(',').map(Number);
  return match[1]?{a:values[0],b:values[1],c:values[4],d:values[5]}:{a:values[0],b:values[1],c:values[2],d:values[3]};
}
function projection(element,document,window){
  let matrix=identity();
  for(let node=element;node&&node!==document.body;node=node.parentElement){
    const own=affine(window.getComputedStyle(node).transform,window),{a,b,c,d}=matrix;
    matrix={a:own.a*a+own.c*b,b:own.b*a+own.d*b,c:own.a*c+own.c*d,d:own.b*c+own.d*d};
  }
  return matrix;
}

/** Temporary selection and pointer ownership only. Quest persistence belongs to commit. */
export function createQuestBundles({document=globalThis.document,window=globalThis.window,getState,commit,renderQuest,getDropTarget,onAssist=()=>{},onTarget=()=>{},onCue=()=>{},isBlocked=()=>false,onStart=()=>{},onEnd=()=>{},reducedMotion=()=>false}){
  const selected=new Set(),registrations=[];
  let gesture=null,destroyed=false,observer=null,suppressUntil=0,lastCue=null,refreshing=false;
  const now=()=>window.performance?.now?.()??Date.now();
  const stateQuests=()=>{
    const {items,paperweight}=getState();
    return new Set(items.filter(item=>item.type==='quest'&&item.id!==paperweight?.questId).map(item=>item.id));
  };
  const listen=(target,type,fn)=>{target.addEventListener(type,fn,true);registrations.push(()=>target.removeEventListener(type,fn,true));};
  const bar=document.createElement('div');bar.className='quest-bundle-selection';bar.hidden=true;bar.setAttribute('role','group');bar.setAttribute('aria-label','เควสที่เลือก');
  const count=document.createElement('span');count.setAttribute('role','status');count.setAttribute('aria-live','polite');
  const clearButton=document.createElement('button');clearButton.type='button';clearButton.textContent='ยกเลิกการเลือก';clearButton.dataset.bundleClear='';
  bar.append(count,clearButton);document.body.append(bar);

  function sourceFor(target){
    if(!target?.closest||target.closest(EXCLUDED))return null;
    const element=target.closest(SOURCE);
    if(!element||!element.closest('#board-canvas,.storage-plane,.folder-window'))return null;
    const id=element.dataset.id??element.dataset.storageId??element.dataset.folioPaper??element.dataset.questId;
    if(!id||!getState().items.some(item=>item.id===id&&item.type==='quest'))return null;
    return {id,element};
  }
  function allowedSelection(target){
    const interactive=target.closest(INTERACTIVE);
    return !interactive||!!interactive.matches('[data-bundle-select],[data-quest-drag],[data-folio-select],.quest-title[data-read-front],.drag-handle');
  }
  function paint(){
    for(const element of document.querySelectorAll(SOURCE)){
      if(element.closest('.paper-reader,.quest-bundle-ghost'))continue;
      const id=element.dataset.id??element.dataset.storageId??element.dataset.folioPaper??element.dataset.questId;
      element.classList.toggle('bundle-selected',selected.has(id));
      element.classList.toggle('bundle-source',!!gesture?.moved&&gesture.ids.includes(id));
    }
    for(const button of document.querySelectorAll('[data-bundle-select]')){
      if(button.closest('.paper-reader,.quest-bundle-ghost'))continue;
      button.setAttribute('aria-pressed',String(selected.has(button.dataset.bundleSelect)));
    }
    bar.hidden=selected.size===0;
    const text=`เลือก ${selected.size} เควส`;
    if(count.textContent!==text)count.textContent=text;
  }
  function refresh(){
    if(destroyed||refreshing)return;
    refreshing=true;
    try{
      const existing=stateQuests();
      if(gesture&&gesture.ids.some(id=>!existing.has(id)))finish(false,null,'deleted');
      for(const id of selected)if(!existing.has(id))selected.delete(id);
      paint();
    }finally{refreshing=false;}
  }
  function toggle(id){
    if(destroyed||gesture||isBlocked()||!stateQuests().has(id))return false;
    if(selected.has(id))selected.delete(id);else selected.add(id);
    refresh();return selected.has(id);
  }
  function clear(){
    if(destroyed)return;
    if(gesture)finish(false,null,'clear');
    selected.clear();paint();
  }
  function makeGhost(d){
    const ghost=document.createElement('div');ghost.className='quest-bundle-ghost';ghost.setAttribute('aria-hidden','true');ghost.inert=true;
    Object.assign(ghost.style,{position:'fixed',width:`${PAPER.width}px`,height:`${PAPER.height}px`,zIndex:'10000',pointerEvents:'none'});
    const quests=d.ids.slice(0,5).map(id=>getState().items.find(item=>item.id===id));
    for(let index=quests.length-1;index>=0;index--){
      const holder=document.createElement('div');holder.innerHTML=renderQuest(quests[index],index);
      const sheet=holder.firstElementChild;if(!sheet)throw new Error('Cannot render a bundle paper');
      for(const node of [sheet,...sheet.querySelectorAll('*')]){
        for(const attribute of [...node.attributes])if(attribute.name==='id'||attribute.name.startsWith('data-'))node.removeAttribute(attribute.name);
        node.removeAttribute('tabindex');
      }
      sheet.classList.remove('board-item','bundle-source','bundle-selected');sheet.classList.add('quest-bundle-sheet');
      Object.assign(sheet.style,{left:`${index*5}px`,top:`${index*4}px`,zIndex:String(5-index),transform:`rotate(${index===0?0:(index%2?1:-1)*index*1.4}deg)`});
      ghost.append(sheet);
    }
    const badge=document.createElement('strong');badge.className='quest-bundle-count';badge.textContent=String(d.ids.length);ghost.append(badge);
    document.body.append(ghost);d.ghost=ghost;
  }
  function update(d,event){
    Object.assign(d.ghost.style,ghostPose({x:event.clientX,y:event.clientY},d.grab,d.scale,d.rotation,0,reducedMotion()?1:1.025));
    safely(onAssist,event);
    d.target=safely(getDropTarget,event,d.ids)??null;
    safely(onTarget,d.target);
  }
  function finish(committed,target,reason,error){
    const d=gesture;if(!d)return;
    gesture=null;
    if(!committed)d.cue.abort();
    d.ghost?.remove();
    if(document.body.hasPointerCapture?.(d.pointerId))safely(()=>document.body.releasePointerCapture(d.pointerId));
    if(d.moved)suppressUntil=now()+400;
    safely(onTarget,null);
    if(committed)selected.clear();
    paint();
    if(d.moved)safely(onEnd,{ids:d.ids,committed,target,reason,...(error?{error}:{})});
  }
  function down(event){
    if(destroyed)return;
    if(gesture){
      // A new primary grab retires the previous packet, including its sound.
      if(event.button===0&&event.isPrimary!==false)finish(false,null,'regrab');
      else return;
    }
    const source=sourceFor(event.target);if(!source||event.button!==0||event.isPrimary===false||isBlocked())return;
    const checkbox=event.target.closest('[data-bundle-select]');
    if(checkbox){consume(event);return;}
    if(event.shiftKey&&allowedSelection(event.target)){consume(event);return;}
    const grip=event.target.closest('.drag-handle,[data-quest-drag]');
    if(!grip||!source.element.contains(grip)||!allowedSelection(event.target))return;
    refresh();
    if(selected.size<2||!selected.has(source.id))return;
    let anchor;
    try{
      if(source.element.matches('.folio-index-row'))anchor={grab:{x:PAPER.width/2,y:28},scale:1,rotation:0};
      else anchor=sourceAnchor({x:event.clientX,y:event.clientY},source.element.getBoundingClientRect(),projection(source.element,document,window));
    }catch{return;}
    lastCue?.abort();
    const CueAbort=window.AbortController??globalThis.AbortController,cue=new CueAbort();lastCue=cue;
    gesture={...anchor,source:source.element,ids:[source.id,...[...selected].filter(id=>id!==source.id)],pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,moved:false,ghost:null,target:null,cue};
    consume(event);safely(()=>window.getSelection?.()?.removeAllRanges());safely(()=>document.body.setPointerCapture(event.pointerId));
  }
  function move(event){
    const d=gesture;if(!d||event.pointerId!==d.pointerId)return;
    consume(event);
    const existing=stateQuests();
    if(d.ids.some(id=>!existing.has(id))){finish(false,null,'deleted');return;}
    if(!d.moved&&Math.abs(event.clientX-d.startX)+Math.abs(event.clientY-d.startY)<=5)return;
    if(!d.moved){
      d.moved=true;
      try{makeGhost(d);}catch(error){finish(false,null,'render-error',error);return;}
      safely(onStart,{ids:d.ids,source:d.source,pointerId:d.pointerId});
      safely(onCue,'paperPick',{signal:d.cue.signal,delay:0});paint();
    }
    update(d,event);
  }
  function up(event){
    const d=gesture;if(!d||event.pointerId!==d.pointerId)return;
    consume(event);move(event);
    if(gesture!==d)return;
    if(!d.moved){finish(false,null,'no-drag');return;}
    const target=d.target;
    if(!target){finish(false,null,'invalid-target');return;}
    try{
      const next=moveQuestBundle(getState(),d.ids,target,{x:event.clientX,y:event.clientY},d.grab);
      commit(next);
      finish(true,target,'drop');
      // Placement is immediate, so contact has no delayed flight to outlive it.
      safely(onCue,target.type==='folder'?'paperSlide':'paperDrop',{signal:d.cue.signal,delay:0});
    }catch(error){finish(false,null,'invalid-drop',error);}
  }
  function cancel(event){
    if(event?.type==='blur'||event?.type==='pagehide')lastCue?.abort();
    if(!gesture||event?.pointerId!==undefined&&event.pointerId!==gesture.pointerId)return;
    finish(false,null,event?.type??'cancel');
  }
  function click(event){
    if(now()<suppressUntil){consume(event);return;}
    if(event.target.closest?.('[data-bundle-clear]')){consume(event);clear();return;}
    const source=sourceFor(event.target);if(!source)return;
    const checkbox=event.target.closest('[data-bundle-select]');
    if(checkbox){consume(event);toggle(source.id);return;}
    if(event.shiftKey&&allowedSelection(event.target)&&!isBlocked()){consume(event);toggle(source.id);}
  }
  function keydown(event){
    if(event.isComposing)return;
    if(event.key==='Escape'&&gesture){consume(event);finish(false,null,'Escape');return;}
    if(event.key==='Escape'&&selected.size&&!event.target.closest?.('input,textarea,select,[contenteditable]')&&!isBlocked()){consume(event);clear();return;}
    if(event.shiftKey&&[' ','Spacebar'].includes(event.key)&&!event.repeat&&!isBlocked()){
      const source=sourceFor(event.target);
      if(source&&allowedSelection(event.target)){consume(event);toggle(source.id);}
    }
  }
  listen(document,'pointerdown',down);listen(document,'click',click);listen(document,'keydown',keydown);
  listen(window,'pointermove',move);listen(window,'pointerup',up);listen(window,'pointercancel',cancel);listen(window,'blur',cancel);listen(window,'pagehide',cancel);listen(document,'lostpointercapture',cancel);
  const Observer=window.MutationObserver;
  if(Observer){observer=new Observer(()=>refresh());observer.observe(document.body,{childList:true,subtree:true});}
  refresh();
  function destroy(){
    if(destroyed)return;
    if(gesture)finish(false,null,'destroy');
    lastCue?.abort();observer?.disconnect();for(const remove of registrations)remove();selected.clear();paint();bar.remove();destroyed=true;
  }
  return {refresh,clear,toggle,get selectedIds(){return [...selected];},get dragging(){return gesture!==null;},destroy};
}
