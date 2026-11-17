import test from 'node:test';
import assert from 'node:assert/strict';
import {createBackEditor} from '../dist/quest-back.mjs';
function editor({fails=false}={}){
  let timer=0,reject=fails;const timers=new Map(),writes=[],statuses=[];
  const draft=createBackEditor({quest:{},onSave:patch=>{if(reject)throw Error('Backup unavailable');writes.push(patch);},onStatus:status=>statuses.push(status),setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id)});
  return {draft,writes,statuses,timers,retry:()=>reject=false,tick(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}}};
}
test('notes debounce saves the latest exact text and close flushes pending edits',()=>{
  const h=editor();h.draft.notes('  one\n');h.draft.notes('  two\n');assert.equal(h.writes.length,0);assert.equal(h.timers.size,1);
  h.tick();assert.equal(h.writes[0].notes,'  two\n');
  h.draft.notes('last keystroke');assert.equal(h.draft.dispose(),true);assert.equal(h.writes.at(-1).notes,'last keystroke');assert.equal(h.timers.size,0);
  assert.equal(h.draft.notes('too late'),false);
});
test('subquests add, rename, check and remove independently of the main quest',()=>{
  const h=editor();h.draft.notes('A field note');const id=h.draft.add('  Prepare the map  ');
  assert.equal(h.writes.at(-1).subquests[0].text,'Prepare the map');assert.equal(h.writes.at(-1).notes,'A field note');
  h.draft.task(id,{text:'Find a map',done:true});h.draft.flush();
  assert.deepEqual(h.writes.at(-1).subquests,[{id,text:'Find a map',done:true}]);
  const snapshot=h.draft.snapshot();snapshot.subquests[0].done=false;assert.equal(h.draft.snapshot().subquests[0].done,true);
  h.draft.remove(id);assert.deepEqual(h.writes.at(-1).subquests,[]);assert.equal(h.writes.at(-1).notes,'A field note');
});
test('failed saves retain the draft, refuse disposal and can be retried without losing text',()=>{
  const h=editor({fails:true});h.draft.notes('Do not lose this');h.tick();assert.equal(h.draft.dirty,true);assert.equal(h.statuses.at(-1).mode,'error');assert.equal(h.draft.dispose(),false);
  assert.equal(h.draft.snapshot().notes,'Do not lose this');h.retry();assert.equal(h.draft.flush(),true);assert.equal(h.writes.at(-1).notes,'Do not lose this');assert.equal(h.draft.dirty,false);
});
test('opening and closing an untouched old quest does not manufacture empty backup changes',()=>{
  const h=editor();assert.equal(h.draft.dispose(),true);assert.equal(h.writes.length,0);
});
test('invalid edits do not corrupt the existing draft or pending save',()=>{
  const h=editor();const id=h.draft.add('Valid');h.draft.notes('Keep');
  assert.throws(()=>h.draft.task(id,{text:''}));assert.throws(()=>h.draft.notes('x'.repeat(8001)));
  h.tick();assert.equal(h.writes.at(-1).notes,'Keep');assert.equal(h.writes.at(-1).subquests[0].text,'Valid');
});
