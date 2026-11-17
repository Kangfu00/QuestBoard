import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhotoViewer} from '../dist/photo-viewer.mjs';

const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ';
const JPEG='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/';
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
class Events {
  listeners=new Map();
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  emit(type,props={}){const event={type,target:this,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...props};for(const fn of [...this.listeners.get(type)??[]])fn(event);return event;}
}
class Element extends Events {
  constructor(tag,document){super();this.tagName=tag.toUpperCase();this.ownerDocument=document;this.children=[];this.parentElement=null;this.attrs=new Map();this.style={};this.open=false;this.complete=false;this.naturalWidth=0;this.naturalHeight=0;this.text='';}
  setAttribute(name,value){this.attrs.set(name,String(value));}
  getAttribute(name){return this.attrs.get(name)??null;}
  removeAttribute(name){this.attrs.delete(name);}
  append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=null;}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  get isConnected(){return this===this.ownerDocument.body||!!this.parentElement?.isConnected;}
  set textContent(value){this.text=String(value);this.children=[];}
  get textContent(){return this.text+this.children.map(child=>child.textContent).join('');}
  querySelectorAll(selector){const result=[];for(const child of this.children){if(selector.startsWith('.')?child.className===selector.slice(1):child.tagName===selector.toUpperCase())result.push(child);result.push(...child.querySelectorAll(selector));}return result;}
  querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
  focus(){if(this.tagName!=='IMG'||this.getAttribute('tabindex')!==null)this.ownerDocument.activeElement=this;}
  showModal(){if(this.ownerDocument.failModal)throw Error('modal unavailable');this.open=true;this.modal=true;this.ownerDocument.modalShows++;}
  close(){this.open=false;this.emit('close');}
  get src(){return this._src??'';}
  set src(value){this._src=value;this.currentSrc=value;if(this.tagName==='IMG'&&this.ownerDocument.cached){this.complete=true;this.naturalWidth=1200;this.naturalHeight=800;}else if(this.tagName==='IMG'){this.complete=false;this.naturalWidth=0;this.naturalHeight=0;}}
  decode(){const job={};job.promise=new Promise((resolve,reject)=>Object.assign(job,{resolve,reject}));this.ownerDocument.decodes.push(job);return job.promise;}
  getBoundingClientRect(){if(this.rect)return this.rect;const width=parseFloat(this.style.width)||0,height=parseFloat(this.style.height)||0,left=(this.ownerDocument.window.innerWidth-width)/2,top=(this.ownerDocument.window.innerHeight-height)/2;return {left,top,width,height,right:left+width,bottom:top+height};}
  animate(keyframes,options){if(this.ownerDocument.failAnimation)throw Error('WAAPI unavailable');let resolve,reject;const job={target:this,keyframes,options,finished:new Promise((yes,no)=>{resolve=yes;reject=no;}),complete(){resolve();},reject(){reject(Error('animation failed'));},cancel(){this.cancelled=true;reject(Error('cancelled'));}};this.ownerDocument.animations.push(job);return job;}
}
function fixture(t,{motion=true,cached=true,animate=true}={}){
  const document=new Events(),window=new Events();Object.assign(document,{window,cached,decodes:[],animations:[],modalShows:0});Object.assign(window,{innerWidth:1000,innerHeight:800,getComputedStyle:node=>({transform:node.computedTransform??'none',opacity:'1'})});
  document.createElement=tag=>{const node=new Element(tag,document);if(!animate)node.animate=undefined;return node;};document.body=document.createElement('body');document.activeElement=document.body;
  const trigger=document.createElement('button');document.body.append(trigger);trigger.focus();
  const source=document.createElement('img');source.src=PNG;source.naturalWidth=1200;source.naturalHeight=800;source.rect={left:100,top:200,width:120,height:80};document.body.append(source);
  const cues=[],viewer=createPhotoViewer({document,window,reducedMotion:()=>!motion,onCue:name=>cues.push(name)});t.after(()=>viewer.destroy());
  const dialog=()=>document.body.querySelector('.photo-viewer'),image=()=>dialog()?.querySelector('.photo-viewer-image');
  return {document,window,trigger,source,cues,viewer,dialog,image,open:options=>viewer.open({src:PNG,alt:'รูปประกอบเควส',source,...options})};
}

test('invalid or nonraster sources cannot open a dialog or issue a lift cue',t=>{
  const f=fixture(t);for(const src of ['https://example.test/a.png','data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,YWJjZA==','data:image/png;base64,iVBORw0KGgo'])assert.equal(f.viewer.open({src}),false);
  assert.equal(f.viewer.isOpen,false);assert.deepEqual(f.cues,[]);assert.equal(f.document.modalShows,0);
});

test('one native modal shows the uncropped intrinsic ratio, plain caption, close focus and one cue per action',async t=>{
  const f=fixture(t,{motion:false});assert.equal(f.open({alt:'<img src=x onerror=alert(1)>'}),true);const dialog=f.dialog(),image=f.image();
  assert.equal(dialog.modal,true);assert.equal(f.viewer.isOpen,true);assert.equal(f.document.activeElement,dialog.querySelector('.photo-viewer-close'));assert.equal(image.alt,'<img src=x onerror=alert(1)>');assert.equal(dialog.querySelector('.photo-viewer-caption').textContent,'<img src=x onerror=alert(1)>');assert.equal(dialog.querySelectorAll('img').length,1);
  assert.equal(parseFloat(image.style.width)/parseFloat(image.style.height),1.5);assert.ok(parseFloat(image.style.width)<=928);assert.ok(parseFloat(image.style.height)<=656);
  f.open();assert.equal(f.document.modalShows,1);assert.deepEqual(f.cues,['paperPick']);assert.equal(f.viewer.close(),true);assert.equal(f.viewer.isOpen,false);assert.equal(f.document.activeElement,f.trigger);assert.deepEqual(f.cues,['paperPick','paperDrop']);assert.equal(f.viewer.close(),false);
  assert.equal(f.open(),true);assert.equal(f.dialog(),dialog);assert.equal(f.document.body.querySelectorAll('dialog').length,1);await flush();
});

test('lift and return use a uniform scale and resolve the source again after a paper rerender',async t=>{
  const f=fixture(t);let current=f.source;f.open({getSource:()=>current});const opening=f.document.animations[0];
  const transform=opening.keyframes[0].transform;assert.match(transform,/translate\(-340px, -160px\) scale\(/);assert.ok(Math.abs(Number(transform.match(/scale\(([^)]+)\)/)[1])-120/928)<1e-9);assert.equal(f.source.style.visibility,'hidden');
  opening.complete();await flush();assert.equal(f.image().style.transform,'none');
  f.source.remove();current=f.document.createElement('img');current.src=PNG;current.rect={left:700,top:100,width:180,height:120};f.document.body.append(current);
  assert.equal(f.viewer.close(),true);const returning=f.document.animations.at(-1);assert.match(returning.keyframes.at(-1).transform,/translate\(290px, -240px\) scale\(/);assert.equal(current.style.visibility,'hidden');assert.equal(f.viewer.isOpen,true);
  returning.complete();await flush();assert.equal(f.viewer.isOpen,false);assert.equal(current.style.visibility??'','');assert.equal(f.source.style.visibility??'','');assert.equal(f.document.activeElement,f.trigger);
});

test('Escape, close button and backdrop close while image clicks retain the modal',t=>{
  const f=fixture(t,{motion:false});f.open();f.dialog().emit('click',{target:f.image()});assert.equal(f.viewer.isOpen,true);
  const event=f.dialog().emit('cancel');assert.equal(event.defaultPrevented,true);assert.equal(f.viewer.isOpen,false);
  f.open();f.dialog().querySelector('.photo-viewer-close').emit('click');assert.equal(f.viewer.isOpen,false);
  f.open();f.dialog().emit('click');assert.equal(f.viewer.isOpen,false);assert.equal(f.document.activeElement,f.trigger);assert.deepEqual(f.cues,['paperPick','paperDrop','paperPick','paperDrop','paperPick','paperDrop']);
});

test('a disappeared or changed source fades out instead of returning to an unrelated image',async t=>{
  const f=fixture(t);f.open();f.document.animations[0].complete();await flush();f.source.src=JPEG;f.viewer.close();const returning=f.document.animations.at(-1);
  assert.equal(returning.keyframes.at(-1).opacity,0);assert.equal(returning.keyframes.at(-1).transform,'none');returning.reject();await flush();assert.equal(f.viewer.isOpen,false);assert.equal(f.source.style.visibility??'','');
});

test('an image whose pending src has changed cannot be a return destination even while currentSrc is stale',async t=>{
  const f=fixture(t);f.open();f.document.animations[0].complete();await flush();f.source.src=JPEG;f.source.currentSrc=PNG;f.viewer.close();
  assert.equal(f.document.animations.at(-1).keyframes.at(-1).opacity,0);
});

test('closing after the initiating control was replaced returns focus to the fresh source image without leaving a tab stop',t=>{
  const f=fixture(t,{motion:false});let current=f.source;f.open({getSource:()=>current});f.trigger.remove();f.source.remove();current=f.document.createElement('img');current.src=PNG;current.rect={left:500,top:100,width:120,height:80};f.document.body.append(current);
  f.viewer.close();assert.equal(f.document.activeElement,current);assert.equal(current.getAttribute('tabindex'),null);
});

test('closing or replacing an undecoded image prevents stale decodes and load events from reopening it',async t=>{
  const f=fixture(t,{cached:false});f.open();const image=f.image(),oldDecode=f.document.decodes[0];assert.equal(f.document.animations.length,0);assert.notEqual(f.source.style.visibility,'hidden');
  f.viewer.close();oldDecode.resolve();image.complete=true;image.naturalWidth=1200;image.naturalHeight=800;image.emit('load');await flush();assert.equal(f.viewer.isOpen,false);assert.equal(f.document.animations.length,0);
  f.open();const staleDecode=f.document.decodes.at(-1);f.open({src:JPEG});staleDecode.resolve();await flush();assert.equal(f.document.animations.length,0);
  image.complete=true;image.naturalWidth=800;image.naturalHeight=1200;image.emit('load');await flush();assert.equal(image.src,JPEG);assert.equal(parseFloat(image.style.width)/parseFloat(image.style.height),2/3);assert.equal(f.document.animations.length,1);
});

test('decode rejection falls back to load and a broken image closes with no retained source visibility',async t=>{
  const f=fixture(t,{cached:false});f.open();f.document.decodes[0].reject(Error('decode deferred'));await flush();assert.equal(f.viewer.isOpen,true);
  f.image().complete=true;f.image().naturalWidth=1200;f.image().naturalHeight=800;f.image().emit('load');assert.equal(f.document.animations.length,1);f.image().emit('error');await flush();assert.equal(f.viewer.isOpen,false);assert.equal(f.source.style.visibility??'','');
});

test('rapid close and reopen cannot let cancelled animation callbacks close the new image',async t=>{
  const f=fixture(t);f.open();const opening=f.document.animations[0];f.image().computedTransform='matrix(0.5, 0, 0, 0.5, -10, -20)';f.viewer.close();const closing=f.document.animations.at(-1);assert.equal(opening.cancelled,true);assert.equal(closing.keyframes[0].transform,'matrix(0.5, 0, 0, 0.5, -10, -20)');
  f.open({src:JPEG});assert.equal(closing.cancelled,true);opening.complete();closing.complete();await flush();assert.equal(f.viewer.isOpen,true);assert.equal(f.image().src,JPEG);assert.deepEqual(f.cues,['paperPick','paperDrop','paperPick']);
  f.document.animations.at(-1).reject();await flush();assert.equal(f.viewer.isOpen,true);assert.equal(f.image().style.transform,'none');f.viewer.close();f.document.animations.at(-1).cancel();await flush();assert.equal(f.viewer.isOpen,false);
});

test('opening the same raster from a different paper replaces the return source safely',async t=>{
  const f=fixture(t);f.open();const first=f.document.animations[0],replacement=f.document.createElement('img');replacement.src=PNG;replacement.rect={left:700,top:100,width:180,height:120};f.document.body.append(replacement);
  f.open({source:replacement});assert.equal(first.cancelled,true);assert.equal(f.source.style.visibility??'','');assert.equal(replacement.style.visibility,'hidden');assert.equal(f.document.modalShows,1);
  f.document.animations.at(-1).complete();await flush();f.viewer.close();assert.match(f.document.animations.at(-1).keyframes.at(-1).transform,/translate\(290px, -240px\) scale\(/);
});

test('resize settles a lift, refits the image and safely completes a pending return',async t=>{
  const f=fixture(t);f.open();const opening=f.document.animations[0];f.window.innerWidth=400;f.window.innerHeight=500;f.window.emit('resize');await flush();assert.equal(opening.cancelled,true);assert.equal(f.viewer.isOpen,true);assert.ok(parseFloat(f.image().style.width)<=328);assert.ok(parseFloat(f.image().style.height)<=356);
  f.viewer.close();f.window.emit('resize');await flush();assert.equal(f.viewer.isOpen,false);assert.equal(f.source.style.visibility??'','');
});

test('missing or failing WAAPI and reduced motion complete actions without stale animations',async t=>{
  for(const options of [{animate:false},{motion:false},{}]){const f=fixture(t,options);if(options.animate!==false&&options.motion!==false)f.document.failAnimation=true;assert.equal(f.open(),true);assert.equal(f.viewer.isOpen,true);assert.equal(f.viewer.close(),true);await flush();assert.equal(f.viewer.isOpen,false);assert.equal(f.source.style.visibility??'','');}
});

test('failed native modal opening preserves focus, source and cues',t=>{
  const f=fixture(t);f.document.failModal=true;assert.equal(f.open(),false);assert.equal(f.viewer.isOpen,false);assert.equal(f.document.activeElement,f.trigger);assert.equal(f.source.style.visibility??'','');assert.deepEqual(f.cues,[]);
});

test('destroy removes listeners, pending decodes and animations and leaves future actions inert',async t=>{
  const f=fixture(t);f.open();const dialog=f.dialog(),image=f.image(),button=dialog.querySelector('.photo-viewer-close'),animation=f.document.animations[0];f.viewer.destroy();assert.equal(animation.cancelled,true);assert.equal(f.source.style.visibility??'','');assert.equal(f.document.activeElement,f.trigger);assert.equal(dialog.isConnected,false);assert.equal(f.viewer.isOpen,false);
  for(const target of [dialog,f.window,image,button])for(const listeners of target.listeners.values())assert.equal(listeners.size,0);
  animation.complete();await flush();assert.equal(f.open(),false);assert.equal(f.viewer.close(),false);assert.deepEqual(f.cues,['paperPick']);
  const pending=fixture(t,{cached:false});pending.open();const decode=pending.document.decodes[0];pending.viewer.destroy();decode.resolve();await flush();assert.equal(pending.viewer.isOpen,false);assert.equal(pending.document.animations.length,0);
});
