import test from 'node:test';
import assert from 'node:assert/strict';
import {createPaperReader} from '../dist/paper-reader.mjs';

// A synthetic DOM exercises the real reader/editor without a browser or packages.
const decode=value=>String(value).replace(/&(amp|lt|gt|quot|#39);/g,(_,name)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[name]));
class Events {
  listeners=new Map();
  addEventListener(type,listener){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(listener);}
  removeEventListener(type,listener){this.listeners.get(type)?.delete(listener);}
  emit(type,props={}){const event={type,target:this,preventDefault(){this.defaultPrevented=true;},...props};let node=this;do{node['on'+type]?.(event);for(const listener of [...node.listeners?.get(type)??[]])listener(event);node=props.bubbles===false?null:node.parentElement;}while(node);return event;}
}
class Element extends Events {
  constructor(tag,document){super();this.tagName=tag.toUpperCase();this.ownerDocument=document;this.parentElement=null;this.children=[];this.attrs=new Map();this.dataset={};this.style={setProperty(name,value){this[name]=value;}};this.open=false;this.hidden=false;this.scrollTop=0;this.scrollHeight=300;this.value='';this.text='';this.classList={add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(' ');},remove:(...names)=>{this.className=this.className.split(/\s+/).filter(name=>!names.includes(name)).join(' ');},contains:name=>this.className.split(/\s+/).includes(name),toggle:(name,on)=>{const value=on??!this.classList.contains(name);this.classList[value?'add':'remove'](name);return value;}};}
  get className(){return this.attrs.get('class')??'';}
  set className(value){this.attrs.set('class',value);}
  get attributes(){return [...this.attrs].map(([name,value])=>({name,value}));}
  setAttribute(name,value){this.attrs.set(name,String(value));if(name==='value')this.value=decode(value);if(name==='type')this.type=value;if(name==='checked')this.checked=true;if(name==='hidden')this.hidden=true;if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);}
  getAttribute(name){return this.attrs.get(name)??null;}
  removeAttribute(name){this.attrs.delete(name);if(name.startsWith('data-'))delete this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())];}
  append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=null;}
  replaceWith(node){const parent=this.parentElement,index=parent.children.indexOf(this);parent.children[index]=node;node.parentElement=parent;this.parentElement=null;}
  cloneNode(deep){const clone=new Element(this.tagName,this.ownerDocument);for(const [name,value] of this.attrs)clone.setAttribute(name,value);clone.text=this.text;clone.value=this.value;clone.checked=this.checked;if(deep)for(const child of this.children)clone.append(child.cloneNode(true));return clone;}
  animate(){let finish;const animation={finished:new Promise(resolve=>finish=resolve),complete(){finish();},cancel(){this.cancelled=true;finish();}};this.ownerDocument.animations.push(animation);return animation;}
  get firstElementChild(){return this.children[0]??null;}
  get isConnected(){return this===this.ownerDocument.body||!!this.parentElement?.isConnected;}
  set innerHTML(html){this.children.forEach(node=>node.parentElement=null);this.children=[];this.text='';const stack=[this];for(const token of html.match(/<[^>]+>|[^<]+/g)??[]){if(token.startsWith('</')){stack.pop();continue;}if(token.startsWith('<')){const match=token.match(/^<([\w-]+)([\s\S]*?)\/?\s*>$/);if(!match)continue;const node=new Element(match[1],this.ownerDocument);for(const attr of match[2].matchAll(/([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))node.setAttribute(attr[1],decode(attr[2]??attr[3]??attr[4]??''));stack.at(-1).append(node);if(!['input','br','hr','img'].includes(match[1])&&!token.endsWith('/>'))stack.push(node);}else{const current=stack.at(-1);current.text+=decode(token);if(current.tagName==='TEXTAREA')current.value+=decode(token);}}}
  get innerHTML(){return this.textContent;}
  set textContent(value){this.children=[];this.text=String(value);}
  get textContent(){return this.text+this.children.map(node=>node.textContent).join('');}
  matches(selector){const parts=selector.match(/^(\w+)?(?:\.([\w-]+))?(?:\[([\w-]+)(?:="([^"]*)")?\])?$/);if(!parts)return false;return (!parts[1]||this.tagName===parts[1].toUpperCase())&&(!parts[2]||this.classList.contains(parts[2]))&&(!parts[3]||(this.getAttribute(parts[3])!==null&&(parts[4]===undefined||this.getAttribute(parts[3])===parts[4])));}
  closest(selector){let node=this;while(node){if(node.matches(selector))return node;node=node.parentElement;}return null;}
  querySelectorAll(selector){if(selector.includes(','))return [...new Set(selector.split(',').flatMap(part=>this.querySelectorAll(part)))];const tokens=selector.split(/\s+(?![^\[]*\])/),all=[];const visit=node=>{for(const child of node.children){all.push(child);visit(child);}};visit(this);return all.filter(node=>{if(selector==='*')return true;if(!node.matches(tokens.at(-1)))return false;let parent=node.parentElement;for(let index=tokens.length-2;index>=0;index--){while(parent&&parent!==this&&!parent.matches(tokens[index]))parent=parent.parentElement;if(!parent||parent===this)return false;parent=parent.parentElement;}return true;});}
  querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
  focus(){this.ownerDocument.activeElement=this;this.emit('focusin');}
  setCustomValidity(value){this.validity=value;}
  getBoundingClientRect(){return {left:20,top:20,width:300,height:400,right:320,bottom:420};}
  show(){this.open=true;}
  showModal(){this.modal=true;this.open=true;}
  close(){this.open=false;this.emit('close');}
}
function fixture(t,{reducedMotion=()=>true}={}){
  const document=new Events();document.animations=[];document.createElement=tag=>new Element(tag,document);document.body=document.createElement('body');document.activeElement=document.body;document.visibilityState='visible';
  const window=new Events(),frames=new Map(),observers=[];let frameId=0;window.requestAnimationFrame=fn=>{frames.set(++frameId,fn);return frameId;};window.cancelAnimationFrame=id=>frames.delete(id);window.runFrames=()=>{for(const [id,fn] of [...frames]){frames.delete(id);fn();}};window.ResizeObserver=class {constructor(callback){this.callback=callback;observers.push(this);}observe(target){this.target=target;}disconnect(){this.disconnected=true;}};
  const quests=new Map(['a','b'].map(id=>[id,{id,type:'quest',title:`Quest ${id}`,notes:`notes ${id}`,subquests:[{id:`task-${id}`,text:`step ${id}`,done:false}]}])),saves=[],edits=[],closes=[],failures=new Set(),registrations=new Map();let top=null;
  const windows={get top(){return top;},get size(){return registrations.size;},register(panel,options){assert.equal(options.handle,'.paper-reader-scene');const raise=()=>{top=panel;};const registration={raise,cancelDrag(){},destroy(){registrations.delete(panel);if(top===panel)top=[...registrations.keys()].at(-1)??null;}};registrations.set(panel,{...registration,...options});panel.addEventListener('pointerdown',raise);panel.addEventListener('focusin',raise);return registration;}};
  const reader=createPaperReader({document,window,windows,getQuest:id=>quests.get(id),renderFront:quest=>`<article class="quest-paper board-item drag-handle" id="quest-${quest.id}" data-id="${quest.id}" tabindex="0"><h2 class="quest-title">${quest.title}</h2><button class="paper-turn-corner">turn</button><button class="quest-bundle-select" data-bundle-select="${quest.id}">select</button></article>`,onSave(id,patch){if(failures.has(id))throw Error(`offline ${id}`);saves.push({id,patch});Object.assign(quests.get(id),patch);},onEdit:id=>edits.push(id),onClose:id=>closes.push(id),reducedMotion});
  const panels=()=>document.body.querySelectorAll('.paper-reader'),panel=id=>panels().find(node=>node.dataset.readerQuest===id),input=(id,selector,value)=>{const target=panel(id).querySelector(selector);target.value=value;target.emit('input');return target;};
  t.after(()=>{failures.clear();reader.close();});
  return {document,window,reader,quests,saves,edits,closes,failures,windows,registrations,panels,panel,input,observers,frames};
}
test('two nonmodal readers retain independent drafts, controls, sides and one window per quest',async t=>{
  const f=fixture(t);assert.equal(f.reader.open('a',{back:false}),true);const a=f.panels()[0];assert.equal(f.reader.open('b',{back:false}),true);
  assert.equal(f.panels().length,2);assert.equal(f.windows.size,2);assert.deepEqual(f.reader.ids,['a','b']);assert.equal(a.modal,undefined);
  f.input('a','.back-notes','draft A');f.input('b','.back-notes','draft B');f.panel('a').querySelector('.back-add-input').value='unfinished entry';
  await f.panel('a').querySelector('.reader-turn').onclick();assert.equal(f.panel('a').dataset.side,'back');assert.equal(f.panel('b').dataset.side,'front');
  const before=f.saves.length;assert.equal(f.reader.open('a',{back:false}),true);assert.equal(f.panels().length,2);assert.equal(f.reader.id,'a');assert.equal(f.panel('a'),a);assert.equal(a.querySelector('.back-notes').value,'draft A');assert.equal(a.querySelector('.back-add-input').value,'unfinished entry');assert.equal(a.dataset.side,'back');assert.equal(f.saves.length,before);
  assert.equal(f.reader.flush(),true);assert.deepEqual(f.saves.map(save=>[save.id,save.patch.notes]),[['a','draft A'],['b','draft B']]);assert.equal(f.reader.flush(),true);assert.equal(f.saves.length,2);
  assert.equal(a.querySelector('.reader-front').querySelector('[id]'),null);assert.equal(a.querySelector('.paper-turn-corner'),null);assert.equal(a.querySelector('.quest-bundle-select'),null,'selection controls are not printed into reader documents');
});

test('paper is the draggable surface and the persistent lower corner flips both faces',async t=>{
  const f=fixture(t);f.reader.open('a',{back:false});
  const panel=f.panel('a'),scene=panel.querySelector('.paper-reader-scene'),turn=panel.querySelector('.reader-turn');
  assert.equal(turn.parentElement,scene,'corner remains on paper outside the inert rotating faces');
  assert.equal(panel.querySelector('.paper-reader-toolbar').parentElement,scene,'controls live on the sheet');
  assert.equal(panel.querySelector('.paper-reader-footer'),null);
  assert.equal(turn.classList.contains('reader-turn-corner'),true);
  assert.match(turn.getAttribute('aria-label'),/พลิก.*จดบันทึก/);
  const icon=turn.querySelector('.reader-turn-icon');assert.ok(icon);
  await turn.onclick();assert.equal(panel.dataset.side,'back');
  assert.match(turn.getAttribute('aria-label'),/กลับด้านหน้า/);
  assert.equal(turn.querySelector('.reader-turn-icon'),icon,'flipping retains the corner icon and its focus target');
  assert.equal(turn.closest('.reader-face'),null);
  await turn.onclick();assert.equal(panel.dataset.side,'front');
});
test('closing one reader refuses failed saves and leaves the other draft and input intact',t=>{
  const f=fixture(t);f.reader.open('a',{back:false});f.reader.open('b',{back:false});f.input('a','.back-notes','keep failed A');f.input('b','.back-notes','keep B');f.panel('b').querySelector('.back-add-input').value='new B';f.failures.add('a');
  assert.equal(f.reader.close('a'),false);assert.equal(f.panel('a').open,true);assert.equal(f.panel('a').querySelector('.back-retry').hidden,false);assert.deepEqual(f.saves,[]);
  f.failures.delete('a');assert.equal(f.reader.close('a'),true);assert.equal(f.panel('a'),undefined);assert.deepEqual(f.reader.ids,['b']);assert.equal(f.panel('b').querySelector('.back-notes').value,'keep B');assert.equal(f.panel('b').querySelector('.back-add-input').value,'new B');assert.deepEqual(f.saves.map(save=>save.id),['a']);assert.equal(f.windows.size,1);assert.equal(f.reader.id,'b');
  f.reader.close();assert.deepEqual(f.saves.map(save=>save.id),['a','b']);assert.equal(f.reader.id,null);assert.equal(f.windows.size,0);
});
test('editing closes only that quest, and native manager Escape closes only its registered panel',t=>{
  const f=fixture(t);f.reader.open('a',{back:false});f.reader.open('b',{back:false});f.input('a','.back-notes','A for edit');f.input('b','.back-notes','B untouched');
  f.panel('a').querySelector('.reader-edit').onclick();assert.deepEqual(f.edits,['a']);assert.deepEqual(f.reader.ids,['b']);assert.deepEqual(f.saves.map(save=>save.id),['a']);assert.equal(f.panel('b').querySelector('.back-notes').value,'B untouched');
  assert.equal(f.registrations.get(f.panel('b')).onEscape(),true);assert.deepEqual(f.reader.ids,[]);assert.deepEqual(f.closes,['a','b']);
});
test('blur, pagehide and hidden visibility flush every open reader to its own quest once',t=>{
  const f=fixture(t);f.reader.open('a',{back:false});f.reader.open('b',{back:false});
  for(const [index,event] of ['blur','pagehide','visibilitychange'].entries()){f.input('a','.back-notes',`A${index}`);f.input('b','.back-notes',`B${index}`);if(event==='visibilitychange'){f.document.visibilityState='hidden';f.document.emit(event);}else f.window.emit(event);}
  assert.deepEqual(f.saves.map(save=>[save.id,save.patch.notes]),[['a','A0'],['b','B0'],['a','A1'],['b','B1'],['a','A2'],['b','B2']]);assert.equal(f.reader.close(),true);assert.equal(f.saves.length,6);
});
test('refresh updates rendered quest faces while preserving local notes, pending add and side, and reconciles deletion',async t=>{
  const f=fixture(t);f.reader.open('a',{back:false});f.reader.open('b',{back:false});await f.panel('a').querySelector('.reader-turn').onclick();f.input('a','.back-notes','local pending');f.panel('a').querySelector('.back-add-input').value='pending add';f.quests.get('a').title='Renamed quest A';
  f.reader.refresh();assert.equal(f.panel('a').querySelector('.quest-title').textContent,'Renamed quest A');assert.equal(f.panel('a').querySelector('.back-heading p').textContent,'Renamed quest A');assert.equal(f.panel('a').querySelector('.back-notes').value,'local pending');assert.equal(f.panel('a').querySelector('.back-add-input').value,'pending add');assert.equal(f.panel('a').dataset.side,'back');
  const staleNotes=f.panel('a').querySelector('.back-notes').oninput;f.quests.delete('a');f.reader.refresh();assert.equal(f.panel('a'),undefined);assert.deepEqual(f.reader.ids,['b']);assert.equal(f.windows.size,1);assert.deepEqual(f.saves,[]);f.window.runFrames();assert.deepEqual(f.saves,[]);
  f.quests.set('a',{id:'a',type:'quest',title:'Replacement A',notes:'new notes',subquests:[]});f.reader.open('a',{back:false});staleNotes({target:{value:'deleted draft'}});assert.equal(f.panel('a').querySelector('.back-notes').value,'new notes');f.reader.flush();assert.deepEqual(f.saves,[]);
});
test('closing before the scheduled initial flip prevents stale callbacks, duplicate saves and registrations',async t=>{
  const f=fixture(t);f.reader.open('a');const old=f.panel('a'),staleInput=old.querySelector('.back-notes').oninput;f.input('a','.back-notes','saved A');assert.equal(f.reader.close('a'),true);f.reader.open('a',{back:false});f.window.runFrames();await Promise.resolve();
  staleInput({target:{value:'stale'}});assert.equal(f.panel('a').dataset.side,'front');assert.equal(f.panel('a').querySelector('.back-notes').value,'saved A');assert.deepEqual(f.saves.map(save=>save.patch.notes),['saved A']);assert.equal(f.windows.size,1);
});
test('closing all attempts every reader even when one save is rejected',t=>{
  const f=fixture(t);f.reader.open('a',{back:false});f.reader.open('b',{back:false});f.input('a','.back-notes','fail A');f.input('b','.back-notes','save B');f.failures.add('a');assert.equal(f.reader.close(),false);assert.deepEqual(f.reader.ids,['a']);assert.deepEqual(f.saves.map(save=>save.id),['b']);
});
test('each reader checklist adds, renames, checks and removes only its own quest tasks',t=>{
  const f=fixture(t);f.reader.open('a',{back:false});f.reader.open('b',{back:false});
  f.input('a','.back-task-text','renamed A');const check=f.panel('b').querySelector('input[type="checkbox"]');check.checked=true;check.emit('change');f.reader.flush();
  assert.deepEqual(f.saves.map(save=>[save.id,save.patch.subquests[0].text,save.patch.subquests[0].done]),[['a','renamed A',false],['b','step b',true]]);
  f.panel('a').querySelector('.back-add-input').value='another A';f.panel('a').querySelector('.back-add-form').emit('submit');assert.equal(f.saves.at(-1).id,'a');assert.equal(f.saves.at(-1).patch.subquests[1].text,'another A');assert.equal(f.panel('b').querySelectorAll('.back-task').length,1);
  f.panel('b').querySelector('.back-remove').emit('click');assert.equal(f.saves.at(-1).id,'b');assert.equal(f.saves.at(-1).patch.subquests.length,0);assert.equal(f.panel('a').querySelectorAll('.back-task').length,2);
});
test('simultaneous strip turns finish independently and closing one cancels only its own turn',async t=>{
  const f=fixture(t,{reducedMotion:()=>false});f.reader.open('a',{back:false});f.reader.open('b',{back:false});f.input('a','.back-notes','turn A');f.input('b','.back-notes','turn B');
  const a=f.panel('a').querySelector('.reader-turn').onclick(),b=f.panel('b').querySelector('.reader-turn').onclick();assert.equal(f.document.animations.length,12);assert.equal(f.panel('a').querySelectorAll('.paper-turn-strip').length,5);assert.equal(f.panel('b').querySelectorAll('.paper-turn-strip').length,5);
  assert.equal(f.reader.close('a'),true);assert.ok(f.document.animations.slice(0,6).every(animation=>animation.cancelled));assert.ok(f.document.animations.slice(6).every(animation=>!animation.cancelled));
  f.document.animations[6].complete();await Promise.all([a,b]);assert.equal(f.panel('b').dataset.side,'back');assert.equal(f.panel('b').querySelectorAll('.paper-turn-strip').length,0);assert.deepEqual(f.saves.map(save=>[save.id,save.patch.notes]),[['a','turn A'],['b','turn B']]);
});
test('closing disposes only that reader observer and unregisters lifecycle listeners after the final reader',t=>{
  const f=fixture(t);f.reader.open('a');f.reader.open('b');assert.equal(f.frames.size,2);assert.equal(f.window.listeners.get('blur').size,1);assert.equal(f.observers.length,2);
  f.reader.close('a');assert.equal(f.observers[0].disconnected,true);assert.equal(f.observers[1].disconnected,undefined);assert.equal(f.frames.size,1);assert.equal(f.window.listeners.get('blur').size,1);
  f.reader.close('b');assert.equal(f.observers[1].disconnected,true);assert.equal(f.frames.size,0);assert.equal(f.windows.size,0);assert.equal(f.window.listeners.get('blur').size,0);assert.equal(f.window.listeners.get('pagehide').size,0);assert.equal(f.document.listeners.get('visibilitychange').size,0);
});
