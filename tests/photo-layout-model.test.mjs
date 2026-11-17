import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,createQuest,createFolder,addStamp,updateItem,setItemStatus,setArchived,moveQuestToFolder,serializeState,parseState} from '../dist/model.mjs';
const image='data:image/png;base64,iVBORw0KGgo=';
const layout={x:30,y:170,width:110,rotation:4};

test('legacy version-one quests omit photo layout through creation, edits and backup round trips',()=>{
  let state=createInitialState();
  assert.ok(state.items.every(item=>!Object.hasOwn(item,'photoLayout')));
  const quest=createQuest({title:'Legacy photo',imageDataUrl:image},state);
  assert.equal(Object.hasOwn(quest,'photoLayout'),false);
  state={...state,items:[...state.items,quest]};
  state=updateItem(state,quest.id,{title:'Edited legacy photo'});
  assert.deepEqual(parseState(serializeState(state)),state);
  assert.equal(state.version,1);
  assert.equal(Object.hasOwn(state.items.find(item=>item.id===quest.id),'photoLayout'),false);
});

test('new photo layouts persist with independent quest photos and explicit automatic reset',()=>{
  let state=createInitialState();
  const first=createQuest({title:'First photo',imageDataUrl:image,photoLayout:layout},state);
  const second=createQuest({title:'Second photo',imageDataUrl:image,photoLayout:{x:50,y:180,width:90,rotation:-2}},state);
  assert.deepEqual(first.photoLayout,layout);
  assert.notEqual(first.photoLayout,layout);
  state={...state,items:[...state.items,first,second]};
  state=updateItem(state,first.id,{photoLayout:{x:40,y:175,width:100,rotation:2}});
  const loaded=parseState(serializeState(state));
  assert.deepEqual(loaded.items.find(item=>item.id===first.id).photoLayout,{x:40,y:175,width:100,rotation:2});
  assert.deepEqual(loaded.items.find(item=>item.id===second.id).photoLayout,{x:50,y:180,width:90,rotation:-2});
  state=updateItem(state,first.id,{photoLayout:null});
  assert.equal(parseState(serializeState(state)).items.find(item=>item.id===first.id).photoLayout,null);
});

test('photo layout edits preserve quest back, stamps, storage and image metadata',()=>{
  let state=createInitialState();
  state=addStamp(state,{id:'stamp-photo',name:'Done',status:'done',dataUrl:image});
  const folder=createFolder({name:'Photo journeys'},state);
  state={...state,items:[...state.items,folder]};
  const quest=createQuest({title:'Photo journey',description:'Keep description',imageDataUrl:image,notes:'A journal',subquests:[{id:'step-photo',text:'Travel',done:true}],photoLayout:layout},state);
  state={...state,items:[...state.items,quest]};
  state=setItemStatus(state,quest.id,'done','stamp-photo','banner',{x:100,y:230});
  state=setArchived(state,quest.id,true);
  state=moveQuestToFolder(state,quest.id,folder.id);
  state=updateItem(state,quest.id,{storagePosition:{x:200,y:300},photoLayout:{x:35,y:160,width:100,rotation:-3}});
  const loaded=parseState(serializeState(state)).items.find(item=>item.id===quest.id);
  assert.deepEqual(loaded,{...quest,status:'done',stampId:'stamp-photo',stampStyle:'banner',stampPosition:{x:100,y:230},archived:true,folderId:folder.id,storagePosition:{x:200,y:300},photoLayout:{x:35,y:160,width:100,rotation:-3}});
});

test('removing a quest image clears its saved arrangement without changing unrelated fields',()=>{
  let state=createInitialState();
  const quest=createQuest({title:'Removed photo',imageDataUrl:image,photoLayout:layout,notes:'Keep journal'},state);
  state={...state,items:[...state.items,quest]};
  state=updateItem(state,quest.id,{imageDataUrl:null});
  const loaded=parseState(serializeState(state)).items.find(item=>item.id===quest.id);
  assert.equal(loaded.imageDataUrl,null);
  assert.equal(loaded.photoLayout,null);
  assert.equal(loaded.notes,'Keep journal');
});

test('replacing an image resets the old arrangement while an explicit replacement pose is accepted',()=>{
  let state=createInitialState();
  const quest=createQuest({title:'Replace photo',imageDataUrl:image,photoLayout:layout,notes:'Keep journal'},state);
  state={...state,items:[...state.items,quest]};
  const same=updateItem(state,quest.id,{imageDataUrl:image});
  assert.deepEqual(same.items.find(item=>item.id===quest.id).photoLayout,layout);
  const replacement='data:image/jpeg;base64,/9j/';
  const replaced=updateItem(state,quest.id,{imageDataUrl:replacement}).items.find(item=>item.id===quest.id);
  assert.deepEqual(replaced,{...quest,imageDataUrl:replacement,photoLayout:null});
  const explicit=updateItem(state,quest.id,{imageDataUrl:replacement,photoLayout:{x:40,y:170,width:90,rotation:-1}}).items.find(item=>item.id===quest.id);
  assert.deepEqual(explicit.photoLayout,{x:40,y:170,width:90,rotation:-1});
  const removed=updateItem(state,quest.id,{imageDataUrl:null,photoLayout:layout}).items.find(item=>item.id===quest.id);
  assert.equal(removed.photoLayout,null);
});

test('malformed photo layouts fail create, update and import before mutation',()=>{
  const state=createInitialState(),quest=createQuest({title:'Photo',imageDataUrl:image,photoLayout:layout},state);
  state.items.push(quest);
  const snapshot=serializeState(state);
  for(const bad of [{},[],{...layout,x:NaN},{...layout,y:Infinity},{...layout,width:253},{...layout,rotation:16},{...layout,x:-1}]){
    assert.throws(()=>createQuest({title:'Bad photo',imageDataUrl:image,photoLayout:bad},state));
    assert.throws(()=>updateItem(state,quest.id,{photoLayout:bad}));
    const raw=JSON.parse(snapshot);raw.items.find(item=>item.id===quest.id).photoLayout=bad;
    assert.throws(()=>parseState(JSON.stringify(raw)));
    assert.equal(serializeState(state),snapshot);
  }
});
