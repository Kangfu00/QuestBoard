import test from 'node:test';
import assert from 'node:assert/strict';
import {PAPER} from '../dist/paper-format.mjs';
const module=await import('../dist/stamp-surfaces.mjs').catch(()=>({}));
const call=(name,...args)=>{assert.equal(typeof module[name],'function',`${name} is exported`);return module[name](...args);};
const resolve=target=>call('resolveStampSurface',target);

class Element {
  constructor(tag='div',classes='',attrs={}){
    this.tagName=tag.toUpperCase();this.classes=new Set(classes.split(/\s+/).filter(Boolean));this.attrs=new Map();this.dataset={};this.children=[];this.parentElement=null;this.hidden=false;this.inert=false;this.open=false;this.transform='none';
    this.classList={contains:name=>this.classes.has(name),add:name=>this.classes.add(name),remove:name=>this.classes.delete(name)};
    for(const [name,value] of Object.entries(attrs))this.setAttribute(name,value);
  }
  setAttribute(name,value){this.attrs.set(name,String(value));if(name==='id')this.id=String(value);if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=String(value);}
  getAttribute(name){return this.attrs.get(name)??null;}
  hasAttribute(name){return this.attrs.has(name);}
  append(...nodes){for(const node of nodes){node.remove();node.parentElement=this;this.children.push(node);}}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=null;}
  replaceChildren(...nodes){for(const node of [...this.children])node.remove();this.append(...nodes);}
  matches(selector){return selector.split(',').some(part=>{part=part.trim();return part.startsWith('.')?this.classes.has(part.slice(1)):part.startsWith('#')?this.id===part.slice(1):this.tagName.toLowerCase()===part;});}
  closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
  querySelectorAll(selector){const found=[];for(const child of this.children){if(child.matches(selector))found.push(child);found.push(...child.querySelectorAll(selector));}return found;}
  get isConnected(){return !!this.closest('body');}
  getBoundingClientRect(){return this.rect??{left:0,top:0,width:PAPER.width,height:PAPER.height};}
}
const node=(tag,classes,attrs)=>new Element(tag,classes,attrs);
const paper=(id,kind='board')=>node('article','quest-paper',kind==='reader'?{}:{[kind==='folio'?'data-folio-paper':'data-id']:id});
function board(id='quest'){
  const body=node('body'),host=node('div','',{'id':'board-canvas'}),sheet=paper(id);body.append(host);host.append(sheet);return {body,host,paper:sheet};
}
function reader(id='quest',body=node('body')){
  const host=node('dialog','paper-reader',{'data-reader-quest':id,'data-side':'front'}),scene=node('div','paper-reader-scene',{'data-side':'front'}),live=node('div','paper-reader-live'),front=node('div','reader-face reader-front'),sheet=paper(id,'reader');
  host.open=true;body.append(host);host.append(scene);scene.append(live);live.append(front);front.append(sheet);return {body,host,scene,live,front,paper:sheet};
}
function folio(id='quest',body=node('body')){
  const host=node('section','folder-window folio-spread',{'data-open-folder':'folder'}),right=node('section','folio-right'),viewport=node('div','folio-paper-viewport'),stage=node('div','folio-paper-stage'),sheet=paper(id,'folio');
  body.append(host);host.append(right);right.append(viewport);viewport.append(stage);stage.append(sheet);return {body,host,right,viewport,stage,paper:sheet};
}

test('resolves only the actual board, live front reader and selected folio paper',()=>{
  for(const [kind,make] of [['board',board],['reader',reader],['folio',folio]]){
    const view=make(),text=node('span','quest-description');view.paper.append(text);
    assert.deepEqual(resolve(text),{id:'quest',paper:view.paper,kind,host:view.host});
  }
  const detached=paper('quest');assert.equal(resolve(detached),null);
  const body=node('body'),drawer=node('div','storage-plane');body.append(drawer);drawer.append(paper('quest'));assert.equal(resolve(drawer.children[0]),null);
  assert.equal(resolve(null),null);
});

test('reader back, closed, turning, hidden or inert front never becomes a target',()=>{
  for(const invalidate of [v=>{v.host.open=false;},v=>{v.host.dataset.side='back';},v=>{v.scene.dataset.side='back';},v=>v.scene.classList.add('paper-is-turning'),v=>{v.front.inert=true;},v=>{v.host.hidden=true;},v=>v.scene.setAttribute('aria-hidden','true')]){
    const view=reader();invalidate(view);assert.equal(resolve(view.paper),null);
  }
  const view=reader(),ghost=node('div','paper-turn-ghost'),copy=node('div','reader-front'),sheet=paper('quest','reader');view.scene.append(ghost);ghost.append(copy);copy.append(sheet);assert.equal(resolve(sheet),null);
  const back=node('div','reader-back'),backPaper=paper('quest','reader');view.live.append(back);back.append(backPaper);assert.equal(resolve(backPaper),null);
});

test('folio ignores index copies, hidden stages and closing or dragged ghosts',()=>{
  for(const invalidate of [v=>{v.stage.hidden=true;},v=>v.host.classList.add('folio-closing-ghost'),v=>{v.host.inert=true;},v=>{v.paper.classList.add('quest-drag-ghost');},v=>v.host.setAttribute('hidden','')]){
    const view=folio();invalidate(view);assert.equal(resolve(view.paper),null);
  }
  const view=folio(),index=node('div','folder-window-list'),copy=paper('quest','folio');view.host.append(index);index.append(copy);assert.equal(resolve(copy),null);
});

test('paper controls cannot stamp, while printed titles and headers can',()=>{
  for(const make of [board,reader,folio]){
    const view=make();
    for(const [tag,classes,attrs] of [['button','paper-turn-corner',{}],['button','quest-bundle-select',{}],['button','other-control',{}],['textarea','back-notes',{}],['input','',{}],['a','',{}],['label','',{}],['div','',{'contenteditable':'true'}],['div','',{'role':'button'}]]){
      const control=node(tag,classes,attrs),child=node('span');view.paper.append(control);control.append(child);assert.equal(resolve(child),null,`${tag}.${classes}`);
    }
    for(const [tag,classes] of [['button','quest-title'],['div','quest-top'],['span','quest-title']]){
      const printed=node(tag,classes);view.paper.append(printed);assert.equal(resolve(printed)?.paper,view.paper);
    }
  }
  const view=reader(),notes=node('textarea','back-notes'),turn=node('button','reader-turn');view.scene.append(notes,turn);assert.equal(resolve(notes),null);assert.equal(resolve(turn),null);
});

test('hidden or inert ancestors reject board papers as well',()=>{
  for(const flag of ['hidden','inert']){const view=board();view.host[flag]=true;assert.equal(resolve(view.paper),null);}
});

test('refresh stays in the original persistent window despite duplicate quest IDs',()=>{
  const first=reader(),other=reader('quest',first.body),folioCopy=folio('quest',first.body),surface=resolve(first.paper);
  const replacement=paper('quest','reader');first.front.replaceChildren(replacement);
  assert.deepEqual(call('refreshStampSurface',surface),{id:'quest',paper:replacement,kind:'reader',host:first.host});
  assert.notEqual(call('refreshStampSurface',surface).paper,other.paper);assert.notEqual(call('refreshStampSurface',surface).paper,folioCopy.paper);
  first.front.replaceChildren();assert.equal(call('refreshStampSurface',surface),null);
});

test('refresh reacquires board and folio papers and rejects changed or removed hosts',()=>{
  for(const [kind,make] of [['board',board],['folio',folio]]){
    const view=make(),surface=resolve(view.paper),replacement=paper('quest',kind);view.paper.parentElement.replaceChildren(replacement);
    assert.equal(call('refreshStampSurface',surface).paper,replacement);
    view.host.remove();assert.equal(call('refreshStampSurface',surface),null);
  }
  const view=reader(),surface=resolve(view.paper);view.host.dataset.readerQuest='other';assert.equal(call('refreshStampSurface',surface),null);
});

class Matrix {
  constructor(transform){
    const values=transform.slice(transform.indexOf('(')+1,-1).split(',').map(Number);this.is2D=transform.startsWith('matrix(');
    if(this.is2D)[this.a,this.b,this.c,this.d,this.e,this.f]=values;
    else{
      for(let column=1;column<=4;column++)for(let row=1;row<=4;row++)this[`m${column}${row}`]=values[(column-1)*4+row-1];
      [this.a,this.b,this.c,this.d,this.e,this.f]=[this.m11,this.m12,this.m21,this.m22,this.m41,this.m42];
    }
  }
}
const geometry={getComputedStyle:element=>({transform:element.transform}),Matrix};
const point=(surface,pointer)=>call('stampSurfacePoint',surface,pointer,geometry);
const assertPoint=(actual,expected)=>{
  for(const axis of ['x','y'])assert.ok(Math.abs(actual[axis]-expected[axis])<.001,`${axis}: expected ${expected[axis]}, got ${actual[axis]}`);
};

test('canonical ink position inverts the actual rotated and scaled ancestor presentation through body',()=>{
  const view=board();view.paper.transform='matrix(1,0.2,0.3,1.1,10,-5)';view.host.transform='matrix(0,0.6,-0.6,0,15,20)';view.body.transform='matrix(1.25,0,0,1.25,0,0)';
  // Combined linear transform [-.15,.75,-.825,.225], with viewport centre (400,450).
  const width=45+.825*PAPER.height,height=225+.225*PAPER.height;
  view.paper.rect={left:400-width/2,top:450-height/2,width,height};
  assertPoint(point(resolve(view.paper),{x:410.5+.20625*PAPER.height,y:397.5-.05625*PAPER.height}),{x:80,y:87.5});
});

test('reader and folio coordinates use the scaled A4 footprint and save legacy ink positions',()=>{
  for(const make of [reader,folio]){
    const view=make();view.paper.transform='matrix(1.6,0,0,1.6,0,0)';view.paper.rect={left:100,top:200,width:480,height:PAPER.height*1.6};view.host.declaredScale=.5;
    assertPoint(point(resolve(view.paper),{x:228,y:200+PAPER.height*1.6*40/350}),{x:80,y:40});
    assert.deepEqual(point(resolve(view.paper),{x:50,y:200+PAPER.height*1.6+100}),{x:0,y:350});
  }
});

test('live A4 board, reader and folio bottom corners map to the unchanged saved-space edge',()=>{
  for(const make of [board,reader,folio]){
    const view=make();
    assert.deepEqual(point(resolve(view.paper),{x:300,y:PAPER.height}),{x:300,y:350});
    assertPoint(point(resolve(view.paper),{x:150,y:PAPER.height/2}),{x:150,y:175});
    assertPoint(point(resolve(view.paper),{x:75,y:PAPER.height*7/8}),{x:75,y:306.25});
    view.paper.transform='matrix(0,.75,-.75,0,0,0)';
    view.paper.rect={left:100,top:200,width:PAPER.height*.75,height:225};
    assert.deepEqual(point(resolve(view.paper),{x:100,y:425}),{x:300,y:350});
    assertPoint(point(resolve(view.paper),{x:100+PAPER.height*.75/8,y:256.25}),{x:75,y:306.25});
  }
});

test('identity matrix3d is affine but genuine 3D, singular and nonfinite transforms are rejected',()=>{
  const view=reader();view.front.transform='matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)';
  assertPoint(point(resolve(view.paper),{x:80,y:PAPER.height*40/350}),{x:80,y:40});
  for(const transform of ['matrix(0,0,0,0,0,0)','matrix(NaN,0,0,1,0,0)','matrix(1,0,0,1,Infinity,0)','matrix3d(1,0,0.4,0,0,1,0,0,0,0,1,0,0,0,0,1)']){
    view.front.transform=transform;assert.throws(()=>point(resolve(view.paper),{x:80,y:40}),RangeError);
  }
  view.front.transform='none';view.paper.rect={left:0,top:0,width:0,height:0};assert.throws(()=>point(resolve(view.paper),{x:0,y:0}),RangeError);
});
