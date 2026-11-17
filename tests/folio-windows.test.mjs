import test from 'node:test';
import assert from 'node:assert/strict';
import {createFolioWindows} from '../dist/folio-windows.mjs';

const dataKey=name=>name.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());
class Element {
  constructor(tagName='div',document){
    this.tagName=tagName;this.ownerDocument=document;this.children=[];this.parentNode=null;this.attrs=new Map();this.dataset={};this.listeners=new Map();
    this.style={setProperty(name,value){this[name]=value;}};this.hidden=false;this.scrollTop=0;this.scrollLeft=0;this.clientWidth=350;this.clientHeight=420;this._value='';
    this.classList={contains:name=>this.className.split(/\s+/).includes(name),add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(' ');},remove:(...names)=>{this.className=this.className.split(/\s+/).filter(name=>!names.includes(name)).join(' ');},toggle:(name,force)=>{const yes=force??!this.classList.contains(name);this.classList[yes?'add':'remove'](name);return yes;}};
  }
  get className(){return this.attrs.get('class')??'';}set className(value){this.attrs.set('class',value);}
  get id(){return this.attrs.get('id')??'';}set id(value){this.attrs.set('id',value);}
  get attributes(){return [...this.attrs].map(([name,value])=>({name,value}));}
  get isConnected(){return this===this.ownerDocument?.body||Boolean(this.parentNode?.isConnected);}
  get firstElementChild(){return this.children[0]??null;}
  get offsetWidth(){return 760;}
  get value(){return this._value;}set value(value){this._value=value;this.selectionStart=value.length;this.selectionEnd=value.length;this.scrollLeft=0;}
  setAttribute(name,value){this.attrs.set(name,String(value));if(name.startsWith('data-'))this.dataset[dataKey(name)]=String(value);if(name==='hidden')this.hidden=true;}
  getAttribute(name){if(name.startsWith('data-'))return this.dataset[dataKey(name)]??null;return this.attrs.get(name)??null;}
  removeAttribute(name){this.attrs.delete(name);if(name.startsWith('data-'))delete this.dataset[dataKey(name)];}
  matches(selector){
    if(selector.includes(','))return selector.split(',').some(part=>this.matches(part.trim()));
    const tag=selector.match(/^[a-z]+/i)?.[0];if(tag&&tag!==this.tagName)return false;
    for(const name of selector.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(name[1]))return false;
    const id=selector.match(/#([\w-]+)/)?.[1];if(id&&this.id!==id)return false;
    for(const [,name,value] of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g))if(value===undefined?this.getAttribute(name)===null:this.getAttribute(name)!==value)return false;
    return true;
  }
  closest(selector){return this.matches(selector)?this:this.parentNode?.closest(selector)??null;}
  querySelectorAll(selector){const all=this.children.flatMap(child=>[child,...child.querySelectorAll('*')]);return selector==='*'?all:all.filter(child=>child.matches(selector));}
  querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  append(child){child.remove();this.children.push(child);child.parentNode=this;}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.parentNode=null;}
  replaceChildren(...children){for(const child of this.children)child.parentNode=null;this.children=[];for(const child of children)this.append(child);}
  set innerHTML(html){
    this.html=html;this.replaceChildren();const stack=[this],voids=new Set(['input','img','br','hr']);
    for(const match of html.matchAll(/<\/?([a-z][\w-]*)([^>]*)>/gi)){
      if(match[0][1]==='/'){if(stack.length>1)stack.pop();continue;}
      const node=new Element(match[1],this.ownerDocument);
      for(const [,name,,value] of match[2].matchAll(/([\w:-]+)(?:=(['"])(.*?)\2)?/g))node.setAttribute(name,value??'');
      stack.at(-1).append(node);if(!voids.has(node.tagName)&&!match[0].endsWith('/>'))stack.push(node);
    }
  }
  get innerHTML(){return this.html??'';}
  addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);}
  removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);}
  fire(name,extra={}){const event={target:this,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...extra};for(let node=this;node;node=node.parentNode){for(const fn of node.listeners.get(name)??[])fn(event);if(event.stopped)break;}return event;}
  focus(){this.ownerDocument.activeElement=this;this.fire('focusin');}
  getBoundingClientRect(){return {left:120,top:90,width:760,height:570};}
  cloneNode(deep){const copy=new Element(this.tagName,this.ownerDocument);for(const {name,value} of this.attributes)copy.setAttribute(name,value);Object.assign(copy.dataset,this.dataset);Object.assign(copy.style,this.style);copy.hidden=this.hidden;if(deep)for(const child of this.children)copy.append(child.cloneNode(true));return copy;}
}
function fixture({reduced=true}={}){
  const document={createElement:tag=>new Element(tag,document),querySelector:selector=>document.body.querySelector(selector)};document.body=new Element('body',document);
  let serial=0,front=null;const timers=new Map(),registrations=new Map(),reads=[],cues=[];
  const window={setTimeout(fn,delay){const id=++serial;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);}};
  const windows={register(panel,options){assert.equal(panel.hidden,false,'show before measuring/registering');const entry={options,raises:0,destroyed:false};registrations.set(panel,entry);return {raise(){front=panel;entry.raises++;panel.style.zIndex=String(++serial+240);},cancelDrag(){entry.cancelled=true;},destroy(){entry.destroyed=true;registrations.delete(panel);}};},get top(){return front&&!front.hidden?front:null;}};
  const controller=createFolioWindows({document,window,windows,renderQuest:quest=>`<article class="quest-paper board-item" data-id="${quest.id}"><div class="quest-top"></div><button data-edit="${quest.id}"></button></article>`,icon:()=>'<svg></svg>',binding:()=>'<span class="folio-binding"></span>',onRead:id=>reads.push(id),onCue:(name,options)=>cues.push({name,...options}),reducedMotion:()=>reduced});
  const folders=[{id:'alpha',type:'folder',name:'Alpha notes',color:'gold'},{id:'beta',type:'folder',name:'Beta notes',color:'sage'}];
  const quests=folders.flatMap(folder=>[0,1,2].map(i=>({id:`${folder.id}-${i}`,type:'quest',folderId:folder.id,title:`${folder.id} quest ${i}`,status:'active',archived:true,subquests:[]})));
  const items=[...folders,...quests];
  return {document,window,windows,controller,registrations,timers,cues,reads,folders,items,setFront(panel){front=panel;},panels:()=>document.body.children.filter(node=>node.classList.contains('folder-window')&&!node.classList.contains('folio-closing-ghost')),ghosts:()=>document.body.children.filter(node=>node.classList.contains('folio-closing-ghost'))};
}
const search=(panel,value)=>{const input=panel.querySelector('.folder-search');input.value=value;input.fire('input');return input;};
const pick=(panel,id)=>panel.querySelector(`[data-folio-select="${id}"]`).fire('click');

test('two actual folios keep independent search, bookmark, input and scroll when one is closed or reopened',()=>{
  const h=fixture(),a=h.controller.open(h.folders[0],h.items),b=h.controller.open(h.folders[1],h.items);
  assert.equal(h.panels().length,2);assert.equal(a.dataset.folderTarget,'alpha');assert.equal(b.dataset.openFolder,'beta');
  pick(a,'alpha-1');pick(b,'beta-2');
  const input=search(a,'alpha quest 1'),list=b.querySelector('.folder-window-list');
  input.selectionStart=2;input.selectionEnd=6;input.scrollLeft=30;list.scrollTop=79;list.scrollLeft=9;
  const paper=b.querySelector('.folio-paper-stage').firstElementChild;
  h.controller.render(h.items);
  assert.equal(input.selectionStart,2);assert.equal(input.selectionEnd,6);assert.equal(input.scrollLeft,30);
  assert.equal(list.scrollTop,79);assert.equal(list.scrollLeft,9);assert.equal(b.querySelector('.folio-paper-stage').firstElementChild,paper);
  h.controller.close('alpha');assert.equal(a.hidden,true);assert.equal(a.dataset.folderTarget,undefined);assert.equal(b.hidden,false);
  assert.equal(h.controller.activeId,'beta');assert.equal(b.querySelector('.folio-paper-stage').firstElementChild,paper);
  const reopened=h.controller.open(h.folders[0],h.items,{focus:false});assert.equal(reopened,a);assert.equal(h.panels().length,2);
  assert.equal(a.querySelector('.folder-search'),input);assert.equal(input.value,'alpha quest 1');assert.equal(a.querySelector('.folio-paper-stage').firstElementChild.dataset.folioPaper,'alpha-1');
  search(a,'');assert.equal(a.querySelector('.folio-paper-stage').firstElementChild.dataset.folioPaper,'alpha-1');
});
test('same folder opens once, raises its existing panel and registers a scoped header with per-folder Escape',()=>{
  const h=fixture(),a=h.controller.open(h.folders[0],h.items),b=h.controller.open(h.folders[1],h.items);
  const input=search(a,'alpha quest 2'),paper=a.querySelector('.folio-paper-stage').firstElementChild;
  const first=h.registrations.get(a);assert.equal(first.options.key,'folder:alpha');assert.equal(first.options.handle,'.folder-window-header');
  const again=h.controller.open(h.folders[0],h.items);assert.equal(again,a);assert.equal(h.panels().length,2);assert.equal(h.registrations.size,2);assert.equal(first.raises,2);
  assert.equal(h.document.activeElement,input);assert.equal(a.querySelector('.folio-paper-stage').firstElementChild,paper);assert.equal(h.controller.activeId,'alpha');
  first.options.onEscape();assert.equal(a.hidden,true);assert.equal(b.hidden,false);assert.equal(h.controller.activeId,'beta');
  h.controller.closeAll();assert.equal(b.hidden,true);assert.equal(h.controller.activeId,null);
});
test('render reconciles deleted folders, keeps other views open and never opens closed cached folios',()=>{
  const h=fixture(),a=h.controller.open(h.folders[0],h.items),b=h.controller.open(h.folders[1],h.items);
  const reg=h.registrations.get(a);h.controller.close('beta');const betaInput=b.querySelector('.folder-search');
  h.controller.render(h.items.filter(item=>item.id!=='alpha'));
  assert.equal(a.isConnected,false);assert.equal(reg.destroyed,true);assert.equal(h.registrations.has(a),false);assert.equal(b.hidden,true);
  assert.equal(betaInput,b.querySelector('.folder-search'));assert.equal(h.controller.activeId,null);
  h.controller.open(h.folders[1],h.items);const changed=h.items.map(item=>item.id==='beta'?{...item,name:'Revised folio',color:'red'}:item);
  h.controller.render(changed);assert.equal(b.querySelector('.folder-window-title').textContent,'Revised folio');assert.ok(b.classList.contains('folder-red'));
});
test('each folio owns opening and closing motion, and finishing one held sheet leaves the other opening',()=>{
  const h=fixture({reduced:false}),a=h.controller.open(h.folders[0],h.items),b=h.controller.open(h.folders[1],h.items);
  assert.equal(a.classList.contains('is-unfolding'),true);assert.equal(b.classList.contains('is-unfolding'),true);assert.equal(h.timers.size,2);
  h.controller.render(h.items);assert.equal(a.classList.contains('is-unfolding'),true);assert.equal(b.classList.contains('is-unfolding'),true);
  h.controller.finishOpening(a);assert.equal(a.classList.contains('is-unfolding'),false);assert.equal(b.classList.contains('is-unfolding'),true);assert.equal(h.timers.size,1);
  h.controller.close('alpha',{animate:true});assert.equal(h.ghosts().length,1);assert.equal(b.hidden,false);assert.equal(b.classList.contains('is-unfolding'),true);
  h.controller.close('beta',{animate:true});assert.equal(h.ghosts().length,2);assert.equal(h.timers.size,2);
  h.controller.open(h.folders[0],h.items,{focus:false});assert.equal(h.ghosts().length,1);assert.equal(b.hidden,true);
  h.controller.cancelClosing();assert.equal(h.ghosts().length,0);assert.equal(h.timers.size,1);
  h.controller.finishOpening('alpha');assert.equal(h.timers.size,0);
});
test('panel close controls and keyboard reading target their own folio and restore focus only when requested',()=>{
  const h=fixture(),opener=h.document.createElement('button');opener.dataset.openFolder='alpha';h.document.body.append(opener);
  const a=h.controller.open(h.folders[0],h.items),b=h.controller.open(h.folders[1],h.items);
  a.querySelector('.quest-top').fire('keydown',{key:'Enter'});assert.deepEqual(h.reads,['alpha-0']);
  a.querySelector('[data-action="close-folder"]').fire('click');assert.equal(a.hidden,true);assert.equal(b.hidden,false);
  h.controller.open(h.folders[0],h.items);h.controller.close('alpha',{returnFocus:true});assert.equal(h.document.activeElement,opener);
  assert.equal(b.hidden,false);assert.equal(h.controller.close('missing'),false);
});
test('all mounted folios have disjoint ids and labels reference their own title',()=>{
  const h=fixture(),a=h.controller.open(h.folders[0],h.items),b=h.controller.open(h.folders[1],h.items);
  const ids=panel=>[panel,...panel.querySelectorAll('*')].map(node=>node.id).filter(Boolean);
  assert.ok(ids(a).length>0);assert.deepEqual(ids(a).filter(id=>ids(b).includes(id)),[]);
  assert.equal(a.getAttribute('aria-labelledby'),a.querySelector('.folder-window-title').id);
  assert.equal(b.getAttribute('aria-labelledby'),b.querySelector('.folder-window-title').id);
});
test('starting a header drag settles only its folio while header buttons preserve opening motion',()=>{
  const h=fixture({reduced:false}),a=h.controller.open(h.folders[0],h.items),b=h.controller.open(h.folders[1],h.items);
  a.querySelector('[data-edit-folder="alpha"]').fire('pointerdown',{button:0});assert.equal(a.classList.contains('is-unfolding'),true);
  a.querySelector('.folder-window-title').fire('pointerdown',{button:0});
  assert.equal(a.classList.contains('is-unfolding'),false);assert.equal(b.classList.contains('is-unfolding'),true);
  h.controller.finishOpening();assert.equal(b.classList.contains('is-unfolding'),false);assert.equal(h.timers.size,0);
});
test('activeId follows manager activation and the foremost folio even beneath a different document',()=>{
  const h=fixture(),a=h.controller.open(h.folders[0],h.items),b=h.controller.open(h.folders[1],h.items);
  h.setFront(a);assert.equal(h.controller.activeId,'alpha');
  const reader=h.document.createElement('section');h.document.body.append(reader);h.setFront(reader);
  a.style.zIndex='280';b.style.zIndex='270';assert.equal(h.controller.activeId,'alpha');
  a.style.left='278px';a.style.top='149px';h.controller.close('alpha');h.controller.open(h.folders[0],h.items,{focus:false});
  assert.equal(a.style.left,'278px');assert.equal(a.style.top,'149px');
  h.controller.closeAll();assert.equal(h.controller.activeId,null);
});
test('deleting a folio releases its input listeners, observer and independent pending motion',()=>{
  const h=fixture({reduced:false}),observers=[];
  h.document.defaultView={ResizeObserver:class{constructor(){observers.push(this);}observe(node){this.node=node;}disconnect(){this.disconnected=true;}}};
  const a=h.controller.open(h.folders[0],h.items),b=h.controller.open(h.folders[1],h.items),input=a.querySelector('.folder-search');
  h.controller.close('alpha',{animate:true});assert.equal(h.ghosts().length,1);
  h.controller.render(h.items.filter(item=>item.id!=='alpha'));
  assert.equal(a.isConnected,false);assert.equal(observers[0].disconnected,true);assert.equal(observers[1].disconnected,undefined);
  assert.equal(input.listeners.get('input').size,0);assert.ok([...a.listeners.values()].every(listeners=>listeners.size===0));
  assert.equal(h.ghosts().length,0);assert.equal(h.timers.size,1);assert.equal(b.classList.contains('is-unfolding'),true);
  h.controller.finishOpening();
});
test('routine renders and folder color edits preserve live window, motion and drop classes',()=>{
  const h=fixture(),a=h.controller.open(h.folders[0],h.items);
  const live=['is-window-active','is-window-dragging','is-unfolding','folder-drop-ready'];a.classList.add(...live);
  h.controller.render(h.items);assert.ok(live.every(name=>a.classList.contains(name)));
  h.controller.render(h.items.map(item=>item.id==='alpha'?{...item,color:'red'}:item));
  assert.ok(live.every(name=>a.classList.contains(name)));assert.equal(a.classList.contains('folder-gold'),false);assert.equal(a.classList.contains('folder-red'),true);
});
