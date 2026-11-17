import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,createFolder,moveQuestToFolder,updateItem} from '../dist/model.mjs';
import {folioSelection,folioMarkup,folioIndexMarkup,folioPaperScale,createFolioView} from '../dist/folio-view.mjs';
const icon=()=>'<svg></svg>';
function quests(){
  let state=createInitialState();const folder=createFolder({name:'Field notes'},state);state.items.push(folder);
  const ids=state.items.filter(item=>item.type==='quest').slice(0,3).map(item=>item.id);
  for(const id of ids)state=moveQuestToFolder(state,id,folder.id);
  return {state,folder,ids};
}
test('folio preserves selection, selects a matching search result and recovers after removing the selected quest',()=>{
  const {state,folder,ids}=quests();
  assert.equal(folioSelection(state.items,folder.id,'',ids[1]).selected.id,ids[1]);
  const only=state.items.find(item=>item.id===ids[2]);
  assert.equal(folioSelection(state.items,folder.id,only.title,ids[1]).selected.id,ids[2]);
  assert.equal(folioSelection(state.items.filter(item=>item.id!==ids[1]),folder.id,'',ids[1]).selected.id,ids[0]);
  assert.equal(folioSelection(state.items,folder.id,'no-such-quest-898989',ids[1]).selected,null);
});
test('leather spread markup keeps the index and full-sheet viewport in persistent separate wings',()=>{
  const html=folioMarkup({id:'f',name:'<bad name>'},{icon,binding:'<span class="folio-binding"></span>'});
  for(const name of ['folio-left','folio-right','folio-spine','folio-cover-outer','folio-cover-inner','folio-paper-stage','folder-window-drop'])assert.ok(html.includes(name));
  assert.ok(html.includes('&lt;bad name&gt;'));assert.ok(!html.includes('<bad name>'));
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);assert.equal(ids.length,new Set(ids).size);
});
test('each folio markup receives unique DOM ids while retaining stable class selectors',()=>{
  const first=folioMarkup({id:'first',name:'First'},{icon,binding:''});
  const second=folioMarkup({id:'second',name:'Second'},{icon,binding:''});
  const ids=html=>[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.ok(ids(first).length>0);assert.equal(ids(first).filter(id=>ids(second).includes(id)).length,0);
  for(const html of [first,second])for(const selector of ['folder-search','folder-window-list','folio-selected-title','folio-page-count','folio-total'])assert.ok(html.includes(selector));
});
test('index titles are escaped and selected rows expose the correct state and drag target',()=>{
  const html=folioIndexMarkup([{id:'q',title:'<img onerror="bad">',status:'active',subquests:[{done:true},{done:false}]}],'q',icon);
  assert.ok(!html.includes('<img'));assert.ok(html.includes('aria-current="true"'));assert.ok(html.includes('data-quest-drag="q"'));assert.ok(html.includes('1/2'));
});
test('A4 paper fitting respects width and height while retaining room for the sheet edges',()=>{
  assert.equal(folioPaperScale(400,600),1.15);
  assert.equal(folioPaperScale(316,500),1);
  assert.equal(folioPaperScale(166,500),.5);
  assert.ok(Math.abs(folioPaperScale(600,228.14285714285714)-.5)<1e-12,'a short viewport fits the entire taller sheet');
  assert.ok(Math.abs(folioPaperScale(316,366)-.8249158249158249)<1e-12,'legacy-height viewports shrink A4 paper');
});
test('a narrow or collapsed folio viewport never forces a minimum paper size that crops its contents',()=>{
  assert.equal(folioPaperScale(31,80),.05);
  assert.equal(folioPaperScale(16,500),0);
  assert.equal(folioPaperScale(500,8),0);
});
function viewHarness(){
  let nodes=new Map(),builds=0;const events=new Map(),cues=[];
  function node(){return {style:{setProperty(key,value){this[key]=value;}},dataset:{},classList:{remove(...names){this.removed=names;}},scrollTop:0,textContent:'',hidden:false,_value:'',get value(){return this._value;},set value(value){this._value=value;this.selectionStart=value.length;this.selectionEnd=value.length;this.scrollLeft=0;},focus(){this.focused=true;},setAttribute(key,value){this[key]=value;},removeAttribute(key){delete this[key];},addEventListener(key,fn){this[key]=fn;},replaceChildren(){this.innerHTML='';}};}
  const panel={hidden:true,dataset:{},classList:{toggle(){},add(){},remove(){}},setAttribute(){},style:node().style,addEventListener:(key,fn)=>events.set(key,fn),querySelector:selector=>{
    if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);
  }};
  Object.defineProperty(panel,'innerHTML',{set(){nodes=new Map();const stage=node();Object.defineProperty(stage,'innerHTML',{set(html){builds++;stage.html=html;stage.firstElementChild=node();stage.firstElementChild['data-id']='temporary';stage.firstElementChild.querySelector=()=>node();},get(){return this.html;}});nodes.set('.folio-paper-stage',stage);nodes.set('.folio-paper-viewport',{clientWidth:350,clientHeight:420});}});
  const view=createFolioView({panel,document:{},icon,binding:()=>'',renderQuest:q=>`<article>${q.id}</article>`,onSearch(){},onRead(){},onCue:name=>cues.push(name),reducedMotion:()=>true});
  return {panel,view,cues,node:selector=>panel.querySelector(selector),get builds(){return builds;}};
}
test('actual folio view updates the selected full sheet without touching model coordinates or rebuilding on unrelated renders',()=>{
  const {state,folder,ids}=quests(),h=viewHarness();h.view.render({folder,items:state.items});
  assert.equal(h.view.selectedId,ids[0]);assert.equal(h.builds,1);
  const paper=h.node('.folio-paper-stage').firstElementChild;
  assert.equal(paper['data-id'],undefined);assert.equal(paper.dataset.folioPaper,ids[0]);assert.equal(paper.style.cssText,'--rotation:0deg;');
  h.view.render({folder,items:state.items});assert.equal(h.builds,1);
  assert.equal(h.view.select(ids[1]),true);assert.equal(h.builds,2);assert.equal(h.cues.length,1);
  assert.equal(h.view.select(ids[1]),false);assert.equal(h.cues.length,1);
  const before=state.items.find(item=>item.id===ids[1]);const changed=updateItem(state,ids[1],{notes:'New note'});
  h.view.render({folder,items:changed.items});assert.equal(h.builds,3);assert.equal(h.view.selectedId,ids[1]);
  assert.deepEqual({x:changed.items.find(item=>item.id===ids[1]).x,y:changed.items.find(item=>item.id===ids[1]).y},{x:before.x,y:before.y});
});

test('a prerequisite change refreshes a cached folio sheet even when the dependent quest object is unchanged',()=>{
  const {state,folder,ids}=quests(),h=viewHarness(),dependent=state.items.find(q=>q.id===ids[0]),prerequisite=state.items.find(q=>q.id===ids[1]);
  dependent.prerequisiteIds=[prerequisite.id];h.view.render({folder,items:state.items});assert.equal(h.builds,1);
  const changed=state.items.map(q=>q.id===prerequisite.id?{...q,status:'done'}:q);
  assert.equal(changed.find(q=>q.id===dependent.id),dependent);h.view.render({folder,items:changed});
  assert.equal(h.builds,2,'the visible waiting/ready badge must follow another quest status');
  h.view.render({folder,items:changed});assert.equal(h.builds,2,'unrelated renders keep the sheet stable');
});
test('resizing the live folio publishes matching A4 stage and backing-sheet dimensions',()=>{
  const {state,folder}=quests(),h=viewHarness();h.view.render({folder,items:state.items});
  const viewport=h.node('.folio-paper-viewport');viewport.clientWidth=166;viewport.clientHeight=500;h.view.size();
  assert.equal(Number(h.panel.style['--folio-paper-scale']),.5);
  assert.equal(parseFloat(h.panel.style['--folio-paper-width']),150);
  assert.ok(Math.abs(parseFloat(h.panel.style['--folio-paper-height'])-212.14285714285714)<1e-10);
  viewport.clientWidth=600;viewport.clientHeight=228.14285714285714;h.view.size();
  assert.ok(Math.abs(Number(h.panel.style['--folio-paper-scale'])-.5)<1e-12);
  assert.ok(Math.abs(parseFloat(h.panel.style['--folio-paper-width'])-150)<1e-10);
  assert.ok(Math.abs(parseFloat(h.panel.style['--folio-paper-height'])-212.14285714285714)<1e-10);
});
test('empty search clears the full-paper actions and an empty folder clears the current selection safely',()=>{
  const {state,folder,ids}=quests(),h=viewHarness();h.view.render({folder,items:state.items});h.view.select(ids[1]);
  h.view.render({folder,items:state.items,search:'nothing-matches-9898'});assert.equal(h.view.selectedId,null);assert.equal(h.node('.folio-preview-empty').hidden,false);assert.equal(h.node('.folio-paper-actions').innerHTML,'');
  const other=createFolder({name:'Empty'},state);h.view.render({folder:other,items:[...state.items,other]});assert.equal(h.view.selectedId,null);
});
test('folio sheet edges represent full folder contents, with no stack for zero or one quest and at most four backing sheets',()=>{
  const {state,folder,ids}=quests(),h=viewHarness();
  const originals=ids.map(id=>state.items.find(item=>item.id===id));
  const members=[...originals,...Array.from({length:7},(_,i)=>({...originals[0],id:`extra-${i}`,title:`Extra ${i}`}))];
  for(const [count,edges] of [[0,0],[1,0],[2,1],[3,2],[10,4]]){
    h.view.render({folder,items:[folder,...members.slice(0,count)]});
    const stack=h.node('.folio-stack');
    assert.equal([...(stack.innerHTML??'').matchAll(/class="folio-stack-sheet"/g)].length,edges,`${count} quests`);
    assert.equal(stack.hidden,count<2,`${count} quests stack visibility`);
    assert.equal(h.node('.folio-total').textContent,String(count));
  }
  h.view.render({folder,items:[folder,...members],search:originals[2].title});
  assert.equal(h.view.selectedId,ids[2]);
  assert.equal(h.node('.folio-total').textContent,'10');
  assert.equal([...h.node('.folio-stack').innerHTML.matchAll(/class="folio-stack-sheet"/g)].length,4);
  h.view.render({folder,items:[folder,...members],search:'no-matching-paper-11909'});
  assert.equal(h.view.selectedId,null);
  assert.equal(h.node('.folio-stack').hidden,false,'a search miss does not empty the folder');
  assert.equal([...h.node('.folio-stack').innerHTML.matchAll(/class="folio-stack-sheet"/g)].length,4);
});
test('clearing a temporary search restores the bookmarked quest instead of remembering its fallback result',()=>{
  const {state,folder,ids}=quests(),h=viewHarness();h.view.render({folder,items:state.items});h.view.select(ids[1]);
  const matching=state.items.find(item=>item.id===ids[2]);
  h.view.render({folder,items:state.items,search:matching.title});assert.equal(h.view.selectedId,ids[2]);
  assert.ok(!h.node('.folder-window-list').innerHTML.includes('folio-bookmark'),'a temporary fallback has no bookmark');
  h.view.render({folder,items:state.items});assert.equal(h.view.selectedId,ids[1]);
  assert.match(h.node('.folder-window-list').innerHTML,new RegExp(`data-folio-bookmark="${ids[1]}"`));
  h.view.render({folder,items:state.items,search:'no-matching-paper-11909'});assert.equal(h.view.selectedId,null);
  h.view.render({folder,items:state.items});assert.equal(h.view.selectedId,ids[1]);
});
test('each folder remembers its own selected quest across switching and reopening the view',()=>{
  const {state,folder,ids}=quests(),h=viewHarness(),other=createFolder({name:'Other notes'},state);
  const otherMembers=ids.slice(0,2).map((id,index)=>({...state.items.find(item=>item.id===id),id:`other-${index}`,folderId:other.id}));
  const items=[...state.items,other,...otherMembers];
  h.view.render({folder,items});h.view.select(ids[1]);
  h.view.render({folder:other,items});h.view.select('other-1');
  h.view.render({folder,items});assert.equal(h.view.selectedId,ids[1]);
  h.panel.hidden=true;h.view.render({folder,items});assert.equal(h.view.selectedId,ids[1]);
  h.view.render({folder:other,items});assert.equal(h.view.selectedId,'other-1');
});
test('a removed or moved bookmark falls back to a current folder member even while a search hides it',()=>{
  const {state,folder,ids}=quests(),h=viewHarness();h.view.render({folder,items:state.items});h.view.select(ids[1]);
  const matching=state.items.find(item=>item.id===ids[2]);
  const removed=state.items.filter(item=>item.id!==ids[1]);
  h.view.render({folder,items:removed,search:matching.title});assert.equal(h.view.selectedId,ids[2]);
  h.view.render({folder,items:removed});assert.equal(h.view.selectedId,ids[0]);
  h.view.select(ids[2]);
  const moved=removed.map(item=>item.id===ids[2]?{...item,folderId:null}:item);
  h.view.render({folder,items:moved});assert.equal(h.view.selectedId,ids[0]);
  assert.ok(!h.node('.folder-window-list').innerHTML.includes(`data-folio-bookmark="${ids[2]}"`));
});
test('explicitly picking a search fallback replaces the remembered quest without rebuilding its paper',()=>{
  const {state,folder,ids}=quests(),h=viewHarness();h.view.render({folder,items:state.items});h.view.select(ids[1]);
  h.view.render({folder,items:state.items,search:state.items.find(item=>item.id===ids[2]).title});
  const paper=h.node('.folio-paper-stage').firstElementChild,builds=h.builds;
  h.view.select(ids[2]);
  h.view.render({folder,items:state.items});assert.equal(h.view.selectedId,ids[2]);
  assert.equal(h.node('.folio-paper-stage').firstElementChild,paper);assert.equal(h.builds,builds);
  assert.match(h.node('.folder-window-list').innerHTML,new RegExp(`data-folio-bookmark="${ids[2]}"`));
});
test('a search that still includes the bookmark preserves the focused search field and live preview paper',()=>{
  const {state,folder,ids}=quests(),h=viewHarness();h.view.render({folder,items:state.items});h.view.select(ids[1]);
  const input=h.node('.folder-search'),paper=h.node('.folio-paper-stage').firstElementChild,builds=h.builds;
  input.focus();
  h.view.render({folder,items:state.items,search:state.items.find(item=>item.id===ids[1]).title});
  assert.equal(h.node('.folder-search'),input);assert.equal(input.focused,true);
  assert.equal(h.node('.folio-paper-stage').firstElementChild,paper);assert.equal(h.builds,builds);
  assert.equal(paper.dataset.folioPaper,ids[1]);
});
test('an unrelated render preserves the search caret, horizontal input scroll and index scroll',()=>{
  const {state,folder}=quests(),h=viewHarness(),search='not present in any title';
  h.view.render({folder,items:state.items,search});
  const input=h.node('.folder-search'),list=h.node('.folder-window-list');
  input.selectionStart=2;input.selectionEnd=6;input.scrollLeft=38;list.scrollTop=93;list.scrollLeft=7;
  h.view.render({folder,items:state.items,search});
  assert.equal(input.selectionStart,2);assert.equal(input.selectionEnd,6);assert.equal(input.scrollLeft,38);
  assert.equal(list.scrollTop,93);assert.equal(list.scrollLeft,7);
});
