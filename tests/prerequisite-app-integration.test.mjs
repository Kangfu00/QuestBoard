import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createInitialState,createQuest,setItemStatus,deleteItem,updateItem,validateState,STATUS,CATEGORIES} from '../dist/model.mjs';
import {dependencyInfo} from '../dist/quest-dependencies.mjs';
import {PAPER} from '../dist/paper-format.mjs';
const source=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a);return source.slice(a,b)}

test('commit compares old and next quests and plays unlocks after rendering and persistence',()=>{
  const before={items:[{id:'a',status:'active'},{id:'b',prerequisiteIds:['a']}]},next={items:[{id:'a',status:'done'},before.items[1]]};
  const calls=[],comparisons=[];
  const context={state:before,ensureTrayPositions:value=>value,
    newlyUnlockedQuestIds:(oldItems,newItems)=>{comparisons.push([oldItems,newItems]);return ['b']},
    questUnlockEffects:{cancelAll:()=>calls.push('cancel'),play:ids=>calls.push(['play',ids])},
    renderBoard:()=>calls.push('board'),renderCounts:()=>calls.push('counts'),renderFolderWindow:()=>calls.push('folio'),paperReader:{refresh:()=>calls.push('reader')},persist:()=>calls.push('persist'),showToast:()=>calls.push('toast')};
  vm.createContext(context);vm.runInContext(section('function commit(','const questItems='),context);context.commit(next);
  assert.equal(context.state,next);assert.deepEqual(comparisons,[[before.items,next.items]]);
  assert.equal(calls[0],'cancel');assert.ok(calls.indexOf('persist')<calls.findIndex(value=>Array.isArray(value)&&value[0]==='play'));
  assert.deepEqual(calls.find(value=>Array.isArray(value)),['play',['b']]);
});

test('import commits suppress unlock flourishes while still rendering and persisting',()=>{
  let comparisons=0,played=0,saved=0;
  const context={state:{items:[]},ensureTrayPositions:value=>value,newlyUnlockedQuestIds:()=>{comparisons++;return ['b']},questUnlockEffects:{cancelAll(){},play(){played++}},renderBoard(){},renderCounts(){},renderFolderWindow(){},paperReader:{refresh(){}},persist(){saved++},showToast(){}};
  vm.createContext(context);vm.runInContext(section('function commit(','const questItems='),context);context.commit({items:[]},'นำเข้าแล้ว',{animateUnlock:false});
  assert.equal(saved,1);assert.equal(comparisons,0);assert.equal(played,0);
});

function dependencyState(){const state=createInitialState();state.items=[];const source=createQuest({title:'เตรียมเอกสาร'},state);state.items.push(source);const dependent=createQuest({title:'ยื่นคำร้อง',prerequisiteIds:[source.id],notes:'Keep notes'},state);state.items.push(dependent);return {state,source,dependent}}

test('stamp modal explains waiting quests and keeps the modal open when a locked completion is attempted',()=>{
  const {state,source,dependent}=dependencyState(),events=[],apply={},toasts=[];let html='';
  const context={state,STATUS,dependencyInfo,setItemStatus,dialog:{querySelectorAll:()=>[]},filters:{status:'all'},
    icon:()=>'',stampMarkup:()=>'',esc:value=>String(value),openDialog:(title,subtitle,body)=>{html=body},
    $:selector=>selector==='#apply-stamp'?apply:selector==='.dialog-body'?{insertAdjacentHTML:(position,value)=>{html+=value}}:null,closeDialog:()=>events.push('close'),commit:()=>events.push('commit'),playStampImpact:()=>events.push('impact'),showToast:message=>toasts.push(message),formError:message=>toasts.push(message)};
  vm.createContext(context);vm.runInContext(section('function openStamp(','function queueContactSound('),context);context.openStamp(dependent.id);
  assert.ok(html.includes(source.title),'waiting predecessor is named');
  assert.doesNotThrow(()=>apply.onclick());assert.deepEqual(events,[]);assert.ok(toasts.length>0);assert.equal(state.items[1].status,'active');
});

test('deletion undo restores prerequisite edges while preserving later status and placement changes',()=>{
  const {state,source,dependent}=dependencyState();let current=deleteItem(state,source.id);
  current=updateItem(current,dependent.id,{x:345,notes:'New note'});
  const context={validateState};vm.createContext(context);
  vm.runInContext(section('function restoreDeletedSnapshot(','function confirmDelete('),context);
  const restored=context.restoreDeletedSnapshot(current,state,source.id),quest=restored.items.find(q=>q.id===dependent.id);
  assert.deepEqual(quest.prerequisiteIds,[source.id]);assert.equal(quest.x,345);assert.equal(quest.notes,'New note');
  assert.equal(restored.items.find(q=>q.id===source.id).title,source.title);assert.equal(dependencyInfo(restored.items,quest).locked,true);
});

function editorHarness({creating=false,selection=[]}={}){
  const {state,source,dependent}=dependencyState(),nodes=new Map(),events=[],errors=[],before=state;
  const values={title:'Updated quest',description:'Details',category:CATEGORIES[0],priority:'normal',due:'',xp:'75',x:'55',y:'85',rotation:'0'};
  if(creating)for(const key of ['x','y','rotation'])delete values[key];
  const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{isConnected:true,reportValidity:()=>true,value:'',hidden:false,removeAttribute(){},style:{}});return nodes.get(selector)};
  const context={state,CATEGORIES,PAPER,updateItem,canvasBounds:{width:1180,height:1000},prerequisitePicker:null,
    filters:{status:'all'},icon:()=>'',esc:value=>String(value??''),$:node,openDialog(){},closeDialog:()=>events.push('close'),
    createPrerequisitePicker:options=>{events.push(['picker',options]);return {getSelectedIds:()=>selection,destroy(){}}},
    FormData:class{[Symbol.iterator](){return Object.entries(values)[Symbol.iterator]()}},
    rotatedClampPosition:(x,y)=>({x,y}),formError:message=>errors.push(message),createVisibleQuest:input=>createQuest(input,context.state),
    commit(next){assert.equal(context.state,before,'the editor must not replace the old state before commit');context.state=next;events.push('commit')},animateNewQuest:()=>events.push('arrival'),
    openStamp:()=>events.push(['status',context.state.items.find(q=>q.id===dependent.id).prerequisiteIds]),archiveQuest:()=>events.push(['archive',context.state.items.find(q=>q.id===dependent.id).prerequisiteIds]),restoreQuest(){}};
  vm.createContext(context);vm.runInContext(section('function openQuest(','function restoreDeletedSnapshot('),context);context.openQuest(creating?undefined:dependent.id);
  return {context,source,dependent,before,events,errors,node};
}

test('quest editor submits selected predecessors through the snapshot-safe commit path',()=>{
  const h=editorHarness();h.node('#quest-form').onsubmit({preventDefault(){},target:h.node('#quest-form')});
  assert.deepEqual(h.context.state.items.find(q=>q.id===h.dependent.id).prerequisiteIds,[]);assert.deepEqual(h.before.items[1].prerequisiteIds,[h.source.id]);
  assert.deepEqual(h.events.filter(value=>typeof value==='string'),['close','commit']);assert.deepEqual(h.errors,[]);
});

for(const action of ['quest-status','quest-archive'])test(`quest editor saves selected conditions before ${action}`,()=>{
  const selected=[],h=editorHarness({selection:selected});selected.push(h.source.id);h.node('#'+action).onclick();
  assert.equal(h.context.state.items[1].prerequisiteIds[0],h.source.id);assert.ok(h.events.indexOf('commit')<h.events.findIndex(value=>Array.isArray(value)&&value[0]===(action==='quest-status'?'status':'archive')));assert.deepEqual(h.errors,[]);
});

test('a newly created quest retains the picker selection and starts locked',()=>{
  const selected=[],h=editorHarness({creating:true,selection:selected});selected.push(h.source.id);h.node('#quest-form').onsubmit({preventDefault(){},target:h.node('#quest-form')});
  assert.deepEqual(h.errors,[]);const added=h.context.state.items.at(-1);assert.deepEqual(added.prerequisiteIds,[h.source.id]);assert.equal(dependencyInfo(h.context.state.items,added).locked,true);assert.ok(h.events.includes('arrival'));
});

test('a stale or tampered invalid picker selection stays in the editor with an error',()=>{
  const selected=[],h=editorHarness({selection:selected});selected.push(h.dependent.id);h.node('#quest-form').onsubmit({preventDefault(){},target:h.node('#quest-form')});
  assert.equal(h.context.state,h.before);assert.equal(h.events.includes('close'),false);assert.ok(h.errors.length>0);
});
