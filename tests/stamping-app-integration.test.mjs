import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createInitialState,createQuest,setArchived} from '../dist/model.mjs';
import {chooseStampTool,applyHeldStamp} from '../dist/stamp-tools.mjs';
import {stampPoint} from '../dist/stamp-placement.mjs';
import {createFolioView} from '../dist/folio-view.mjs';

const source=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');
function section(start,end){
  const from=source.indexOf(start),to=source.indexOf(end,from+start.length);
  assert.ok(from>=0&&to>from,`actual app section exists: ${start}`);
  return source.slice(from,to);
}
function classes(){
  const values=new Set();
  return {add:(...names)=>names.forEach(name=>values.add(name)),remove:(...names)=>names.forEach(name=>values.delete(name)),
    contains:name=>values.has(name),toggle(name,on){if(on??!values.has(name))values.add(name);else values.delete(name);}};
}
function paper(rect={left:10,top:20,width:150,height:175}){
  return {offsetWidth:300,offsetHeight:350,classList:classes(),getBoundingClientRect:()=>rect,
    querySelector(){return null;},contains(node){return node===this;},closest(){return null;}};
}
function stampHarness(){
  const state=createInitialState();state.items=[];
  state.items.push(createQuest({title:'Board copy'},state),createQuest({title:'Selected document'},state));
  const board=paper(),cursor={classList:classes(),offsetWidth:68},events=[],positions=[],applications=[],impacts=[],toasts=[];
  const context={state,heldStamp:chooseStampTool('done'),filters:{status:'failed'},currentScale:.5,stampPressTimer:null,
    document:{activeElement:null},getComputedStyle:()=>({transform:'none'}),DOMMatrix:class{},stampPoint,
    $:selector=>selector==='#stamp-cursor'?cursor:board,
    stampSurfacePoint(surface,point,options){positions.push({surface,point,options});events.push('measure');return surface.point;},
    applyHeldStamp(...args){applications.push(args);return applyHeldStamp(...args);},
    paperEffects:{cancelEntry(value){events.push(['cancel',value]);}},
    commit(next){events.push('commit');context.state=next;},
    playStampImpact(...args){events.push('impact');impacts.push(args);},updateStampPointer(){events.push('cursor');},
    refreshStampSurface:surface=>surface,sound:{play(){}},setTimeout(){},clearTimeout(){},showToast:message=>toasts.push(message),
    finishFolderOpening(host){events.push(['settle',host]);},
    resolveStampSurface(node){return node===board?{id:state.items[0].id,kind:'board',paper:board,host:{}}:null;},
  };
  context.questPhotos??=null;context.photoViewer??=null;vm.createContext(context);vm.runInContext(section('function stampPaper(','function renderFolderDrawer('),context);
  return {context,state,board,events,positions,applications,impacts,toasts};
}

test('stampPaper measures the clicked expanded copy before commit and stamps only its quest once',()=>{
  for(const kind of ['reader','folio']){
    const h=stampHarness(),id=h.state.items[1].id,copy=paper(),surface={id,kind,paper:copy,host:{},point:{x:83,y:217}};
    const tool=h.context.heldStamp;
    h.context.stampPaper(id,{clientX:511,clientY:398,detail:1},surface);
    assert.equal(h.positions.length,1,'coordinates come from the explicit source copy');
    assert.equal(h.positions[0].surface,surface);
    assert.equal(h.positions[0].options.getComputedStyle,h.context.getComputedStyle);
    assert.equal(h.positions[0].options.Matrix,h.context.DOMMatrix);
    assert.deepEqual({...h.positions[0].point},{x:511,y:398});
    assert.deepEqual(h.context.state.items[1].stampPosition,{x:83,y:217});
    assert.equal(h.context.state.items[1].status,'done');assert.equal(h.context.state.items[0].status,'active');
    assert.deepEqual(h.impacts,[[id,true,surface]]);
    assert.equal(h.events.filter(event=>event==='commit').length,1);
    assert.ok(h.events.indexOf('measure')<h.events.indexOf('commit'));
    if(kind==='folio')assert.ok(h.events.findIndex(event=>Array.isArray(event)&&event[0]==='settle')<h.events.indexOf('measure'));
    assert.ok(h.events.indexOf('commit')<h.events.indexOf('impact'));
    assert.ok(h.events.indexOf('impact')<h.events.indexOf('cursor'));
    assert.equal(h.context.heldStamp,tool,'stamping retains the selected tool');
    assert.equal(h.context.filters.status,'all');assert.deepEqual(h.toasts,[]);
  }
});

test('archived permission is confined to explicit reader and folio sources',()=>{
  for(const kind of ['board','reader','folio']){
    const h=stampHarness(),id=h.state.items[1].id;
    h.context.state=setArchived(h.state,id,true);
    const surface={id,kind,paper:paper(),host:{},point:{x:64,y:91}};
    h.context.stampPaper(id,{clientX:120,clientY:90,detail:1},surface);
    assert.equal(h.applications.length,1);assert.equal(h.applications[0][4].allowArchived,kind!=='board');
    assert.equal(h.context.state.items[1].status,kind==='board'?'active':'done');
    assert.equal(h.context.state.items[1].archived,true);
    assert.equal(h.impacts.length,kind==='board'?0:1);
  }
});

test('wrong source ID, missing quest, unavailable geometry and absent tool cannot commit or animate',()=>{
  for(const invalid of ['wrong-id','missing-quest','geometry','tool']){
    const h=stampHarness(),id=h.state.items[1].id,surface={id,kind:'reader',paper:paper(),host:{},point:{x:64,y:91}};
    if(invalid==='wrong-id')surface.id=h.state.items[0].id;
    if(invalid==='missing-quest')h.context.state={...h.state,items:[]};
    if(invalid==='geometry')h.context.stampSurfacePoint=()=>{throw new RangeError('No geometry');};
    if(invalid==='tool')h.context.heldStamp=null;
    h.context.stampPaper(id,{clientX:120,clientY:90,detail:1},surface);
    assert.equal(h.events.includes('commit'),false,invalid);assert.equal(h.impacts.length,0,invalid);
  }
});

test('keyboard stamps preserve placement and repeat across papers with the same held tool',()=>{
  const h=stampHarness(),[first,second]=h.state.items,tool=h.context.heldStamp;
  h.context.state=applyHeldStamp(h.state,first.id,chooseStampTool('paused'),{x:37,y:204});
  for(const id of [first.id,second.id])h.context.stampPaper(id,{detail:0},{id,kind:'reader',paper:paper(),host:{}});
  assert.equal(h.positions.length,0);assert.deepEqual(h.context.state.items[0].stampPosition,{x:37,y:204});
  assert.ok(h.context.state.items.every(item=>item.status==='done'));assert.equal(h.context.heldStamp,tool);
  assert.equal(h.impacts.length,2);
});

test('focus restoration stays within the refreshed clicked document',()=>{
  const h=stampHarness(),id=h.state.items[1].id,focused={},copy=paper(),surface={id,kind:'folio',paper:copy,host:{},point:{x:64,y:91}};
  copy.contains=value=>value===focused;h.context.document.activeElement=focused;
  let restored=0;h.context.refreshStampSurface=value=>{assert.equal(value,surface);return {...surface,paper:{querySelector:()=>({focus(){restored++;}})}};};
  h.context.stampPaper(id,{detail:0},surface);assert.equal(restored,1);
  h.context.document.activeElement={};h.context.stampPaper(id,{detail:0},surface);
  assert.equal(restored,1,'unrelated document focus is left alone');
});

test('the legacy board-only stampPaper call still maps board coordinates',()=>{
  const h=stampHarness(),id=h.state.items[0].id;
  h.context.stampSurfacePoint=(surface,point)=>stampPoint(point,surface.paper.getBoundingClientRect(),{a:1,b:0,c:0,d:1},.5);
  h.context.stampPaper(id,{clientX:50,clientY:40,detail:1});
  assert.deepEqual(h.context.state.items[0].stampPosition,{x:80,y:40});assert.equal(h.impacts.length,1);
});

// A small DOM double supports the selectors used by the app's capture handlers;
// surface visibility and geometry have independent tests in stamp-surfaces.test.
function node({tag='div',names=[],dataset={},parent=null,surface=null}={}){
  const value={tagName:tag.toUpperCase(),dataset,parentElement:parent,surface,isContentEditable:false,
    matches(selector){return selector.split(',').some(part=>{
      part=part.trim();
      const requiredTag=part.match(/^[a-z]+/i)?.[0];if(requiredTag&&requiredTag!==tag)return false;
      if([...part.matchAll(/\.([\w-]+)/g)].some(match=>!names.includes(match[1])))return false;
      if([...part.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g)].some(([,key,expected])=>{
        const actual=key.startsWith('data-')?dataset[key.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]:undefined;
        return actual===undefined||(expected!==undefined&&actual!==expected);
      }))return false;
      return true;
    });},
    closest(selector){for(let current=this;current;current=current.parentElement)if(current.matches(selector))return current;return null;},
    contains(other){for(let current=other;current;current=current.parentElement)if(current===this)return true;return false;},
    querySelector(){return this.front??null;},
  };
  return value;
}
function event(target,values={}){
  return {target,button:0,isPrimary:true,detail:1,clientX:222,clientY:333,defaultPrevented:false,
    prevented:0,stopped:0,immediate:0,preventDefault(){this.defaultPrevented=true;this.prevented++;},
    stopPropagation(){this.stopped++;},stopImmediatePropagation(){this.immediate++;},...values};
}
function eventHarness(){
  const calls=[],menu={open:false},context={heldStamp:chooseStampTool('done'),dialog:{open:false},
    suppressClickUntil:0,performance:{now:()=>1000},$:()=>menu,
    resolveStampSurface(target){calls.push(['resolve',target]);return target?.surface??null;},
    finishFolderOpening(host){calls.push(['settle',host]);},
    deskWindows:{register(host){calls.push(['register',host]);return {raise(){calls.push(['raise',host]);}};}}};
  context.questPhotos??=null;context.photoViewer??=null;vm.createContext(context);vm.runInContext(section('function heldStampSurface(','function stampPaper('),context);
  context.stampPaper=(...args)=>calls.push(['stamp',...args]);
  return {context,calls,menu};
}

test('captured pointerdown prevents reader dragging and settles only the clicked folio before click stamping',()=>{
  for(const kind of ['board','reader','folio']){
    const h=eventHarness(),host={},target=node(),surface={id:'selected',kind,paper:target,host};target.surface=surface;
    const down=event(target);h.context.prepareStampPointer(down);
    assert.equal(down.prevented,1);assert.equal(down.stopped,1);assert.equal(h.calls.some(call=>call[0]==='stamp'),false);
    assert.equal(h.calls.some(call=>call[0]==='settle'&&call[1]===host),kind==='folio');
    assert.equal(h.calls.some(call=>call[0]==='raise'&&call[1]===host),kind!=='board');
    const click=event(target);h.context.handleStampClick(click);
    assert.equal(click.prevented,1);assert.equal(click.immediate,1);
    const stamps=h.calls.filter(call=>call[0]==='stamp');assert.equal(stamps.length,1);
    assert.deepEqual(stamps[0],['stamp','selected',click,surface]);
  }
});

test('right clicks, secondary pointers, controls, excluded faces and open modals leave normal handlers available',()=>{
  for(const excluded of ['right','secondary','control','back','turning','modal','menu','no-tool']){
    const h=eventHarness(),target=node(),surface={id:'q',kind:'reader',paper:target,host:{}};target.surface=surface;
    const values={};
    if(excluded==='right')values.button=2;
    if(excluded==='secondary')values.isPrimary=false;
    if(['control','back','turning'].includes(excluded))target.surface=null;
    if(excluded==='modal')h.context.dialog.open=true;
    if(excluded==='menu')h.menu.open=true;
    if(excluded==='no-tool')h.context.heldStamp=null;
    const down=event(target,values);h.context.prepareStampPointer(down);
    assert.equal(down.prevented,0,excluded);assert.equal(down.stopped,0,excluded);
    if(excluded!=='secondary'){
      const click=event(target,values);h.context.handleStampClick(click);
      assert.equal(click.prevented,0,excluded);assert.equal(click.immediate,0,excluded);
    }
    assert.equal(h.calls.some(call=>call[0]==='stamp'),false,excluded);
  }
});

test('a suppressed post-drag click is consumed before it can stamp or open a document',()=>{
  const h=eventHarness();h.context.suppressClickUntil=1100;
  const target=node({surface:{id:'q'}}),click=event(target);h.context.handleStampClick(click);
  assert.equal(click.prevented,1);assert.equal(click.immediate,1);assert.deepEqual(h.calls,[]);
});

test('Enter and Space stamp a printed grip and the front of a reader scene without a pointer position',()=>{
  for(const [key,scene] of [['Enter',false],[' ',false],['Enter',true],[' ',true]]){
    const h=eventHarness(),host=node({names:['paper-reader'],dataset:{readerQuest:'q'}});
    const front=node({names:['quest-paper'],parent:host}),surface={id:'q',kind:'reader',paper:front,host};front.surface=surface;
    const target=scene?node({names:['paper-reader-scene'],dataset:{deskWindowHandle:''},parent:host})
      :node({names:['drag-handle','quest-top'],parent:front,surface});
    target.front=front;host.front=front;
    const keyEvent=event(target,{key,detail:0});h.context.handleStampKey(keyEvent);
    assert.equal(keyEvent.prevented,1,`${key} scene=${scene}`);assert.equal(keyEvent.immediate,1);
    const stamps=h.calls.filter(call=>call[0]==='stamp');assert.equal(stamps.length,1);
    assert.equal(stamps[0][1],'q');assert.equal(stamps[0][3],surface);
    assert.equal(stamps[0][2].detail,0);
  }
});

test('keyboard stamping leaves notes, controls and composing key events untouched',()=>{
  for(const excluded of ['input','textarea','select','button','editable','composing','prevented','other-key','body']){
    const h=eventHarness(),front=node({names:['quest-paper']}),surface={id:'q',kind:'reader',paper:front,host:{}};
    const tag=['input','textarea','select','button'].includes(excluded)?excluded:'div';
    const control=['input','textarea','select','button','editable'].includes(excluded);
    const grip=node({names:['drag-handle'],parent:front});
    const target=node({tag,names:control||excluded==='body'?[]:['drag-handle'],parent:control?grip:front,surface});
    target.isContentEditable=excluded==='editable';
    const keyEvent=event(target,{key:excluded==='other-key'?'ArrowDown':'Enter',detail:0,
      isComposing:excluded==='composing',defaultPrevented:excluded==='prevented'});
    h.context.handleStampKey(keyEvent);
    assert.equal(keyEvent.prevented,0,excluded);assert.equal(keyEvent.immediate,0,excluded);
    assert.equal(h.calls.some(call=>call[0]==='stamp'),false,excluded);
  }
});

test('held stamping keys consume repeats on a folio grip without opening its reader or stamping twice',()=>{
  for(const key of ['Enter',' ']){
    const h=eventHarness(),listeners=new Map(),reads=[];
    const panel={addEventListener:(name,handler)=>listeners.set(name,handler),querySelector:()=>null};
    createFolioView({panel,document:{},onRead:id=>reads.push(id)});
    const target=node({names:['quest-top'],dataset:{questDrag:'q'}});
    target.surface={id:'q',kind:'folio',paper:target,host:panel};
    for(const repeat of [false,true,true]){
      const keyEvent=event(target,{key,detail:0,repeat});
      h.context.handleStampKey(keyEvent);
      if(!keyEvent.immediate)listeners.get('keydown')(keyEvent);
      assert.equal(keyEvent.prevented,1,'valid paper repeats stay inside held-tool mode');
    }
    assert.equal(h.calls.filter(call=>call[0]==='stamp').length,1);
    assert.deepEqual(reads,[],'repeat cannot reach the actual folio reader-opening handler');
  }
});

test('the actual app registers stamp pointer, click and keyboard handlers in capture phase',()=>{
  const registered=[],context={document:{addEventListener:(...args)=>registered.push(args)},
    prepareStampPointer(){},handleStampClick(){},handleStampKey(){}};
  context.questPhotos??=null;context.photoViewer??=null;vm.createContext(context);
  for(const [type,handler] of [['pointerdown','prepareStampPointer'],['click','handleStampClick'],['keydown','handleStampKey']]){
    const registration=source.match(new RegExp(`document\\.addEventListener\\(['"]${type}['"],\\s*${handler}\\s*,[^;]+;`));
    assert.ok(registration,`${type} uses the tested named handler`);vm.runInContext(registration[0],context);
    const actual=registered.at(-1);assert.equal(actual[0],type);assert.equal(actual[1],context[handler]);
    assert.ok(actual[2]===true||actual[2]?.capture===true,`${type} runs before reader drag and folio open handlers`);
  }
});

test('held cursor moves above expanded windows without rescanning the desk or marking the same paper again',()=>{
  const cursor={classList:classes(),style:{}},expanded=paper(),other=paper(),menu={open:false};
  const bodyClasses=classes();bodyClasses.add('is-stamping');
  let hits=0,marks=0,scans=0,nextFrame=0;
  const frames=new Map();
  const add=expanded.classList.add;
  expanded.classList.add=(...args)=>{marks++;add(...args);};
  const context={heldStamp:chooseStampTool('done'),dialog:{open:false},stampPointer:{x:5,y:8},stampPressTimer:null,
    stampPointerFrame:null,stampTargetPaper:null,deskWindows:{topZ:640},
    $:selector=>selector==='#stamp-cursor'?cursor:menu,heldStampSurface:target=>({id:'q',kind:'reader',paper:target}),
    document:{body:{classList:bodyClasses},elementFromPoint:x=>{hits++;return x<260?expanded:other;},
      querySelectorAll:selector=>{scans++;return selector==='[data-desk-window]'?[{style:{zIndex:'640'}}]:[expanded,other];}},
    requestAnimationFrame(callback){frames.set(++nextFrame,callback);return nextFrame;},
    cancelAnimationFrame(id){frames.delete(id);},clearTimeout(){},refreshStampToolButtons(){}};
  context.questPhotos??=null;context.photoViewer??=null;vm.createContext(context);vm.runInContext(section('function updateStampPointer(','function heldStampSurface('),context);
  context.updateStampPointer({clientX:232,clientY:410});
  context.updateStampPointer({clientX:240,clientY:415});
  assert.equal(scans,0,'moving the cursor uses no document-wide selector');
  assert.equal(marks,1,'an unchanged target is marked once');
  assert.equal(hits,2);
  assert.equal(expanded.classList.contains('stamp-target'),true);
  assert.equal(cursor.classList.contains('is-visible'),true);assert.ok(Number(cursor.style.zIndex)>640);
  assert.equal(cursor.style.translate,'240px 415px');assert.equal(cursor.style.left,undefined);assert.equal(cursor.style.top,undefined);
  for(let x=241;x<=275;x++)context.queueStampPointer({clientX:x,clientY:415});
  assert.equal(frames.size,1,'a burst queues one frame');
  assert.equal(hits,2,'a burst does no synchronous hit testing');
  const [id,render]=frames.entries().next().value;
  frames.delete(id);render();
  assert.equal(hits,3,'the frame hit-tests once');
  assert.equal(cursor.style.translate,'275px 415px','the frame paints the newest pointer position');
  assert.equal(expanded.classList.contains('stamp-target'),false);
  assert.equal(other.classList.contains('stamp-target'),true);
  context.queueStampPointer({clientX:240,clientY:415});
  context.returnStamp(false);assert.equal(context.heldStamp,null);assert.equal(bodyClasses.contains('is-stamping'),false);
  assert.equal(frames.size,0,'returning the stamp cancels the pending cursor update');
  assert.equal(cursor.classList.contains('is-visible'),false);assert.equal(other.classList.contains('stamp-target'),false);
});

test('stamp impact reacquires the clicked copy after commit and preserves expanded paper transforms',()=>{
  for(const kind of ['board','reader','folio']){
    const soundCalls=[],refreshed=[],effects=[],timers=[],stamp={classList:classes(),getBoundingClientRect:()=>({left:410,top:200,width:80,height:75})};
    const original=paper(),replacement=paper();replacement.querySelector=()=>stamp;
    const surface={id:'q',kind,paper:original,host:{}},fresh={...surface,paper:replacement};
    const context={state:{items:[{id:'q',status:'done'}]},STATUS:{done:{color:'green'}},stampCues:new Map(),AbortController,
      refreshStampSurface(value){refreshed.push(value);return fresh;},$:()=>{throw Error('Must use the clicked document');},
      getComputedStyle:()=>({zIndex:'500'}),reducedMotion:()=>false,icon:()=>'',
      sound:{play:(...args)=>soundCalls.push(args)},setTimeout:fn=>timers.push(fn),
      document:{body:{append:effect=>effects.push(effect)},createElement:()=>({style:{},remove(){}})}};
    context.questPhotos??=null;context.photoViewer??=null;vm.createContext(context);vm.runInContext(section('function playStampImpact(','async function prepareImage('),context);
    context.playStampImpact('q',true,surface);
    assert.deepEqual(refreshed,[surface]);assert.equal(soundCalls.length,1);assert.equal(soundCalls[0][0],'stamp');
    assert.equal(stamp.classList.contains('just-stamped'),true);assert.equal(effects.length,1);
    assert.equal(original.classList.contains('stamp-hit'),false);
    assert.equal(replacement.classList.contains('stamp-hit'),kind==='board');
  }
});
