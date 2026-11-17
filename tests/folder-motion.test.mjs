import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');
function storeHarness({invalid=false,animationThrows=false,reduced=false,animated=true}={}){
  const log=[],ghost={remove(){log.push('remove');}};
  const context={state:{items:[{id:'folder',type:'folder',name:'Notes'}]},
    moveQuestToFolder(state,id,folderId){if(invalid)throw Error('Missing folder');return {...state,stored:id,folderId};},
    commit(next){context.state=next;log.push('commit');},sound:{play(){log.push('sound');}},showToast(){log.push('toast');},
    animateFolderInsert(g,id){assert.equal(g,ghost);assert.equal(id,'folder');log.push('animate');if(animationThrows)throw Error('Animation unavailable');return animated;},
    reducedMotion:()=>reduced,queueContactSound(id,name,delay){log.push({cue:name,delay,id});return new AbortController();},
  };
  vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function storeInFolder('),source.indexOf('function startStoredDrag(')),context);
  return {log,ghost,context,run:()=>context.storeInFolder('quest','folder',ghost)};
}
test('filing commits before animation and transfers the ghost for cleanup',()=>{
  const h=storeHarness();h.run();assert.equal(h.context.state.stored,'quest');
  assert.ok(h.log.indexOf('commit')<h.log.indexOf('animate'));assert.ok(h.log.includes('animate'));
});
test('an unavailable insertion effect cannot undo filing or leave a ghost',()=>{
  const h=storeHarness({animationThrows:true});assert.doesNotThrow(h.run);
  assert.equal(h.context.state.stored,'quest');assert.ok(h.log.includes('remove'));
});
test('an invalid folder removes the ghost without committing',()=>{
  const h=storeHarness({invalid:true});h.run();assert.ok(!h.log.includes('commit'));assert.ok(h.log.includes('remove'));
});

test('folder contact follows the approach and falls back to immediate sound without animation',()=>{
  const h=storeHarness();h.run();assert.deepEqual(h.log.at(-1),{cue:'paperSlide',delay:215,id:'quest'});
  const fallback=storeHarness({animated:false});fallback.run();assert.equal(fallback.log.at(-1).delay,0);
});
