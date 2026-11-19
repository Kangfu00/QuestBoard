import {resolveStampSurface} from './stamp-surfaces.mjs';
import {animateTransient,cancelMotion} from './desk-motion.mjs';
import {MOTION_DURATION,MOTION_TIMING} from './motion-tokens.mjs';

const ghosts='.quest-drag-ghost,.quest-bundle-ghost,.paper-turn-ghost,.paper-turn-strip,.folio-closing-ghost,.folder-drag-ghost';
const availability=['hidden','inert','aria-hidden','style','class','data-side','open','data-id','data-storage-id','data-folio-paper','data-reader-quest','data-open-folder'];
const duration=MOTION_DURATION.questUnlock;

/** A short, local release of the dependency knot; paper state never waits for it. */
export function createQuestUnlockEffects({document=globalThis.document,window=globalThis.window,reducedMotion=()=>false}={}){
  const records=new Set(),listeners=[];
  let destroyed=false,observing=false;
  const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const reduced=()=>Boolean((typeof reducedMotion==='function'?reducedMotion():reducedMotion)||media?.matches);
  const later=(fn,delay)=>(window.setTimeout??globalThis.setTimeout).call(window,fn,delay);
  const clearLater=id=>(window.clearTimeout??globalThis.clearTimeout).call(window,id);
  const listen=(target,type,fn,options=false)=>{target?.addEventListener?.(type,fn,options);listeners.push(()=>target?.removeEventListener?.(type,fn,options));};

  function surface(paper){
    if(!paper||paper.isConnected===false||paper.closest?.(ghosts))return null;
    for(let node=paper;node;node=node.parentElement){
      if(node.hidden||node.inert||node.hasAttribute?.('hidden')||node.hasAttribute?.('inert')||node.getAttribute?.('aria-hidden')==='true')return null;
      const style=window.getComputedStyle?.(node);
      if(style?.display==='none'||style?.visibility==='hidden'||style?.visibility==='collapse')return null;
    }
    const resolved=resolveStampSurface(paper);if(resolved)return resolved;
    const host=paper.closest?.('#drawer-list');
    if(host&&paper.dataset.storageId)return {id:paper.dataset.storageId,paper,host,kind:'tray'};
    return null;
  }
  function retire(record){
    if(!records.delete(record))return;
    clearLater(record.timer);
    for(const node of record.nodes)cancelMotion(node);
    record.effect.remove();
    if(!records.size){observer?.disconnect();observing=false;}
  }
  function cancelAll(){for(const record of [...records])retire(record);}
  function validate(){
    if(reduced()){cancelAll();return;}
    for(const record of [...records]){
      const current=surface(record.paper);
      if(!record.effect.isConnected||!record.paper.contains(record.anchor)||record.effect.parentElement!==record.anchor||!current||current.id!==record.id||current.host!==record.host||current.kind!==record.kind)retire(record);
    }
  }
  const observer=window.MutationObserver?new window.MutationObserver(validate):null;
  function watch(){
    if(!observing&&records.size&&document.body){observer?.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:availability});observing=Boolean(observer);}
  }
  function child(parent,className){const node=document.createElement('span');node.className=className;parent.append(node);return node;}
  function decorate(current){
    const {paper}=current,badge=paper.querySelector('.quest-dependency-badge'),metadata=paper.querySelector('.quest-metadata'),anchor=badge??metadata??paper;
    const effect=document.createElement('span');
    effect.className=`quest-unlock-effect${badge?'':metadata?' quest-unlock-at-metadata':' quest-unlock-at-paper'}`;
    effect.setAttribute('aria-hidden','true');effect.inert=true;effect.style.pointerEvents='none';
    const ring=child(effect,'quest-unlock-ring'),left=child(effect,'quest-unlock-cord quest-unlock-cord-left'),right=child(effect,'quest-unlock-cord quest-unlock-cord-right'),lock=child(effect,'quest-unlock-lock');
    anchor.append(effect);
    const record={...current,anchor,effect,nodes:[],promises:[],timer:null};records.add(record);
    const motion=[
      [ring,[{opacity:0,transform:'scale(.35)',offset:0},{opacity:.65,transform:'scale(.9)',offset:.25},{opacity:0,transform:'scale(1.8)',offset:1}]],
      [left,[{opacity:.8,transform:'translate(0,0) rotate(0deg)',offset:0},{opacity:.7,transform:'translate(-3px,1px) rotate(-23deg)',offset:.38},{opacity:0,transform:'translate(-8px,3px) rotate(-36deg)',offset:1}]],
      [right,[{opacity:.8,transform:'translate(0,0) rotate(0deg)',offset:0},{opacity:.7,transform:'translate(3px,1px) rotate(23deg)',offset:.38},{opacity:0,transform:'translate(8px,3px) rotate(36deg)',offset:1}]],
      [lock,[{opacity:.85,transform:'translateY(0) rotate(0deg)',offset:0},{opacity:.85,transform:'translateY(-3px) rotate(-16deg)',offset:.32},{opacity:0,transform:'translateY(4px) rotate(-27deg)',offset:1}]],
    ];
    try{
      for(const [node,keyframes]of motion){
        if(typeof node.animate!=='function')throw new Error('Animation unavailable');
        let started=false;
        record.nodes.push(node);
        const promise=animateTransient(node,keyframes,MOTION_TIMING.questUnlock,{
          onStart(){started=true;},
          onFinish(completed){if(!completed)retire(record);},
        });
        if(!started)throw new Error('Animation unavailable');
        record.promises.push(promise);
      }
      Promise.all(record.promises).then(()=>retire(record));
      record.timer=later(()=>retire(record),duration+120);
      watch();
    }catch{retire(record);}
  }
  function play(ids){
    cancelAll();if(destroyed||reduced())return;
    const wanted=new Set(Array.isArray(ids)?ids.filter(id=>typeof id==='string'&&id):[]);if(!wanted.size)return;
    for(const paper of document.querySelectorAll('.quest-paper')){const current=surface(paper);if(current&&wanted.has(current.id))decorate(current);}
  }
  const pointerDown=event=>{if(event.target?.closest?.('.quest-paper'))cancelAll();};
  listen(document,'pointerdown',pointerDown,true);
  listen(window,'blur',cancelAll);listen(window,'resize',cancelAll);listen(window,'pagehide',cancelAll);
  if(media?.addEventListener)listen(media,'change',validate);
  else if(media?.addListener){media.addListener(validate);listeners.push(()=>media.removeListener(validate));}
  function destroy(){if(destroyed)return;destroyed=true;cancelAll();observer?.disconnect();for(const remove of listeners)remove();listeners.length=0;}
  return {play,cancelAll,destroy};
}
