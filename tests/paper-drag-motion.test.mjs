import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {paperGripPose} from '../dist/paper-grip.mjs';
import {createQuest,createFolder,moveQuestToFolder,updateItem,setArchived} from '../dist/model.mjs';
import {containsPoint} from '../dist/interactions.mjs';
import {ghostPose,dragTilt} from '../dist/desk-motion.mjs';

const source=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');
const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end));

// Run the real release/cancel handlers and model mutations. DOM/capture doubles
// represent an already-held paper; pointer geometry and animation lifecycle have
// their own tests. A detached ghost at the animation boundary is a visible bug.
function eventTarget(){
  const listeners=new Map();let captured=null;
  return {listeners,
    addEventListener(name,fn){listeners.set(name,fn);},
    removeEventListener(name,fn){if(listeners.get(name)===fn)listeners.delete(name);},
    setPointerCapture(id){captured=id;},hasPointerCapture(id){return captured===id;},
    releasePointerCapture(id){assert.equal(captured,id);captured=null;},
  };
}
function element(...initialClasses){
  const classes=new Set(initialClasses);
  return {...eventTarget(),isConnected:true,style:{left:'450px',top:'500px',zIndex:99,setProperty(name,value){this[name]=value;}},
    classList:{contains:name=>classes.has(name),add(...names){names.forEach(name=>classes.add(name));},remove(...names){names.forEach(name=>classes.delete(name));}},
    remove(){this.isConnected=false;},
  };
}
function desk({stored=false,reduced=false,realInsertion=false,surface='board-folder'}={}){
  let state={version:1,items:[],stamps:[],settings:{stampStyle:'seal',theme:'walnut',boardName:'Test'}};
  const quest={...createQuest({title:'Carry this paper',x:80,y:100,rotation:3,archived:stored},state),id:'quest'};
  state.items.push(quest);
  state.items.push({...createFolder({name:'Notes',x:500,y:200},state),id:'folder'});
  const handle=eventTarget(),body=eventTarget(),window=eventTarget();
  const paper=element('dragging','drag-source'),ghost=element();
  ghost.animate=()=>({finished:Promise.resolve(),cancel(){}});
  const effects=[],commits=[],drawers=[],errors=[],frames=new Map(),visuals={reads:0,animations:0};let nextFrame=1;
  const rect={left:0,top:0,right:1000,bottom:800,width:1000,height:800};
  const nodes=new Map([['#board-scroll',{getBoundingClientRect:()=>rect}],['#board-canvas',{getBoundingClientRect:()=>rect}],['[data-id="quest"]',paper]]);
  const drag={id:'quest',item:quest,type:'quest',rotation:3,el:paper,handle,pointerId:7,moved:true,ghost,grab:{x:22,y:28},x:80,y:100,next:{x:450,y:500},folderTarget:'folder',folderSurface:surface,overTray:false,drawerBefore:'tool-drawer'};
  const folder=element(surface);folder.dataset={folderTarget:'folder'};
  folder.closest=()=>surface==='drawer-folder-row'&&drawers.length&&drawers.at(-1)!=='quest-drawer'?{}:null;
  folder.getBoundingClientRect=()=>{visuals.surface=surface;return {left:500,top:200,width:300,height:210};};
  const boardFolder=element('board-folder');boardFolder.dataset={folderTarget:'folder'};boardFolder.closest=()=>null;
  boardFolder.getBoundingClientRect=()=>{visuals.surface='board-folder';return {left:20,top:20,width:300,height:210};};
  ghost.getBoundingClientRect=()=>({left:450,top:500,width:300,height:350});
  const context={state,drag:stored?null:drag,storedDrag:stored?drag:null,window,document:{body,elementFromPoint:()=>null,querySelectorAll(){visuals.reads++;return surface==='folder-window'?[boardFolder,folder]:[folder];}},
    currentScale:1,suppressClickUntil:0,performance:{now:()=>100},containsPoint,moveQuestToFolder,updateItem,setArchived,
    $:selector=>nodes.get(selector),reducedMotion:()=>reduced,
    onDrag(){},moveStoredDrag(){},settlePaper(){},ghostPose,dragTilt,paperGripPose,
    requestAnimationFrame(fn){const id=nextFrame++;frames.set(id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);},
    setTimeout(){},animateTransient(){visuals.animations++;},
    clearStorageFeedback(){},highlightFolder(){},renderFolderWindow(){},
    setActiveDrawer(id){drawers.push(id);},sound:{play(){}},queueContactSound(){return new AbortController();},showToast(message){errors.push(message);},
    commit(next){context.state=next;commits.push(next);},persist(){},
    animateFolderInsert(g,id){effects.push({ghost:g,id,connected:g?.isConnected,committed:context.state.items.find(item=>item.id==='quest').folderId});},
    archiveQuest(){throw Error('Folder drop was routed to the storage tray');},
  };
  context.questPhotos??=null;context.photoViewer??=null;vm.createContext(context);
  vm.runInContext([
    section('function updateHeldGhost(','function settlePaper('),
    realInsertion?section('function animateFolderInsert(','function storeInFolder('):'',
    section('function storeInFolder(','function startStoredDrag('),
    section('function cleanupStoredDrag(','function renderBoard('),
    section('function cleanupDrag(','function moveWithKeyboard('),
  ].join('\n'),context);
  const capture=stored?body:handle,target=stored?window:handle;
  capture.setPointerCapture(7);
  for(const [name,fn]of [['pointermove',stored?context.moveStoredDrag:context.onDrag],['pointerup',stored?context.endStoredDrag:context.endDrag],['pointercancel',stored?context.cancelStoredDrag:context.cancelDrag]])target.addEventListener(name,fn);
  return {context,paper,ghost,handle,body,window,commits,effects,drawers,errors,quest,frames,visuals,
    move:(clientX,clientY)=>context.updateHeldGhost(drag,{clientX,clientY}),
    release:()=>stored?context.endStoredDrag({pointerId:7,clientX:700,clientY:400}):context.endDrag({pointerId:7,clientX:700,clientY:400}),
    cancel:()=>stored?context.cancelStoredDrag({pointerId:7}):context.cancelDrag(),
  };
}
function assertReleased(h,stored=false){
  assert.equal(stored?h.context.storedDrag:h.context.drag,null);
  assert.equal((stored?h.body:h.handle).hasPointerCapture(7),false);
  assert.equal((stored?h.window:h.handle).listeners.size,0);
  assert.equal(h.frames.size,0,'no held-paper frame may run after release');
  if(!stored){assert.equal(h.paper.classList.contains('dragging'),false);assert.equal(h.paper.classList.contains('drag-source'),false);}
}

for(const stored of [false,true]){
  test(`${stored?'stored':'board'} paper dropped into a folder stays visible until the insertion effect owns it`,()=>{
    const h=desk({stored});h.move(700,400);h.release();
    assertReleased(h,stored);
    assert.equal(h.context.state.items.find(item=>item.id==='quest').folderId,'folder');
    assert.equal(h.context.state.items.find(item=>item.id==='quest').archived,true);
    assert.equal(h.commits.length,1);
    assert.equal(h.effects.length,1,'the retained ghost must reach the folder insertion effect');
    assert.equal(h.effects[0].ghost,h.ghost);
    assert.equal(h.effects[0].connected,true,'cleanup must not remove the ghost before insertion');
    assert.equal(h.effects[0].committed,'folder','filing must commit before animation begins');
    assert.equal(h.context.suppressClickUntil,500);
  });
  test(`cancelling a ${stored?'stored':'board'} paper removes its ghost and restores the previous drawer`,()=>{
    const h=desk({stored});h.move(700,400);h.cancel();
    assertReleased(h,stored);
    assert.equal(h.ghost.isConnected,false);
    assert.equal(h.drawers.at(-1),'tool-drawer');
    assert.equal(h.commits.length,0);
    assert.equal(h.context.state.items.find(item=>item.id==='quest').folderId,null);
    if(!stored){assert.equal(h.paper.style.left,'80px');assert.equal(h.paper.style.top,'100px');assert.equal(h.paper.style.zIndex,h.quest.z);}
  });
  test(`reduced motion files a ${stored?'stored':'board'} paper synchronously without a receiving effect`,()=>{
    const h=desk({stored,reduced:true,realInsertion:true});h.move(700,400);h.release();
    assertReleased(h,stored);
    assert.equal(h.context.state.items.find(item=>item.id==='quest').folderId,'folder');
    assert.equal(h.commits.length,1);
    assert.equal(h.ghost.isConnected,false);
    assert.equal(h.visuals.reads,0,'reduced motion must skip receiving target layout');
    assert.equal(h.visuals.animations,0);
  });
}

test('held-paper updates move its grabbed pixel immediately and share one cancellable frame',()=>{
  const h=desk();h.move(600,400);
  assert.equal(h.ghost.style.left,'578px');assert.equal(h.ghost.style.top,'372px');
  assert.equal(h.ghost.style.transformOrigin,'22px 28px');assert.equal(h.frames.size,1);
  assert.match(h.ghost.style.transform,/perspective\(1000px\).*rotateX\(.*rotateY\(/);
  h.move(760,500);
  assert.equal(h.ghost.style.left,'738px');assert.equal(h.ghost.style.top,'472px');
  assert.equal(h.frames.size,1,'pointer samples must not stack animation loops');
  h.cancel();assert.equal(h.frames.size,0);assert.equal(h.ghost.isConnected,false);
});

test('held folders retain their rigid pose while reduced-motion paper does not pitch',()=>{
  const h=desk();h.context.drag.type='folder';h.context.drag.item={...h.context.drag.item,type:'folder'};h.move(600,400);
  assert.doesNotMatch(h.ghost.style.transform,/perspective|rotateX|rotateY/);h.cancel();
  const reduced=desk({reduced:true});reduced.move(600,400);
  assert.doesNotMatch(reduced.ghost.style.transform,/perspective|rotateX|rotateY/);
  assert.equal(reduced.frames.size,0);reduced.cancel();
});

test('a folder-row drop keeps its drawer open until the paper can visibly enter it',()=>{
  const h=desk({surface:'drawer-folder-row',realInsertion:true});h.move(700,400);h.release();
  assert.equal(h.context.state.items.find(item=>item.id==='quest').folderId,'folder');
  assert.equal(h.drawers.at(-1),'quest-drawer');
  assert.equal(h.visuals.surface,'drawer-folder-row');assert.equal(h.visuals.animations,1);
});

test('dropping into an open folder animates toward that window rather than its board copy',()=>{
  const h=desk({surface:'folder-window',realInsertion:true});h.move(700,400);h.release();
  assert.equal(h.visuals.surface,'folder-window');assert.equal(h.visuals.animations,1);
});
