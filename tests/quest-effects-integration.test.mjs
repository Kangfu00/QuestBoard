import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createInitialState,createQuest,setArchived} from '../dist/model.mjs';
import {rotatedClampPosition} from '../dist/interactions.mjs';
import {chooseStampTool,applyHeldStamp} from '../dist/stamp-tools.mjs';
import {stampPoint} from '../dist/stamp-placement.mjs';
import {resolveStampSurface,refreshStampSurface,stampSurfacePoint} from '../dist/stamp-surfaces.mjs';
import {PAPER} from '../dist/paper-format.mjs';

const source=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b));
const classes={add(){},remove(){},contains(){return false;}};

test('paper contact cues follow contact time and can be retired by replacing or re-grabbing the item',()=>{
  const calls=[],timers=[],stampCues=new Map();let reduced=false;
  const context={stampCues,AbortController,reducedMotion:()=>reduced,sound:{play:(...args)=>calls.push(args)},setTimeout:fn=>timers.push(fn)};
  vm.createContext(context);vm.runInContext(section('function queueContactSound(','function playStampImpact('),context);
  context.queueContactSound('paper','paperDrop',144);
  assert.equal(calls[0][1].delay,144);const first=calls[0][1].signal;
  context.queueContactSound('paper','paperSlide',215);assert.equal(first.aborted,true);
  const second=calls[1][1].signal;timers[0]();
  assert.equal(stampCues.get('paper').signal,second,'old cleanup cannot retire the replacement');
  stampCues.get('paper').abort();assert.equal(second.aborted,true);
  reduced=true;context.queueContactSound('paper','paperDrop',144);assert.equal(calls.at(-1)[1].delay,0);
});

test('stamp contact sound follows the visible impact and replaces pending contact on the same paper',()=>{
  const calls=[],stampCues=new Map();let reduced=false;
  const stamp={classList:classes,getBoundingClientRect:()=>({left:0,top:0,width:90,height:90})};
  const paper={classList:classes,querySelector:()=>stamp,scrollIntoView(){}};
  const context={stampCues,AbortController,reducedMotion:()=>reduced,$:()=>paper,
    state:{items:[{id:'quest',status:'done'}]},STATUS:{done:{color:'green'}},icon:()=>'',setTimeout(){},
    document:{body:{append(){}},createElement:()=>({style:{},remove(){}})},
    sound:{play:(...args)=>calls.push(args)},
  };
  vm.createContext(context);vm.runInContext(section('function playStampImpact(','async function prepareImage('),context);
  context.playStampImpact('quest',true);
  assert.equal(calls.length,1);assert.equal(calls[0][0],'stamp');assert.equal(calls[0][1].delay,250);
  const first=calls[0][1].signal;
  context.playStampImpact('quest',true);assert.equal(first.aborted,true);
  reduced=true;context.playStampImpact('quest',true);
  assert.equal(calls.at(-1)[1].delay,0,'reduced motion needs immediate contact');
});
test('the held stamp commits the clicked local pixel instead of the default location',()=>{
  const state=createInitialState(),id=state.items.find(i=>i.type==='quest').id;
  const body={tagName:'BODY'},host={id:'board-canvas',tagName:'DIV',parentElement:body,transform:'matrix(0.5,0,0,0.5,0,0)'};
  const paper={tagName:'ARTICLE',dataset:{id},classList:classes,parentElement:host,closest:()=>paper,offsetWidth:PAPER.width,offsetHeight:PAPER.height,getBoundingClientRect:()=>({left:100,top:200,width:PAPER.width/2,height:PAPER.height/2})};
  const cursor={classList:classes,offsetWidth:68};
  const context={state,currentScale:.5,heldStamp:chooseStampTool('done'),filters:{status:'all'},stampPressTimer:null,
    document:{activeElement:null},$:selector=>selector==='#stamp-cursor'?cursor:paper,stampPoint,applyHeldStamp,resolveStampSurface,refreshStampSurface,stampSurfacePoint,
    getComputedStyle:node=>({transform:node.transform??'none'}),DOMMatrix:class{constructor(value){const [a,b,c,d,e,f]=value.match(/-?\d*\.?\d+/g).map(Number);Object.assign(this,{a,b,c,d,e,f});}},
    paperEffects:{cancelEntry(){}},commit(next){context.state=next;},sound:{play(){}},playStampImpact(){},updateStampPointer(){},setTimeout(){},clearTimeout(){},showToast(message){throw Error(message);},
  };
  vm.createContext(context);vm.runInContext(section('function stampPaper(','function renderFolderDrawer('),context);
  context.stampPaper(id,{clientX:140,clientY:200+PAPER.height*(40/350)/2,detail:1});
  const stamped=context.state.items.find(i=>i.id===id).stampPosition;
  assert.equal(stamped.x,80);assert.ok(Math.abs(stamped.y-40)<.001,'physical rounding retains the same normalized ink point');
  context.stampPaper(id);
  assert.deepEqual(context.state.items.find(i=>i.id===id).stampPosition,stamped,'keyboard stamping must preserve the chosen point');
});

test('archiving commits and releases its ghost even when the visual effect is unavailable',()=>{
  const state=createInitialState(),id=state.items.find(i=>i.type==='quest').id,events=[];
  const ghost={style:{},remove(){events.push('remove');}};
  const context={state,closeFolderWindow(){},folderDrawerSearch:'',archiveSearch:'',currentScale:1,setArchived,
    $:()=>({value:'',getBoundingClientRect:()=>({left:500,top:100,width:300,height:100})}),
    settleTrayItem(id,ghost){ghost?.remove();},setActiveDrawer(){},reducedMotion:()=>false,animateTransient(){},paperEffects:{store(){events.push('effect');throw Error('Unavailable');}},
    commit(next){context.state=next;events.push('commit');},sound:{play(){}},showToast(){},restoreQuest(){},
  };
  vm.createContext(context);vm.runInContext(section('function archiveQuest(','function restoreQuest('),context);
  assert.doesNotThrow(()=>context.archiveQuest(id,ghost));
  assert.equal(context.state.items.find(i=>i.id===id).archived,true);
  assert.ok(events.indexOf('commit')<events.indexOf('remove'));assert.ok(events.includes('remove'));
});

test('a new quest is placed inside the current scrolled view at half zoom',()=>{
  const viewport={scrollLeft:700,scrollTop:450,clientWidth:800,clientHeight:600};
  const context={PAPER,state:createInitialState(),currentScale:.5,canvasBounds:{width:5000,height:5000},$:()=>viewport,createQuest,rotatedClampPosition};
  vm.createContext(context);vm.runInContext(section('function createVisibleQuest(','function animateNewQuest('),context);
  const q=context.createVisibleQuest({title:'From the writing drawer'});
  assert.ok(q.x>=1400&&q.x+PAPER.width<=3000);assert.ok(q.y>=900&&q.y+PAPER.height<=2100);
  assert.equal(q.rotation,0);assert.equal(q.archived,false);
});
