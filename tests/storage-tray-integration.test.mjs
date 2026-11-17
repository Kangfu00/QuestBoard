import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createInitialState,createFolder,updateItem,setArchived,moveQuestToFolder,serializeState,parseState} from '../dist/model.mjs';
import {TRAY_SCALE,trayDrop,trayItems,trayPosition,ensureTrayPositions} from '../dist/storage-tray.mjs';
const source=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b));
function desk(){
  const state=createInitialState(),quest=state.items.find(i=>i.type==='quest');
  const folder=createFolder({name:'Letters'},state);state.items.push(folder);
  const events=[];
  const context={state,TRAY_SCALE,trayItems,trayPosition,trayDrop,ensureTrayPositions,setArchived,updateItem,
    closeFolderWindow(){},archiveSearch:'',sound:{play(){}},setActiveDrawer(){},showToast(){},restoreQuest(){},settleTrayItem(id,ghost){ghost?.remove();},
    $:()=>({value:'',getBoundingClientRect:()=>({left:100,top:-20})}),
    commit(next){context.state=ensureTrayPositions(next);events.push('commit');},
  };
  vm.createContext(context);vm.runInContext(section('function storeAtTray(','function settleTrayItem(')+section('function archiveQuest(','function restoreQuest('),context);
  return {context,quest,folder,events};
}
for(const type of ['quest','folder'])test(`${type}: board → precise tray position → rearrange → reload → board preserves both surfaces`,()=>{
  const h=desk(),item=h[type],original={x:item.x,y:item.y},grab={x:80,y:28};let removed=false;
  const event={clientX:410,clientY:228};
  h.context.archiveQuest(item.id,{remove(){removed=true;}},event,grab);
  assert.equal(removed,true);
  let saved=h.context.state.items.find(i=>i.id===item.id);assert.equal(saved.archived,true);
  assert.deepEqual(saved.storagePosition,trayDrop({x:410,y:228},{left:100,top:-20},grab,TRAY_SCALE,item.rotation,item.type));
  assert.deepEqual({x:saved.x,y:saved.y},original);
  h.context.storeAtTray(item.id,{clientX:720,clientY:352},grab);
  const restored=parseState(serializeState(h.context.state));
  saved=restored.items.find(i=>i.id===item.id);assert.equal(saved.archived,true);
  assert.deepEqual(saved.storagePosition,trayDrop({x:720,y:352},{left:100,top:-20},grab,TRAY_SCALE,item.rotation,item.type));
  const back=setArchived(restored,item.id,false).items.find(i=>i.id===item.id);
  assert.equal(back.archived,false);assert.deepEqual({x:back.x,y:back.y},original);assert.deepEqual(back.storagePosition,saved.storagePosition);
});
test('pulling a quest from a folio into the open tray detaches only that quest',()=>{
  const h=desk();h.context.state=moveQuestToFolder(h.context.state,h.quest.id,h.folder.id);
  h.context.storeAtTray(h.quest.id,{clientX:440,clientY:250},{x:100,y:25});
  const q=h.context.state.items.find(i=>i.id===h.quest.id);
  assert.equal(q.folderId,null);assert.equal(q.archived,true);
  assert.ok(trayItems(h.context.state).some(i=>i.id===q.id));
  assert.ok(trayItems(h.context.state).some(i=>i.id===h.folder.id));
});
test('initial migration freezes stored layout so removing another item never shifts its neighbors',()=>{
  const h=desk();const old=ensureTrayPositions(setArchived(h.context.state,h.quest.id,true));
  const before=old.items.find(i=>i.id===h.folder.id).storagePosition;
  const after=ensureTrayPositions(setArchived(old,h.quest.id,false));
  assert.deepEqual(after.items.find(i=>i.id===h.folder.id).storagePosition,before);
});
