import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createInitialState,createQuest,createFolder} from '../dist/model.mjs';
import {animateTransient,cancelMotion,ghostPose,dragTilt} from '../dist/desk-motion.mjs';
import {paperGripPose} from '../dist/paper-grip.mjs';
import {stampPoint} from '../dist/stamp-placement.mjs';
import {TRAY_SCALE} from '../dist/storage-tray.mjs';
import {PAPER} from '../dist/paper-format.mjs';

const source=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');
function section(start,end){
  const from=source.indexOf(start),to=source.indexOf(end,from);
  assert.ok(from>=0&&to>from,`Application section ${start} must exist`);
  return source.slice(from,to);
}
function element(){
  const classes=new Set();let captured=null;
  return {isConnected:true,dataset:{},style:{left:'800px',top:'100px',transform:'scale(.62)',transformOrigin:'150px 28px',setProperty(name,value){this[name]=value;}},
    classList:{contains:name=>classes.has(name),add(...names){names.forEach(name=>classes.add(name));},remove(...names){names.forEach(name=>classes.delete(name));}},
    addEventListener(){},removeEventListener(){},setAttribute(){},removeAttribute(){},
    setPointerCapture(id){captured=id;},hasPointerCapture:id=>captured===id,releasePointerCapture(){captured=null;},
    remove(){this.isConnected=false;},
  };
}
function desk(type){
  const state=createInitialState();
  const item={...(type==='folder'?createFolder({name:'Re-grab folio'},state):createQuest({title:'Re-grab paper',archived:true},state)),id:'held',archived:true,rotation:0};
  state.items=[item];
  const surface=element(),grip=element(),body=element(),ghosts=[],panel={hidden:true};
  surface.dataset.storageId=item.id;
  surface.getBoundingClientRect=()=>({left:800,top:100,width:PAPER.width*TRAY_SCALE,height:(type==='folder'?210:PAPER.height)*TRAY_SCALE});
  grip.dataset[type==='folder'?'folderDrag':'questDrag']=item.id;
  grip.closest=selector=>selector==='[data-storage-id]'?surface:selector==='[data-folio-paper]'?null:grip;
  const landing=element();let finishLanding;
  const finished=new Promise(resolve=>{finishLanding=resolve;});
  landing.animate=()=>({finished,cancel(){}});
  const context={PAPER,state,TRAY_SCALE,currentScale:.8,drag:null,storedDrag:null,heldStamp:null,dialog:{open:false},stampCues:new Map(),AbortController,
    animateTransient,cancelMotion,ghostPose,dragTilt,paperGripPose,stampPoint,
    reducedMotion:()=>false,performance:{now:()=>100},requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout(){},
    window:{getSelection:()=>null,addEventListener(){},removeEventListener(){}},
    document:{body:Object.assign(body,{append(ghost){ghosts.push(ghost);}}),createElement(){return {firstElementChild:element()};}},
    $:selector=>selector==='#folder-window'?panel:selector==='[data-storage-id="held"]'?surface:null,
    getComputedStyle:()=>({transform:'none'}),storageDrawerControl:{rest(){}},
    sound:{play(){}},activeDrawerId:()=> 'quest-drawer',setActiveDrawer(){},
    renderQuest:()=>'<article></article>',renderFolder:()=>'<article></article>',
    finishFolderOpening(){},activateStorageDrawer(){},followStorageHandle(){},
    folderTargetAt:()=>null,highlightFolder(){},overStorageTray:()=>null,highlightStorageTray(){},clearStorageFeedback(){},
    renderFolderWindow(){},suppressClickUntil:0,
  };
  context.questPhotos??=null;context.photoViewer??=null;vm.createContext(context);
  vm.runInContext([
    section('function updateHeldGhost(','function settlePaper('),
    section('function startStoredDrag(','function renderBoard('),
    section('function settleTrayItem(','function archiveQuest('),
    section('function queueContactSound(','function playStampImpact('),
  ].join('\n'),context);
  const pointer={target:grip,button:0,pointerId:7,clientX:893,clientY:117.36,preventDefault(){}};
  return {context,surface,landing,ghosts,finishLanding,pointer};
}

// Catch a previous landing keeping its ghost or clearing a replacement drag's
// source state. Use real handlers and motion ownership; only DOM/WAAPI are fake.
for(const type of ['quest','folder'])test(`re-grabbing a settling ${type} retires the landing without exposing the new drag source`,async()=>{
  const h=desk(type);
  h.context.settleTrayItem('held',h.landing,{x:150,y:28});
  assert.equal(h.surface.classList.contains('storage-source'),true);
  h.context.startStoredDrag(h.pointer);
  h.context.moveStoredDrag({...h.pointer,clientX:905,clientY:125.36});
  const replacement=h.context.storedDrag;
  const afterPickup={oldGhostRemoved:!h.landing.isConnected,newGhostVisible:h.ghosts[0]?.isConnected,sourceDimmed:h.surface.classList.contains('storage-source')};
  h.finishLanding();
  await Promise.resolve();await Promise.resolve();
  const afterOldCompletion={newDragActive:h.context.storedDrag===replacement,newGhostVisible:h.ghosts[0]?.isConnected,sourceDimmed:h.surface.classList.contains('storage-source')};
  h.context.cancelStoredDrag({pointerId:7});
  assert.deepEqual({afterPickup,afterOldCompletion},{
    afterPickup:{oldGhostRemoved:true,newGhostVisible:true,sourceDimmed:true},
    afterOldCompletion:{newDragActive:true,newGhostVisible:true,sourceDimmed:true},
  });
});
