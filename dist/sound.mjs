import { DESK_SOUNDS } from './sound-catalog.mjs';

const STORAGE_KEY='questboard-desk-sound-v1';
const MAX_VOICES=6;
const OUTPUT_GAIN=1.2;
// Missed contact sounds should disappear before their visual motion finishes.
const MAX_CUE_LATENESS=100;
const MAX_DELAY=2000;

function readSettings(){
  const defaults={muted:false,volume:.65};
  try{
    const saved=JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY)??'null');
    if(saved&&typeof saved==='object'){
      if(typeof saved.muted==='boolean')defaults.muted=saved.muted;
      if(typeof saved.volume==='number'&&Number.isFinite(saved.volume))defaults.volume=Math.max(0,Math.min(1,saved.volume));
    }
  }catch{}
  return defaults;
}

/** Local recorded foley. play/prime synchronously accept a cue and never block UI. */
export function createDeskSound(options={}){
  const catalog=options.catalog??DESK_SOUNDS;
  const random=options.random??Math.random;
  const now=options.now??(()=>globalThis.performance?.now()??Date.now());
  const schedule=options.setTimeout??globalThis.setTimeout.bind(globalThis);
  const cancelTimer=options.clearTimeout??globalThis.clearTimeout.bind(globalThis);
  const settings=readSettings(),voices=new Set(),lastPlayed=new Map(),bags=new Map(),buffers=new Map();
  let context=null,master=null,resuming=null;
  const getSettings=()=>({...settings});
  const gestureActive=()=>globalThis.navigator?.userActivation?.isActive!==false;
  const silent=()=>settings.muted||settings.volume===0;

  function release(voice){
    if(voice.finished)return;
    voice.finished=true;
    voices.delete(voice);
    if(voice.timer!==null){try{cancelTimer(voice.timer);}catch{}voice.timer=null;}
    try{voice.signal?.removeEventListener('abort',voice.abort);}catch{}
    for(const node of voice.nodes){
      if('onended' in node)node.onended=null;
      try{node.stop?.();}catch{}
      try{node.disconnect();}catch{}
    }
  }

  function persist(){
    try{globalThis.localStorage?.setItem(STORAGE_KEY,JSON.stringify(settings));}catch{}
    if(silent())for(const voice of voices)release(voice);
    try{
      if(master&&context?.state!=='closed')master.gain.setTargetAtTime(settings.muted?0:settings.volume*OUTPUT_GAIN,context.currentTime,.015);
    }catch{}
  }

  function setMuted(muted){
    if(typeof muted==='boolean'){settings.muted=muted;persist();}
    return getSettings();
  }

  function setVolume(volume){
    if(typeof volume==='number'&&Number.isFinite(volume)){settings.volume=Math.max(0,Math.min(1,volume));persist();}
    return getSettings();
  }

  function unlock(){
    if(silent()||typeof globalThis.fetch!=='function')return null;
    if(!context||context.state==='closed'){
      if(!gestureActive())return null;
      const AudioContext=globalThis.AudioContext??globalThis.webkitAudioContext;
      if(!AudioContext)return null;
      for(const voice of voices)release(voice);
      const audio=new AudioContext(),output=audio.createGain(),compressor=audio.createDynamicsCompressor();
      output.gain.value=settings.volume*OUTPUT_GAIN;
      // Shared peak protection also covers overlapping paper and impact sounds.
      compressor.threshold.value=-3;
      compressor.knee.value=3;
      compressor.ratio.value=20;
      compressor.attack.value=.001;
      compressor.release.value=.08;
      output.connect(compressor);compressor.connect(audio.destination);
      context=audio;master=output;resuming=null;
    }
    if(context.state==='running')return {audio:context,ready:Promise.resolve(true)};
    if(!gestureActive())return null;
    if(!resuming){
      const audio=context;
      // Invoke resume before leaving the input event, including for delayed cues.
      const pending=Promise.resolve(audio.resume()).then(()=>audio.state==='running').catch(()=>false);
      resuming=pending;
      pending.then(()=>{if(resuming===pending)resuming=null;});
    }
    return {audio:context,ready:resuming};
  }

  function loadClip(audio,path){
    if(buffers.has(path))return buffers.get(path);
    const pending=(async()=>{
      const response=await globalThis.fetch(new URL(path,import.meta.url));
      if(!response.ok)throw new Error('Foley recording unavailable');
      const buffer=await audio.decodeAudioData(await response.arrayBuffer());
      if(!buffer)throw new Error('Foley recording could not be decoded');
      return buffer;
    })().catch(()=>{
      // A failed preload may retry on a later input; there is no retry loop.
      if(buffers.get(path)===pending)buffers.delete(path);
      return null;
    });
    buffers.set(path,pending);
    return pending;
  }

  function chooseClip(name,recipe){
    let state=bags.get(name);
    if(!state){state={remaining:[],previous:null};bags.set(name,state);}
    if(!state.remaining.length){
      state.remaining=[...new Set(recipe.clips)];
      for(let index=state.remaining.length-1;index>0;index--){
        const other=Math.floor(random()*(index+1));
        [state.remaining[index],state.remaining[other]]=[state.remaining[other],state.remaining[index]];
      }
      if(state.remaining.length>1&&state.remaining[0]===state.previous){
        [state.remaining[0],state.remaining[1]]=[state.remaining[1],state.remaining[0]];
      }
    }
    state.previous=state.remaining.shift();
    return state.previous;
  }

  function start(voice,recipe,path,buffer){
    if(voice.finished)return;
    if(silent()||voice.signal?.aborted||voice.audio!==context||context.state!=='running'||now()-voice.due>MAX_CUE_LATENESS){release(voice);return;}
    try{
      const source=context.createBufferSource(),gain=context.createGain();
      voice.nodes.push(source,gain);
      source.buffer=buffer;
      const [minimum=1,maximum=minimum]=recipe.rate??[];
      source.playbackRate.value=minimum+random()*(maximum-minimum);
      gain.gain.value=(recipe.gain??1)*(recipe.clipGains?.[path]??1)*(.94+random()*.12);
      source.connect(gain);gain.connect(master);
      source.onended=()=>release(voice);
      source.start(context.currentTime);
    }catch{release(voice);}
  }

  function prime(){
    try{
      const unlocked=unlock();
      if(!unlocked)return false;
      for(const recipe of Object.values(catalog))for(const path of recipe.clips??[])loadClip(unlocked.audio,path);
      return true;
    }catch{return false;}
  }

  function play(name,cue={}){
    let voice;
    try{
      if(!cue||typeof cue!=='object')return false;
      const {delay=0,signal}=cue;
      const recipe=Object.hasOwn(catalog,name)?catalog[name]:null;
      if(!recipe?.clips?.length||silent()||signal?.aborted)return false;
      if(context?.state==='closed')for(const active of voices)release(active);
      const requested=now();
      if(voices.size>=MAX_VOICES||requested-(lastPlayed.get(name)??-Infinity)<(recipe.interval??0))return false;
      const unlocked=unlock();
      if(!unlocked)return false;
      const path=chooseClip(name,recipe),due=requested+Math.max(0,Math.min(MAX_DELAY,Number.isFinite(delay)?delay:0));
      voice={nodes:[],finished:false,timer:null,audio:unlocked.audio,due,signal,abort:null};
      voice.abort=()=>release(voice);
      voices.add(voice);
      signal?.addEventListener('abort',voice.abort,{once:true});
      // Stalled fetch/decode cannot reserve one of the six voice slots forever.
      voice.timer=schedule(()=>release(voice),due-requested+MAX_CUE_LATENESS+1);
      const loading=loadClip(unlocked.audio,path);
      Promise.all([unlocked.ready,loading]).then(([ready,buffer])=>{
        if(voice.finished)return;
        if(!ready||!buffer||silent()||signal?.aborted||now()-due>MAX_CUE_LATENESS){release(voice);return;}
        cancelTimer(voice.timer);voice.timer=null;
        const remaining=due-now();
        if(remaining>0)voice.timer=schedule(()=>{voice.timer=null;start(voice,recipe,path,buffer);},remaining);
        else start(voice,recipe,path,buffer);
      }).catch(()=>release(voice));
      lastPlayed.set(name,requested);
      return true;
    }catch{
      if(voice)release(voice);
      return false;
    }
  }

  return {play,prime,setMuted,setVolume,getSettings};
}
