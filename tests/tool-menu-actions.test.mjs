import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');
function menu(){
  let handler;const events=[];
  const context={document:{addEventListener:(name,fn)=>{handler=fn;}},zoom:1,
    openToolMenu(){events.push('open');},closeToolMenu(){events.push('close');},openLibrary(){},openSettings(){events.push('settings');},openHelp(){},arrangeBoard(){},resizeBoard(){events.push('resize');},openAdventurerCardEditor(){events.push('adventurer-card');},
  };
  vm.createContext(context);vm.runInContext(source.slice(source.lastIndexOf("document.addEventListener('click',e=>{"),source.indexOf("document.addEventListener('keydown',e=>{")),context);
  return {events,click:dataset=>handler({detail:1,target:{closest:()=>({dataset})}})};
}
test('sound preview and mute buttons keep the advanced dialog open for further adjustments',()=>{
  const h=menu();h.click({});h.click({});assert.deepEqual(h.events,[]);
});
test('zoom controls update the board without dismissing advanced controls',()=>{
  const h=menu();for(const action of ['zoom-in','zoom-out','zoom-reset'])h.click({action});
  assert.deepEqual(h.events,['resize','resize','resize']);
});
test('opening settings closes advanced controls before opening the next dialog',()=>{
  const h=menu();h.click({action:'settings'});assert.deepEqual(h.events,['close','settings']);
});
