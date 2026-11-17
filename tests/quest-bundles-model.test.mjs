import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuest,createFolder,validateState} from '../dist/model.mjs';
import {PAPER} from '../dist/paper-format.mjs';

const missing=()=>assert.fail('Quest bundle movement has not been implemented');
const {moveQuestBundle=missing,bundleDropPosition=missing,sourceAnchor=missing}=await import('../dist/quest-bundle-model.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
export function bundleState(){
  const state={version:1,items:[],stamps:[],settings:{stampStyle:'seal',theme:'walnut',boardName:'Test desk'}};
  const folder={...createFolder({name:'Folio'},state),id:'folio'};state.items.push(folder);
  const a={...createQuest({title:'First',rotation:0,notes:'Fresh writing',subquests:[{id:'task',text:'Keep this',done:true}]},state),id:'a'};state.items.push(a);
  const b={...createQuest({title:'Second',rotation:-13,status:'paused',archived:true,folderId:'folio'},state),id:'b'};state.items.push(b);
  return state;
}

test('folder batch preserves all quest content and untouched item identity without mutating its input',()=>{
  const state=bundleState(),before=structuredClone(state);
  const next=moveQuestBundle(state,['a','b'],{type:'folder',id:'folio'});
  assert.deepEqual(state,before);assert.equal(next.items[0],state.items[0]);
  for(const id of ['a','b']){const old=state.items.find(q=>q.id===id),q=next.items.find(q=>q.id===id);assert.deepEqual(q,{...old,archived:true,folderId:'folio'});}
  assert.doesNotThrow(()=>validateState(next));
});

test('board drop anchors the first paper at pointer scale and forms a bounded offset stack',()=>{
  const state=bundleState(),next=moveQuestBundle(state,['a','b'],{type:'board',origin:{left:100,top:50},scale:2,bounds:{width:1180,height:1000}},{x:800,y:600},{x:150,y:28});
  assert.deepEqual(next.items.slice(1).map(q=>({x:q.x,y:q.y,archived:q.archived,folderId:q.folderId,z:q.z})),[
    {x:200,y:247,archived:false,folderId:null,z:4},{x:210,y:257,archived:false,folderId:null,z:5}]);
  assert.equal(next.items[2].rotation,-13);assert.equal(next.items[1].notes,'Fresh writing');
});

test('tray drop uses current origin and scale while preserving saved board positions and rotations',()=>{
  const state=bundleState(),next=moveQuestBundle(state,['a','b'],{type:'tray',origin:{left:90,top:20},scale:.5},{x:290,y:220},{x:150,y:28});
  assert.deepEqual(next.items[1].storagePosition,{x:250,y:372});assert.deepEqual(next.items[2].storagePosition,{x:260,y:382});
  assert.equal(next.items[2].folderId,null);assert.equal(next.items[2].archived,true);assert.equal(next.items[2].x,state.items[2].x);assert.equal(next.items[2].rotation,-13);
  assert.deepEqual(next.items.slice(1).map(q=>q.z),[4,5]);
});

test('missing quests, repeated ids, wrong item types, invalid destinations and invalid geometry reject the whole batch',()=>{
  const state=bundleState(),before=structuredClone(state);
  for(const [ids,target] of [
    [['a','gone'],{type:'folder',id:'folio'}],[['a','a'],{type:'folder',id:'folio'}],[['a','folio'],{type:'folder',id:'folio'}],
    [['a','b'],{type:'folder',id:'gone'}],[['a','b'],{type:'folder',id:'a'}],[['a','b'],{type:'tray',origin:{left:0,top:0},scale:0}],
    [['a','b'],{type:'board',origin:{left:0,top:0},scale:1,bounds:{width:5,height:5}}],[['a','b'],{type:'unknown'}],
  ])assert.throws(()=>moveQuestBundle(state,ids,target,{x:600,y:500},{x:150,y:28}));
  assert.deepEqual(state,before);
});

test('a rotated grab remains under the pointer and board edge clamping respects the rotated sheet',()=>{
  const target={type:'board',origin:{left:100,top:50},scale:2,bounds:{width:1180,height:1000}};
  const position=bundleDropPosition({x:1000,y:800},target,{x:150,y:28},90);
  assert.ok(Math.abs(position.x-115.857143)<1e-9);
  assert.ok(Math.abs(position.y-162.857143)<1e-9);
  const edge=bundleDropPosition({x:-200,y:-200},target,{x:150,y:28},90);
  assert.ok(Math.abs(edge.x-62.14285714285714)<1e-9);
  assert.equal(edge.y,0);
});

test('source geometry inverts rotated and zoomed paper bounds rather than jumping to the usual grip',()=>{
  const result=sourceAnchor({x:298.1428571428571,y:210},{left:100,top:200,width:PAPER.height/2,height:150},{a:0,b:.5,c:-.5,d:0});
  assert.deepEqual(result,{grab:{x:20,y:28},scale:.5,rotation:90});
  assert.throws(()=>sourceAnchor({x:0,y:0},{left:0,top:0,width:0,height:0},{a:0,b:0,c:0,d:0}));
});

test('a whole-page bundle grab and offset stack stay inside the exact noninteger tray boundary',()=>{
  const state=bundleState(),target={type:'tray',origin:{left:0,top:0},scale:1};
  const anchor=sourceAnchor({x:300,y:PAPER.height},{left:0,top:0,width:300,height:PAPER.height},{a:1,b:0,c:0,d:1});
  assert.deepEqual(anchor.grab,{x:300,y:PAPER.height});
  const next=moveQuestBundle(state,['a','b'],target,{x:50000,y:50000},anchor.grab);
  for(const quest of next.items.slice(1))assert.deepEqual(quest.storagePosition,{x:19700,y:19575.714285714286});
  assert.deepEqual(validateState(next),next,'validation must not silently move a supposedly final bundle');
  const board=bundleDropPosition({x:50000,y:50000},{type:'board',origin:{left:0,top:0},scale:1,bounds:{width:20000,height:20000}},anchor.grab);
  assert.deepEqual(board,{x:19700,y:19575.714285714286});
  assert.throws(()=>bundleDropPosition({x:0,y:0},{type:'board',origin:{left:0,top:0},scale:1,bounds:{width:300,height:350}},{x:150,y:28}));
});
