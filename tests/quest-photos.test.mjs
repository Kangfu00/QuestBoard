import test from 'node:test';
import assert from 'node:assert/strict';
import {PAPER} from '../dist/paper-format.mjs';

const module=await import('../dist/quest-photos.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
const createQuestPhotos=options=>{assert.equal(typeof module.createQuestPhotos,'function','createQuestPhotos is exported');return module.createQuestPhotos(options);};

// A small DOM boundary with capture/bubble and real controller event ownership.
class Target{
  constructor(){this.listeners=new Map();}
  addEventListener(type,fn,options){const capture=options===true||!!options?.capture;this.listeners.set(type,[...(this.listeners.get(type)??[]),{fn,capture}]);}
  removeEventListener(type,fn,options){const capture=options===true||!!options?.capture;this.listeners.set(type,(this.listeners.get(type)??[]).filter(item=>item.fn!==fn||item.capture!==capture));}
  get listenerCount(){return [...this.listeners.values()].reduce((n,list)=>n+list.length,0);}
  fire(type,init={}){
    const event={type,target:this,button:0,isPrimary:true,pointerId:1,clientX:80,clientY:200,detail:1,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.stopped=this.immediate=true;},...init};
    const path=[];for(let node=this;node;node=node.parentNode)path.push(node);
    const visit=(node,capture)=>{for(const item of [...node.listeners.get(type)??[]]){if(item.capture===capture)item.fn(event);if(event.immediate)break;}};
    for(const node of [...path].reverse()){visit(node,true);if(event.stopped)return event;}
    for(const node of event.bubbles===false?[this]:path){visit(node,false);if(event.stopped)break;}return event;
  }
}
const dataKey=name=>name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
class Element extends Target{
  constructor(tag,document){
    super();this.tagName=tag.toUpperCase();this.ownerDocument=document;this.children=[];this.attrs=new Map();this.dataset={};this.hidden=false;this.inert=false;this.captures=new Set();this.rect={left:0,top:0,width:PAPER.width,height:PAPER.height};
    this.style={setProperty(name,value){this[name]=value;},removeProperty(name){delete this[name];}};
    this.classList={contains:name=>this.className.split(/\s+/).includes(name),add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(' ');},remove:(...names)=>{this.className=this.className.split(/\s+/).filter(name=>!names.includes(name)).join(' ');},toggle:(name,force)=>{const yes=force??!this.classList.contains(name);this.classList[yes?'add':'remove'](name);return yes;}};
  }
  get className(){return this.attrs.get('class')??'';}set className(value){this.attrs.set('class',value);}
  get id(){return this.attrs.get('id')??'';}set id(value){this.attrs.set('id',value);}
  get parentElement(){return this.parentNode instanceof Element?this.parentNode:null;}
  get isConnected(){return this===this.ownerDocument.body||!!this.parentNode?.isConnected;}
  setAttribute(name,value){this.attrs.set(name,String(value));if(name.startsWith('data-'))this.dataset[dataKey(name)]=String(value);}
  getAttribute(name){return name.startsWith('data-')?this.dataset[dataKey(name)]??null:this.attrs.get(name)??null;}
  hasAttribute(name){return this.getAttribute(name)!==null;}
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
  focus(){
    const previous=this.ownerDocument.activeElement;if(previous===this)return;
    // Element blur does not bubble, but still reaches window capture listeners.
    if(previous&&previous!==this.ownerDocument.body)previous.fire('blur',{relatedTarget:this,bubbles:false});
    this.ownerDocument.activeElement=this;this.fire('focusin');
  }
}
class Matrix{
  constructor(transform){
    const values=transform.slice(transform.indexOf('(')+1,-1).split(',').map(Number);this.is2D=transform.startsWith('matrix(');
    if(this.is2D)[this.a,this.b,this.c,this.d,this.e,this.f]=values;
    else{for(let column=1;column<=4;column++)for(let row=1;row<=4;row++)this[`m${column}${row}`]=values[(column-1)*4+row-1];[this.a,this.b,this.c,this.d,this.e,this.f]=[this.m11,this.m12,this.m21,this.m22,this.m41,this.m42];}
  }
}
const near=(value,expected)=>assert.ok(Math.abs(value-expected)<.01,`${value} ≈ ${expected}`);
function harness(t,{ready=true,width=232,height=296}={}){
  const window=new Target(),document=new Target();document.parentNode=window;document.createElement=tag=>new Element(tag,document);document.body=document.createElement('body');document.body.parentNode=document;document.activeElement=document.body;
  document.querySelectorAll=selector=>document.body.querySelectorAll(selector);document.querySelector=selector=>document.body.querySelector(selector);
  window.DOMMatrix=Matrix;window.getComputedStyle=node=>({transform:node.transform??'none',display:node.hidden?'none':'block',visibility:'visible',zoom:node.zoom??'1'});
  const observers=[];window.MutationObserver=class{
    constructor(callback){this.callback=callback;observers.push(this);}
    observe(target,options){this.target=target;this.options=options;this.observing=true;}
    disconnect(){this.observing=false;}
    deliver(changes){const accepted=changes.filter(change=>change.type==='attributes'?this.options.attributes&&(!this.options.attributeFilter||this.options.attributeFilter.includes(change.attributeName)):this.options.childList);if(this.observing&&accepted.length)this.callback(accepted);}
  };
  const quests=new Map([['a',{id:'a',type:'quest',title:'A',imageDataUrl:'data:image/png;base64,AA=='}]]),saves=[],views=[],viewFocus=[],cues=[];let blocked=false;
  const make=(tag,classes='',attrs={})=>{const node=document.createElement(tag);node.className=classes;for(const [name,value]of Object.entries(attrs))node.setAttribute(name,value);return node;};
  const board=make('div','',{id:'board-canvas'});document.body.append(board);
  function add(kind='board',id='a'){
    let host=board,parent=board;
    if(kind==='reader'){
      host=make('dialog','paper-reader',{'data-reader-quest':id,'data-side':'front'});host.open=true;const scene=make('div','paper-reader-scene',{'data-side':'front'}),live=make('div','paper-reader-live'),front=make('div','reader-face reader-front');document.body.append(host);host.append(scene);scene.append(live);live.append(front);parent=front;
    }else if(kind==='folio'){
      host=make('section','folder-window folio-spread',{'data-open-folder':'folder'});const right=make('section','folio-right'),viewport=make('div','folio-paper-viewport'),stage=make('div','folio-paper-stage');document.body.append(host);host.append(right);right.append(viewport);viewport.append(stage);parent=stage;
    }else if(kind==='tray'){host=make('div','storage-plane',{id:'drawer-list'});document.body.append(host);parent=host;}
    const paper=make('article','quest-paper has-photo',kind==='reader'?{}:{[kind==='folio'?'data-folio-paper':kind==='tray'?'data-storage-id':'data-id']:id}),photo=make('div','quest-photo'),img=make('img','',{src:quests.get(id).imageDataUrl,alt:'Photo A'});
    Object.assign(img,{complete:ready,naturalWidth:ready?width:0,naturalHeight:ready?height:0});parent.append(paper);paper.append(photo);photo.append(img);return {host,paper,photo,img,parent};
  }
  const a=add();
  const controller=createQuestPhotos({document,window,getQuest:id=>quests.get(id),onSave(id,layout){saves.push([id,layout]);quests.set(id,{...quests.get(id),photoLayout:layout});},isBlocked:()=>blocked,onView:value=>{views.push(value);viewFocus.push(document.activeElement);},onCue:name=>cues.push(name),reducedMotion:()=>true});
  t.after(()=>controller.destroy());
  return {document,window,board,controller,quests,saves,views,viewFocus,cues,observers,make,add,a,get blocked(){return blocked;},set blocked(value){blocked=value;},button:(action,view=a)=>view.paper.querySelector(`[data-photo-action="${action}"]`),edit(view=a){this.button('edit',view).fire('click');},done(view=a){this.button('done',view).fire('click');}};
}

test('image load classifies and caches intrinsic size without persisting automatic presentation',t=>{
  const h=harness(t,{ready:false,width:484,height:140});assert.equal(h.controller.presentation(h.quests.get('a')),null);assert.equal(h.a.paper.classList.contains('photo-sized'),false);
  Object.assign(h.a.img,{naturalWidth:484,naturalHeight:140,complete:true});h.a.img.fire('load');
  const frame=h.controller.presentation(h.quests.get('a'));assert.equal(frame.orientation,'landscape');assert.equal(frame.x,24);assert.equal(frame.y,206);assert.equal(frame.width,252);assert.equal(frame.height,84);assert.equal(h.a.photo.style.width,'252px');assert.equal(h.a.img.style.height,'70px');assert.ok(h.a.paper.classList.contains('photo-landscape'));assert.deepEqual(h.saves,[]);
  const copy=h.add('reader');copy.img.complete=false;copy.img.naturalWidth=copy.img.naturalHeight=0;h.controller.refresh();assert.equal(copy.photo.style.width,'252px');
});

test('decorates board, persistent reader, folio and tray copies, excluding ghosts, backs and inert papers',t=>{
  const h=harness(t),reader=h.add('reader'),folio=h.add('folio'),tray=h.add('tray'),ghost=h.add();ghost.paper.classList.add('quest-drag-ghost');const back=h.add('reader');back.host.dataset.side='back';const inert=h.add();inert.paper.inert=true;
  h.controller.refresh();for(const view of [h.a,reader,folio,tray]){assert.ok(h.button('edit',view));assert.ok(h.button('view',view));}for(const view of [ghost,back,inert])assert.equal(h.button('edit',view),null);
  h.controller.refresh();assert.equal(reader.photo.querySelectorAll('[data-photo-action="edit"]').length,1);
});

test('full view uses double click or the view control and reacquires a replaced original in its persistent host',t=>{
  const h=harness(t),reader=h.add('reader');h.controller.refresh();let opened=0;reader.host.addEventListener('click',()=>opened++);reader.img.fire('click');assert.equal(h.views.length,0);assert.equal(opened,0);
  reader.img.fire('dblclick');assert.equal(h.views.length,1);const payload=h.views[0];assert.equal(payload.src,h.quests.get('a').imageDataUrl);assert.equal(payload.alt,'Photo A');assert.equal(payload.source,reader.img);
  const replacement=h.make('article','quest-paper has-photo'),photo=h.make('div','quest-photo'),img=h.make('img','',{src:payload.src});reader.paper.remove();reader.parent.append(replacement);replacement.append(photo);photo.append(img);assert.equal(payload.getSource(),img);
  replacement.remove();assert.equal(payload.getSource(),null);h.button('view').fire('click');assert.equal(h.views.length,2);
});

test('blocked stamp and modal interactions keep priority, while edit mode prevents view and paper/window drag',t=>{
  const h=harness(t);h.blocked=true;assert.equal(h.a.img.fire('pointerdown').defaultPrevented,false);h.a.img.fire('dblclick');h.button('edit').fire('click');assert.equal(h.controller.editing,false);assert.equal(h.views.length,0);
  h.blocked=false;let drags=0;h.board.addEventListener('pointerdown',()=>drags++);assert.equal(h.a.img.fire('pointerdown').defaultPrevented,true);assert.equal(drags,0);h.edit();h.a.img.fire('dblclick');assert.equal(h.views.length,0);assert.equal(h.controller.editing,true);
});

test('pointer focus changes keep arrangement open through Edit, Resize, Rotate and Done',t=>{
  const h=harness(t),edit=h.button('edit');edit.fire('pointerdown');edit.fire('click');
  assert.equal(h.controller.editing,true,'focusing Move after Edit must not cancel arrangement');
  for(const action of ['resize','rotate']){
    const button=h.button(action);button.fire('pointerdown');h.window.fire('pointerup');
    assert.equal(h.controller.editing,true,`focusing ${action} must keep the draft`);
  }
  const done=h.button('done');done.fire('pointerdown');done.fire('click');
  assert.equal(h.controller.editing,false);assert.equal(h.saves.length,1);
});

test('photo pointer focus activates its own reader and supplies viewer focus from that source',t=>{
  const h=harness(t),first=h.add('reader'),second=h.add('reader');h.controller.refresh();const raised=[];second.host.addEventListener('focusin',()=>raised.push(second.host));first.img.focus();
  const view=h.button('view',second);view.fire('pointerdown');assert.equal(h.document.activeElement,view);assert.equal(raised.at(-1),second.host);view.fire('click');assert.equal(h.viewFocus[0],view);
  first.img.focus();second.img.fire('pointerdown');assert.equal(h.document.activeElement,second.photo);assert.equal(second.photo.tabIndex,-1);second.img.fire('dblclick');assert.equal(h.viewFocus[1],second.photo);
  first.img.focus();h.blocked=true;second.img.fire('pointerdown');assert.equal(h.document.activeElement,first.img);
});

test('move edits only a draft and Done commits once and updates duplicate copies',t=>{
  const h=harness(t),reader=h.add('reader');h.controller.refresh();h.edit();h.a.img.fire('pointerdown',{clientX:70,clientY:190});h.window.fire('pointermove',{clientX:90,clientY:200});h.window.fire('pointerup',{clientX:90,clientY:200});assert.equal(h.saves.length,0);assert.equal(h.a.photo.style.left,'44px');assert.equal(h.a.photo.style.top,'168px');assert.equal(reader.photo.style.left,'24px');
  const done=h.button('done');done.fire('click');done.fire('click');assert.equal(h.saves.length,1);assert.equal(h.saves[0][0],'a');near(h.saves[0][1].x,44);near(h.saves[0][1].y,168);assert.equal(reader.photo.style.left,'44px');assert.equal(h.controller.editing,false);assert.equal(h.a.photo.hasPointerCapture(1),false);
});

test('resize preserves intrinsic aspect and rotation is bounded without writes until Done',t=>{
  const h=harness(t);h.edit();h.button('resize').fire('pointerdown',{clientX:150,clientY:320});h.window.fire('pointermove',{clientX:160,clientY:333});h.window.fire('pointerup');const width=parseFloat(h.a.photo.style.width),height=parseFloat(h.a.photo.style.height);assert.ok(width>126);near((height-14)/(width-10),296/232);
  const x=parseFloat(h.a.photo.style.left)+width/2,y=parseFloat(h.a.photo.style.top)+height/2;h.button('rotate').fire('pointerdown',{clientX:x+40,clientY:y});h.window.fire('pointermove',{clientX:x,clientY:y+40});h.window.fire('pointerup');assert.equal(h.a.photo.style.transform,'rotate(15deg)');assert.equal(h.saves.length,0);h.done();assert.equal(h.saves[0][1].rotation,15);
});

for(const edge of [16,264])test(`tiny rotated photo at x=${edge} keeps its editor on the paper and Done and Cancel route to that source`,t=>{
  const h=harness(t,{width:1000,height:100}),reader=h.add('reader');h.quests.set('a',{...h.quests.get('a'),photoLayout:{x:edge,y:200,width:20,rotation:15}});h.controller.refresh();h.edit();
  const editor=h.a.paper.querySelector('.quest-photo-editor');assert.equal(editor?.parentElement,h.a.paper);assert.equal(h.a.photo.contains(editor),false);assert.equal(h.a.photo.querySelector('.quest-photo-controls')?.parentElement,h.a.photo);
  // Actions from another copy cannot save or cancel this paper's draft.
  const wrongEditor=h.make('div','quest-photo-editor'),wrongDone=h.make('button','',{'data-photo-action':'done'}),wrongMove=h.make('button','',{'data-photo-action':'move'});reader.paper.append(wrongEditor);wrongEditor.append(wrongDone,wrongMove);wrongDone.fire('click');wrongMove.fire('keydown',{key:'ArrowDown'});assert.equal(h.controller.editing,true);assert.equal(h.saves.length,0);
  h.button('move').fire('keydown',{key:'ArrowDown'});h.button('cancel').fire('click');assert.equal(h.controller.editing,false);assert.equal(h.saves.length,0);assert.equal(h.a.paper.querySelector('.quest-photo-editor'),null);
  h.edit();h.button('move').fire('keydown',{key:'ArrowDown'});const done=h.button('done');done.fire('click');done.fire('click');assert.equal(h.controller.editing,false);assert.equal(h.saves.length,1);assert.equal(h.saves[0][0],'a');near(h.saves[0][1].y,201);assert.equal(h.a.paper.querySelector('.quest-photo-editor'),null);
});

test('reset is draft-only, cancellation restores manual layout, and Done clears it once',t=>{
  const h=harness(t);h.quests.set('a',{...h.quests.get('a'),photoLayout:{x:40,y:160,width:100,rotation:4}});h.controller.refresh();h.edit();h.button('reset').fire('click');assert.equal(h.a.photo.style.left,'24px');assert.equal(h.saves.length,0);h.button('cancel').fire('click');assert.equal(h.a.photo.style.left,'40px');
  h.edit();h.button('reset').fire('click');h.done();assert.deepEqual(h.saves,[['a',null]]);assert.equal(h.a.paper.classList.contains('photo-manual'),false);
});

for(const reason of ['Escape','pointercancel','blur','resize','removed','changed-image'])test(`${reason} retires draft and capture without writing`,t=>{
  const h=harness(t);h.edit();h.a.img.fire('pointerdown');h.window.fire('pointermove',{clientX:100,clientY:210});assert.equal(h.a.photo.hasPointerCapture(1),true);
  if(reason==='Escape')h.document.fire('keydown',{key:'Escape'});else if(reason==='removed'){h.a.paper.remove();h.controller.refresh();}else if(reason==='changed-image'){h.quests.set('a',{...h.quests.get('a'),imageDataUrl:'data:image/png;base64,BB=='});h.controller.refresh();}else h.window.fire(reason);
  assert.equal(h.controller.editing,false);assert.equal(h.saves.length,0);assert.equal(h.a.photo.hasPointerCapture(1),false);assert.equal(h.a.paper.classList.contains('photo-editing'),false);assert.equal(h.a.paper.querySelector('.quest-photo-editor'),null);
});

test('canonical pointer inversion uses rotated ancestors and CSS zoom rather than declared reader scales',t=>{
  const h=harness(t);h.a.paper.transform='matrix(0,.5,-.5,0,0,0)';h.board.zoom='2';h.a.paper.rect={left:100,top:200,width:PAPER.height,height:300};h.edit();
  // Paper point (70,190) => viewport (100 + paperHeight - 190, 200 + 70).
  h.a.img.fire('pointerdown',{clientX:100+PAPER.height-190,clientY:270});h.window.fire('pointermove',{clientX:100+PAPER.height-200,clientY:290});h.window.fire('pointerup');h.done();near(h.saves[0][1].x,44);near(h.saves[0][1].y,168);
});

test('nonfinite, singular and genuinely 3D transforms reject gestures safely',t=>{
  const h=harness(t);for(const transform of ['matrix(0,0,0,0,0,0)','matrix(NaN,0,0,1,0,0)','matrix3d(1,0,.4,0,0,1,0,0,0,0,1,0,0,0,0,1)']){
    h.edit();h.a.paper.transform=transform;h.a.img.fire('pointerdown');h.window.fire('pointermove',{clientX:200,clientY:300});assert.equal(h.a.photo.hasPointerCapture(1),false);assert.equal(h.controller.editing,false);
  }assert.equal(h.saves.length,0);
});

test('input keys stay local, while focused photo controls support arrow adjustment and Escape',t=>{
  const h=harness(t);h.edit();const input=h.make('textarea');h.a.paper.append(input);assert.equal(input.fire('keydown',{key:'Escape'}).defaultPrevented,false);assert.equal(h.controller.editing,true);
  h.button('move').fire('keydown',{key:'ArrowRight'});h.button('move').fire('keydown',{key:'ArrowDown',shiftKey:true});h.done();near(h.saves[0][1].x,25);near(h.saves[0][1].y,168);
});

test('losing the owned pointer capture cancels a draft; a different pointer cannot cancel it',t=>{
  const h=harness(t);h.edit();h.a.img.fire('pointerdown',{pointerId:7});h.window.fire('pointercancel',{pointerId:8});assert.equal(h.controller.editing,true);h.a.photo.fire('lostpointercapture',{pointerId:7});assert.equal(h.controller.editing,false);assert.equal(h.saves.length,0);assert.equal(h.a.photo.hasPointerCapture(7),false);
});

test('unrelated desk mutations do not rescan papers or disturb a photo draft',async t=>{
  const h=harness(t);h.edit();let scans=0;const query=h.document.querySelectorAll;h.document.querySelectorAll=selector=>{scans++;return query(selector);};const particle=h.make('i','atmosphere-mote');h.document.body.append(particle);h.observers[0].callback([{type:'childList',target:h.document.body,addedNodes:[particle],removedNodes:[]}]);await Promise.resolve();assert.equal(scans,0);assert.equal(h.controller.editing,true);
});

test('reader front controls and double click recover after a back-side refresh and attribute-only flip to front',async t=>{
  const h=harness(t),reader=h.add('reader');h.controller.refresh();assert.ok(h.button('edit',reader));
  reader.host.dataset.side='back';reader.host.querySelector('.paper-reader-scene').dataset.side='back';reader.parent.inert=true;reader.parent.setAttribute('aria-hidden','true');h.controller.refresh();assert.equal(h.button('edit',reader),null);
  reader.host.dataset.side='front';reader.host.querySelector('.paper-reader-scene').dataset.side='front';reader.parent.inert=false;reader.parent.setAttribute('aria-hidden','false');
  h.observers[0].deliver([{type:'attributes',target:reader.host,attributeName:'data-side'},{type:'attributes',target:reader.parent,attributeName:'inert'},{type:'attributes',target:reader.parent,attributeName:'aria-hidden'}]);await Promise.resolve();
  assert.ok(h.button('edit',reader));reader.img.fire('dblclick');assert.equal(h.views.length,1);assert.equal(h.views[0].source,reader.img);h.edit(reader);assert.equal(h.controller.editing,true);assert.equal(h.saves.length,0);
});

test('a reused folio paper cancels edits on hide and recovers controls and double click on attribute-only reopen',async t=>{
  const h=harness(t),folio=h.add('folio');h.controller.refresh();h.edit(folio);const original=folio.paper;
  folio.host.hidden=true;folio.host.setAttribute('hidden','');h.observers[0].deliver([{type:'attributes',target:folio.host,attributeName:'hidden'}]);await Promise.resolve();assert.equal(h.controller.editing,false);assert.equal(h.button('edit',folio),null);
  folio.host.hidden=false;folio.host.removeAttribute('hidden');h.observers[0].deliver([{type:'attributes',target:folio.host,attributeName:'hidden'}]);await Promise.resolve();
  assert.equal(folio.paper,original);assert.ok(h.button('view',folio));folio.img.fire('dblclick');assert.equal(h.views.length,1);assert.equal(h.views[0].source,folio.img);h.edit(folio);assert.equal(h.controller.editing,true);assert.equal(h.saves.length,0);
});

test('availability observation ignores unrelated menus and the classes and styles painted by photo controls',async t=>{
  const h=harness(t);h.edit();let scans=0;const query=h.document.querySelectorAll;h.document.querySelectorAll=selector=>{scans++;return query(selector);};const menu=h.make('div','desk-menu');h.document.body.append(menu);
  h.observers[0].deliver([{type:'attributes',target:menu,attributeName:'hidden'},{type:'attributes',target:h.a.paper,attributeName:'class'},{type:'attributes',target:h.a.photo,attributeName:'style'}]);await Promise.resolve();assert.equal(scans,0);assert.equal(h.controller.editing,true);
});

test('observer notices replacement papers, ignores its own controls, and destroy removes listeners and drafts',async t=>{
  const h=harness(t),reader=h.add('reader');const observer=h.observers[0];assert.ok(observer);observer.callback([{type:'childList',target:reader.parent,addedNodes:[reader.paper],removedNodes:[]}]);await Promise.resolve();assert.ok(h.button('edit',reader));
  h.edit();const controls=h.a.paper.querySelector('.quest-photo-editor');observer.callback([{type:'childList',target:h.a.paper,addedNodes:[controls],removedNodes:[]}]);await Promise.resolve();assert.equal(h.controller.editing,true);
  h.a.img.fire('pointerdown');h.controller.destroy();assert.equal(h.controller.editing,false);assert.equal(h.document.listenerCount,0);assert.equal(h.window.listenerCount,0);assert.equal(h.a.img.listenerCount,0);assert.equal(h.a.photo.hasPointerCapture(1),false);assert.equal(h.button('edit'),null);assert.equal(h.a.paper.querySelector('.quest-photo-editor'),null);assert.equal(observer.observing,false);assert.equal(h.saves.length,0);
});
