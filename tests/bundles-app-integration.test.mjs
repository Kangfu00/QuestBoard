import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {containsPoint} from '../dist/interactions.mjs';
const source=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');

function harness(){
  let hit=null,tray=false;
  const folder={hidden:false,dataset:{folderTarget:'folio'},closest:()=>null};
  const context={document:{elementFromPoint:()=>hit},state:{items:[{id:'folio',type:'folder'}]},containsPoint,
    currentScale:.5,TRAY_SCALE:.62,canvasBounds:{width:2000,height:1500},
    overStorageTray:()=>tray?'quest-drawer':null,
    $:selector=>({getBoundingClientRect:()=>selector==='#board-scroll'?{left:0,top:0,right:1000,bottom:800}:selector==='#drawer-list'?{left:730,top:-90}:{left:20,top:30}})};
  context.questPhotos??=null;context.photoViewer??=null;vm.createContext(context);
  const start=source.indexOf('function bundleTargetAt('),end=source.indexOf('function highlightFolder(',start);
  if(start>=0)vm.runInContext(source.slice(start,end),context);
  return {context,folder,pointer:{clientX:400,clientY:300},set(kind){
    tray=kind==='tray';hit={closest(selector){
      if(selector==='[data-folder-target]'&&kind==='folder')return folder;
      if(selector==='[inert]'&&kind==='inert')return {};
      if(selector.includes('[data-desk-window]')&&kind==='document')return {};
      return null;
    }};
  }};
}
test('bundle targets use current board/tray scale and scroll origin, and recognize actual folios',()=>{
  const h=harness();assert.equal(typeof h.context.bundleTargetAt,'function');
  h.set('board');const board=h.context.bundleTargetAt(h.pointer,['a','b']);
  assert.equal(board.type,'board');assert.equal(board.scale,.5);assert.deepEqual({...board.origin},{left:20,top:30});
  h.set('tray');const tray=h.context.bundleTargetAt(h.pointer,['a','b']);assert.equal(tray.type,'tray');assert.equal(tray.scale,.62);assert.equal(tray.origin.top,-90);
  h.set('folder');assert.equal(h.context.bundleTargetAt(h.pointer,['a','b']).id,'folio');
});
test('bundle drops cannot reach board behind another document or an inert target',()=>{
  const h=harness();assert.equal(typeof h.context.bundleTargetAt,'function');
  for(const kind of ['document','inert']){h.set(kind);assert.equal(h.context.bundleTargetAt(h.pointer,['a','b']),null);}
  h.set('board');assert.equal(h.context.bundleTargetAt({clientX:1100,clientY:900},['a','b']),null);
});

test('master sound toggle mutes ambience as well as foley and unlocks requested ambience when enabled',()=>{
  const button={},calls=[],daypartCalls=[];let muted=false;
  const context={$:()=>button,sound:{getSettings:()=>({muted}),setMuted:value=>{muted=value;},play:name=>calls.push(name)},
    ambience:{setMuted:value=>calls.push(value),unlock:()=>calls.push('unlock')},
    daypartAmbience:{setMuted:value=>daypartCalls.push(value),unlock:()=>daypartCalls.push('unlock')},refreshSoundControls(){}};
  const start=source.indexOf("$('#sound-toggle').onclick="),end=source.indexOf("$('#sound-volume').oninput=",start);
  context.questPhotos??=null;context.photoViewer??=null;vm.createContext(context);vm.runInContext(source.slice(start,end),context);
  button.onclick();assert.deepEqual(calls,[true]);
  assert.deepEqual(daypartCalls,[true]);
  button.onclick();assert.deepEqual(calls,[true,false,'unlock','paperDrop']);
  assert.deepEqual(daypartCalls,[true,false,'unlock']);
});

test('dropping a bundle on the board clears filters before its only commit so every returned paper is visible',()=>{
  let options;const search={value:'old search'},next={items:[]},calls=[];
  const context={bundleControl:null,document:{},window:{},state:next,filters:{status:'done',category:'งานหลัก',search:'old search'},
    $:()=>search,renderQuest(){},reducedMotion:()=>false,bundleTargetAt(){},onSoundCue(){},highlightFolder(){},highlightStorageTray(){},
    createQuestBundles(value){options=value;return {refresh(){},destroy(){}};},
    commit(value){calls.push(value);assert.equal(context.filters.status,'all');assert.equal(context.filters.search,'');assert.equal(context.filters.category,'all');assert.equal(search.value,'');}};
  context.questPhotos??=null;context.photoViewer??=null;vm.createContext(context);const start=source.indexOf('function setupQuestBundles('),end=source.indexOf('function highlightFolder(',start);vm.runInContext(source.slice(start,end),context);
  context.setupQuestBundles();options.onTarget({type:'board'});options.commit(next);
  assert.deepEqual(calls,[next]);
});
