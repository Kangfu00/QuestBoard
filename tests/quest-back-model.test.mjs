import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,createQuest,updateItem,serializeState,parseState,setArchived,moveQuestToFolder,createFolder} from '../dist/model.mjs';
test('notes and subquests survive edits, archive, folder storage and JSON backup',()=>{
  let state=createInitialState();const q=state.items.find(i=>i.type==='quest'),original={...q};
  state=updateItem(state,q.id,{notes:'  สำรวจเส้นทาง\nเตรียมเสบียง  ',subquests:[{id:'a',text:'ซื้อเสบียง',done:false},{id:'b',text:'เตรียมแผนที่',done:true}]});
  state=updateItem(state,q.id,{title:'A changed quest'});state=setArchived(state,q.id,true);
  const folder=createFolder({name:'Journeys'},state);state.items.push(folder);state=moveQuestToFolder(state,q.id,folder.id);
  const loaded=parseState(serializeState(state)).items.find(i=>i.id===q.id);
  assert.equal(loaded.notes,'  สำรวจเส้นทาง\nเตรียมเสบียง  ');
  assert.deepEqual(loaded.subquests,[{id:'a',text:'ซื้อเสบียง',done:false},{id:'b',text:'เตรียมแผนที่',done:true}]);
  assert.equal(loaded.x,original.x);assert.equal(loaded.y,original.y);assert.equal(loaded.status,original.status);
});
test('old backups do not need back fields and creation can initialize them',()=>{
  const old=createInitialState();assert.deepEqual(parseState(serializeState(old)),old);
  const q=createQuest({title:'A two-sided quest',notes:'A note',subquests:[{id:'first',text:'First step',done:false}]},old);
  assert.equal(q.notes,'A note');assert.equal(q.subquests.length,1);
});
test('malformed or excessive back data is rejected before state mutation',()=>{
  const state=createInitialState(),q=state.items.find(i=>i.type==='quest'),snapshot=serializeState(state);
  for(const patch of [{notes:null},{notes:'x'.repeat(8001)},{subquests:{}},{subquests:[{id:'x',text:'',done:false}]},{subquests:[{id:'x',text:'a',done:'yes'}]},{subquests:[{id:'x',text:'a',done:false},{id:'x',text:'b',done:true}]},{subquests:Array.from({length:81},(_,i)=>({id:`step${i}`,text:'step',done:false}))}]){
    assert.throws(()=>updateItem(state,q.id,patch));assert.equal(serializeState(state),snapshot);
  }
});
