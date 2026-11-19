import {PAPER} from './paper-format.mjs';
import {animateTransient,cancelMotion} from './desk-motion.mjs';
import {MOTION_DURATION,MOTION_EASING} from './motion-tokens.mjs';

const positive=(value,fallback)=>Number.isFinite(value)&&value>0?value:fallback;

// These effects own only temporary DOM/animation resources. The caller commits
// the quest immediately, so cancellation never changes its storage or position.
export function createPaperEffects({
  document=globalThis.document,window=globalThis.window,
  reducedMotion=()=>false,
  requestAnimationFrame=globalThis.requestAnimationFrame?.bind(globalThis),
  cancelAnimationFrame=globalThis.cancelAnimationFrame?.bind(globalThis),
  onCue,
}={}) {
  const stores=new Set(),entries=new Map();
  const reduce=()=>typeof reducedMotion==='function'?reducedMotion():!!reducedMotion;
  const viewport=()=>[window?.innerWidth??document?.documentElement?.clientWidth,window?.innerHeight??document?.documentElement?.clientHeight];
  const cue=(name,controller,delay=0)=>{
    try{Promise.resolve(onCue?.(name,{delay,signal:controller.signal})).catch(()=>{});}catch{}
  };

  function motion(state,element,keyframes,options){
    if(state.stopped||typeof element?.animate!=='function')return Promise.resolve(false);
    let cancelled=false;
    const cancel=()=>{cancelled=true;cancelMotion(element);};
    state.cancelAnimation=cancel;
    return animateTransient(element,keyframes,options).then(completed=>{
      if(state.cancelAnimation===cancel)state.cancelAnimation=null;
      return completed&&!cancelled&&!state.stopped;
    });
  }

  function readSlot(slot){
    if(!slot||slot.isConnected===false||slot.hidden||slot.closest?.('[hidden], [inert]'))return null;
    const rect=slot.getBoundingClientRect();
    if(![rect.left,rect.top,rect.width,rect.height].every(Number.isFinite)||rect.width<=0||rect.height<=0)return null;
    return {left:rect.left,top:rect.top,width:rect.width,height:rect.height,bottom:rect.top+rect.height};
  }

  async function store(ghost,slotElement,{scale=1,height=PAPER.height,material='paper'}={}){
    if(!ghost)return;
    // Reusing a transient cannot leave an older watcher or mask in charge.
    for(const active of stores)if(active.ghost===ghost)active.cancel();
    const state={ghost,stopped:false,completed:false,mask:null,frame:null,cancelAnimation:null,cues:new AbortController()};
    const slide=material==='folder'?'folderSlide':'paperSlide';
    state.cancel=()=>{
      if(state.stopped)return;state.stopped=true;
      if(!state.completed)state.cues.abort();
      state.cancelAnimation?.();
      if(state.frame!==null)cancelAnimationFrame?.(state.frame);
      state.frame=null;
      ghost.remove();state.mask?.remove();stores.delete(state);
    };
    stores.add(state);
    try{
      if(reduce()||typeof ghost.animate!=='function'){
        cue(slide,state.cues);state.completed=true;return;
      }
      const slot=readSlot(slotElement);if(!slot)return;
      const initialViewport=viewport();
      const valid=()=>{
        if(state.stopped||ghost.isConnected===false||reduce())return false;
        const current=readSlot(slotElement),size=viewport();
        return !!current&&['left','top','width','height'].every(key=>Math.abs(current[key]-slot[key])<1)
          &&size.every((value,index)=>value===initialViewport[index]);
      };
      const watch=()=>{
        state.frame=null;
        try{if(!valid()){state.cancel();return;}}catch{state.cancel();return;}
        state.frame=requestAnimationFrame?.(watch)??null;
      };
      state.frame=requestAnimationFrame?.(watch)??null;

      const width=positive(ghost.offsetWidth,PAPER.width),paperHeight=positive(height,PAPER.height);
      const fit=Math.min(positive(scale,1),slot.width*.8/width);
      const computed=window?.getComputedStyle?.(ghost)??ghost.style;
      const origin=computed.transformOrigin||ghost.style.transformOrigin||'50% 50%';
      const parts=origin.split(/\s+/);
      const coordinate=(part,length)=>part==='center'?length/2:part?.endsWith('%')?parseFloat(part)*length/100:parseFloat(part)||0;
      const grab={x:coordinate(parts[0],width),y:coordinate(parts[1]??parts[0],paperHeight)};
      const from={left:computed.left||ghost.style.left,top:computed.top||ghost.style.top,
        transform:computed.transform||ghost.style.transform,transformOrigin:origin};
      const mouth=slot.bottom-12;
      const approach={left:`${slot.left+slot.width/2-width*fit/2-grab.x*(1-fit)}px`,
        top:`${mouth-paperHeight*fit-grab.y*(1-fit)}px`,transform:`rotate(0deg) scale(${fit})`,transformOrigin:origin};
      if(!await motion(state,ghost,[from,approach],{duration:MOTION_DURATION.approach,easing:MOTION_EASING.approach,fill:'forwards'})||!valid())return;

      // Freeze the reached viewport pose before moving the fixed ghost into a
      // viewport-sized clip. No origin reset or wrapper transform can jump it.
      Object.assign(ghost.style,approach);
      const mask=document.createElement('div');state.mask=mask;
      mask.className='drawer-feed-mask';mask.inert=true;mask.setAttribute('aria-hidden','true');
      Object.assign(mask.style,{position:'fixed',inset:'0',pointerEvents:'none',zIndex:ghost.style.zIndex||'180',
        clipPath:`inset(0 0 calc(100% - ${mouth}px) 0)`});
      mask.style.setProperty('--mouth-y',`${mouth}px`);
      document.body.append(mask);mask.append(ghost);
      const swallowed={...approach,top:`${parseFloat(approach.top)+paperHeight*fit+14}px`};
      cue(slide,state.cues);
      state.completed=await motion(state,ghost,[approach,swallowed],{duration:MOTION_DURATION.storeFeed,easing:MOTION_EASING.feed,fill:'forwards'});
    }catch{
      // Unavailable layout/WAAPI affects only the flourish, never the quest.
    }finally{state.cancel();}
  }

  function cancelEntry(paper){entries.get(paper)?.cancel();}

  async function enter(paper,{source,scale=1,rotation=0}={}){
    if(!paper)return;
    cancelEntry(paper);
    if(reduce()||typeof paper.animate!=='function'||!Number.isFinite(source?.x)||!Number.isFinite(source?.y)){
      const controller=new AbortController();cue('paperUnfold',controller);cue('paperDrop',controller);return;
    }
    const state={stopped:false,completed:false,cancelAnimation:null,cues:new AbortController()};
    const priorDuration=paper.style.getPropertyValue?.('--paper-arrival-duration')??'';
    state.cancel=()=>{
      if(state.stopped)return;state.stopped=true;
      if(!state.completed)state.cues.abort();
      state.cancelAnimation?.();
      paper.classList?.remove('paper-arriving');
      if(priorDuration)paper.style.setProperty('--paper-arrival-duration',priorDuration);
      else paper.style.removeProperty?.('--paper-arrival-duration');
      if(entries.get(paper)===state)entries.delete(paper);
    };
    entries.set(paper,state);
    try{
      const rect=paper.getBoundingClientRect(),zoom=positive(scale,1);
      const dx=(source.x-rect.left-rect.width/2)/zoom,dy=(source.y-rect.top-rect.height/2)/zoom;
      if(!Number.isFinite(dx)||!Number.isFinite(dy))return;
      const angle=Number.isFinite(rotation)?rotation:0;
      paper.style.setProperty('--paper-arrival-duration',`${MOTION_DURATION.retrieve}ms`);paper.classList?.add('paper-arriving');
      cue('paperUnfold',state.cues);cue('paperDrop',state.cues,456);
      state.completed=await motion(state,paper,[
        {transform:`translate(${dx}px, ${dy}px) rotate(0deg) scale(0.18, 0.08)`,transformOrigin:'50% 50%'},
        {transform:`translate(${dx*.04}px, ${dy*.04}px) rotate(${angle+.7}deg) scale(0.98, 1.04)`,transformOrigin:'50% 50%',offset:.76},
        {transform:`translate(0px, 0px) rotate(${angle}deg) scale(1)`,transformOrigin:'50% 50%'},
      ],{duration:MOTION_DURATION.retrieve,easing:MOTION_EASING.unfold,fill:'both'});
    }catch{
      // Keep the real paper usable even if the visual animation cannot start.
    }finally{state.cancel();}
  }

  function cancelAll(){
    for(const state of [...stores])state.cancel();
    for(const state of [...entries.values()])state.cancel();
  }
  return {store,enter,cancelAll,cancelEntry};
}
