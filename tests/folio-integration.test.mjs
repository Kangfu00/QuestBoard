import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');
const closeSource=source.slice(source.indexOf('function closeFolderWindow('),source.indexOf('function renderFolderWindow('));
function desk(){
  const captured=[];
  const context={folioWindows:{activeId:'front-folder',close(id,options){captured.push({id,...options});}}};
  vm.createContext(context);vm.runInContext(closeSource,context);
  return {captured,context};
}
test('explicit close addresses only the foreground folio with its closing animation',()=>{
  const h=desk();h.context.closeFolderWindow(true);
  assert.deepEqual(h.captured,[{id:'front-folder',animate:true,returnFocus:true}]);
});
test('archiving a different folio closes that exact document without affecting foreground',()=>{
  const h=desk();h.context.closeFolderWindow(false,'archived-folder');
  assert.deepEqual(h.captured,[{id:'archived-folder',animate:false,returnFocus:false}]);
  assert.equal(h.context.folioWindows.activeId,'front-folder');
});
test('refresh delegates all open folios to the multi-document controller',()=>{
  const items=[{id:'a'},{id:'b'}];let rendered;
  const context={state:{items},bundleControl:null,folioWindows:{render(value){rendered=value;}}};
  vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function renderFolderWindow('),source.indexOf('function folderTargetAt(')),context);
  context.renderFolderWindow();assert.equal(rendered,items);
});
