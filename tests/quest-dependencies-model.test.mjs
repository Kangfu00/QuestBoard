import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createQuest, createFolder, createLabel, updateItem, deleteItem, setItemStatus,
  setArchived, moveQuestToFolder, validateState, serializeState, parseState,
  MAX_BACKUP_BYTES,
} from '../dist/model.mjs';
import {applyHeldStamp, chooseStampTool} from '../dist/stamp-tools.mjs';
import * as dependencies from '../dist/quest-dependencies.mjs';

const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0WQAAAAASUVORK5CYII=';
const emptyState=()=>({version:1,items:[],stamps:[],settings:{stampStyle:'seal',theme:'walnut',boardName:'Dependencies'}});
function addQuest(state,id,input={}){
  const quest={...createQuest({title:id,...input},state),id};
  state.items.push(quest);return quest;
}
function chain(){
  const state=emptyState();
  addQuest(state,'first');addQuest(state,'second');
  addQuest(state,'dependent',{prerequisiteIds:['first','second']});
  addQuest(state,'last',{prerequisiteIds:['dependent']});
  return state;
}

test('quest creation keeps selected prerequisite order without sharing the input array',()=>{
  const state=emptyState();addQuest(state,'one');addQuest(state,'two');
  const prerequisiteIds=[' two ','one'];
  const quest=createQuest({title:'Dependent',prerequisiteIds},state);
  assert.deepEqual(quest.prerequisiteIds,['two','one']);
  assert.notEqual(quest.prerequisiteIds,prerequisiteIds);
  assert.deepEqual(prerequisiteIds,[' two ','one']);
  assert.equal(Object.hasOwn(createQuest({title:'Legacy'},state),'prerequisiteIds'),false);
  assert.deepEqual(createQuest({title:'Explicitly cleared',prerequisiteIds:[]},state).prerequisiteIds,[]);
});

test('malformed and nonquest prerequisites fail on create edit and import without changing state',()=>{
  const state=emptyState();addQuest(state,'one');addQuest(state,'target');
  state.items.push({...createLabel({text:'Heading'},state),id:'heading'});
  state.items.push({...createFolder({name:'Folder'},state),id:'folder'});
  const before=structuredClone(state);
  for(const prerequisiteIds of [null,'one',{},['one','one'],['one',' one '],['missing'],['heading'],['folder'],[''],[1],['unsafe id'],['ก'],['x'.repeat(101)]]){
    assert.throws(()=>createQuest({title:'Bad',prerequisiteIds},state),/ภารกิจ|รหัส|เควส|เงื่อนไข/);
    assert.throws(()=>updateItem(state,'target',{prerequisiteIds}),/ภารกิจ|รหัส|เควส|เงื่อนไข/);
    const raw={...state,items:state.items.map(item=>item.id==='target'?{...item,prerequisiteIds}:item)};
    assert.throws(()=>validateState(raw),/ภารกิจ|รหัส|เควส|เงื่อนไข/);
    assert.deepEqual(state,before);
  }
});

test('self references and direct or indirect cycles are rejected on edit and import',()=>{
  const state=chain();
  for(const [id,prerequisiteIds] of [['first',['first']],['first',['dependent']],['first',['last']],['dependent',['last']]]){
    assert.throws(()=>updateItem(state,id,{prerequisiteIds}),/ตัวเอง|วงจร|วน/);
    const raw={...state,items:state.items.map(item=>item.id===id?{...item,prerequisiteIds}:item)};
    assert.throws(()=>parseState(JSON.stringify(raw)),/ตัวเอง|วงจร|วน/);
  }
  assert.equal(Object.hasOwn(state.items[0],'prerequisiteIds'),false);
});

test('all prerequisite quests must succeed before any direct modal or held stamp can complete a quest',()=>{
  const initial=chain();
  for(const state of [initial,setItemStatus(initial,'first','done'),setItemStatus(setItemStatus(initial,'first','done'),'second','paused'),setItemStatus(setItemStatus(initial,'first','done'),'second','failed')]){
    const before=structuredClone(state);
    assert.throws(()=>updateItem(state,'dependent',{status:'done'}),/ก่อน|สำเร็จ/);
    assert.throws(()=>setItemStatus(state,'dependent','done'),/ก่อน|สำเร็จ/);
    assert.throws(()=>applyHeldStamp(state,'dependent',chooseStampTool('done'),{x:30,y:40}),/ก่อน|สำเร็จ/);
    assert.throws(()=>createQuest({title:'Cannot bypass',status:'done',prerequisiteIds:['first','second']},state),/ก่อน|สำเร็จ/);
    assert.equal(setItemStatus(state,'dependent','paused').items[2].status,'paused');
    assert.equal(setItemStatus(state,'dependent','failed').items[2].status,'failed');
    assert.deepEqual(state,before);
  }
  let ready=setItemStatus(setItemStatus(initial,'first','done'),'second','done');
  assert.throws(()=>setItemStatus(ready,'last','done'),/ก่อน|สำเร็จ/);
  ready=applyHeldStamp(ready,'dependent',chooseStampTool('done'),{x:30,y:40});
  assert.deepEqual(ready.items[2].stampPosition,{x:30,y:40});
  assert.equal(setItemStatus(ready,'last','done').items[3].status,'done');
  assert.equal(createQuest({title:'Ready on creation',status:'done',prerequisiteIds:['first','second']},ready).status,'done');
});

test('archiving and filing do not bypass completion guards or prevent completed prerequisites from unlocking',()=>{
  let state=chain();
  const folder={...createFolder({name:'Archive'},state),id:'archive'};state.items.push(folder);
  state=moveQuestToFolder(state,'first','archive');state=setArchived(state,'dependent',true);
  assert.throws(()=>applyHeldStamp(state,'dependent',chooseStampTool('done'),undefined,{allowArchived:true}),/ก่อน|สำเร็จ/);
  state=applyHeldStamp(state,'first',chooseStampTool('done'),undefined,{allowArchived:true});
  state=setItemStatus(state,'second','done');
  assert.equal(applyHeldStamp(state,'dependent',chooseStampTool('done'),undefined,{allowArchived:true}).items[2].status,'done');
});

test('reopening a predecessor preserves completed history and permits edits while unfinished dependents relock',()=>{
  let state=chain();
  state=setItemStatus(setItemStatus(state,'first','done'),'second','done');
  state=setItemStatus(state,'dependent','done',null,'banner',{x:28,y:90});
  const historical=state.items[2];
  state=setItemStatus(state,'first','active');
  assert.equal(state.items[2],historical);
  assert.deepEqual(state.items[2].stampPosition,{x:28,y:90});
  assert.equal(updateItem(state,'dependent',{title:'Kept achievement'}).items[2].status,'done');
  assert.equal(setItemStatus(state,'dependent','done').items[2].status,'done');
  assert.deepEqual(parseState(serializeState(state)),state);
  const reopened=setItemStatus(state,'dependent','active');
  assert.throws(()=>setItemStatus(reopened,'dependent','done'),/ก่อน|สำเร็จ/);
  assert.throws(()=>updateItem(reopened,'last',{status:'done'}),/ก่อน|สำเร็จ/);
});

test('deleting a prerequisite removes only its edges and preserves surviving quest metadata immutably',()=>{
  const state=chain();
  state.items[2]={...state.items[2],imageDataUrl:PNG,notes:'Keep these notes',subquests:[{id:'task',text:'Keep task',done:true}],storagePosition:{x:120,y:240},photoLayout:null};
  const before=structuredClone(state),unrelated=state.items[3];
  const deleted=deleteItem(state,'first');
  assert.deepEqual(deleted.items.find(item=>item.id==='dependent'),{...state.items[2],prerequisiteIds:['second']});
  assert.equal(deleted.items.find(item=>item.id==='last'),unrelated);
  assert.deepEqual(state,before);
  assert.deepEqual(validateState(deleted),deleted);
  const noEdges=deleteItem(deleted,'second');
  assert.deepEqual(noEdges.items.find(item=>item.id==='dependent').prerequisiteIds,[]);
  assert.equal(Object.hasOwn(noEdges.items.find(item=>item.id==='last'),'prerequisiteIds'),true);
});

test('dependency fields round trip while untouched legacy quests keep the field absent',()=>{
  let state=chain();
  const legacy=state.items[0];
  state=updateItem(state,'dependent',{notes:'A note',subquests:[{id:'step',text:'A step',done:false}],imageDataUrl:PNG,storagePosition:{x:170,y:380}});
  state=updateItem(state,'dependent',{x:500,y:600,rotation:4,z:20});
  const restored=parseState(serializeState(state));
  assert.deepEqual(restored,state);
  assert.equal(Object.hasOwn(restored.items[0],'prerequisiteIds'),false);
  assert.equal(state.items[0],legacy);
  const cleared=updateItem(state,'dependent',{prerequisiteIds:[]});
  assert.deepEqual(cleared.items[2].prerequisiteIds,[]);
});

test('the 499 prerequisite limit and 100 character ASCII identifiers survive a maximum size board',()=>{
  const state=emptyState(),prototype=createQuest({title:'Predecessor',status:'done'},state);
  state.items=Array.from({length:499},(_,index)=>({...prototype,id:`${'x'.repeat(96)}-${String(index).padStart(3,'0')}`}));
  const prerequisiteIds=state.items.map(item=>item.id);
  const quest=createQuest({title:'All predecessors',status:'done',prerequisiteIds},state);
  assert.equal(quest.prerequisiteIds.length,499);
  const full={...state,items:[...state.items,quest]};
  assert.deepEqual(parseState(serializeState(full)),full);
  assert.throws(()=>updateItem(full,quest.id,{prerequisiteIds:[...prerequisiteIds,'overflow']}),/499/);
});

test('dependency info reports all selected quests and only unfinished predecessors in their selected order',()=>{
  let state=chain();
  state=setArchived(state,'first',true);state=setItemStatus(state,'first','done');
  state=setItemStatus(state,'second','paused');
  assert.deepEqual(dependencies.dependencyInfo(state.items,'dependent'),{
    prerequisites:[state.items[0],state.items[1]],pending:[state.items[1]],locked:true,
  });
  assert.deepEqual(dependencies.dependencyInfo(state.items,state.items[0]),{prerequisites:[],pending:[],locked:false});
  assert.deepEqual(dependencies.dependencyInfo(state.items,'missing'),{prerequisites:[],pending:[],locked:false});
  const historical={...state.items[2],status:'done'};
  assert.deepEqual(dependencies.dependencyInfo(state.items,historical),{
    prerequisites:[state.items[0],state.items[1]],pending:[state.items[1]],locked:false,
  });
  assert.equal(dependencies.dependencyInfo(state.items,{...state.items[2],prerequisiteIds:['second','first']}).prerequisites[0],state.items[1]);
});

test('cycle previews detect self and transitive routes without disabling unrelated or existing safe edges',()=>{
  const items=chain().items;
  assert.equal(dependencies.wouldCreateDependencyCycle(items,'first','first'),true);
  assert.equal(dependencies.wouldCreateDependencyCycle(items,'first','dependent'),true);
  assert.equal(dependencies.wouldCreateDependencyCycle(items,'first','last'),true);
  assert.equal(dependencies.wouldCreateDependencyCycle(items,'dependent','first'),false);
  assert.equal(dependencies.wouldCreateDependencyCycle(items,'new-quest','last'),false);
  assert.equal(dependencies.wouldCreateDependencyCycle(items,'second','first'),false);
});

test('unlock transitions require the final successful predecessor and return every existing unfinished dependent once',()=>{
  const before=chain();
  addQuest(before,'sibling',{prerequisiteIds:['second']});
  addQuest(before,'archived',{prerequisiteIds:['second'],archived:true});
  let partial=setItemStatus(before,'first','done');
  assert.deepEqual(dependencies.newlyUnlockedQuestIds(before.items,partial.items),[]);
  let after=setItemStatus(partial,'second','done');
  assert.deepEqual(dependencies.newlyUnlockedQuestIds(partial.items,after.items),['dependent','sibling','archived']);
  assert.deepEqual(dependencies.newlyUnlockedQuestIds(after.items,after.items),[]);
  const stamped=setItemStatus(after,'dependent','done');
  assert.deepEqual(dependencies.newlyUnlockedQuestIds(after.items,stamped.items),['last']);
  const reopened=setItemStatus(after,'first','active');
  assert.deepEqual(dependencies.newlyUnlockedQuestIds(after.items,reopened.items),[]);
  assert.deepEqual(dependencies.newlyUnlockedQuestIds(reopened.items,setItemStatus(reopened,'first','done').items),['dependent']);
});

test('unlock transitions include removed prerequisite edges but exclude initial imports new quests and completed history',()=>{
  const before=chain();
  const after=deleteItem(deleteItem(before,'first'),'second');
  assert.deepEqual(dependencies.newlyUnlockedQuestIds(before.items,after.items),['dependent']);
  assert.deepEqual(dependencies.newlyUnlockedQuestIds([],after.items),[]);
  assert.deepEqual(dependencies.newlyUnlockedQuestIds(before.items,updateItem(before,'dependent',{title:'Edited while waiting'}).items),[]);
  const newState={...before,items:[...before.items]};addQuest(newState,'new-ready');
  assert.deepEqual(dependencies.newlyUnlockedQuestIds(before.items,newState.items),[]);
  const historical={...before,items:before.items.map(item=>item.id==='dependent'?{...item,status:'done'}:item)};
  const completedAfter=setItemStatus(setItemStatus(historical,'first','done'),'second','done');
  assert.deepEqual(dependencies.newlyUnlockedQuestIds(historical.items,completedAfter.items),[]);
});

test('standalone normalization preserves absent legacy fields and rejects invalid lists before graph lookup',()=>{
  assert.equal(dependencies.normalizePrerequisiteIds(undefined),undefined);
  const raw=[' one ','two'];
  assert.deepEqual(dependencies.normalizePrerequisiteIds(raw),['one','two']);
  assert.deepEqual(raw,[' one ','two']);
  assert.throws(()=>dependencies.normalizePrerequisiteIds(Array.from({length:500},(_,i)=>`quest-${i}`)),/499/);
  assert.throws(()=>dependencies.normalizePrerequisiteIds(new Array(1)),/รหัส/);
  assert.throws(()=>dependencies.validateDependencies([{id:'quest',type:'quest',prerequisiteIds:['missing']}]),/ไม่พบ/);
  assert.throws(()=>dependencies.validateDependencies([{id:'quest',type:'quest',prerequisiteIds:['quest']}]),/ตัวเอง/);
});

test('adding prerequisite metadata observes the aggregate backup budget before accepting an edit or import',()=>{
  const state=emptyState(),prototype=createQuest({title:'Photo'},state);
  const bytes=Buffer.alloc(2*1024*1024);bytes.set([137,80,78,71,13,10,26,10]);
  const image=`data:image/png;base64,${bytes.toString('base64')}`;
  state.items=Array.from({length:32},(_,index)=>({...prototype,id:`photo-${index}`,imageDataUrl:image}));
  state.items.push({...prototype,id:'target',imageDataUrl:PNG});
  const metadata={...state,items:state.items.map(item=>({...item,imageDataUrl:''}))};
  const metadataBytes=new TextEncoder().encode(JSON.stringify(metadata,null,2)).byteLength;
  const prefix='data:image/png;base64,';
  const finalLength=Math.floor((MAX_BACKUP_BYTES-metadataBytes-32*image.length-prefix.length)/4)*4;
  const finalBytes=Buffer.alloc(finalLength/4*3);finalBytes.set([137,80,78,71,13,10,26,10]);
  state.items.at(-1).imageDataUrl=prefix+finalBytes.toString('base64');
  assert.equal(validateState(state).items.length,33);
  assert.throws(()=>updateItem(state,'target',{prerequisiteIds:['photo-0']}),/90|ขนาด/);
  const raw={...state,items:state.items.map(item=>item.id==='target'?{...item,prerequisiteIds:['photo-0']}:item)};
  assert.throws(()=>validateState(raw),/90|ขนาด/);
  assert.equal(Object.hasOwn(state.items.at(-1),'prerequisiteIds'),false);
});
