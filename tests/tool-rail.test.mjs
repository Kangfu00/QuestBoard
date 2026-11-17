import test from 'node:test';
import assert from 'node:assert/strict';
import {bindToolRail,undockedFitHeight} from '../dist/tool-rail.mjs';
import {canvasLayout} from '../dist/interactions.mjs';

function harness(){
  let open=false,reveal=0,clock=100;const events=new Map(),windowEvents=new Map(),reserved=[],pulling=[];
  const rail={offsetHeight:144,style:{setProperty:(key,value)=>{reveal=parseFloat(value);}},classList:{add(){},remove(){}}};
  const handle={getBoundingClientRect:()=>({bottom:30+reveal}),addEventListener:(key,fn)=>events.set(key,fn),setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(){}};
  const control=bindToolRail({rail,handle,isOpen:()=>open,setOpen:value=>{open=value;control.sync();},onReveal:value=>reserved.push(value),onPullChange:value=>pulling.push(value),window:{addEventListener:(key,fn)=>windowEvents.set(key,fn)},now:()=>clock});
  return {rail,control,reserved,pulling,emit:(key,y=0,detail=1,pointerId=1)=>events.get(key)({button:0,pointerId,clientY:y,detail}),resize:()=>windowEvents.get('resize')(),blur:()=>windowEvents.get('blur')(),later:()=>clock+=500,get open(){return open;},get reveal(){return reveal;}};
}
test('rail follows downward pull and reserves the exact visible height',()=>{
  const h=harness();assert.equal(h.reserved.at(-1),30);
  h.emit('pointerdown',15);h.emit('pointermove',75);assert.equal(h.reveal,60);assert.equal(h.reserved.at(-1),90);
  h.resize();assert.equal(h.reveal,60);assert.equal(h.pulling.at(-1),true);
  h.emit('pointerup',75);assert.equal(h.open,true);assert.equal(h.reveal,114);assert.equal(h.reserved.at(-1),144);
  assert.equal(h.pulling.at(-1),false);
});
test('closing pull never expands before settling and its click does not reopen the rail',()=>{
  const h=harness();h.emit('click',0,0);assert.equal(h.open,true);
  h.emit('pointerdown',129);h.emit('pointermove',40);assert.equal(h.reveal,25);
  h.resize();assert.equal(h.reveal,25);h.emit('pointerup',40);h.emit('click',40);
  assert.equal(h.open,false);assert.equal(h.reveal,0);assert.equal(h.reserved.at(-1),30);
  h.later();h.emit('click');assert.equal(h.open,true);
});
test('pointer cancellation and window blur restore the original rail state',()=>{
  const h=harness();h.emit('pointerdown',15);h.emit('pointermove',90);h.emit('pointercancel',90);
  assert.equal(h.open,false);assert.equal(h.reserved.at(-1),30);
  h.emit('click',0,0);h.emit('pointerdown',130);h.emit('pointermove',45);h.blur();
  assert.equal(h.open,true);assert.equal(h.reserved.at(-1),144);
});
test('wrong pointers cannot move or release the held rail; keyboard click remains available',()=>{
  const h=harness();h.emit('pointerdown',15);h.emit('pointermove',120,1,2);h.emit('pointerup',120,1,2);
  assert.equal(h.reveal,0);h.emit('pointercancel');h.emit('click',0,0);assert.equal(h.open,true);
});
test('opening the tool rail preserves paper fitting height',()=>{
  for(const reserved of [30,60,100,144,30]){
    const height=820-reserved,fitHeight=undockedFitHeight(height,20+reserved,20);
    const layout=canvasLayout({width:1400,height,fitWidth:1400,fitHeight},[],1,false);
    assert.equal(layout.scale,.82);
  }
});
