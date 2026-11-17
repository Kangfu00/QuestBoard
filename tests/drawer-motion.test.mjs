import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {bindToolRail} from '../dist/tool-rail.mjs';
import {bindStorageDrawer} from '../dist/storage-tray.mjs';
import {drawerReveal,shouldOpenDrawer} from '../dist/interactions.mjs';

// Exercise the actual app event handlers without opening a browser or touching
// user storage. Layout reads record the position the handler asks to flush.
const source=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');
const drawerSource=source.slice(source.indexOf('function drawerTravel('),source.indexOf('function refreshToolOptions('));
function desk(){
  const nodes=new Map(),windowEvents=new Map(),layoutReads=[],sounds=[],contentAnimations=[];
  const parts=[['quest-drawer','drawer-handle','drawer-content'],['folder-drawer','folder-drawer-handle','folder-drawer-content'],['tool-drawer','tool-drawer-handle','tool-drawer-content']];
  function element(id){
    if(nodes.has(id))return nodes.get(id);
    const classes=new Set(),events=new Map();let captured=null,reveal=0;
    const el={id,events,
      classList:{contains:name=>classes.has(name),add:name=>classes.add(name),remove:name=>classes.delete(name),toggle(name,active){if(active)classes.add(name);else classes.delete(name);}},
      style:{setProperty(name,value){this[name]=value;if(name==='--drawer-reveal')reveal=parseFloat(value);}},
      get offsetHeight(){layoutReads.push({id,reveal});return id==='tool-drawer'?144:378;},get offsetWidth(){layoutReads.push({id,reveal});return 376;},get reveal(){return reveal;},
      addEventListener(name,fn){events.set(name,fn);},setAttribute(){},contains(target){return target===this||target?.parent===this;},focus(){context.document.activeElement=this;},
      setPointerCapture(id){captured=id;},hasPointerCapture(id){return captured===id;},releasePointerCapture(){captured=null;},
      open:false,showModal(){this.open=true;},close(){this.open=false;},getBoundingClientRect(){return {right:1280-reveal};},
    };nodes.set(id,el);return el;
  }
  for(const [drawer,handle,body]of parts){element(drawer);element(body);element(handle).getBoundingClientRect=()=>({right:1324-element(drawer).reveal,left:1236-element(drawer).reveal});}
  element('tool-drawer-handle').getBoundingClientRect=()=>({bottom:30+element('tool-drawer').reveal});
  const context={bindToolRail,toolRailControl:null,bindStorageDrawer,storageDrawerControl:null,returnStamp(){},cancelMotion(){},animateTransient(element,frames){contentAnimations.push({element,frames});},reducedMotion:()=>false,drawerReveal,shouldOpenDrawer,drawerOpen:false,toolsOpen:false,folderDrawerOpen:false,drag:null,storedDrag:null,paperEffects:{cancelAll(){}},
    $:selector=>element(selector.slice(1)),document:{activeElement:null,body:{style:{setProperty(){}},classList:{toggle(){}}}},sound:{play(name){sounds.push(name);}},refreshToolOptions(){},renderDrawer(){},renderFolderDrawer(){},performance:{now:()=>100},
    window:{innerWidth:1280,addEventListener(name,fn){const handlers=windowEvents.get(name)||[];handlers.push(fn);windowEvents.set(name,handlers);}},
  };
  context.questPhotos??=null;context.photoViewer??=null;vm.createContext(context);vm.runInContext(drawerSource+'\nsetupDrawer();globalThis.controls={setActiveDrawer,activeDrawerId,setToolsOpen};',context);
  vm.runInContext(source.slice(source.indexOf('function clearStorageFeedback('),source.indexOf('function followStorageHandle(')),context);
  const event=(handle,name,x)=>nodes.get(handle).events.get(name)?.({clientX:x,clientY:x,pointerId:1,button:0,detail:1});
  return {nodes,layoutReads,event,sounds,context,contentAnimations,openTools:value=>context.controls.setToolsOpen(value),tools:()=>context.toolsOpen,open:id=>context.controls.setActiveDrawer(id),active:()=>context.controls.activeDrawerId(),resize:()=>windowEvents.get('resize').forEach(fn=>fn())};
}

test('content drift affects only tray translation and reduced motion keeps contents still',()=>{
  const h=desk(),plane=h.nodes.get('drawer-list');plane.style.transform='scale(.62)';
  h.event('drawer-handle','pointerdown',1250);h.event('drawer-handle','pointermove',1000);
  assert.ok(parseFloat(plane.style['--tray-drift'])>0);assert.equal(plane.style.transform,'scale(.62)');
  h.event('drawer-handle','pointerup',1000);
  assert.equal(plane.style['--tray-drift'],'0px');assert.equal(h.contentAnimations.length,1);
  assert.ok(h.contentAnimations[0].frames.every(frame=>!Object.hasOwn(frame,'transform')));
  h.context.reducedMotion=()=>true;
  h.event('drawer-handle','pointerdown',920);h.event('drawer-handle','pointermove',1150);h.event('drawer-handle','pointerup',1150);
  assert.equal(plane.style['--tray-drift'],'0px');assert.equal(h.contentAnimations.length,1);
});

for(const [name,drawer] of [['paperPick','quest-drawer'],['folderPick','folder-drawer']]){
  test(`${name} is not layered with its automatically opening storage drawer`,()=>{
    const h=desk();h.context.sound.play(name);h.context.activateStorageDrawer(drawer);
    assert.equal(h.active(),'quest-drawer');assert.equal(h.nodes.get('quest-drawer').reveal,332);
    assert.deepEqual(h.sounds,[name]);
  });
}
test('silent automatic closure does not remove sound from manual drawer use',()=>{
  const h=desk();h.open('folder-drawer');h.sounds.length=0;
  h.context.sound.play('folderPick');h.context.setActiveDrawer(null,false,false);
  assert.equal(h.active(),null);assert.deepEqual(h.sounds,['folderPick']);
  h.open('quest-drawer');h.open(null);
  assert.deepEqual(h.sounds,['folderPick','drawerOpen','drawerClose']);
});

test('top tool rail follows a closing pull without a resize flash',()=>{
  const h=desk();h.openTools(true);h.event('tool-drawer-handle','pointerdown',129);h.event('tool-drawer-handle','pointermove',80);
  assert.equal(h.nodes.get('tool-drawer').reveal,65);h.layoutReads.length=0;
  h.event('tool-drawer-handle','pointermove',55);h.resize();
  assert.equal(h.nodes.get('tool-drawer').reveal,40);
  assert.ok(h.layoutReads.filter(r=>r.id==='tool-drawer').every(r=>r.reveal<=65&&r.reveal>=40));
});
test('storage and top tools can stay open independently',()=>{
  const h=desk();h.open('quest-drawer');h.openTools(true);
  assert.equal(h.active(),'quest-drawer');assert.equal(h.tools(),true);
  assert.equal(h.nodes.get('quest-drawer').reveal,332);assert.equal(h.nodes.get('tool-drawer').reveal,114);
  h.openTools(false);assert.equal(h.nodes.get('quest-drawer').reveal,332);assert.equal(h.tools(),false);
  h.openTools(true);h.open(null);assert.equal(h.tools(),true);assert.equal(h.nodes.get('tool-drawer').reveal,114);
});
test('cancelling a tool rail pull leaves the storage drawer open',()=>{
  const h=desk();h.open('quest-drawer');h.event('tool-drawer-handle','pointerdown',15);h.event('tool-drawer-handle','pointermove',90);
  assert.equal(h.nodes.get('tool-drawer').reveal,75);assert.equal(h.nodes.get('quest-drawer').reveal,332);
  h.event('tool-drawer-handle','pointercancel',90);
  assert.equal(h.active(),'quest-drawer');assert.equal(h.nodes.get('quest-drawer').reveal,332);assert.equal(h.nodes.get('tool-drawer').reveal,0);
});
test('advanced tools use their own dialog and do not expand the rail or close storage',()=>{
  const h=desk();h.open('quest-drawer');h.openTools(true);h.context.openToolMenu();
  assert.equal(h.nodes.get('tool-menu-dialog').open,true);
  assert.equal(h.nodes.get('tool-drawer').reveal,114);assert.equal(h.nodes.get('quest-drawer').reveal,332);
  h.context.closeToolMenu();assert.equal(h.nodes.get('tool-menu-dialog').open,false);
});
test('closing the rail returns keyboard focus to its visible handle before a pen dialog captures focus',()=>{
  const h=desk();h.openTools(true);
  h.context.document.activeElement={parent:h.nodes.get('tool-drawer-content')};
  h.openTools(false);
  assert.equal(h.context.document.activeElement,h.nodes.get('tool-drawer-handle'));
  assert.equal(h.nodes.get('tool-drawer-content').inert,true);
});
test('releasing a closing pull settles shut and the resulting click does not reopen it',()=>{
  const h=desk();h.open('quest-drawer');h.event('drawer-handle','pointerdown',920);h.event('drawer-handle','pointermove',1252);h.event('drawer-handle','pointerup',1252);h.event('drawer-handle','click',1252);
  assert.equal(h.active(),null);assert.equal(h.nodes.get('quest-drawer').reveal,0);assert.equal(h.nodes.get('quest-drawer').classList.contains('is-pulling'),false);
});
