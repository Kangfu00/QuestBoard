import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../dist/model.mjs';
import * as format from '../dist/paper-format.mjs';
import {trayItems,trayDrop,TRAY_SCALE} from '../dist/storage-tray.mjs';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAfcAAAAASUVORK5CYII=';

test('independent photographs preserve their source, treatment, rear notes and drawer position in a backup',()=>{
  const initial=model.createInitialState();
  const photo=model.createPhotoSheet({title:'Guild portrait',imageDataUrl:png,aspect:.75},initial);
  const board={...initial,items:[...initial.items,photo]};
  assert.equal(photo.tone,'gold');
  assert.equal(photo.type,'photo');
  assert.equal(photo.archived,false);
  const drawer=model.updateItem(model.setArchived(board,photo.id,true),photo.id,{notes:'  หอเก่า\nประตูทางทิศเหนือ  ',tone:'original',storagePosition:{x:52,y:64}});
  const restored=model.parseState(model.serializeState(drawer));
  const saved=trayItems(restored,'ประตูทางทิศเหนือ')[0];
  assert.equal(saved.id,photo.id);
  assert.equal(saved.imageDataUrl,png);
  assert.equal(saved.notes,'  หอเก่า\nประตูทางทิศเหนือ  ');
  assert.equal(saved.tone,'original');
  assert.deepEqual(saved.storagePosition,{x:52,y:64});
  assert.equal(trayItems(model.setArchived(restored,photo.id,false)).length,0);
});

test('landscape and portrait photographs fit their own geometry when placed at a tray edge',()=>{
  for(const aspect of [.7,2]){
    const size=format.photoSheetSize(aspect);
    assert.ok(aspect>1?size.width>size.height:size.width<size.height);
    const point=trayDrop({x:100000,y:100000},{left:30,top:20},{x:30,y:40},TRAY_SCALE,0,'photo',aspect);
    assert.deepEqual(point,{x:model.BOARD_LIMIT.width-size.width,y:model.BOARD_LIMIT.height-size.height});
  }
});

test('standalone photographs reject unsupported files and never become quest stamps',()=>{
  const state=model.createInitialState();
  for(const patch of [{aspect:0},{aspect:Infinity},{imageDataUrl:'https://example.com/sample.png'},{notes:'x'.repeat(model.MAX_QUEST_NOTES+1)}]){
    assert.throws(()=>model.createPhotoSheet({title:'Test',imageDataUrl:png,aspect:1,...patch},state));
  }
  const photo=model.createPhotoSheet({title:'Test',imageDataUrl:png,aspect:1},state);
  const next={...state,items:[...state.items,photo]};
  assert.throws(()=>model.setItemStatus(next,photo.id,'done'));
  assert.equal(model.filterQuests(next.items).some(item=>item.id===photo.id),false);
});

test('enlarged photo dimensions keep their aspect ratio through the board and drawer and survive backup',()=>{
  const state=model.createInitialState();
  const photo=model.createPhotoSheet({title:'Large portrait',imageDataUrl:png,aspect:.6},state);
  const initial={...state,items:[...state.items,photo]};
  const resized=model.updateItem(initial,photo.id,{photoScale:1.8});
  const saved=model.parseState(model.serializeState(resized)).items.at(-1);
  assert.equal(saved.photoScale,1.8);
  const base=format.photoSheetSize(photo.aspect),size=format.photoSheetSize(saved.aspect,saved.photoScale);
  assert.deepEqual(size,{width:base.width*1.8,height:base.height*1.8});
  const drop=trayDrop({x:100000,y:100000},{left:30,top:20},{x:30,y:40},TRAY_SCALE,0,'photo',saved.aspect,saved.photoScale);
  assert.deepEqual(drop,{x:model.BOARD_LIMIT.width-size.width,y:model.BOARD_LIMIT.height-size.height});
  const stored=model.updateItem(model.setArchived(resized,photo.id,true),photo.id,{storagePosition:drop});
  assert.deepEqual(trayItems(stored)[0].storagePosition,drop);
  assert.equal(model.setArchived(stored,photo.id,false).items.at(-1).photoScale,1.8);
  assert.throws(()=>model.updateItem(resized,photo.id,{photoScale:100}));
});
