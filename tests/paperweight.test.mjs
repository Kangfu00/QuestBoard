import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../dist/model.mjs';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAfcAAAAASUVORK5CYII=';

test('a customized weight and its attached corner survive a board backup round trip', () => {
  const initial = model.createInitialState();
  assert.equal(model.parseState(model.serializeState(initial)).paperweight, undefined);
  const quest = initial.items.find(item => item.type === 'quest');
  const saved = model.updatePaperweight(initial, {x:120,y:160,questId:quest.id,corner:'top-right',emblem:'custom',imageDataUrl:png});
  assert.deepEqual(model.parseState(model.serializeState(saved)).paperweight, saved.paperweight);
  assert.equal(saved.paperweight.imageDataUrl, png);
  assert.equal(initial.paperweight, undefined);
  const builtin = model.updatePaperweight(saved, {emblem:'star'});
  assert.equal(builtin.paperweight.imageDataUrl, null);
  assert.equal(builtin.paperweight.questId, quest.id);
});

test('archiving, filing or deleting the pinned quest leaves the weight loose without changing its emblem', () => {
  const initial = model.createInitialState();
  const quest = initial.items.find(item => item.type === 'quest');
  const folder = model.createFolder({name:'Test folio'},initial);
  const held = model.updatePaperweight({...initial,items:[...initial.items,folder]}, {questId:quest.id,corner:'bottom-left',emblem:'feather'});
  for (const next of [model.setArchived(held,quest.id,true),model.moveQuestToFolder(held,quest.id,folder.id),model.deleteItem(held,quest.id)]) {
    assert.equal(next.paperweight.questId,null);
    assert.equal(next.paperweight.corner,null);
    assert.equal(next.paperweight.emblem,'feather');
  }
});

test('editing a pinned quest keeps its position and rotation until the weight is lifted', () => {
  const initial = model.createInitialState();
  const quest = initial.items.find(item => item.type === 'quest');
  const held = model.updatePaperweight(initial,{questId:quest.id,corner:'top-left'});
  const patch = {x:210,y:250,rotation:9,title:'Updated title'};
  const pinned = model.updateItem(held,quest.id,patch).items.find(item => item.id === quest.id);
  assert.equal(pinned.title,patch.title);
  assert.deepEqual([pinned.x,pinned.y,pinned.rotation],[quest.x,quest.y,quest.rotation]);
  const released = model.updatePaperweight(held,{questId:null,corner:null});
  const moved = model.updateItem(released,quest.id,patch).items.find(item => item.id === quest.id);
  assert.deepEqual([moved.x,moved.y,moved.rotation],[patch.x,patch.y,patch.rotation]);
});

test('invalid position, emblem and raster formats are rejected and missing anchor references are released', () => {
  const initial = model.createInitialState();
  for (const patch of [{x:-1},{y:Infinity},{emblem:'missing'},{emblem:'custom',imageDataUrl:'https://example.com/a.png'},{questId:'invalid id',corner:'top-left'},{questId:'missing',corner:'middle'}]) {
    assert.throws(() => model.updatePaperweight(initial,patch));
  }
  const orphan = model.updatePaperweight(initial,{questId:'missing',corner:'top-left'});
  assert.equal(orphan.paperweight.questId,null);
  assert.equal(orphan.paperweight.corner,null);
});
