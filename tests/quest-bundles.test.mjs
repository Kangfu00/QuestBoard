import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuest,createFolder} from '../dist/model.mjs';
import {PAPER} from '../dist/paper-format.mjs';

const {createQuestBundles}=await import('../dist/quest-bundles.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {createQuestBundles(){assert.fail('The quest bundle controller is missing');}};});

// Synthetic browser boundaries retain real capture/bubble and pointer ownership.
class Target{
  constructor(){this.listeners=new Map();}
  addEventListener(type,fn,options){const capture=options===true||!!options?.capture;this.listeners.set(type,[...(this.listeners.get(type)??[]),{fn,capture}]);}
  removeEventListener(type,fn,options){const capture=options===true||!!options?.capture;this.listeners.set(type,(this.listeners.get(type)??[]).filter(item=>item.fn!==fn||item.capture!==capture));}
  get listenerCount(){return [...this.listeners.values()].reduce((n,list)=>n+list.length,0);}
  fire(type,init={}){
    const event={type,target:this,button:0,isPrimary:true,pointerId:1,clientX:150,clientY:28,detail:1,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.stopped=this.immediate=true;},...init};
    const path=[];for(let node=this;node;node=node.parentNode)path.push(node);
    const visit=(node,capture)=>{event.currentTarget=node;for(const item of [...node.listeners.get(type)??[]]){if(item.capture===capture)item.fn(event);if(event.immediate)break;}};
    for(const node of [...path].reverse()){visit(node,true);if(event.stopped)return event;}
    for(const node of path){visit(node,false);if(event.stopped)break;}return event;
  }
}
const dataKey=name=>name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
class Element extends Target{
  constructor(tag,document){super();this.tagName=tag.toUpperCase();this.ownerDocument=document;this.children=[];this.attrs=new Map();this.dataset={};this.hidden=false;this.captures=new Set();this.rect={left:0,top:0,width:PAPER.width,height:PAPER.height};this.style={setProperty(name,value){this[name]=value;},removeProperty(name){delete this[name];}};this.classList={contains:name=>this.className.split(/\s+/).includes(name),add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(' ');},remove:(...names)=>{this.className=this.className.split(/\s+/).filter(name=>!names.includes(name)).join(' ');},toggle:(name,force)=>{const yes=force??!this.classList.contains(name);this.classList[yes?'add':'remove'](name);return yes;}};}
  get className(){return this.attrs.get('class')??'';}set className(value){this.attrs.set('class',value);}
  get id(){return this.attrs.get('id')??'';}set id(value){this.attrs.set('id',value);}
  get parentElement(){return this.parentNode instanceof Element?this.parentNode:null;}
  get firstElementChild(){return this.children[0]??null;}
  get isConnected(){return this===this.ownerDocument.body||!!this.parentNode?.isConnected;}
  get attributes(){return [...this.attrs].map(([name,value])=>({name,value}));}
  setAttribute(name,value){this.attrs.set(name,String(value));if(name.startsWith('data-'))this.dataset[dataKey(name)]=String(value);}
  getAttribute(name){return name.startsWith('data-')?this.dataset[dataKey(name)]??null:this.attrs.get(name)??null;}
  removeAttribute(name){this.attrs.delete(name);if(name.startsWith('data-'))delete this.dataset[dataKey(name)];}
  matches(selector){return selector.split(',').some(part=>{part=part.trim();const tag=part.match(/^[a-z]+/i)?.[0];if(tag&&tag.toUpperCase()!==this.tagName)return false;for(const [,name] of part.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(name))return false;const id=part.match(/#([\w-]+)/)?.[1];if(id&&this.id!==id)return false;for(const [,name,value] of part.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g))if(value===undefined?this.getAttribute(name)===null:this.getAttribute(name)!==value)return false;return true;});}
  closest(selector){return this.matches(selector)?this:this.parentElement?.closest(selector)??null;}
  querySelectorAll(selector){const all=this.children.flatMap(child=>[child,...child.querySelectorAll('*')]);return selector==='*'?all:all.filter(node=>node.matches(selector));}
  querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
  append(...nodes){for(const node of nodes){node.remove();node.parentNode=this;this.children.push(node);}}
  remove(){if(this.parentNode instanceof Element)this.parentNode.children=this.parentNode.children.filter(node=>node!==this);this.parentNode=null;}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  getBoundingClientRect(){return this.rect;}
  setPointerCapture(id){this.captures.add(id);}hasPointerCapture(id){return this.captures.has(id);}releasePointerCapture(id){this.captures.delete(id);}
  focus(){this.ownerDocument.activeElement=this;}
  set innerHTML(value){this.children=[];const stack=[this];for(const m of value.matchAll(/<\/?([a-z][\w-]*)([^>]*)>/gi)){if(m[0][1]==='/'){if(stack.length>1)stack.pop();continue;}const node=new Element(m[1],this.ownerDocument);for(const [,name,,v] of m[2].matchAll(/([\w:-]+)(?:=(['"])(.*?)\2)?/g))node.setAttribute(name,v??'');stack.at(-1).append(node);if(!['input','img','br','hr'].includes(m[1]))stack.push(node);}}
}
function harness(t,{count=2}={}){
  const window=new Target(),document=new Target();document.parentNode=window;document.createElement=tag=>new Element(tag,document);document.body=document.createElement('body');document.body.parentNode=document;document.querySelectorAll=selector=>document.body.querySelectorAll(selector);document.querySelector=selector=>document.body.querySelector(selector);document.activeElement=document.body;
  window.getComputedStyle=node=>({transform:node.computedTransform??'none'});window.getSelection=()=>({removeAllRanges(){}});window.performance={now:()=>100};
  let state={version:1,items:[],stamps:[],settings:{stampStyle:'seal',theme:'walnut',boardName:'Test desk'}};
  state.items.push({...createFolder({name:'Folio'},state),id:'folio'});
  for(let i=0;i<count;i++)state.items.push({...createQuest({title:`Quest ${i}`,notes:'Original notes'},state),id:String.fromCharCode(97+i),rotation:0});
  const renderQuest=q=>`<article class="quest-paper board-item" data-id="${q.id}"><div class="quest-top drag-handle" tabindex="0"></div><button class="quest-bundle-select" data-bundle-select="${q.id}"></button><button data-read-front="${q.id}"></button><textarea></textarea></article>`;
  const board=document.createElement('div');board.id='board-canvas';document.body.append(board);board.innerHTML=state.items.filter(q=>q.type==='quest').map(renderQuest).join('');
  const commits=[],cues=[],starts=[],ends=[],targets=[];let blocked=false,drop={type:'folder',id:'folio'},assist=()=>{};
  const controller=createQuestBundles({document,window,getState:()=>state,commit(next){commits.push(next);state=next;},renderQuest,getDropTarget:()=>drop,onAssist:e=>assist(e),onTarget:target=>targets.push(target),onCue:(name,options)=>cues.push({name,options}),isBlocked:()=>blocked,onStart:value=>starts.push(value),onEnd:value=>ends.push(value),reducedMotion:()=>true});
  t.after(()=>controller.destroy());
  const paper=id=>document.querySelectorAll('.quest-paper').find(node=>node.dataset.id===id&&!node.closest('.quest-bundle-ghost'));
  return {document,window,board,controller,commits,cues,starts,ends,targets,paper,grip:id=>paper(id).querySelector('.drag-handle'),button:id=>paper(id).querySelector('[data-bundle-select]'),get state(){return state;},set state(value){state=value;},set blocked(value){blocked=value;},set drop(value){drop=value;},set assist(value){assist=value;},ghost:()=>document.querySelector('.quest-bundle-ghost'),renderQuest};
}
function lift(h,id='a'){h.controller.toggle('a');h.controller.toggle('b');h.grip(id).fire('pointerdown');h.window.fire('pointermove',{clientX:180,clientY:70});}

test('Shift-click, checkbox and Shift-Space select without opening a reader, while writing and reader windows remain untouched',t=>{
  const h=harness(t);let opens=0;h.document.addEventListener('click',()=>opens++);
  const event=h.paper('a').fire('click',{shiftKey:true});assert.equal(event.defaultPrevented,true);assert.deepEqual(h.controller.selectedIds,['a']);
  h.button('b').fire('pointerdown');h.button('b').fire('click',{detail:0});assert.deepEqual(h.controller.selectedIds,['a','b']);assert.equal(opens,0);
  assert.equal(h.button('a').getAttribute('aria-pressed'),'true');assert.ok(h.paper('a').classList.contains('bundle-selected'));
  h.grip('a').fire('keydown',{key:' ',shiftKey:true});assert.deepEqual(h.controller.selectedIds,['b']);
  h.paper('a').querySelector('textarea').fire('click',{shiftKey:true});assert.deepEqual(h.controller.selectedIds,['b']);
  const reader=h.document.createElement('section');reader.className='paper-reader';reader.innerHTML=h.renderQuest(h.state.items[1]);h.document.body.append(reader);reader.firstElementChild.fire('click',{shiftKey:true});assert.deepEqual(h.controller.selectedIds,['b']);
  const bar=h.document.querySelector('.quest-bundle-selection');assert.equal(bar.hidden,false);bar.querySelector('button').fire('click');assert.deepEqual(h.controller.selectedIds,[]);assert.equal(bar.hidden,true);assert.equal(h.commits.length,0);
});

test('one selected grip and blocked gestures retain existing single-paper pointer behavior',t=>{
  const h=harness(t);let singles=0;h.document.addEventListener('pointerdown',()=>singles++);
  h.controller.toggle('a');assert.equal(h.grip('a').fire('pointerdown').defaultPrevented,false);assert.equal(singles,1);assert.equal(h.controller.dragging,false);
  h.controller.toggle('b');h.blocked=true;assert.equal(h.grip('a').fire('pointerdown').defaultPrevented,false);assert.equal(singles,2);assert.equal(h.ghost(),null);
  h.blocked=false;assert.equal(h.grip('a').fire('pointerdown',{button:2}).defaultPrevented,false);assert.equal(h.grip('a').fire('pointerdown',{isPrimary:false}).defaultPrevented,false);
});

test('a captured multi-paper gesture commits once against latest notes and suppresses the release click',t=>{
  const h=harness(t);lift(h);assert.equal(h.controller.dragging,true);assert.equal(h.starts.length,1);assert.equal(h.document.body.hasPointerCapture(1),true);assert.ok(h.paper('a').classList.contains('bundle-source'));assert.ok(h.paper('b').classList.contains('bundle-source'));
  h.state={...h.state,items:h.state.items.map(q=>q.id==='a'?{...q,notes:'Typed during pickup'}:q)};
  h.window.fire('pointerup',{clientX:400,clientY:250});assert.equal(h.commits.length,1);assert.equal(h.state.items[1].notes,'Typed during pickup');assert.equal(h.state.items[1].folderId,'folio');assert.equal(h.state.items[2].folderId,'folio');assert.equal(h.controller.dragging,false);assert.equal(h.ghost(),null);
  assert.deepEqual(h.cues.map(c=>c.name),['paperPick','paperSlide']);assert.equal(h.ends[0].committed,true);assert.equal(h.document.body.hasPointerCapture(1),false);
  let reads=0;h.document.addEventListener('click',()=>reads++);h.grip('a').fire('click');assert.equal(reads,0);
});

test('ghost rendering is capped at five sheets with the actual selection count',t=>{
  const h=harness(t,{count:7});for(const q of h.state.items.filter(q=>q.type==='quest'))h.controller.toggle(q.id);
  h.grip('a').fire('pointerdown');h.window.fire('pointermove',{clientX:190,clientY:90});
  assert.equal(h.ghost().querySelectorAll('.quest-bundle-sheet').length,5);assert.equal(h.ghost().querySelector('.quest-bundle-count').textContent,'7');assert.equal(h.ghost().style.pointerEvents,'none');assert.equal(h.ghost().style.zIndex,'10000');assert.deepEqual(h.cues.map(c=>c.name),['paperPick']);
});

for(const reason of ['pointercancel','blur','pagehide','Escape','invalid-target','deleted'])test(`${reason} cancels the complete bundle with no writes or retained ghost/source/capture`,t=>{
  const h=harness(t);lift(h);
  if(reason==='Escape')h.document.fire('keydown',{key:'Escape'});
  else if(reason==='invalid-target'){h.drop=null;h.window.fire('pointerup',{clientX:190,clientY:80});}
  else if(reason==='deleted'){h.state={...h.state,items:h.state.items.filter(q=>q.id!=='b')};h.controller.refresh();}
  else h.window.fire(reason);
  assert.equal(h.commits.length,0);assert.equal(h.controller.dragging,false);assert.equal(h.ghost(),null);assert.equal(h.document.body.hasPointerCapture(1),false);assert.equal(h.paper('a').classList.contains('bundle-source'),false);assert.deepEqual(h.cues.map(c=>c.name),['paperPick']);assert.equal(h.ends.length,1);assert.equal(h.ends[0].committed,false);assert.equal(h.targets.at(-1),null);
});

test('current tray transform after assistance determines the drop, never the pickup origin',t=>{
  const h=harness(t);h.drop={type:'tray',origin:{left:0,top:0},scale:.5};h.assist=()=>{h.drop={type:'tray',origin:{left:90,top:20},scale:.5};};lift(h);h.window.fire('pointerup',{clientX:290,clientY:220});
  assert.equal(h.commits.length,1);assert.deepEqual(h.state.items[1].storagePosition,{x:250,y:372});assert.equal(h.state.items[2].archived,true);assert.equal(h.state.items[2].folderId,null);assert.deepEqual(h.cues.map(c=>c.name),['paperPick','paperDrop']);
});

test('rotated zoomed source preserves its grabbed local pixel through ghost transforms',t=>{
  const h=harness(t);h.paper('a').computedTransform='matrix(0, .5, -.5, 0, 0, 0)';h.paper('a').rect={left:100,top:200,width:PAPER.height/2,height:150};h.controller.toggle('a');h.controller.toggle('b');
  h.grip('a').fire('pointerdown',{clientX:298.1428571428571,clientY:210});h.window.fire('pointermove',{clientX:300,clientY:250});
  assert.equal(h.ghost().style.left,'280px');assert.equal(h.ghost().style.top,'222px');assert.equal(h.ghost().style.transformOrigin,'20px 28px');assert.equal(h.ghost().style.transform,'rotate(90deg) scale(0.5)');
});

test('bundle ghosts retain the complete A4 sheet footprint during a live lift',t=>{
  const h=harness(t);lift(h);
  assert.equal(h.ghost().style.width,'300px');
  assert.equal(h.ghost().style.height,`${PAPER.height}px`);
  assert.equal(h.ghost().querySelectorAll('.quest-bundle-sheet').length,2);
});

test('refresh repaints replaced originals, regrab cancels old ownership, and destroy removes every listener',t=>{
  const h=harness(t);lift(h);const old=h.paper('a');old.remove();const holder=h.document.createElement('div');holder.innerHTML=h.renderQuest(h.state.items[1]);h.board.append(holder.firstElementChild);h.controller.refresh();assert.ok(h.paper('a').classList.contains('bundle-source'));assert.equal(h.button('a').getAttribute('aria-pressed'),'true');
  h.grip('b').fire('pointerdown',{pointerId:2});assert.equal(h.ends.length,1);assert.equal(h.ends[0].committed,false);assert.equal(h.ghost(),null);assert.equal(h.document.body.hasPointerCapture(1),false);h.window.fire('pointermove',{pointerId:2,clientX:190,clientY:80});assert.equal(h.starts.length,2);
  h.controller.destroy();assert.equal(h.ghost(),null);assert.equal(h.controller.dragging,false);assert.equal(h.document.body.hasPointerCapture(2),false);assert.equal(h.document.listenerCount,0);assert.equal(h.window.listenerCount,0);assert.equal(h.document.querySelector('.quest-bundle-selection'),null);assert.equal(h.commits.length,0);
});

test('tray and folio preview originals can share a packet while reader controls remain interactive',t=>{
  const h=harness(t),tray=h.document.createElement('div'),folio=h.document.createElement('section');tray.className='storage-plane';folio.className='folder-window';h.document.body.append(tray,folio);
  const a=h.paper('a'),b=h.paper('b');a.removeAttribute('data-id');a.dataset.storageId='a';a.querySelector('.drag-handle').dataset.questDrag='a';tray.append(a);
  b.removeAttribute('data-id');b.dataset.folioPaper='b';b.querySelector('.drag-handle').dataset.questDrag='b';folio.append(b);
  a.fire('click',{shiftKey:true});b.querySelector('[data-bundle-select]').fire('click',{detail:0});assert.deepEqual(h.controller.selectedIds,['a','b']);
  let reads=0;h.document.addEventListener('click',e=>{if(e.target.closest('[data-read-front]'))reads++;});
  assert.equal(b.querySelector('[data-read-front]').fire('click',{shiftKey:true}).defaultPrevented,false);assert.equal(reads,1);
  b.querySelector('.drag-handle').fire('pointerdown');h.window.fire('pointermove',{clientX:200,clientY:100});assert.deepEqual(h.starts[0].ids,['b','a']);assert.ok(a.classList.contains('bundle-source'));assert.ok(b.classList.contains('bundle-source'));
  h.drop={type:'board',origin:{left:100,top:50},scale:2,bounds:{width:1180,height:1000}};h.window.fire('pointerup',{clientX:800,clientY:600});
  assert.equal(h.commits.length,1);assert.equal(h.state.items.find(q=>q.id==='b').x,200);assert.equal(h.state.items.find(q=>q.id==='a').x,210);assert.deepEqual(h.controller.selectedIds,[]);
});

test('folio index grips select and lift their quest without becoming a reader document drag',t=>{
  const h=harness(t),folio=h.document.createElement('section');folio.className='folder-window';folio.innerHTML='<article class="folio-index-row" data-quest-id="a"><button data-quest-drag="a"></button><button data-folio-select="a"></button></article>';h.document.body.append(folio);
  folio.querySelector('[data-folio-select]').fire('click',{shiftKey:true});h.controller.toggle('b');
  const down=folio.querySelector('[data-quest-drag]').fire('pointerdown');assert.equal(down.defaultPrevented,true);h.window.fire('pointermove',{clientX:200,clientY:100});assert.equal(h.controller.dragging,true);assert.ok(folio.firstElementChild.classList.contains('bundle-source'));
  h.window.fire('pointerup',{clientX:400,clientY:200});assert.equal(h.commits.length,1);assert.equal(h.state.items.find(q=>q.id==='a').folderId,'folio');
});

test('changed or invalid destination data rejects every quest and aborts sound ownership',t=>{
  const h=harness(t);lift(h);const signal=h.cues[0].options.signal;h.drop={type:'folder',id:'missing'};h.window.fire('pointerup',{clientX:200,clientY:100});
  assert.equal(h.commits.length,0);assert.equal(h.state.items[1].archived,false);assert.equal(h.state.items[2].archived,false);assert.equal(signal.aborted,true);assert.equal(h.ends[0].reason,'invalid-drop');assert.ok(h.ends[0].error instanceof Error);assert.deepEqual(h.controller.selectedIds,['a','b']);
});

test('successful contact cue is shared by the packet and aborted by the next grab or destroy',t=>{
  const h=harness(t);lift(h);h.window.fire('pointerup',{clientX:300,clientY:200});const contact=h.cues.at(-1);assert.equal(contact.options.delay,0);assert.equal(contact.options.signal.aborted,false);assert.equal(contact.options.signal,h.cues[0].options.signal);
  h.controller.toggle('a');h.controller.toggle('b');h.grip('a').fire('pointerdown');assert.equal(contact.options.signal.aborted,true);h.window.fire('pointermove',{clientX:190,clientY:80});const pickup=h.cues.at(-1);h.controller.destroy();assert.equal(pickup.options.signal.aborted,true);assert.equal(h.commits.length,1);
});

test('Shift-click on the printed quest title selects without opening it, while a normal click still reads',t=>{
  const h=harness(t),title=h.paper('a').querySelector('[data-read-front]');title.className='quest-title';let reads=0;h.document.addEventListener('click',()=>reads++);
  const shift=title.fire('click',{shiftKey:true});assert.equal(shift.defaultPrevented,true);assert.deepEqual(h.controller.selectedIds,['a']);assert.equal(reads,0);
  title.fire('click');assert.equal(reads,1);assert.deepEqual(h.controller.selectedIds,['a']);
});

for(const event of ['blur','pagehide'])test(`${event} retires any pending successful contact cue after the drag has ended`,t=>{
  const h=harness(t);lift(h);h.window.fire('pointerup',{clientX:300,clientY:200});const signal=h.cues.at(-1).options.signal;assert.equal(signal.aborted,false);h.window.fire(event);assert.equal(signal.aborted,true);assert.equal(h.commits.length,1);
});
