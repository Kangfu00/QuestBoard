import test from 'node:test';
import assert from 'node:assert/strict';

const module=await import('../dist/quest-unlock.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
const create=options=>{assert.equal(typeof module.createQuestUnlockEffects,'function','createQuestUnlockEffects is exported');return module.createQuestUnlockEffects(options);};
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};

// DOM, mutation delivery, timers and animation completion are browser boundaries;
// the controller, identity resolution and resource lifetimes stay real.
class Target{
  constructor(){this.listeners=new Map();}
  addEventListener(type,fn,options){this.listeners.set(type,[...(this.listeners.get(type)??[]),{fn,options}]);}
  removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)??[]).filter(item=>item.fn!==fn));}
  fire(type,init={}){const event={type,target:this,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;},...init};for(const {fn}of [...this.listeners.get(type)??[]])fn(event);return event;}
  get listenerCount(){return [...this.listeners.values()].reduce((sum,list)=>sum+list.length,0);}
}
const dataKey=name=>name.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());
class Element extends Target{
  constructor(tag,document){
    super();Object.assign(this,{tagName:tag.toUpperCase(),ownerDocument:document,children:[],attrs:new Map(),dataset:{},hidden:false,inert:false,style:{},animations:[]});
    this.classList={contains:name=>this.className.split(/\s+/).includes(name),add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(' ');},remove:(...names)=>{this.className=this.className.split(/\s+/).filter(name=>!names.includes(name)).join(' ');}};
  }
  get className(){return this.attrs.get('class')??'';}set className(value){this.attrs.set('class',value);}
  get id(){return this.attrs.get('id')??'';}set id(value){this.attrs.set('id',value);}
  get parentElement(){return this.parentNode instanceof Element?this.parentNode:null;}
  get isConnected(){return this===this.ownerDocument.body||!!this.parentNode?.isConnected;}
  setAttribute(name,value){this.attrs.set(name,String(value));if(name.startsWith('data-'))this.dataset[dataKey(name)]=String(value);}
  getAttribute(name){return name.startsWith('data-')?this.dataset[dataKey(name)]??null:this.attrs.get(name)??null;}
  hasAttribute(name){return this.getAttribute(name)!==null;}
  matches(selector){return selector.split(',').some(part=>{part=part.trim();const tag=part.match(/^[a-z]+/i)?.[0];if(tag&&tag.toUpperCase()!==this.tagName)return false;for(const [,name]of part.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(name))return false;const id=part.match(/#([\w-]+)/)?.[1];if(id&&this.id!==id)return false;return true;});}
  closest(selector){return this.matches(selector)?this:this.parentElement?.closest(selector)??null;}
  querySelectorAll(selector){const all=this.children.flatMap(child=>[child,...child.querySelectorAll('*')]);return selector==='*'?all:all.filter(node=>node.matches(selector));}
  querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
  append(...nodes){for(const node of nodes){node.remove();node.parentNode=this;this.children.push(node);}}
  remove(){if(this.parentNode instanceof Element)this.parentNode.children=this.parentNode.children.filter(node=>node!==this);this.parentNode=null;}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  animate(keyframes,options){
    const animation={target:this,keyframes,options,cancelled:false};let finish,fail;
    animation.finished=new Promise((resolve,reject)=>{finish=resolve;fail=reject;});
    animation.finish=finish;animation.fail=()=>fail(new Error('Unavailable'));
    animation.cancel=()=>{animation.cancelled=true;fail(new Error('Cancelled'));};
    this.animations.push(animation);return animation;
  }
}
function harness(t,{reduced=false,nativeReduced=false,waapi='working'}={}){
  const document=new Target(),window=new Target(),nodes=[],timers=new Map(),observers=[],media=new Target();let nextTimer=1;
  document.createElement=tag=>{const node=new Element(tag,document);nodes.push(node);if(waapi==='missing')node.animate=undefined;if(waapi==='throw')node.animate=()=>{throw new Error('WAAPI unavailable');};return node;};
  document.body=document.createElement('body');document.activeElement=document.body;document.querySelectorAll=selector=>document.body.querySelectorAll(selector);
  window.getComputedStyle=node=>({display:node.style.display??'block',visibility:node.style.visibility??'visible'});
  media.matches=nativeReduced;window.matchMedia=()=>media;
  window.setTimeout=(fn,delay)=>{const id=nextTimer++;timers.set(id,{fn,delay});return id;};window.clearTimeout=id=>timers.delete(id);
  window.MutationObserver=class{constructor(callback){this.callback=callback;observers.push(this);}observe(target,options){Object.assign(this,{target,options,observing:true});}disconnect(){this.observing=false;}deliver(changes=[]){if(this.observing)this.callback(changes);}};
  const make=(tag,classes='',attrs={})=>{const node=document.createElement(tag);node.className=classes;for(const [name,value]of Object.entries(attrs))node.setAttribute(name,value);return node;};
  const board=make('div','',{id:'board-canvas'});document.body.append(board);
  function add(kind='board',id='a',{badge=true,metadata=true}={}){
    let host=board,parent=board,scene;
    if(kind==='reader'){
      host=make('dialog','paper-reader',{'data-reader-quest':id,'data-side':'front'});host.open=true;scene=make('div','paper-reader-scene',{'data-side':'front'});const live=make('div','paper-reader-live'),front=make('div','reader-face reader-front');document.body.append(host);host.append(scene);scene.append(live);live.append(front);parent=front;
    }else if(kind==='folio'){
      host=make('section','folder-window folio-spread',{'data-open-folder':'folder'});const right=make('section','folio-right'),viewport=make('div','folio-paper-viewport'),stage=make('div','folio-paper-stage');document.body.append(host);host.append(right);right.append(viewport);viewport.append(stage);parent=stage;
    }else if(kind==='tray'){host=make('div','storage-plane',{id:'drawer-list'});document.body.append(host);parent=host;}
    const paper=make('article','quest-paper',kind==='reader'?{}:{[kind==='folio'?'data-folio-paper':kind==='tray'?'data-storage-id':'data-id']:id});parent.append(paper);
    const meta=metadata?make('div','quest-metadata'):null,anchor=badge?make('span','quest-dependency-badge'):null;if(meta)paper.append(meta);if(anchor)(meta??paper).append(anchor);
    paper.style.transform='rotate(-4deg)';return {host,paper,parent,scene,meta,anchor};
  }
  const controller=create({document,window,reducedMotion:()=>reduced});t.after(()=>controller.destroy());
  const effects=view=>view.paper.querySelectorAll('.quest-unlock-effect');
  const animations=()=>nodes.flatMap(node=>node.animations);
  return {document,window,media,nodes,timers,observers,make,add,controller,effects,animations,get reduced(){return reduced;},set reduced(value){reduced=value;},mutate(){for(const observer of observers)observer.deliver([{type:'childList',target:document.body}]);},finish(){for(const animation of animations())animation.finish();},expire(){for(const {fn}of [...timers.values()])fn();}};
}

test('one unlock decorates every live board, tray, reader and folio copy once',t=>{
  const h=harness(t),views=['board','tray','reader','folio'].map(kind=>h.add(kind)),other=h.add('board','b');
  h.controller.play(['a','a','missing']);
  for(const view of views){assert.equal(h.effects(view).length,1);assert.equal(h.effects(view)[0].parentElement,view.anchor);}
  assert.equal(h.effects(other).length,0);assert.equal(h.document.activeElement,h.document.body);
});

test('hidden, inert, ghost, back, turning, closed and disconnected papers never animate',t=>{
  const h=harness(t),valid=h.add();
  const invalid=[];
  for(const change of [v=>{v.paper.hidden=true;},v=>{v.paper.inert=true;},v=>v.paper.setAttribute('aria-hidden','true'),v=>{v.paper.style.display='none';},v=>{v.paper.style.visibility='hidden';},v=>{v.host.style.visibility='collapse';},v=>v.paper.remove()]){const view=h.add('tray');change(view);invalid.push(view);}
  for(const name of ['quest-drag-ghost','quest-bundle-ghost','paper-turn-ghost','paper-turn-strip','folio-closing-ghost','folder-drag-ghost']){const view=h.add();view.paper.classList.add(name);invalid.push(view);}
  for(const change of [v=>{v.host.open=false;},v=>{v.host.dataset.side='back';},v=>{v.scene.dataset.side='back';},v=>v.scene.classList.add('paper-is-turning')]){const view=h.add('reader');change(view);invalid.push(view);}
  h.controller.play(['a']);assert.equal(h.effects(valid).length,1);for(const view of invalid)assert.equal(h.effects(view).length,0);
});

test('a removed last dependency uses the paper metadata area without changing its layout',t=>{
  const h=harness(t),metadata=h.add('board','a',{badge:false}),bare=h.add('tray','a',{badge:false,metadata:false});
  h.controller.play(['a']);assert.equal(h.effects(metadata)[0].parentElement,metadata.meta);assert.equal(h.effects(bare)[0].parentElement,bare.paper);
  assert.equal(metadata.meta.style.position,undefined);assert.equal(metadata.paper.style.transform,'rotate(-4deg)');
});

test('unlock animates only decorative children and retires all resources when finished',async t=>{
  const h=harness(t),view=h.add();h.controller.play(['a']);const effect=h.effects(view)[0],animations=h.animations();
  assert.equal(effect.getAttribute('aria-hidden'),'true');assert.equal(effect.inert,true);assert.equal(effect.style.pointerEvents,'none');assert.ok(animations.length>=3);
  for(const animation of animations){assert.ok(effect.contains(animation.target));assert.notEqual(animation.target,view.paper);assert.ok(animation.options.duration>=650&&animation.options.duration<=900);}
  assert.equal(view.paper.animations.length,0);assert.equal(view.paper.style.transform,'rotate(-4deg)');
  h.finish();await flush();assert.equal(effect.isConnected,false);assert.equal(h.timers.size,0);assert.ok(h.observers.every(observer=>!observer.observing));
});

test('a repeated play cancels the old effect and a late finish cannot remove the new one',async t=>{
  const h=harness(t),view=h.add();h.controller.play(['a']);const previous=h.effects(view)[0],oldAnimations=[...h.animations()];h.controller.play(['a']);const current=h.effects(view)[0];
  assert.notEqual(current,previous);assert.equal(previous.isConnected,false);assert.ok(oldAnimations.every(animation=>animation.cancelled));
  for(const animation of oldAnimations)animation.finish();await flush();assert.equal(current.isConnected,true);assert.equal(h.effects(view).length,1);
});

test('cancelAll clears children, timers and animation work and remains reusable',async t=>{
  const h=harness(t),view=h.add();h.controller.play(['a']);h.controller.cancelAll();h.controller.cancelAll();await flush();
  assert.equal(h.effects(view).length,0);assert.equal(h.timers.size,0);assert.ok(h.animations().every(animation=>animation.cancelled));assert.ok(h.observers.every(observer=>!observer.observing));
  h.controller.play(['a']);assert.equal(h.effects(view).length,1);
});

test('regrabbing a live paper retires the flourish without consuming pointer input',t=>{
  const h=harness(t),view=h.add();h.controller.play(['a']);const event=h.document.fire('pointerdown',{target:view.paper});
  assert.equal(event.defaultPrevented,false);assert.equal(event.stopped,undefined);assert.equal(h.effects(view).length,0);assert.equal(view.paper.inert,false);
});

test('rerendering a paper or badge cancels its resources without decorating a replacement',async t=>{
  for(const replace of ['paper','badge']){
    const h=harness(t),view=h.add();h.controller.play(['a']);const effect=h.effects(view)[0];
    if(replace==='paper'){view.paper.remove();h.add();}else{view.anchor.remove();view.meta.append(h.make('span','quest-dependency-badge'));}
    h.mutate();await flush();assert.equal(effect.isConnected,false);assert.equal(h.document.body.querySelectorAll('.quest-unlock-effect').length,0);assert.equal(h.timers.size,0);assert.ok(h.animations().every(animation=>animation.cancelled));
  }
});

test('a copy becoming hidden, back-facing, dragged or reassigned retires only that copy',t=>{
  for(const invalidate of [v=>{v.paper.hidden=true;},v=>{v.host.dataset.side='back';},v=>v.paper.classList.add('quest-drag-ghost'),v=>{v.host.dataset.readerQuest='other';}]){
    const h=harness(t),reader=h.add('reader'),board=h.add();h.controller.play(['a']);invalidate(reader);h.mutate();assert.equal(h.effects(reader).length,0);assert.equal(h.effects(board).length,1);
  }
});

test('function and native reduced motion skip transient children and timers immediately',t=>{
  for(const options of [{reduced:true},{nativeReduced:true}]){const h=harness(t,options),view=h.add();h.controller.play(['a']);assert.equal(h.effects(view).length,0);assert.equal(h.animations().length,0);assert.equal(h.timers.size,0);}
  const h=harness(t),view=h.add();h.controller.play(['a']);h.reduced=true;h.controller.play(['a']);assert.equal(h.effects(view).length,0);assert.equal(h.timers.size,0);
});

test('changing the native motion preference cancels a running flourish',t=>{
  const h=harness(t),view=h.add();h.controller.play(['a']);h.media.matches=true;h.media.fire('change',{matches:true});assert.equal(h.effects(view).length,0);assert.equal(h.timers.size,0);
});

for(const fault of ['missing','throw','reject'])test(`unavailable WAAPI (${fault}) leaves no decorative overlay`,async t=>{
  const h=harness(t,{waapi:fault}),view=h.add();assert.doesNotThrow(()=>h.controller.play(['a']));
  if(fault==='reject')h.animations()[0].fail();await flush();assert.equal(h.effects(view).length,0);assert.equal(h.timers.size,0);assert.equal(view.paper.style.transform,'rotate(-4deg)');
});

test('a stalled browser animation still expires within a short cleanup deadline',t=>{
  const h=harness(t),view=h.add();h.controller.play(['a']);assert.ok([...h.timers.values()].every(timer=>timer.delay<=1100));h.expire();assert.equal(h.effects(view).length,0);assert.equal(h.timers.size,0);
});

test('window lifecycle changes cancel effects and destroy releases all listeners permanently',t=>{
  const h=harness(t),view=h.add();for(const type of ['blur','resize','pagehide']){h.controller.play(['a']);h.window.fire(type);assert.equal(h.effects(view).length,0);assert.equal(h.timers.size,0);}
  h.controller.play(['a']);h.controller.destroy();h.controller.destroy();assert.equal(h.effects(view).length,0);assert.equal(h.window.listenerCount,0);assert.equal(h.document.listenerCount,0);assert.equal(h.media.listenerCount,0);assert.ok(h.observers.every(observer=>!observer.observing));h.controller.play(['a']);assert.equal(h.effects(view).length,0);
});
