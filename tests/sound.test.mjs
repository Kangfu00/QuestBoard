import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeskSound } from '../dist/sound.mjs';

const catalog={
  stamp:{clips:['audio/stamp-a.ogg','audio/stamp-b.ogg','audio/stamp-c.ogg'],gain:.4,rate:[.97,1.03],interval:65},
  paper:{clips:['audio/paper.ogg'],gain:.2,rate:[.98,1.02],interval:0},
  shared:{clips:['audio/paper.ogg'],gain:.3,rate:[1,1],interval:0},
};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}

// Web Audio and network are browser boundaries; the engine itself stays real.
function installAudio(t,{stored=null,activation=true,storageFails=false,contextFails=false,resumeFails=false,suspended=false,fetchGate,decodeGate}={}){
  const calls={contexts:[],writes:[],sources:[],gains:[],compressors:[],fetches:[],decodes:[],resumes:0};
  const originals=new Map();
  const replace=(name,value)=>{originals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});};
  t.after(()=>{for(const[name,descriptor]of originals){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}});
  const parameter=()=>({value:0,setValueAtTime(value){this.value=value;},setTargetAtTime(value){this.value=value;}});
  const node=()=>({connections:[],disconnected:false,connect(destination){this.connections.push(destination);},disconnect(){this.disconnected=true;}});
  class AudioContextStub {
    constructor(){if(contextFails)throw new Error('Audio unavailable');this.state=suspended||resumeFails?'suspended':'running';this.currentTime=0;this.destination={};calls.contexts.push(this);}
    createGain(){const gain={...node(),gain:parameter()};calls.gains.push(gain);return gain;}
    createDynamicsCompressor(){const compressor={...node(),threshold:parameter(),knee:parameter(),ratio:parameter(),attack:parameter(),release:parameter()};calls.compressors.push(compressor);return compressor;}
    createBufferSource(){const source={...node(),buffer:null,playbackRate:parameter(),started:false,stopped:false,start(time){if(!source.buffer?.decoded)throw new Error('A decoded recording is required');source.started=true;source.startTime=time;},stop(){source.stopped=true;},onended:null};calls.sources.push(source);return source;}
    decodeAudioData(bytes){calls.decodes.push(bytes);return decodeGate?decodeGate(bytes):Promise.resolve({decoded:true,path:new TextDecoder().decode(bytes),duration:.25});}
    resume(){calls.resumes++;if(resumeFails)return Promise.reject(new Error('Autoplay blocked'));this.state='running';return Promise.resolve();}
  }
  replace('AudioContext',AudioContextStub);replace('webkitAudioContext',undefined);
  replace('navigator',{userActivation:{isActive:activation}});
  replace('localStorage',{getItem(){if(storageFails)throw new Error('Storage blocked');return stored;},setItem(key,value){if(storageFails)throw new Error('Storage blocked');calls.writes.push([key,value]);}});
  replace('fetch',async url=>{const path=String(url);calls.fetches.push(path);if(fetchGate)return fetchGate(path);return {ok:true,arrayBuffer:async()=>new TextEncoder().encode(path).buffer};});
  return calls;
}

function clock(){
  let time=0,id=0;const timers=new Map();
  return {now:()=>time,setTimeout(callback,delay){timers.set(++id,{at:time+delay,callback});return id;},clearTimeout(timer){timers.delete(timer);},advance(milliseconds){time+=milliseconds;for(const[key,timer]of [...timers])if(timer.at<=time){timers.delete(key);timer.callback();}},get pending(){return timers.size;}};
}

test('unknown events, saved mute, and saved zero volume do not unlock audio',async t=>{
  for(const stored of [null,{muted:true,volume:.35},{muted:false,volume:0}])await t.test(JSON.stringify(stored),child=>{
    const calls=installAudio(child,{stored:stored&&JSON.stringify(stored)}),sound=createDeskSound({catalog});
    assert.equal(sound.play('unknown'),false);
    if(stored){assert.deepEqual(sound.getSettings(),stored);assert.equal(sound.play('stamp'),false);assert.equal(sound.prime(),false);}
    assert.equal(calls.contexts.length,0);assert.equal(calls.fetches.length,0);assert.equal(calls.writes.length,0);
  });
});

test('a gesture unlocks audio immediately and later actions play decoded recordings',async t=>{
  const calls=installAudio(t,{activation:false,suspended:true}),sound=createDeskSound({catalog});
  assert.equal(sound.play('stamp'),false);assert.equal(sound.prime(),false);assert.equal(calls.contexts.length,0);
  globalThis.navigator.userActivation.isActive=true;assert.equal(sound.play('stamp'),true);
  assert.equal(calls.resumes,1,'resume must be invoked inside the gesture');globalThis.navigator.userActivation.isActive=false;await flush();
  assert.equal(sound.play('paper'),true);await flush();assert.equal(calls.contexts.length,1);assert.equal(calls.sources.length,2);
  assert.ok(calls.sources.every(source=>source.started&&source.buffer.decoded));assert.ok(calls.sources[0].buffer.path.endsWith('.ogg'));
});

test('prime preloads each distinct recording once, shares pending decoding, and never plays',async t=>{
  const gate=deferred(),calls=installAudio(t,{decodeGate:async bytes=>{await gate.promise;return {decoded:true,path:new TextDecoder().decode(bytes),duration:.25};}}),sound=createDeskSound({catalog});
  assert.equal(sound.prime(),true);assert.equal(sound.prime(),true);assert.equal(sound.play('paper'),true);assert.equal(sound.play('shared'),true);await flush();
  assert.equal(calls.fetches.length,4);assert.equal(calls.decodes.length,4);assert.equal(calls.sources.length,0);
  assert.ok(calls.fetches.every(path=>path.startsWith('file:')&&path.includes('/dist/audio/')),'resolve recordings relative to sound.mjs');
  gate.resolve();await flush();assert.equal(calls.sources.length,2);assert.equal(calls.sources[0].buffer,calls.sources[1].buffer);
  assert.equal(sound.prime(),true);await flush();assert.equal(calls.fetches.length,4);assert.equal(calls.sources.length,2);
});

test('shuffle bags use every variant without repeating across bag boundaries',async t=>{
  const calls=installAudio(t),time=clock();let seed=17;
  const sound=createDeskSound({catalog,...time,random:()=>((seed=seed*16807%2147483647)-1)/2147483646}),paths=[],gains=[],rates=[];
  for(let index=0;index<18;index++){
    assert.equal(sound.play('stamp'),true);await flush();const source=calls.sources.at(-1);
    paths.push(source.buffer.path);gains.push(source.connections[0].gain.value);rates.push(source.playbackRate.value);source.onended();time.advance(100);
  }
  for(let index=1;index<paths.length;index++)assert.notEqual(paths[index],paths[index-1]);
  for(let index=0;index<paths.length;index+=3)assert.equal(new Set(paths.slice(index,index+3)).size,3);
  assert.ok(gains.every(gain=>gain>=.376&&gain<=.424));assert.ok(new Set(gains).size>1);
  assert.ok(rates.every(rate=>rate>=.97&&rate<=1.03));assert.ok(new Set(rates).size>1);
});

test('per-recording normalization multiplies the material gain',async t=>{
  const calls=installAudio(t),sound=createDeskSound({catalog:{paper:{...catalog.paper,clipGains:{'audio/paper.ogg':.25}}},random:()=>.5});
  assert.equal(sound.play('paper'),true);await flush();assert.equal(calls.sources[0].connections[0].gain.value,.05);
});

test('delayed impacts unlock and load immediately but wait until the requested impact',async t=>{
  const calls=installAudio(t,{suspended:true}),time=clock(),sound=createDeskSound({catalog,...time});
  assert.equal(sound.play('paper',{delay:400}),true);assert.equal(calls.resumes,1);assert.equal(calls.fetches.length,1);await flush();assert.equal(calls.sources.length,0);
  time.advance(399);assert.equal(calls.sources.length,0);time.advance(1);assert.equal(calls.sources.filter(source=>source.started).length,1);calls.sources[0].onended();
  assert.equal(sound.play('paper',{delay:50000}),true);await flush();time.advance(1999);assert.equal(calls.sources.length,1);time.advance(1);assert.equal(calls.sources.length,2,'delay is capped at two seconds');
});

test('initial decoding more than 100ms late drops the cue but preserves its cache',async t=>{
  const gate=deferred(),time=clock(),calls=installAudio(t,{decodeGate:async bytes=>{await gate.promise;return {decoded:true,path:new TextDecoder().decode(bytes),duration:.25};}}),sound=createDeskSound({catalog,...time});
  assert.equal(sound.play('paper'),true);await flush();time.advance(101);gate.resolve();await flush();assert.equal(calls.sources.length,0);
  assert.equal(sound.play('paper'),true);await flush();assert.equal(calls.sources.length,1);assert.equal(calls.decodes.length,1);
});

test('a stalled recording releases all six voice slots at the 101ms deadline',async t=>{
  const gate=deferred(),time=clock();installAudio(t,{decodeGate:()=>gate.promise});
  const sound=createDeskSound({catalog,...time});
  for(let index=0;index<6;index++)assert.equal(sound.play('paper'),true);
  assert.equal(sound.play('shared'),false);time.advance(101);
  assert.equal(sound.play('shared'),true);sound.setMuted(true);gate.resolve(null);await flush();
});

test('a delayed cue is discarded when decoding finishes 101ms after its impact',async t=>{
  const gate=deferred(),time=clock(),calls=installAudio(t,{decodeGate:async bytes=>{await gate.promise;return {decoded:true,path:new TextDecoder().decode(bytes),duration:.25};}}),sound=createDeskSound({catalog,...time});
  assert.equal(sound.play('paper',{delay:400}),true);await flush();time.advance(501);gate.resolve();await flush();
  assert.equal(calls.sources.length,0);assert.equal(time.pending,0);
});

test('slow decoding cannot play a paper landing after its 600ms arrival has finished',async t=>{
  const gate=deferred(),time=clock(),calls=installAudio(t,{decodeGate:async bytes=>{await gate.promise;return {decoded:true,path:new TextDecoder().decode(bytes),duration:.25};}});
  const sound=createDeskSound({catalog:{paperDrop:catalog.paper},...time});
  assert.equal(sound.play('paperDrop',{delay:456}),true);await flush();
  time.advance(600);gate.resolve();await flush();assert.equal(calls.sources.length,0);assert.equal(time.pending,0);
});

test('muting pending decoding cancels the cue permanently, even after unmuting',async t=>{
  const gate=deferred(),calls=installAudio(t,{decodeGate:async bytes=>{await gate.promise;return {decoded:true,path:new TextDecoder().decode(bytes),duration:.25};}}),sound=createDeskSound({catalog});
  sound.play('paper');await flush();sound.setMuted(true);sound.setMuted(false);gate.resolve();await flush();assert.equal(calls.sources.length,0);
  assert.equal(sound.play('paper'),true);await flush();assert.equal(calls.sources.length,1);
});

test('mute and zero volume cancel delayed impacts and stop active recordings',async t=>{
  for(const silence of [sound=>sound.setMuted(true),sound=>sound.setVolume(0)])await t.test(silence.toString(),async child=>{
    const calls=installAudio(child),time=clock(),sound=createDeskSound({catalog,...time});
    sound.play('paper');await flush();const active=calls.sources[0];sound.play('shared',{delay:400});await flush();assert.equal(time.pending,1);
    silence(sound);assert.equal(active.stopped,true);assert.equal(active.disconnected,true);assert.equal(time.pending,0);
    sound.setMuted(false);sound.setVolume(.65);time.advance(400);assert.equal(calls.sources.length,1);
  });
});

test('abort signals cancel pending loading, scheduled impacts, and reject pre-aborted cues',async t=>{
  const gate=deferred(),time=clock(),calls=installAudio(t,{decodeGate:async bytes=>{await gate.promise;return {decoded:true,path:new TextDecoder().decode(bytes),duration:.25};}}),sound=createDeskSound({catalog,...time}),first=new AbortController();
  sound.play('paper',{signal:first.signal});first.abort();gate.resolve();await flush();assert.equal(calls.sources.length,0);assert.equal(sound.play('paper',{signal:first.signal}),false);
  const second=new AbortController();sound.play('paper',{delay:500,signal:second.signal});await flush();assert.equal(time.pending,1);second.abort();assert.equal(time.pending,0);time.advance(500);assert.equal(calls.sources.length,0);
});

test('six pending or active voices share a compressor and release capacity when ended',async t=>{
  const calls=installAudio(t),sound=createDeskSound({catalog});
  for(let index=0;index<6;index++)assert.equal(sound.play('paper'),true);assert.equal(sound.play('shared'),false);await flush();assert.equal(calls.sources.length,6);
  const master=calls.gains[0],compressor=calls.compressors[0];assert.equal(calls.compressors.length,1);assert.deepEqual(master.connections,[compressor]);assert.deepEqual(compressor.connections,[calls.contexts[0].destination]);
  assert.ok(compressor.threshold.value<=-3);assert.ok(compressor.ratio.value>=12);assert.ok(compressor.knee.value<=6);assert.ok(compressor.attack.value<=.003);assert.ok(compressor.release.value>0);
  for(const source of calls.sources)assert.equal(source.connections[0].connections[0],master);
  calls.sources[0].onended();assert.equal(sound.play('shared'),true);await flush();assert.equal(calls.sources.length,7);
});

test('repeat throttling does not suppress independent material cues',async t=>{
  installAudio(t);const time=clock(),sound=createDeskSound({catalog,...time});
  assert.equal(sound.play('stamp'),true);assert.equal(sound.play('stamp'),false);assert.equal(sound.play('paper'),true);
  time.advance(64);assert.equal(sound.play('stamp'),false);time.advance(1);assert.equal(sound.play('stamp'),true);await flush();
});

test('saved volume keeps the output gain, bounded controls, storage key, and immutable snapshots',async t=>{
  const calls=installAudio(t,{stored:JSON.stringify({muted:false,volume:.35})}),sound=createDeskSound({catalog});
  assert.equal(sound.play('paper'),true);await flush();const master=calls.gains[0];
  assert.equal(master.gain.value,.42);sound.setVolume(.5);assert.equal(master.gain.value,.6);sound.setMuted(true);assert.equal(master.gain.value,0);
  sound.setMuted(false);assert.equal(master.gain.value,.6);sound.setVolume(3);sound.setVolume(NaN);sound.getSettings().volume=0;
  assert.deepEqual(sound.getSettings(),{muted:false,volume:1});sound.setVolume(-1);assert.equal(master.gain.value,0);
  assert.equal(calls.writes.at(-1)[0],'questboard-desk-sound-v1');assert.deepEqual(JSON.parse(calls.writes.at(-1)[1]),{muted:false,volume:0});
});

test('unavailable APIs and blocked storage never interrupt desk actions',async t=>{
  for(const unavailable of ['constructor','AudioContext','fetch'])await t.test(unavailable,async child=>{
    installAudio(child,{storageFails:true,contextFails:unavailable==='constructor'});if(unavailable!=='constructor')globalThis[unavailable]=undefined;
    const sound=createDeskSound({catalog});assert.deepEqual(sound.getSettings(),{muted:false,volume:.65});assert.doesNotThrow(()=>sound.setMuted(false));assert.doesNotThrow(()=>sound.setVolume(.4));assert.equal(sound.play('paper'),false);assert.equal(sound.prime(),false);await flush();
  });
});

test('fetch and decode failures are caught and retried on a subsequent action',async t=>{
  for(const failure of ['http','network','decode'])await t.test(failure,async child=>{
    let attempt=0;const calls=installAudio(child,{
      fetchGate:async path=>{if(failure!=='decode'&&attempt++===0){if(failure==='network')throw new Error('Offline');return {ok:false};}return {ok:true,arrayBuffer:async()=>new TextEncoder().encode(path).buffer};},
      decodeGate:async bytes=>{if(failure==='decode'&&attempt++===0)throw new Error('Bad audio');return {decoded:true,path:new TextDecoder().decode(bytes),duration:.25};},
    }),sound=createDeskSound({catalog});
    assert.equal(sound.play('paper'),true);await flush();assert.equal(calls.sources.length,0);assert.equal(sound.play('paper'),true);await flush();assert.equal(calls.sources.length,1);assert.equal(calls.fetches.length,2);
  });
});

test('a rejected resume never plays and releases pending voice capacity',async t=>{
  const calls=installAudio(t,{resumeFails:true}),sound=createDeskSound({catalog});
  for(let index=0;index<8;index++){assert.equal(sound.play('paper'),true);await flush();}assert.equal(calls.sources.length,0);assert.ok(calls.resumes>=1);
});

test('a closed context is replaced on the next gesture even when every voice slot was occupied',async t=>{
  const calls=installAudio(t),sound=createDeskSound({catalog});
  for(let index=0;index<6;index++)assert.equal(sound.play('paper'),true);await flush();
  calls.contexts[0].state='closed';assert.equal(sound.play('shared'),true);await flush();
  assert.equal(calls.contexts.length,2);assert.equal(calls.sources.length,7);assert.ok(calls.sources.slice(0,6).every(source=>source.stopped));
});

test('malformed cue options cannot throw into an input handler',t=>{
  const calls=installAudio(t),sound=createDeskSound({catalog});
  assert.equal(sound.play('paper',null),false);assert.equal(calls.contexts.length,0);
});
