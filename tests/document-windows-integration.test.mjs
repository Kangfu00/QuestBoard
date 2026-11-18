import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createQuest,createInitialState} from '../dist/model.mjs';
const source=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b));

test('opening a modal edit form flushes documents without closing other open readers',()=>{
  let flushes=0,closes=0;
  const dialog={open:false,showModal(){this.open=true;},querySelector(){return null;}};
  const context={paperReader:{flush(){flushes++;return true;},close(){closes++;}},dialog,
    closeToolMenu(){},returnStamp(){},drag:null,storedDrag:null,document:{activeElement:null},modalTrigger:null,icon:()=>''};
  context.questPhotos??=null;context.photoViewer??=null;context.prerequisitePicker??=null;vm.createContext(context);vm.runInContext(section('function openDialog(','function closeDialog('),context);
  context.openDialog('Edit','Notes','<form></form>');
  assert.equal(flushes,1);assert.equal(closes,0);assert.equal(dialog.open,true);
});

test('quest title opens a readable document while its separate toolbar can still edit',()=>{
  const quest=createQuest({title:'Readable paper'},createInitialState());
  const context={state:{stamps:[],items:[quest]},esc:value=>String(value),icon:()=>'',isOverdue:()=>false,paperStampMarkup:()=>''};
  context.questPhotos??=null;context.photoViewer??=null;vm.createContext(context);vm.runInContext(section('function questPhotoPresentation(','function renderQuest(')+section('function renderQuest(','function renderLabel('),context);
  const html=context.renderQuest(quest,0);
  assert.match(html,/class="quest-title" data-read-front=/);
  assert.doesNotMatch(html,/class="quest-title" data-edit=/);
});

test('import retires old document buffers before replacing data and refuses replacement on save failure',()=>{
  for(const [saved,photoSaved,notebookSaved] of [[true,true,true],[false,true,true],[true,false,true],[true,true,false]]){
    const nodes=new Map(),events=[],incoming=createInitialState();
    const context={openDialog(){},esc:String,icon:()=>'',downloadBackup(){},closeDialog(){events.push('dialog');},
      paperReader:{close(){events.push('readers');return saved;}},folioWindows:{closeAll(){events.push('folios');}},
      photoSheetReader:{closeAll(){events.push('photos');return photoSaved;}},
      notebookWindows:{closeAll(){events.push('notebooks');return notebookSaved;}},
      ensureNotebook:value=>value,
      $:selector=>{if(!nodes.has(selector))nodes.set(selector,{});return nodes.get(selector);},
      commit(value){assert.equal(value,incoming);events.push('commit');},filters:{},showToast(){}};
    context.questPhotos??=null;context.photoViewer??=null;vm.createContext(context);vm.runInContext(section('function confirmImport(','function openHelp('),context);
    context.confirmImport(incoming);nodes.get('#confirm-import').onclick();
    assert.equal(events[0],'readers');assert.equal(events.includes('commit'),saved&&photoSaved&&notebookSaved);
    if(saved&&photoSaved&&notebookSaved){assert.ok(events.indexOf('photos')<events.indexOf('commit'));assert.ok(events.indexOf('folios')<events.indexOf('commit'));assert.ok(events.indexOf('notebooks')<events.indexOf('commit'));}
  }
});

test('export flushes photograph and notebook writing before serializing or refuses an unsaved draft',()=>{
  for(const [saved,notebookSaved] of [[true,true],[true,false],[false,true]]){
    let notes='',notebookPage='',exports=0;
    const context={state:{},paperReader:{flush:()=>true},
      photoSheetReader:{flush(){if(saved)notes='Latest notes';return saved;}},
      notebookWindows:{flush(){if(notebookSaved)notebookPage='Notebook writing';return notebookSaved;}},
      serializeState(){assert.equal(notes,'Latest notes');assert.equal(notebookPage,'Notebook writing');return notes;},
      Blob:class {},URL:{createObjectURL:()=> 'blob:photo',revokeObjectURL(){}},
      document:{createElement:()=>({click(){exports++;}})},setTimeout(){},showToast(){}};
    vm.createContext(context);vm.runInContext(section('function downloadBackup(','function openSettings('),context);
    context.downloadBackup();
    assert.equal(exports,saved&&notebookSaved?1:0);
  }
});
