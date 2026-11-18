import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createQuest,createFolder,updateItem,setArchived,moveQuestToFolder} from '../dist/model.mjs';
import {containsPoint,rotatedClampPosition} from '../dist/interactions.mjs';
import {ghostPose,dragTilt} from '../dist/desk-motion.mjs';
import {paperGripPose} from '../dist/paper-grip.mjs';
import {stampPoint} from '../dist/stamp-placement.mjs';
import {PAPER} from '../dist/paper-format.mjs';
import {TRAY_SCALE,trayDrop,trayPosition,trayItems} from '../dist/storage-tray.mjs';

const source=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');
function section(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,`Application section ${start} must exist`);
  return source.slice(a,b);
}
function target(){
  const listeners=new Map();let pointer=null;
  return {listeners,addEventListener(name,fn){listeners.set(name,fn);},removeEventListener(name,fn){if(listeners.get(name)===fn)listeners.delete(name);},
    setPointerCapture(id){pointer=id;},hasPointerCapture(id){return pointer===id;},releasePointerCapture(id){assert.equal(pointer,id);pointer=null;}};
}
function element(initial=[]){
  const classes=new Set(initial);
  return {...target(),dataset:{},style:{setProperty(name,value){this[name]=value;},getPropertyValue(name){return this[name]??'';}},isConnected:true,
    classList:{add(...names){names.forEach(name=>classes.add(name));},remove(...names){names.forEach(name=>classes.delete(name));},contains:name=>classes.has(name)},
    focus(){this.focused=true;},removeAttribute(name){delete this[name];},setAttribute(name,value){this[name]=value;},remove(){this.isConnected=false;}};
}
function desk({scale=.72,boardScale=.63,rotation=8,grab={x:65,y:24},animatedParent=null}={}){
  let state={version:1,items:[],stamps:[],settings:{stampStyle:'seal',theme:'walnut',boardName:'Test'}};
  const quest={...createQuest({title:'A folio paper',x:120,y:140,rotation,archived:true},state),id:'quest',folderId:'source'};
  const folder={...createFolder({name:'Source'},state),id:'source'};
  const receiver={...createFolder({name:'Receiver'},state),id:'receiver'};
  state.items.push(quest,folder,receiver);
  const body=target(),window=target(),panel={hidden:false},ghosts=[],calls=[],commits=[];
  const angle=(animatedParent?.rotation??0)*Math.PI/180,visualScale=scale*(animatedParent?.scale??1);
  const affine={a:visualScale*Math.cos(angle),b:visualScale*Math.sin(angle),c:-visualScale*Math.sin(angle),d:visualScale*Math.cos(angle)};
  const center={x:430+PAPER.width/2*scale,y:90+PAPER.height/2*scale},width=Math.abs(affine.a)*PAPER.width+Math.abs(affine.c)*PAPER.height,height=Math.abs(affine.b)*PAPER.width+Math.abs(affine.d)*PAPER.height;
  const rect={left:center.x-width/2,top:center.y-height/2,width,height,right:center.x+width/2,bottom:center.y+height/2};
  const stage=animatedParent?element(['folio-paper-stage']):null;
  if(stage){const parentScale=animatedParent.scale;stage.computedTransform=`matrix(${parentScale*Math.cos(angle)},${parentScale*Math.sin(angle)},${-parentScale*Math.sin(angle)},${parentScale*Math.cos(angle)},0,0)`;}
  const paper=element(['quest-paper']);paper.dataset.folioPaper='quest';paper.offsetWidth=PAPER.width;paper.offsetHeight=PAPER.height;
  paper.computedTransform=`matrix(${scale},0,0,${scale},0,0)`;paper.parentElement=stage;
  paper.getBoundingClientRect=()=>{calls.push(['measure-preview']);return rect;};
  paper.closest=selector=>selector.includes('[data-folio-paper]')?paper:selector==='.folio-paper-stage'?stage:selector==='.folder-window'?panel:null;
  const grip=element(['quest-top','drag-handle']);grip.dataset.questDrag='quest';
  grip.matches=selector=>selector==='[data-daily-book-drag]'&&Object.hasOwn(grip.dataset,'dailyBookDrag');
  grip.closest=selector=>selector.includes('[data-quest-drag]')?grip:selector.includes('[data-folio-paper]')?paper:null;
  const boardOrigin={left:40,top:60};
  const trayRect={left:920,top:80};
  const nodes=new Map([
    ['#folder-window',panel],['[data-folio-paper="quest"] .quest-top',grip],['#board-scroll',{getBoundingClientRect:()=>({left:0,top:0,right:1400,bottom:900})}],
    ['#board-canvas',{getBoundingClientRect:()=>boardOrigin}],['#search',{value:''}],['#drawer-list',{getBoundingClientRect:()=>trayRect}],
  ]);
  let activeDrawer='tool-drawer',overTray=false,folderTarget=null;
  const context={PAPER,state,drag:null,storedDrag:null,heldStamp:null,dialog:{open:false},currentScale:boardScale,canvasBounds:{width:3000,height:2200},filters:{},suppressClickUntil:0,
    TRAY_SCALE,trayDrop,trayPosition,trayItems,stampPoint,containsPoint,rotatedClampPosition,ghostPose,dragTilt,updateItem,setArchived,moveQuestToFolder,
    window:Object.assign(window,{getSelection:()=>null}),document:{body:Object.assign(body,{append(node){ghosts.push(node);}}),elementFromPoint:()=>null,
      createElement(){const container={firstElementChild:element(['quest-paper'])};Object.defineProperty(container,'innerHTML',{set(){}});return container;}},
    $:selector=>nodes.get(selector),getComputedStyle:node=>({transform:node.computedTransform??'none',getPropertyValue:()=>String(scale)}),
    DOMMatrix:class{constructor(transform){const [a,b,c,d]=transform.slice(transform.indexOf('(')+1,-1).split(',').map(Number);Object.assign(this,{a,b,c,d});}},
    cancelMotion(node){calls.push(['cancel-stage',node]);node.computedTransform='none';},
    activeDrawerId:()=>activeDrawer,setActiveDrawer(id){activeDrawer=id;calls.push(['drawer',id]);},activateStorageDrawer(){activeDrawer='quest-drawer';},
    sound:{play(name){calls.push(['sound',name]);}},stampCues:new Map(),storageDrawerControl:null,queueContactSound(){return new AbortController();},paperGripPose,renderQuest:()=>'<article></article>',renderFolder:()=>'<article></article>',
    finishFolderOpening(){calls.push(['finish-opening']);},followStorageHandle(){},folderTargetAt:()=>folderTarget,highlightFolder(){},
    overStorageTray:()=>overTray,highlightStorageTray(){},clearStorageFeedback(){},performance:{now:()=>100},reducedMotion:()=>true,
    requestAnimationFrame(){throw Error('Reduced motion must not schedule a frame');},cancelAnimationFrame(){},
    renderFolderWindow(){panel.hidden=false;calls.push(['render-folder']);},closeFolderWindow(){panel.hidden=true;},settlePaper(){},
    settleTrayItem(id,ghost,localGrab){calls.push(['settle-tray',id,{...localGrab}]);ghost?.remove();},
    animateFolderInsert(ghost,id,surface){calls.push(['insert',id,surface,ghost.isConnected]);ghost.remove();},showToast(message){calls.push(['toast',message]);},
    commit(next){context.state=next;commits.push(next);},
  };
  context.questPhotos??=null;context.photoViewer??=null;vm.createContext(context);
  vm.runInContext([
    section('function updateHeldGhost(','function settlePaper('),
    section('function storeInFolder(','function startStoredDrag('),
    section('function startStoredDrag(','function renderBoard('),
    section('function storeAtTray(','function settleTrayItem('),
  ].join('\n'),context);
  const pointer={target:grip,button:0,pointerId:7,clientX:center.x+affine.a*(grab.x-PAPER.width/2)+affine.c*(grab.y-PAPER.height/2),clientY:center.y+affine.b*(grab.x-PAPER.width/2)+affine.d*(grab.y-PAPER.height/2),preventDefault(){calls.push(['prevent']);}};
  return {context,pointer,quest,paper,stage,panel,ghosts,calls,commits,body,window,boardOrigin,trayRect,visualScale,
    start:()=>context.startStoredDrag(pointer),
    move:(dx=12,dy=8)=>context.moveStoredDrag({...pointer,clientX:pointer.clientX+dx,clientY:pointer.clientY+dy}),
    cancel:()=>context.cancelStoredDrag({pointerId:7}),
    release:(clientX=800,clientY=500)=>context.endStoredDrag({...pointer,clientX,clientY}),
    tray(){overTray='quest-drawer';},folder(){folderTarget={id:'receiver',surface:'board-folder'};},
  };
}
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-8,`${message}: ${actual} != ${expected}`);
function released(h){
  assert.equal(h.context.storedDrag,null);assert.equal(h.body.hasPointerCapture(7),false);assert.equal(h.window.listeners.size,0);
}

test('lifting a folder from storage preserves the custom leather hue on its drag copy',()=>{
  const h=desk();
  const folder={...h.context.state.items.find(item=>item.id==='source'), color:'dye-167-classic'};
  const copy=element(['board-folder']);
  copy.style.setProperty('--leather-hue','167');
  Object.defineProperty(copy.style,'cssText',{set(){delete this['--leather-hue'];}});
  h.context.document.createElement=()=>({firstElementChild:copy});
  h.context.storedDrag={id:folder.id,item:folder,surface:element(),scale:TRAY_SCALE,rotation:folder.rotation,
    grab:{x:60,y:18},startX:h.pointer.clientX,startY:h.pointer.clientY,pointerId:h.pointer.pointerId,moved:false};

  h.move();

  assert.equal(h.ghosts[0],copy);
  assert.equal(copy.style.getPropertyValue('--leather-hue'),'167');
  assert.equal(copy.style.position,'fixed');
  assert.equal(copy.style.width,`${PAPER.width}px`);
  assert.equal(copy.style.height,'210px');
});

for(const scale of [.72,1.15])test(`folio pickup at ${scale}x preserves the actual grabbed pixel and its upright fitted pose`,()=>{
  const h=desk({scale});h.start();
  const d=h.context.storedDrag;
  near(d.grab.x,65,'local grab x');near(d.grab.y,24,'local grab y');near(d.scale,scale,'preview scale');
  assert.equal(d.item.rotation,8,'the stored model rotation survives the upright preview');
  h.move();
  assert.equal(h.panel.hidden,false,'the source folio stays visible while the held ghost floats above it');
  assert.equal(h.ghosts.length,1);const ghost=h.ghosts[0];
  near(parseFloat(ghost.style.left),h.pointer.clientX+12-65,'held left');
  near(parseFloat(ghost.style.top),h.pointer.clientY+8-24,'held top');
  const origin=ghost.style.transformOrigin.split(' ').map(parseFloat),pose=ghost.style.transform.match(/^rotate\(([-\d.e]+)deg\) scale\(([-\d.e]+)\)$/);
  near(origin[0],65,'held origin x');near(origin[1],24,'held origin y');assert.ok(pose,'the held pose has an explicit rotation and scale');
  near(Number(pose[1]),0,'upright held rotation');near(Number(pose[2]),scale,'held preview scale');
  assert.equal(h.commits.length,0);h.cancel();released(h);
});

test('picking up during a rotated and scaled selection animation captures the local pixel before settling its ancestors',()=>{
  const h=desk({scale:.72,animatedParent:{rotation:-7,scale:1.04}});h.start();
  const d=h.context.storedDrag;
  near(d.grab.x,65,'animated local grab x');near(d.grab.y,24,'animated local grab y');near(d.scale,h.visualScale,'composite presentation scale');
  const measured=h.calls.findIndex(call=>call[0]==='measure-preview'),cancelled=h.calls.findIndex(call=>call[0]==='cancel-stage'),settled=h.calls.findIndex(call=>call[0]==='finish-opening');
  assert.ok(measured>=0&&cancelled>measured&&settled>cancelled,'snapshot geometry precedes cancelling the stage and settling the folder');
  assert.equal(h.calls[cancelled][1],h.stage);assert.equal(h.stage.computedTransform,'none');
  h.move();const ghost=h.ghosts[0];
  near(parseFloat(ghost.style.left)+65,h.pointer.clientX+12,'stable animated pickup x');
  near(parseFloat(ghost.style.top)+24,h.pointer.clientY+8,'stable animated pickup y');
  const pose=ghost.style.transform.match(/^rotate\(([-\d.e]+)deg\) scale\(([-\d.e]+)\)$/);assert.ok(pose);
  near(Number(pose[1]),0,'upright animated pickup');near(Number(pose[2]),h.visualScale,'captured scale survives ancestor settlement');
  assert.equal(d.item.rotation,8);h.cancel();released(h);
});

test('a click and a sub-threshold movement keep the folio visible without mutating the quest',()=>{
  const h=desk();h.start();h.move(2,2);
  assert.equal(h.context.storedDrag.moved,false);assert.equal(h.panel.hidden,false);assert.equal(h.ghosts.length,0);
  h.release(h.pointer.clientX+2,h.pointer.clientY+2);released(h);
  assert.equal(h.panel.hidden,false);assert.equal(h.commits.length,0);assert.equal(h.context.state.items.find(item=>item.id==='quest').folderId,'source');
});

test('cancelling a folio preview drag restores its drawer and folder without changing storage or rotation',()=>{
  const h=desk();h.start();h.move();
  assert.equal(h.panel.hidden,false,'the source folio remains open while its paper is held');
  h.context.cancelStoredDrag({pointerId:99});assert.ok(h.context.storedDrag,'unrelated pointers cannot cancel the held paper');
  h.cancel();released(h);
  assert.equal(h.ghosts[0].isConnected,false);assert.equal(h.panel.hidden,false);assert.equal(h.commits.length,0);assert.equal(h.pointer.target.focused,true,'cancel returns focus to the restored preview grip');
  assert.ok(h.calls.some(call=>call[0]==='drawer'&&call[1]==='tool-drawer'));
  assert.equal(h.context.state.items.find(item=>item.id==='quest'),h.quest);
});

test('placing a folio preview on the board preserves model rotation and places the grabbed pixel under the pointer',()=>{
  const h=desk({scale:1.15});h.start();h.move();h.release(800,500);released(h);
  assert.equal(h.panel.hidden,false,'placing one paper must not close source or unrelated folios');
  const saved=h.context.state.items.find(item=>item.id==='quest');
  assert.equal(saved.archived,false);assert.equal(saved.folderId,null);assert.equal(saved.rotation,8);assert.equal(h.commits.length,1);
  const angle=saved.rotation*Math.PI/180,gx=65-PAPER.width/2,gy=24-PAPER.height/2;
  near(h.boardOrigin.left+(saved.x+150+gx*Math.cos(angle)-gy*Math.sin(angle))*h.context.currentScale,800,'final anchor x');
  near(h.boardOrigin.top+(saved.y+PAPER.height/2+gx*Math.sin(angle)+gy*Math.cos(angle))*h.context.currentScale,500,'final anchor y');
});

test('placing a folio preview in the tray detaches only that paper and applies its saved rotation to the same grab point',()=>{
  const h=desk();h.start();h.move();h.tray();h.release(1100,500);released(h);
  const saved=h.context.state.items.find(item=>item.id==='quest');
  assert.equal(saved.archived,true);assert.equal(saved.folderId,null);assert.equal(saved.rotation,8);
  const expected=trayDrop({x:1100,y:500},h.trayRect,{x:65,y:24},TRAY_SCALE,8,'quest');
  near(saved.storagePosition.x,expected.x,'tray x');near(saved.storagePosition.y,expected.y,'tray y');
  const settled=h.calls.find(call=>call[0]==='settle-tray');assert.ok(settled);near(settled[2].x,65,'tray grab x');near(settled[2].y,24,'tray grab y');
  assert.equal(h.context.state.items.find(item=>item.id==='source').id,'source');
});

test('placing a folio preview in another folder retains the held ghost until insertion owns it',()=>{
  const h=desk();h.start();h.move();h.folder();h.release();released(h);
  const saved=h.context.state.items.find(item=>item.id==='quest');
  assert.equal(saved.archived,true);assert.equal(saved.folderId,'receiver');assert.equal(saved.rotation,8);
  assert.ok(h.calls.some(call=>call[0]==='insert'&&call[1]==='receiver'&&call[3]===true));
});

test('releasing a held folio paper over a document keeps it filed instead of dropping behind that window',()=>{
  const h=desk();h.start();h.move();
  h.context.document.elementFromPoint=()=>({closest:selector=>selector.includes('[data-desk-window]')?h.panel:null});
  h.release();released(h);
  assert.equal(h.commits.length,0);assert.equal(h.context.state.items.find(item=>item.id==='quest').folderId,'source');
  assert.equal(h.panel.hidden,false);assert.equal(h.ghosts[0].isConnected,false);
});

test('dropping a stored paper on the wooden shutter leaves it in storage',()=>{
  const h=desk();h.start();h.move();
  h.context.document.elementFromPoint=()=>({closest:selector=>selector.includes('.desk-shutter')?{}:null});
  h.release();released(h);
  assert.equal(h.commits.length,0);
  assert.equal(h.context.state.items.find(item=>item.id==='quest').folderId,'source');
});
