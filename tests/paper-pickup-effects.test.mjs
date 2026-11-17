import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {rotatedOrigin,dragPosition,rotatedClampPosition,drawerForDraggedItem} from '../dist/interactions.mjs';
import {grabPoint} from '../dist/desk-motion.mjs';

const source=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');
const pickupSource=source.slice(source.indexOf('function startDrag('),source.indexOf('function cleanupDrag('));

function paper(classes){
  const names=new Set(classes);
  return {dataset:{id:'quest'},offsetWidth:300,offsetHeight:350,
    classList:{contains:name=>names.has(name),add(...values){values.forEach(value=>names.add(value));},remove(...values){values.forEach(value=>names.delete(value));}},
    style:{setProperty(){}},removeAttribute(){},setAttribute(){},querySelectorAll:()=>[],
    cloneNode(){return paper([...names]);},
  };
}
function pickup(effect,scale,{stampCues=new Map()}={}){
  const item=paper(['board-item',effect]),events=new Map(),operations=[],ghosts=[];
  const handle={focus(){},setPointerCapture(){},addEventListener(name,fn){events.set(name,fn);},closest(selector){return selector==='.drag-handle'?handle:selector==='.board-item'?item:null;}};
  item.getBoundingClientRect=()=>{
    operations.push({kind:'measure',activeEffects:['restored-paper','stamp-hit'].filter(name=>item.classList.contains(name))});
    return {left:100,top:200,width:300*scale,height:350*scale};
  };
  const canvas={getBoundingClientRect:()=>({left:0,top:0})};
  const context={heldStamp:null,drag:null,storedDrag:null,stampCues,currentScale:scale,canvasBounds:{width:1180,height:1000},
    state:{items:[{id:'quest',type:'quest',x:80,y:100,rotation:0,z:1}]},
    window:{getSelection:()=>null},document:{body:{append(ghost){ghosts.push(ghost);}}},
    $:selector=>selector==='#board-canvas'?canvas:null,
    cancelMotion(element){operations.push({kind:'cancel',element});},paperEffects:{cancelEntry(){}},
    rotatedOrigin,grabPoint,dragPosition,rotatedClampPosition,drawerForDraggedItem,
    activeDrawerId:()=>null,activateStorageDrawer(){},sound:{play(){}},updateHeldGhost(){},
    followStorageHandle(){},folderTargetAt:()=>null,highlightFolder(){},overStorageTray:()=>false,highlightStorageTray(){},
    endDrag(){},cancelDrag(){},
  };
  context.questPhotos??=null;context.photoViewer??=null;vm.createContext(context);vm.runInContext(pickupSource,context);
  const pointer={target:handle,button:0,pointerId:7,clientX:100+80*scale,clientY:200+28*scale,preventDefault(){}};
  context.startDrag(pointer);
  return {item,context,operations,ghosts,lift(){events.get('pointermove')({...pointer,clientX:pointer.clientX+12,clientY:pointer.clientY+8});}};
}

test('picking up a stamped paper cancels its pending contact without cancelling another paper',()=>{
  const pending=new AbortController(),other=new AbortController();
  const stampCues=new Map([['quest',pending],['other-quest',other]]);
  const h=pickup('stamp-hit',1,{stampCues});
  assert.equal(pending.signal.aborted,true);
  assert.equal(other.signal.aborted,false);
  assert.equal(stampCues.has('quest'),false);assert.equal(stampCues.get('other-quest'),other);
  assert.equal(h.item.classList.contains('stamp-hit'),false);assert.equal(h.context.drag.id,'quest');
});

for(const event of ['blur','pagehide'])test(`${event} cancels all pending stamp contacts`,()=>{
  const cues=[new AbortController(),new AbortController()],events=new Map();
  const stampCues=new Map(cues.map((cue,index)=>[`quest-${index}`,cue]));
  const context={stampCues,drag:null,storedDrag:null,window:{addEventListener:(name,fn)=>events.set(name,fn)},
    paperEffects:{cancelAll(){}},finishFolderOpening(){},folioWindows:{cancelClosing(){}},returnStamp(){},
  };
  context.questPhotos??=null;context.photoViewer??=null;vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("window.addEventListener('blur'"),source.indexOf('if(saveUnavailable)')),context);
  events.get(event)();
  assert.ok(cues.every(cue=>cue.signal.aborted));assert.equal(stampCues.size,0);
});

for(const effect of ['restored-paper','stamp-hit'])for(const scale of [.5,1.5]){
  test(`picking up ${effect} at ${scale}x stops its transform before measurement and cloning`,()=>{
    const h=pickup(effect,scale);
    assert.equal(h.operations[0].kind,'cancel','the previous transient motion must stop before measurement');
    assert.equal(h.operations[0].element,h.item);
    assert.deepEqual(h.operations.find(operation=>operation.kind==='measure').activeEffects,[],
      'CSS transform animations must be removed before computing the local grab point');
    assert.equal(h.context.drag.grab.x,80);assert.equal(h.context.drag.grab.y,28);
    h.lift();
    assert.equal(h.ghosts.length,1);
    assert.equal(h.ghosts[0].classList.contains(effect),false,'the drag ghost must not inherit a CSS transform animation');
    assert.equal(h.ghosts[0].classList.contains('quest-drag-ghost'),true);
  });
}
