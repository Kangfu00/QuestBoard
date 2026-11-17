import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {PAPER,toPaperStampPosition} from '../dist/paper-format.mjs';
import {createInitialState,createQuest} from '../dist/model.mjs';
import {rotatedClampPosition} from '../dist/interactions.mjs';
const source=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);

test('printed legacy ink maps to the same fraction of the taller A4 page without changing saved coordinates',()=>{
  const custom={id:'uploaded'},calls=[],context={toPaperStampPosition,stampMarkup(...args){calls.push(args);return '<i class="stamp"></i>';}};
  vm.createContext(context);vm.runInContext(section('function paperStampMarkup(','function renderQuest('),context);
  for(const point of [{x:0,y:0},{x:123.5,y:175},{x:300,y:350}]){
    const quest={status:'done',stampStyle:'seal',stampPosition:{...point}},html=context.paperStampMarkup(quest,custom);
    near(Number(html.match(/left:([\d.]+)px/)[1]),point.x);
    near(Number(html.match(/top:([\d.]+)px/)[1]),point.y/350*PAPER.height);
    assert.deepEqual(quest.stampPosition,point);assert.equal(calls.at(-1)[2],custom);
  }
  assert.equal(context.paperStampMarkup({status:'active'},custom),'');
});

test('new quests are centred using the actual A4 height in the current scrolled and zoomed viewport',()=>{
  const viewport={scrollLeft:400,scrollTop:300,clientWidth:700,clientHeight:800};
  const context={PAPER,state:{...createInitialState(),items:[]},currentScale:.8,canvasBounds:{width:5000,height:5000},$:()=>viewport,rotatedClampPosition,createQuest};
  vm.createContext(context);vm.runInContext(section('function createVisibleQuest(','function animateNewQuest('),context);
  const quest=context.createVisibleQuest({title:'A tall sheet'});
  near(quest.x,viewport.scrollLeft/.8+(viewport.clientWidth/.8-PAPER.width)*.42);
  near(quest.y,viewport.scrollTop/.8+(viewport.clientHeight/.8-PAPER.height)*.32);
});

test('arranging normal quests leaves A4-height rows and puts folder tokens below the sheets',()=>{
  for(const count of [6,18,55]){
  const state={...createInitialState(),items:[]};
  for(let i=0;i<count;i++)state.items.push(createQuest({title:`Quest ${i}`},state));
  state.items.push({id:'folio',type:'folder',archived:false,x:0,y:0,z:1,rotation:0});
  const context={PAPER,state,questItems:()=>context.state.items.filter(item=>item.type==='quest'),showToast(){},commit(next){context.state=next;}};
  vm.createContext(context);vm.runInContext(section('function arrangeBoard(','document.addEventListener(\'pointerdown\',prepareStampPointer'),context);
  context.arrangeBoard();
  const quests=context.state.items.filter(item=>item.type==='quest'),folder=context.state.items.find(item=>item.id==='folio');
  assert.ok(quests[3].y>=quests[0].y+PAPER.height+24);
  assert.ok(folder.y>=Math.max(...quests.map(quest=>quest.y+PAPER.height))+24);
  }
});

test('tray scrollable height includes the full A4 paper and its lower margin',()=>{
  const quest={id:'q',type:'quest',storagePosition:{x:25,y:500}},plane={style:{},parentElement:{style:{setProperty(){}}}},empty={firstChild:{}};
  const context={PAPER,TRAY_WIDTH:1600,TRAY_SCALE:.62,state:{items:[quest]},archiveSearch:'',bundleControl:null,
    trayItems:()=>[quest],trayPosition:()=>quest.storagePosition,renderQuest:()=>'<article data-id="q" style="left:0px;top:0px;"></article>',
    $:selector=>selector==='#drawer-list'?plane:selector==='#tray-empty'?empty:{}};
  vm.createContext(context);vm.runInContext(section('function renderDrawer(','function storeAtTray('),context);context.renderDrawer();
  near(parseFloat(plane.style.height),quest.storagePosition.y+PAPER.height+40);
});
