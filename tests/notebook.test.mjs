import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,ensureNotebook,parseState,serializeState,setArchived,updateItem,BOARD_LIMIT} from '../dist/model.mjs';
import {rotatedClampPosition} from '../dist/interactions.mjs';
import {trayDrop,trayItems} from '../dist/storage-tray.mjs';

test('a version-one desk gains a separate notebook once and saves its writing, color and drawer position',()=>{
  const legacy=createInitialState();
  assert.equal(parseState(serializeState(legacy)).items.some(item=>item.type==='notebook'),false);
  let state=ensureNotebook(legacy);
  const book=state.items.find(item=>item.type==='notebook');
  assert.deepEqual(book.pages,['','']);
  assert.equal(ensureNotebook(state),state);
  const position=trayDrop({x:30000,y:30000},{left:0,top:0},undefined,1,0,'notebook');
  assert.deepEqual(position,rotatedClampPosition(30000,30000,'notebook',0,BOARD_LIMIT));
  state=updateItem(setArchived(state,book.id,true),book.id,{
    pages:['  เส้นทางผ่านป่า\n\n','จดด้วยหมึก','','หน้าที่สี่'],
    color:'dye-235-pearl',storagePosition:position,
  });
  const restored=parseState(serializeState(state));
  assert.deepEqual(trayItems(restored,'ผ่านป่า'),[state.items.at(-1)]);
  assert.deepEqual(restored.items.at(-1).pages,state.items.at(-1).pages);
  assert.equal(restored.items.at(-1).color,'dye-235-pearl');
  assert.throws(()=>updateItem(restored,book.id,{pages:['หน้าเดียว']}),/สมุด/);
  assert.throws(()=>updateItem(restored,book.id,{pages:[123,'']}),/สมุด/);
});
