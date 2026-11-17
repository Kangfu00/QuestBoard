import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,createFolder,updateItem,serializeState,parseState} from '../dist/model.mjs';
import {trayPosition,trayDrop,trayItems,ensureTrayPositions,bindStorageDrawer,storageInset,undockedFitWidth} from '../dist/storage-tray.mjs';
import {canvasLayout} from '../dist/interactions.mjs';
import {PAPER} from '../dist/paper-format.mjs';

test('storage coordinates persist independently of board coordinates and old backups still load',()=>{
  const original=createInitialState(),quest=original.items.find(i=>i.type==='quest');
  const next=updateItem(original,quest.id,{archived:true,storagePosition:{x:851,y:432}});
  const restored=parseState(serializeState(next)).items.find(i=>i.id===quest.id);
  assert.deepEqual(restored.storagePosition,{x:851,y:432});assert.equal(restored.x,quest.x);assert.equal(restored.y,quest.y);
  assert.deepEqual(parseState(serializeState(original)),original);
  assert.throws(()=>updateItem(next,quest.id,{storagePosition:{x:NaN,y:0}}));
});
test('tray includes loose quests and folders, searches their members and preserves stable default positions',()=>{
  const state=createInitialState(),q=state.items.find(i=>i.type==='quest'),folder=createFolder({name:'Writing'},state);
  state.items=[{...q,archived:true,title:'Loose'},folder,{...q,id:'inside',archived:true,folderId:folder.id,title:'Hidden dragon'}];
  assert.deepEqual(trayItems(state).map(i=>i.id),[q.id,folder.id]);
  assert.deepEqual(trayItems(state,'dragon').map(i=>i.id),[folder.id]);
  assert.deepEqual(trayPosition(folder,5),{x:414,y:30+PAPER.height+40});
  assert.deepEqual(trayPosition({...folder,storagePosition:{x:10,y:12}},5),{x:10,y:12});
});
test('tray drop accounts for scrolled plane and actual grabbed pixel at tray scale',()=>{
  assert.deepEqual(trayDrop({x:348,y:205},{left:100,top:-43},{x:100,y:20}),{x:300,y:380});
  assert.deepEqual(trayDrop({x:-100,y:-100},{left:0,top:0}),{x:0,y:0});
});
test('tray edge placement uses A4 height while folders retain their shorter cover',()=>{
  assert.deepEqual(trayDrop({x:50000,y:50000},{left:0,top:0}),{x:19700,y:19575.714285714286});
  assert.deepEqual(trayDrop({x:50000,y:50000},{left:0,top:0},undefined,undefined,0,'folder'),{x:19700,y:19790});
  const turned=trayDrop({x:517.1928571428571,y:327.8928571428571},{left:40,top:60},{x:150,y:28},.65,90);
  assert.ok(Math.abs(turned.x-400)<1e-9);
  assert.ok(Math.abs(turned.y-200)<1e-9);
  assert.ok(trayPosition({type:'quest'},4).y>=trayPosition({type:'quest'},0).y+PAPER.height+40);
});
test('default placement rolls into new columns before tall A4 sheets exceed the tray and survives reload',()=>{
  const state=createInitialState(),quest=state.items.find(item=>item.type==='quest');
  state.items=Array.from({length:500},(_,index)=>({...quest,id:`paper-${index}`,archived:true}));
  const placed=ensureTrayPositions(state);
  assert.deepEqual(placed.items[172].storagePosition,{x:1554,y:30});
  const positions=placed.items.map(item=>item.storagePosition);
  assert.equal(new Set(positions.map(({x,y})=>`${x},${y}`)).size,500);
  for(const position of positions){
    assert.ok(position.x>=0&&position.x+PAPER.width<=20000);
    assert.ok(position.y>=0&&position.y+PAPER.height<=20000);
  }
  assert.deepEqual(parseState(serializeState(placed)),placed,'loading assigned positions must not move later papers');
});
function drawerHarness(){
  let opened=false,reveal=0;const handlers=new Map(),classes=new Set(),windowEvents=new Map(),reserved=[],pulling=[],motions=[];
  const drawer={offsetWidth:546,style:{setProperty(k,v){reveal=parseFloat(v);}},classList:{add:n=>classes.add(n),remove:n=>classes.delete(n)}};
  const handle={getBoundingClientRect:()=>({left:1200-44-reveal}),setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(){},addEventListener:(n,f)=>handlers.set(n,f)};
  const control=bindStorageDrawer({drawer,handle,isOpen:()=>opened,setOpen:value=>{opened=value;control.sync();},onReveal:width=>reserved.push(width),onPullChange:value=>pulling.push(value),onMotion:(offset,options)=>motions.push({offset,...options}),window:{innerWidth:1200,addEventListener:(n,f)=>windowEvents.set(n,f)},now:()=>100});
  return {control,drawer,reserved,pulling,motions,event:(name,x)=>handlers.get(name)({clientX:x,button:0,pointerId:1,detail:1}),resize:()=>windowEvents.get('resize')(),blur:()=>windowEvents.get('blur')(),get opened(){return opened;},get reveal(){return reveal;}};
}

test('drawer contents lag subtly in either direction and settle without changing drawer placement',()=>{
  const h=drawerHarness();h.event('pointerdown',1178);h.event('pointermove',878);
  assert.ok(h.motions.at(-1)?.offset>0&&h.motions.at(-1)?.offset<=3);
  assert.equal(h.reveal,300);
  h.event('pointermove',900);assert.ok(h.motions.at(-1).offset<0&&h.motions.at(-1).offset>=-3);
  h.event('pointerup',900);assert.equal(h.reveal,502);
  assert.equal(h.motions.at(-1).offset,0);assert.equal(h.motions.at(-1).settle,true);
  assert.ok(h.motions.at(-1).from<0);
});

test('drawer cancellation, resize and rest clear content motion immediately',()=>{
  for(const action of ['cancel','resize','blur','rest']){
    const h=drawerHarness();h.event('pointerdown',1178);h.event('pointermove',878);
    if(action==='cancel')h.event('pointercancel',878);
    else if(action==='rest')h.control.rest();
    else h[action]();
    assert.equal(h.motions.at(-1)?.offset,0,action);
    assert.equal(h.motions.at(-1)?.settle,false,action);
    assert.equal(h.reveal,action==='cancel'||action==='blur'?0:300);
  }
});
test('right drawer follows horizontal pull, ignores resize while held and snaps without one-frame expansion',()=>{
  const h=drawerHarness();h.event('pointerdown',1178);h.event('pointermove',878);h.resize();assert.equal(h.reveal,300);
  h.event('pointerup',878);assert.equal(h.opened,true);assert.equal(h.reveal,502);
  h.event('pointerdown',676);h.event('pointermove',1078);h.resize();assert.equal(h.reveal,100);
  h.event('pointerup',1078);h.event('click',1078);assert.equal(h.opened,false);assert.equal(h.reveal,0);
});
test('cancelled horizontal pull restores initial state',()=>{
  const h=drawerHarness();h.event('pointerdown',1180);h.event('pointermove',750);h.event('pointercancel',750);
  assert.equal(h.opened,false);assert.equal(h.reveal,0);
});
test('board reserves every visible pixel of the drawer during pull, snap and cancellation',()=>{
  const h=drawerHarness();assert.equal(h.reserved.at(-1),44);
  h.event('pointerdown',1178);h.event('pointermove',878);
  assert.equal(h.reserved.at(-1),344);assert.equal(h.pulling.at(-1),true);
  h.event('pointerup',878);assert.equal(h.reserved.at(-1),546);assert.equal(h.pulling.at(-1),false);
  h.event('pointerdown',676);h.event('pointermove',1078);assert.equal(h.reserved.at(-1),144);
  h.event('pointercancel',1078);assert.equal(h.reserved.at(-1),546);
  assert.equal(storageInset(999,546),546);
});
test('drawer width reduces the scroll viewport without reducing paper size',()=>{
  for(const reserved of [44,120,320,550,0]){
    const width=1062-reserved,fitWidth=undockedFitWidth(width,20,20+reserved);
    const layout=canvasLayout({width,height:1000,fitWidth,fitHeight:1000},[],1,false);
    assert.equal(layout.scale,.9);assert.ok(layout.width>=1180);
  }
});
