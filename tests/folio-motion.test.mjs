import test from 'node:test';
import assert from 'node:assert/strict';
import {createFolioMotion} from '../dist/folio-motion.mjs';

// Node has no DOM. This small boundary fixture keeps clone identity, attributes,
// descendants and geometry observable while the real controller owns all motion.
class Element {
  constructor(tagName='div',attributes={},children=[]) {
    this.tagName=tagName;this.attrs=new Map(Object.entries(attributes));
    this.children=[];this.parentNode=null;this.style={};this.hidden=false;this.inert=false;
    this.textContent='';this.layoutReads=[];this._scrollTop=0;this._scrollLeft=0;
    this.classList={
      contains:name=>this.className.split(/\s+/).includes(name),
      add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(' ');},
      remove:(...names)=>{this.className=this.className.split(/\s+/).filter(name=>!names.includes(name)).join(' ');},
    };
    for(const child of children)this.append(child);
  }
  get className(){return this.getAttribute('class')||'';}
  set className(value){this.setAttribute('class',value);}
  get attributes(){return [...this.attrs].map(([name,value])=>({name,value}));}
  get isConnected(){return this.tagName==='body'||Boolean(this.parentNode?.isConnected);}
  get scrollTop(){return this._scrollTop;}
  set scrollTop(value){if(this.isConnected)this._scrollTop=value;}
  get scrollLeft(){return this._scrollLeft;}
  set scrollLeft(value){if(this.isConnected)this._scrollLeft=value;}
  get offsetWidth(){this.layoutReads.push(this.classList.contains('is-unfolding'));return 760;}
  getAttribute(name){return this.attrs.get(name)??null;}
  setAttribute(name,value){this.attrs.set(name,String(value));}
  removeAttribute(name){this.attrs.delete(name);}
  querySelectorAll(selector){assert.equal(selector,'*');return this.children.flatMap(child=>[child,...child.querySelectorAll('*')]);}
  append(child){child.remove();this.children.push(child);child.parentNode=this;}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.parentNode=null;}
  getBoundingClientRect(){return {left:237.5,top:90.25,width:760,height:570};}
  cloneNode(deep){
    const clone=new Element(this.tagName,Object.fromEntries(this.attrs),deep?this.children.map(child=>child.cloneNode(true)):[]);
    Object.assign(clone.style,this.style);clone.hidden=this.hidden;clone.textContent=this.textContent;return clone;
  }
}

function fixture({reduced=false,onCue}={}) {
  let nextTimer=0;
  const timers=new Map(),body=new Element('body');
  const outer=new Element('div',{class:'folio-cover-outer'},[
    new Element('span',{class:'folio-cover-label'}),new Element('span',{class:'folio-cord'}),
  ]);
  outer.children[0].textContent='Expedition notes';
  const cover=new Element('div',{class:'folder-window-cover','aria-hidden':'true'},[
    outer,new Element('div',{class:'folio-cover-inner'}),
  ]);
  const list=new Element('div',{id:'folder-quest-list',class:'folder-window-list'},[
    new Element('div',{class:'folio-index-row is-selected'},[
      new Element('div',{class:'folder-quest-grip','data-quest-drag':'quest-9'}),
      new Element('button',{class:'folio-index-pick','data-folio-select':'quest-9','aria-current':'true'}),
    ]),
  ]);
  const paper=new Element('article',{class:'quest-paper','data-folio-paper':'quest-9'},[
    new Element('div',{class:'quest-top drag-handle','data-quest-drag':'quest-9'}),
    new Element('div',{class:'quest-ink-layer'}),
  ]);
  const preview=new Element('div',{class:'folio-paper-viewport'},[
    new Element('i',{class:'folio-stack-sheet'}),new Element('i',{class:'folio-stack-sheet'}),
    new Element('div',{class:'folio-paper-stage'},[paper]),
  ]);
  const panel=new Element('section',{id:'folder-window',class:'folder-window folio-spread folder-sage','data-folder-target':'folder-7'},[
    cover,new Element('div',{class:'folio-spine'}),
    new Element('section',{class:'folio-left'},[
      new Element('header',{class:'folder-window-header'}),
      new Element('div',{class:'folio-index-paper'},[
        new Element('input',{id:'folder-search',class:'folder-search',autofocus:''}),list,
      ]),new Element('div',{class:'folder-window-drop'}),
    ]),
    new Element('section',{class:'folio-right'},[
      new Element('div',{class:'folio-preview-heading'}),preview,
      new Element('div',{class:'folio-paper-actions'},[
        new Element('button',{'data-action':'edit','data-quest-id':'quest-9',id:'quest-control'}),
      ]),new Element('p',{class:'folder-window-footnote'}),
    ]),
  ]);
  body.append(panel);
  const motion=createFolioMotion({document:{body},reducedMotion:()=>reduced,onCue,
    setTimeout(callback,delay){const id=nextTimer++;timers.set(id,{callback,delay});return id;},
    clearTimeout(id){timers.delete(id);},
  });
  return {motion,panel,body,timers,list,preview,paper,
    pending(){assert.equal(timers.size,1,'one visual cleanup must be scheduled');return [...timers.values()][0];},
    fire(){assert.equal(timers.size,1,'one visual cleanup must be scheduled');const [id,timer]=timers.entries().next().value;timers.delete(id);timer.callback();},
    ghosts:()=>body.children.filter(node=>node.classList.contains('folio-closing-ghost')),
  };
}

test('opening flushes a settled panel and removes its temporary class after the animation',()=>{
  const h=fixture();h.panel.classList.add('is-unfolding');h.motion.open(h.panel);
  assert.deepEqual(h.panel.layoutReads,[false]);
  assert.equal(h.panel.classList.contains('is-unfolding'),true);
  assert.equal([...h.timers.values()][0].delay,1020);
  h.fire();assert.equal(h.panel.classList.contains('is-unfolding'),false);assert.equal(h.timers.size,0);
});

test('reopening cancels the earlier timer and its queued callback cannot end the new opening',()=>{
  const h=fixture();h.motion.open(h.panel);const stale=h.pending().callback;
  h.motion.open(h.panel);assert.equal(h.timers.size,1);stale();
  assert.equal(h.panel.classList.contains('is-unfolding'),true);
  h.fire();assert.equal(h.panel.classList.contains('is-unfolding'),false);
});

test('finishing an opening immediately releases its timer and all affected panel classes',()=>{
  const h=fixture();h.motion.open(h.panel);const stale=h.pending().callback;
  const replacement=new Element('section',{class:'is-unfolding'});
  h.motion.finishOpen(replacement);stale();
  assert.equal(h.panel.classList.contains('is-unfolding'),false);
  assert.equal(replacement.classList.contains('is-unfolding'),false);assert.equal(h.timers.size,0);
  assert.doesNotThrow(()=>h.motion.finishOpen());
});

test('closing settles an unfinished opening and retains an inert visual copy at its screen position',()=>{
  const h=fixture();h.motion.open(h.panel);const staleOpening=h.pending().callback;
  h.motion.close(h.panel);const [ghost]=h.ghosts();
  assert.ok(ghost);assert.notEqual(ghost,h.panel);
  assert.equal(h.panel.classList.contains('is-unfolding'),false);
  assert.equal(ghost.classList.contains('is-unfolding'),false);assert.equal(ghost.classList.contains('folder-sage'),true);
  assert.equal(ghost.children[0].children[0].children[0].textContent,'Expedition notes');
  assert.equal(ghost.children[0].children[0].children[1].className,'folio-cord');
  assert.equal(ghost.children[0].children[1].className,'folio-cover-inner');
  assert.equal(ghost.children[2].className,'folio-left');assert.equal(ghost.children[3].className,'folio-right');
  assert.equal(ghost.inert,true);assert.equal(ghost.getAttribute('aria-hidden'),'true');assert.equal(ghost.getAttribute('role'),'presentation');
  for(const node of [ghost,...ghost.querySelectorAll('*')]){
    assert.equal(node.getAttribute('id'),null);
    assert.ok(node.attributes.every(attr=>!attr.name.startsWith('data-')));
    assert.equal(node.getAttribute('autofocus'),null);
  }
  assert.equal(ghost.style.position,'fixed');assert.equal(ghost.style.left,'237.5px');assert.equal(ghost.style.top,'90.25px');
  assert.equal(ghost.style.width,'760px');assert.equal(ghost.style.height,'570px');assert.equal(ghost.style.margin,'0');
  assert.equal(ghost.style.transform,'none');assert.equal(ghost.style.pointerEvents,'none');
  staleOpening();assert.equal(h.ghosts().length,1);
  assert.equal(h.timers.size,1);assert.equal([...h.timers.values()][0].delay,880);
  h.fire();assert.equal(h.ghosts().length,0);assert.equal(h.timers.size,0);
});

test('motion never changes live panel visibility, content, ids or app routing data',()=>{
  const h=fixture(),originalChildren=[...h.panel.children],originalAttrs=[...h.panel.attrs];
  h.motion.close(h.panel);h.fire();h.motion.open(h.panel);h.motion.finishOpen(h.panel);
  assert.equal(h.panel.hidden,false);assert.deepEqual([...h.panel.attrs],originalAttrs);assert.deepEqual(h.panel.children,originalChildren);
  h.panel.hidden=true;h.motion.close(h.panel);h.motion.open(h.panel);h.motion.finishOpen(h.panel);
  assert.equal(h.panel.hidden,true);assert.equal(h.ghosts().length,0);assert.equal(h.timers.size,0);
});

test('the refolding cover retains its wheel color while drop and action attributes are removed',()=>{
  const h=fixture();
  h.panel.classList.add('folder-dye-235-pearl');
  h.panel.setAttribute('data-leather-tone','pearl');
  h.panel.style['--leather-hue']='235';

  h.motion.close(h.panel);

  const [ghost]=h.ghosts();
  assert.equal(ghost.getAttribute('data-leather-tone'),'pearl');
  assert.equal(ghost.style['--leather-hue'],'235');
  assert.equal(ghost.getAttribute('data-folder-target'),null);
  assert.ok(ghost.querySelectorAll('*').every(node=>node.getAttribute('data-action')===null));
  assert.equal(ghost.inert,true);
});

test('closing preserves the visible scrolled rows after attaching the copy without moving the live list',()=>{
  const h=fixture(),list=h.list;list.scrollTop=145;list.scrollLeft=7;
  h.motion.close(h.panel);const copiedList=h.ghosts()[0].querySelectorAll('*').find(node=>node.className==='folder-window-list');
  assert.equal(copiedList.scrollTop,145);assert.equal(copiedList.scrollLeft,7);
  assert.equal(list.scrollTop,145);assert.equal(list.scrollLeft,7);
  h.motion.cancelClose();assert.equal(list.scrollTop,145);assert.equal(list.scrollLeft,7);
});

test('closing retains the scaled sheet, ink and independently scrolled mobile preview',()=>{
  const h=fixture();
  Object.assign(h.panel.style,{'--folio-paper-scale':'.8333333333','--folio-paper-width':'250px','--folio-paper-height':'291.666667px'});
  Object.assign(h.paper.children[1].style,{'--stamp-x':'42%','--stamp-y':'61%'});
  h.preview.scrollLeft=93;h.preview.scrollTop=12;
  h.motion.close(h.panel);
  const [ghost]=h.ghosts(),descendants=ghost.querySelectorAll('*');
  const preview=descendants.find(node=>node.className==='folio-paper-viewport');
  const paper=descendants.find(node=>node.className==='quest-paper');
  assert.equal(ghost.style['--folio-paper-scale'],'.8333333333');
  assert.equal(ghost.style['--folio-paper-width'],'250px');
  assert.equal(ghost.style['--folio-paper-height'],'291.666667px');
  assert.equal(preview.scrollLeft,93);assert.equal(preview.scrollTop,12);
  assert.equal(paper.children[1].style['--stamp-x'],'42%');assert.equal(paper.children[1].style['--stamp-y'],'61%');
  assert.equal(paper.getAttribute('data-folio-paper'),null);assert.equal(h.paper.getAttribute('data-folio-paper'),'quest-9');
  h.motion.cancelClose();assert.equal(h.preview.scrollLeft,93);assert.equal(h.preview.scrollTop,12);
});

test('reopening removes a closing copy and stale close cleanup cannot affect the live panel',()=>{
  const h=fixture();h.motion.close(h.panel);const staleClose=h.pending().callback;
  h.motion.open(h.panel);assert.equal(h.ghosts().length,0);assert.equal(h.timers.size,1);
  staleClose();assert.equal(h.panel.hidden,false);assert.equal(h.panel.classList.contains('is-unfolding'),true);
  h.fire();assert.equal(h.timers.size,0);
});

test('repeated closes keep only one copy and cancelClose releases it without stale cleanup',()=>{
  const h=fixture();h.motion.close(h.panel);const stale=h.pending().callback,old=h.ghosts()[0];
  h.motion.close(h.panel);const current=h.ghosts()[0];assert.notEqual(current,old);
  stale();assert.deepEqual(h.ghosts(),[current]);assert.equal(h.timers.size,1);
  h.motion.cancelClose();h.motion.cancelClose();assert.equal(h.ghosts().length,0);assert.equal(h.timers.size,0);
});

test('reduced motion opens and closes immediately without layout reads, timers or copies',()=>{
  const h=fixture({reduced:true});h.panel.classList.add('is-unfolding');
  h.motion.open(h.panel);h.motion.close(h.panel);
  assert.equal(h.panel.classList.contains('is-unfolding'),false);assert.deepEqual(h.panel.layoutReads,[]);
  assert.equal(h.timers.size,0);assert.equal(h.ghosts().length,0);assert.equal(h.panel.hidden,false);
});

test('missing panels and failed visual cloning cannot disrupt the caller or retain effects',()=>{
  const h=fixture();h.motion.open(h.panel);assert.equal(h.panel.classList.contains('is-unfolding'),true);
  h.panel.cloneNode=()=>{throw new Error('Visual copy unavailable');};
  assert.doesNotThrow(()=>h.motion.close(h.panel));assert.equal(h.timers.size,0);assert.equal(h.ghosts().length,0);
  assert.equal(h.panel.classList.contains('is-unfolding'),false);assert.equal(h.panel.hidden,false);
  assert.doesNotThrow(()=>{h.motion.open(null);h.motion.close(null);h.motion.finishOpen(null);h.motion.cancelClose();});
});

test('folio cues follow the cord and cover phases without being cut off by natural cleanup',()=>{
  const cues=[],h=fixture({onCue:(name,options)=>cues.push({name,...options})});
  h.motion.open(h.panel);
  assert.deepEqual(cues.map(({name,delay})=>[name,delay]),[['cordUntie',0],['folderOpen',180]]);
  assert.equal(cues[0].signal,cues[1].signal);assert.equal(cues[0].signal.aborted,false);
  h.fire();assert.equal(cues[0].signal.aborted,false);
  h.motion.close(h.panel);
  assert.deepEqual(cues.slice(2).map(({name,delay})=>[name,delay]),[['folderClose',130],['cordTie',690]]);
  h.fire();assert.equal(cues[2].signal.aborted,false);
});

test('replacing or cancelling folio motion aborts only the retired cue group',()=>{
  const cues=[],h=fixture({onCue:(name,options)=>cues.push({name,...options})});
  h.motion.open(h.panel);const first=cues[0].signal;
  h.motion.close(h.panel);const closing=cues[2].signal;
  assert.equal(first.aborted,true);assert.equal(closing.aborted,false);
  h.motion.open(h.panel);const current=cues[4].signal;
  assert.equal(closing.aborted,true);assert.equal(current.aborted,false);
  h.motion.finishOpen();assert.equal(current.aborted,true);
});

test('reduced motion emits each folio cue immediately without scheduling visuals',()=>{
  const cues=[],h=fixture({reduced:true,onCue:(name,options)=>cues.push({name,...options})});
  h.motion.open(h.panel);h.motion.close(h.panel);
  assert.deepEqual(cues.map(({name,delay})=>[name,delay]),[['cordUntie',0],['folderOpen',0],['folderClose',0],['cordTie',0]]);
  assert.ok(cues.every(cue=>!cue.signal.aborted));assert.equal(h.timers.size,0);
  h.panel.hidden=true;h.motion.open(h.panel);h.motion.close(h.panel);assert.equal(cues.length,4);
});

test('a failing optional cue callback cannot interrupt folio motion',async()=>{
  for(const onCue of [()=>{throw new Error('Sound unavailable');},()=>Promise.reject(new Error('Sound unavailable'))]){
    const h=fixture({onCue});h.motion.open(h.panel);
    assert.equal(h.panel.classList.contains('is-unfolding'),true);h.fire();
    h.motion.close(h.panel);assert.equal(h.ghosts().length,1);h.fire();
    await Promise.resolve();
  }
});
