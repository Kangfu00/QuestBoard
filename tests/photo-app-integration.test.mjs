import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createInitialState,createQuest,updateItem} from '../dist/model.mjs';
const source=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,`${start} exists`);return source.slice(a,b);}
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0WQAAAAASUVORK5CYII=';

test('photo setup runs once and routes independent per-quest layout saves and full-image viewing',()=>{
  const state={...createInitialState(),items:[]};
  state.items.push(createQuest({title:'With image',imageDataUrl:image},state),createQuest({title:'Other'},state));
  let options,created=0;const views=[],commits=[];
  const viewer={isOpen:false,open:payload=>views.push(payload)},photos={editing:false,refresh(){}};
  const context={state,document:{},window:{},questPhotos:null,photoViewer:null,heldStamp:null,drag:null,storedDrag:null,bundleControl:null,
    dialog:{open:false},$:()=>({open:false}),reducedMotion:()=>true,onSoundCue(){},updateItem,
    createPhotoViewer(){created++;return viewer;},createQuestPhotos(value){options=value;return photos;},commit(next){context.state=next;commits.push(next);}};
  vm.createContext(context);vm.runInContext(section('function setupQuestPhotos(','function paperStampMarkup('),context);
  context.setupQuestPhotos();context.setupQuestPhotos();assert.equal(created,1);assert.equal(context.questPhotos,photos);
  const pose={x:25,y:156,width:110,rotation:4};options.onSave(state.items[0].id,pose);
  assert.equal(commits.length,1);assert.deepEqual(context.state.items[0].photoLayout,pose);assert.equal(context.state.items[1].photoLayout,undefined);
  const payload={src:image,alt:'A map',source:{}};options.onView(payload);assert.deepEqual(views,[payload]);
  assert.equal(options.isBlocked(),false);photos.editing=true;assert.equal(options.isBlocked(),false,'editing does not block its own gestures');
  context.heldStamp={};assert.equal(options.isBlocked(),true);context.heldStamp=null;
  viewer.isOpen=true;assert.equal(options.isBlocked(),true);viewer.isOpen=false;
  assert.throws(()=>options.onSave('missing',pose));
});

test('quest photo markup carries cached orientation and manual pose into fresh paper copies',()=>{
  const frame={orientation:'portrait',x:26,y:154,width:108,height:162,rotation:4};
  const context={questPhotos:{presentation:()=>frame},esc:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};
  vm.createContext(context);vm.runInContext(section('function questPhotoPresentation(','function renderQuest('),context);
  const photo=context.questPhotoPresentation({imageDataUrl:image,title:'<map>',photoLayout:{x:26,y:154,width:108,rotation:4}});
  assert.match(photo.className,/photo-portrait/);assert.match(photo.className,/photo-manual/);
  assert.match(photo.markup,/left:26px/);assert.match(photo.markup,/height:162px/);assert.match(photo.markup,/rotate\(4deg\)/);
  assert.match(photo.markup,/&lt;map&gt;/);assert.doesNotMatch(photo.markup,/<map>/);
  assert.equal(context.questPhotoPresentation({imageDataUrl:null}).markup,'');
});

test('desk shortcuts leave an open photo viewer, active image arrangement or closed shutter alone',()=>{
  for(const mode of ['viewer','edit','covered']){
    let keydown;const calls=[];
    const context={photoViewer:{isOpen:mode==='viewer'},questPhotos:{editing:mode==='edit'},deskShutter:{closed:mode==='covered'},
      document:{addEventListener:(name,handler)=>{keydown=handler;}},dialog:{open:false},drag:null,storedDrag:null,heldStamp:null,
      $:()=>({open:false}),setActiveDrawer:()=>calls.push('drawer'),setToolsOpen:()=>calls.push('tools'),closeFolderWindow:()=>calls.push('folio')};
    vm.createContext(context);vm.runInContext(section("document.addEventListener('keydown',e=>{","window.addEventListener('blur'"),context);
    keydown({key:'Escape',target:{matches:()=>false}});assert.deepEqual(calls,[]);
    keydown({key:'/',target:{matches:()=>false}});assert.deepEqual(calls,[]);
  }
});
