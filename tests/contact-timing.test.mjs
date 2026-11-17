import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createInitialState,createQuest,createFolder,moveQuestToFolder} from '../dist/model.mjs';
import {ghostPose} from '../dist/desk-motion.mjs';
import {TRAY_SCALE} from '../dist/storage-tray.mjs';
import {PAPER} from '../dist/paper-format.mjs';

const source=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');
function section(start,end){
  const from=source.indexOf(start),to=source.indexOf(end,from);
  assert.ok(from>=0&&to>from,`Application section ${start} must exist`);
  return source.slice(from,to);
}
function element(){
  return {hidden:false,style:{left:'400px',top:'200px',transform:'rotate(0deg) scale(.9)',transformOrigin:'150px 28px'},
    classList:{add(){},remove(){},contains:name=>name==='board-folder'},
    animate(){},remove(){},closest:()=>null,getBoundingClientRect:()=>({left:800,top:100,width:PAPER.width*TRAY_SCALE,height:PAPER.height*TRAY_SCALE}),
  };
}
function desk(){
  const state=createInitialState(),quest={...createQuest({title:'Contact paper',rotation:0},state),id:'quest'},folder={...createFolder({name:'Contact folio'},state),id:'folder'};
  state.items=[quest,folder];
  const paper=element(),ghost=element(),target=element(),animations=[],cues=[];
  target.dataset={folderTarget:'folder'};
  const context={PAPER,state,TRAY_SCALE,currentScale:1,ghostPose,moveQuestToFolder,stampCues:new Map(),AbortController,
    $:()=>paper,document:{querySelectorAll:()=>[target]},reducedMotion:()=>false,setTimeout(){},cancelMotion(){},showToast(){},
    commit(next){context.state=next;},sound:{play(name,options){cues.push({name,...options});}},
    animateTransient(element,frames,options){animations.push({element,frames,options});},
  };
  vm.createContext(context);
  vm.runInContext([
    section('function settlePaper(','function startStoredDrag('),
    section('function settleTrayItem(','function archiveQuest('),
    section('function queueContactSound(','function playStampImpact('),
  ].join('\n'),context);
  return {context,ghost,animations,cues};
}
const bezier=(t,p1,p2)=>3*(1-t)**2*t*p1+3*(1-t)*t*t*p2+t**3;
// WAAPI effect easing maps elapsed time to keyframe progress. Invert its y
// curve, then read x to find the actual wall time of a contact keyframe.
function elapsedAtOffset(offset,{duration,easing='linear'}){
  if(easing==='linear')return offset*duration;
  const match=easing.match(/^cubic-bezier\(([^)]+)\)$/);
  assert.ok(match,`Supported effect easing: ${easing}`);
  const [x1,y1,x2,y2]=match[1].split(',').map(Number);
  let low=0,high=1;
  for(let i=0;i<60;i++){const t=(low+high)/2;if(bezier(t,y1,y2)<offset)low=t;else high=t;}
  return bezier((low+high)/2,x1,x2)*duration;
}
function assertContact(h,predicate){
  assert.equal(h.animations.length,1);assert.equal(h.cues.length,1);
  const {frames,options}=h.animations[0],index=frames.findIndex(predicate);
  assert.ok(index>=0,'the motion must contain its visible contact pose');
  const offset=frames[index].offset??(index===frames.length-1?1:index/(frames.length-1));
  const elapsed=elapsedAtOffset(offset,options);
  assert.ok(Math.abs(h.cues[0].delay-elapsed)<=1,`${h.cues[0].name} at ${h.cues[0].delay}ms must match visible contact at ${elapsed.toFixed(2)}ms`);
}

test('desk drop cue matches the wall time of paper compression after effect easing',()=>{
  const h=desk();h.context.settlePaper('quest');
  assertContact(h,frame=>frame.transform?.includes('scale(.998)'));
  assert.equal(h.cues[0].delay,166);
});
test('folio insertion cue matches the wall time when the paper reaches the pocket',()=>{
  const h=desk();h.context.storeInFolder('quest','folder',h.ghost);
  assertContact(h,frame=>frame.clipPath==='inset(0 0 8% 0)');
});
test('drawer landing cue matches an explicit settled pose before the visual retires',()=>{
  const h=desk();h.context.settleTrayItem('quest',h.ghost);
  assertContact(h,frame=>frame.transform==='rotate(0deg) scale(0.62)');
});
