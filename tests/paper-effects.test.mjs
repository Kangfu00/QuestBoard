import test from 'node:test';
import assert from 'node:assert/strict';
import {createPaperEffects} from '../dist/paper-effects.mjs';
import {PAPER} from '../dist/paper-format.mjs';

// DOM and WAAPI are the external boundary. Keep their completion/cancellation
// separate so a cancelled approach can never start a later feed animation.
function element({width=PAPER.width,height=PAPER.height,left=100,top=100}={}){
  const classes=new Set();
  const node={style:{setProperty(name,value){this[name]=value;},getPropertyValue(name){return this[name]??'';},removeProperty(name){delete this[name];}},children:[],parentNode:null,
    classList:{add(...names){names.forEach(name=>classes.add(name));},remove(...names){names.forEach(name=>classes.delete(name));},contains(name){return classes.has(name);}},
    offsetWidth:width,offsetHeight:height,isConnected:true,hidden:false,inert:false,attributes:{},
    rect:{left,top,width,height,bottom:top+height,right:left+width},
    getBoundingClientRect(){return {...this.rect};},closest(){return null;},
    setAttribute(name,value){this.attributes[name]=value;},
    append(child){child.parentNode?.children.splice(child.parentNode.children.indexOf(child),1);this.children.push(child);child.parentNode=this;child.isConnected=this.isConnected;},
    remove(){this.isConnected=false;for(const child of this.children)child.isConnected=false;if(this.parentNode){this.parentNode.children.splice(this.parentNode.children.indexOf(this),1);this.parentNode=null;}},
    animations:[],animate(keyframes,options){
      let resolve,reject;
      const animation={keyframes,options,cancelled:false,finished:new Promise((yes,no)=>{resolve=yes;reject=no;}),
        finish(){resolve();},cancel(){this.cancelled=true;reject(new Error('Cancelled'));},fail(){reject(new Error('Animation failed'));}};
      this.animations.push(animation);return animation;
    },
  };
  return node;
}
function desk({reduced=false,onCue}={}){
  const body=element(),masks=[],frames=new Map();let nextFrame=1;
  const document={body,documentElement:{clientWidth:1200,clientHeight:900},createElement(){const mask=element();masks.push(mask);return mask;}};
  const window={innerWidth:1200,innerHeight:900,getComputedStyle:node=>node.style};
  const effects=createPaperEffects({document,window,reducedMotion:()=>reduced,onCue,
    requestAnimationFrame(fn){const id=nextFrame++;frames.set(id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);}});
  const ghost=element();Object.assign(ghost.style,{left:'90px',top:'120px',transform:'rotate(7deg) scale(1.025)',transformOrigin:'30px 40px',zIndex:'180'});body.append(ghost);
  const slot=element({width:240,height:100,left:700,top:500});body.append(slot);
  return {effects,ghost,slot,masks,frames,window,body,tick(){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());}};
}
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
const pose=frame=>({left:parseFloat(frame.left),top:parseFloat(frame.top),scale:Number(frame.transform.match(/scale\(([^,)]+)/)?.[1])});

test('storage approaches the actual drawer mouth from the retained pointer pose',async()=>{
  const h=desk(),completion=h.effects.store(h.ghost,h.slot);
  const approach=h.ghost.animations[0];
  assert.deepEqual(approach.keyframes[0],{left:'90px',top:'120px',transform:'rotate(7deg) scale(1.025)',transformOrigin:'30px 40px'});
  const end=approach.keyframes.at(-1),p=pose(end);
  // 240px mouth * .8 = 192px paper width; origin stays at the grabbed pixel.
  assert.equal(p.scale,.64);
  assert.equal(p.left+30*(1-p.scale)+300*p.scale/2,820);
  assert.equal(p.top+40*(1-p.scale)+PAPER.height*p.scale,588);
  assert.equal(end.transformOrigin,'30px 40px');assert.match(end.transform,/rotate\(0deg\)/);
  assert.equal(h.masks.length,0,'the free approach must not be clipped');
  h.effects.cancelAll();await completion;
});

test('storage feeds below the lip without fading and removes every transient after finishing',async()=>{
  const h=desk(),completion=h.effects.store(h.ghost,h.slot);
  h.ghost.animations[0].finish();await flush();
  assert.equal(h.ghost.animations.length,2);
  const mask=h.masks[0],feed=h.ghost.animations[1];
  assert.equal(mask.className,'drawer-feed-mask');assert.equal(mask.inert,true);
  assert.equal(mask.attributes['aria-hidden'],'true');assert.equal(mask.style.pointerEvents,'none');
  assert.equal(mask.style.position,'fixed');assert.equal(mask.style.inset,'0');
  assert.equal(mask.style['--mouth-y'],'588px');
  assert.match(mask.style.clipPath,/588px/);
  assert.equal(h.ghost.parentNode,mask);
  assert.deepEqual(feed.keyframes[0],h.ghost.animations[0].keyframes.at(-1),'reparenting preserves the reached pose');
  for(const animation of h.ghost.animations)for(const frame of animation.keyframes)assert.equal('opacity' in frame,false);
  const end=pose(feed.keyframes.at(-1));
  assert.ok(end.top+40*(1-end.scale)>588,'the entire sheet finishes below the clipping mouth');
  feed.finish();await completion;
  assert.equal(h.ghost.isConnected,false);assert.equal(mask.isConnected,false);assert.equal(h.frames.size,0);
});

test('cancelling an approach prevents a late completion from building a stale feed mask',async()=>{
  const h=desk(),completion=h.effects.store(h.ghost,h.slot),approach=h.ghost.animations[0];
  h.effects.cancelAll();approach.finish();await completion;await flush();
  assert.equal(approach.cancelled,true);assert.equal(h.masks.length,0);
  assert.equal(h.ghost.isConnected,false);assert.equal(h.frames.size,0);
});

for(const phase of ['approach','feed'])for(const change of ['move','close','resize','detach']){
  test(`a drawer ${change} during ${phase} retires the effect`,async()=>{
    const h=desk(),completion=h.effects.store(h.ghost,h.slot);
    if(phase==='feed'){h.ghost.animations[0].finish();await flush();}
    if(change==='move')h.slot.rect.left+=20;
    if(change==='close')h.slot.closest=()=>({inert:true});
    if(change==='resize')h.window.innerHeight=700;
    if(change==='detach')h.slot.isConnected=false;
    h.tick();await completion;
    assert.equal(h.ghost.isConnected,false);assert.equal(h.frames.size,0);
    assert.ok(h.ghost.animations.every(animation=>animation.cancelled));
    assert.ok(h.masks.every(mask=>!mask.isConnected));
  });
}

test('a drawer that moves at the phase boundary never receives an outdated mask',async()=>{
  const h=desk(),completion=h.effects.store(h.ghost,h.slot);
  h.slot.rect.top+=30;h.ghost.animations[0].finish();await completion;
  assert.equal(h.masks.length,0);assert.equal(h.ghost.isConnected,false);
});

for(const fault of ['missing','throw','reject'])test(`storage cleans up if WAAPI is ${fault}`,async()=>{
  const h=desk();
  if(fault==='missing')delete h.ghost.animate;
  if(fault==='throw')h.ghost.animate=()=>{throw new Error('Unavailable');};
  const completion=h.effects.store(h.ghost,h.slot);
  if(fault==='reject')h.ghost.animations[0].fail();
  await completion;
  assert.equal(h.ghost.isConnected,false);assert.equal(h.masks.length,0);assert.equal(h.frames.size,0);
});

test('reduced motion removes the storage ghost without measuring or animating',async()=>{
  const h=desk({reduced:true});h.slot.getBoundingClientRect=()=>{throw new Error('No layout expected');};
  await h.effects.store(h.ghost,h.slot);
  assert.equal(h.ghost.isConnected,false);assert.equal(h.ghost.animations.length,0);assert.equal(h.frames.size,0);
});

test('a failed feed animation still removes its clipping mask and frame watcher',async()=>{
  const h=desk(),completion=h.effects.store(h.ghost,h.slot);
  h.ghost.animations[0].finish();await flush();h.ghost.animations[1].fail();await completion;
  assert.equal(h.ghost.isConnected,false);assert.equal(h.masks[0].isConnected,false);assert.equal(h.frames.size,0);
});

for(const scale of [.5,1.5])test(`new paper unfolds from the viewport source at ${scale}x board zoom`,async()=>{
  const h=desk(),paper=element({left:400,top:300,width:PAPER.width*scale,height:PAPER.height*scale});
  paper.style.transform='rotate(4deg)';h.body.append(paper);
  const completion=h.effects.enter(paper,{source:{x:900,y:700},scale,rotation:4}),animation=paper.animations[0];
  const start=animation.keyframes[0],values=start.transform.match(/translate\(([^p]+)px,\s*([^p]+)px\)/);
  const target={x:400+PAPER.width/2*scale,y:300+PAPER.height/2*scale};
  assert.equal(target.x+Number(values[1])*scale,900);
  assert.equal(target.y+Number(values[2])*scale,700);
  assert.match(start.transform,/scale\(0\.18,\s*0\.08\)/);
  assert.match(animation.keyframes.at(-1).transform,/rotate\(4deg\)/);
  assert.equal(paper.inert,false);assert.equal(paper.attributes['aria-hidden'],undefined);
  assert.equal(paper.style.pointerEvents,undefined);assert.equal(paper.style.visibility,undefined);
  assert.equal(paper.classList.contains('paper-arriving'),true);assert.equal(paper.style['--paper-arrival-duration'],'600ms');
  animation.finish();await completion;
  assert.equal(paper.isConnected,true);assert.equal(paper.style.transform,'rotate(4deg)');assert.equal(animation.cancelled,true);
  assert.equal(paper.classList.contains('paper-arriving'),false);assert.equal(paper.style['--paper-arrival-duration'],undefined);
});

test('picking up an entering paper cancels only its animation and leaves the base pose intact',async()=>{
  const h=desk(),paper=element();paper.style.transform='rotate(-3deg)';h.body.append(paper);
  const completion=h.effects.enter(paper,{source:{x:900,y:700},rotation:-3});
  h.effects.cancelEntry(paper);await completion;
  assert.equal(paper.animations[0].cancelled,true);assert.equal(paper.isConnected,true);
  assert.equal(paper.style.transform,'rotate(-3deg)');
});

test('reduced motion and absent WAAPI leave the new paper immediately usable',async()=>{
  for(const reduced of [false,true]){
    const h=desk({reduced}),paper=element();h.body.append(paper);
    if(!reduced)delete paper.animate;
    await h.effects.enter(paper,{source:{x:900,y:700}});
    assert.equal(paper.isConnected,true);assert.equal(paper.animations.length,0);
    assert.equal(paper.style.pointerEvents,undefined);assert.equal(paper.inert,false);
  }
});

test('cancelling all effects removes ghosts while preserving real papers and their prior styles',async()=>{
  const h=desk(),paper=element();paper.style.setProperty('--paper-arrival-duration','900ms');h.body.append(paper);
  const storage=h.effects.store(h.ghost,h.slot),entry=h.effects.enter(paper,{source:{x:900,y:700}});
  h.ghost.animations[0].finish();await flush();h.effects.cancelAll();await Promise.all([storage,entry]);
  assert.equal(h.ghost.isConnected,false);assert.equal(h.masks[0].isConnected,false);
  assert.equal(paper.isConnected,true);assert.equal(paper.animations[0].cancelled,true);
  assert.equal(paper.classList.contains('paper-arriving'),false);assert.equal(paper.style['--paper-arrival-duration'],'900ms');
});

test('an old entry completion cannot retire a replacement arrival on the same paper',async()=>{
  const h=desk(),paper=element();h.body.append(paper);
  const first=h.effects.enter(paper,{source:{x:900,y:700}}),old=paper.animations[0];
  const second=h.effects.enter(paper,{source:{x:800,y:600}});old.finish();await first;
  assert.equal(paper.classList.contains('paper-arriving'),true);assert.equal(paper.animations[1].cancelled,false);
  h.effects.cancelEntry(paper);await second;
  assert.equal(paper.classList.contains('paper-arriving'),false);assert.equal(paper.style['--paper-arrival-duration'],undefined);
});

test('paper and folder slide cues begin only when a valid drawer feed starts',async()=>{
  for(const material of [undefined,'folder']){
    const cues=[],h=desk({onCue:(name,options)=>cues.push({name,...options})});
    const completion=h.effects.store(h.ghost,h.slot,{material});
    assert.deepEqual(cues,[]);
    h.ghost.animations[0].finish();await flush();
    assert.deepEqual(cues.map(({name,delay})=>[name,delay]),[[material==='folder'?'folderSlide':'paperSlide',0]]);
    assert.equal(cues[0].signal.aborted,false);
    h.ghost.animations[1].finish();await completion;
    assert.equal(cues[0].signal.aborted,false,'natural cleanup must let a short slide finish');
  }
});

test('cancelled or invalid approaches cannot emit a late drawer slide cue',async()=>{
  for(const invalidate of ['cancel','move']){
    const cues=[],h=desk({onCue:(name,options)=>cues.push({name,...options})});
    const completion=h.effects.store(h.ghost,h.slot),approach=h.ghost.animations[0];
    if(invalidate==='cancel')h.effects.cancelAll();else h.slot.rect.top+=30;
    approach.finish();await completion;await flush();
    assert.deepEqual(cues,[]);assert.equal(h.masks.length,0);
  }
});

test('cancelling an active feed aborts its slide cue',async()=>{
  const cues=[],h=desk({onCue:(name,options)=>cues.push({name,...options})});
  const completion=h.effects.store(h.ghost,h.slot);
  h.ghost.animations[0].finish();await flush();
  h.effects.cancelAll();await completion;assert.equal(cues[0].signal.aborted,true);
});

test('paper arrival cues unfold immediately and drop at landing without aborting natural completion',async()=>{
  const cues=[],h=desk({onCue:(name,options)=>cues.push({name,...options})}),paper=element();h.body.append(paper);
  const completion=h.effects.enter(paper,{source:{x:900,y:700}});
  assert.deepEqual(cues.map(({name,delay})=>[name,delay]),[['paperUnfold',0],['paperDrop',456]]);
  assert.equal(cues[0].signal,cues[1].signal);
  paper.animations[0].finish();await completion;
  assert.equal(cues[1].signal.aborted,false);
});

test('pickup and replacement cancel the old arrival drop without cancelling the current arrival',async()=>{
  const cues=[],h=desk({onCue:(name,options)=>cues.push({name,...options})}),paper=element();h.body.append(paper);
  const first=h.effects.enter(paper,{source:{x:900,y:700}}),old=paper.animations[0];
  const second=h.effects.enter(paper,{source:{x:800,y:600}});old.finish();await first;
  assert.equal(cues[1].signal.aborted,true);assert.equal(cues[3].signal.aborted,false);
  h.effects.cancelEntry(paper);await second;assert.equal(cues[3].signal.aborted,true);
});

test('reduced motion and missing WAAPI emit each paper action cue immediately',async()=>{
  for(const reduced of [false,true]){
    const cues=[],h=desk({reduced,onCue:(name,options)=>cues.push({name,...options})}),paper=element();h.body.append(paper);
    if(!reduced){delete h.ghost.animate;delete paper.animate;}
    await h.effects.store(h.ghost,h.slot,{material:'folder'});
    await h.effects.enter(paper,{source:{x:900,y:700}});
    assert.deepEqual(cues.map(({name,delay})=>[name,delay]),[['folderSlide',0],['paperUnfold',0],['paperDrop',0]]);
    assert.ok(cues.every(cue=>!cue.signal.aborted));
  }
});

test('failed optional cues do not prevent paper animation or cleanup',async()=>{
  for(const onCue of [()=>{throw new Error('Sound unavailable');},()=>Promise.reject(new Error('Sound unavailable'))]){
    const h=desk({onCue}),paper=element();h.body.append(paper);
    const storage=h.effects.store(h.ghost,h.slot),entry=h.effects.enter(paper,{source:{x:900,y:700}});
    h.ghost.animations[0].finish();await flush();assert.equal(h.ghost.animations.length,2);
    h.ghost.animations[1].finish();paper.animations[0].finish();await Promise.all([storage,entry]);
    assert.equal(h.ghost.isConnected,false);assert.equal(paper.isConnected,true);
    assert.equal(paper.classList.contains('paper-arriving'),false);
  }
});
