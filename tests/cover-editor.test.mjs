import test from 'node:test';
import assert from 'node:assert/strict';
import {bindCoverEditor} from '../dist/cover-editor.mjs';

function element(values={}){
  const events=new Map(),classes=new Set(values.classes??[]),attributes=new Map(Object.entries(values.attributes??{}));
  return {
    value:values.value??'',textContent:'',dataset:values.dataset??{},style:{
      setProperty(name,value){this[name]=String(value);},
      removeProperty(name){delete this[name];},
    },
    classList:{contains:name=>classes.has(name),add:name=>classes.add(name),remove:name=>classes.delete(name)},
    get attributes(){return [...attributes].map(([name,value])=>({name,value}));},
    setAttribute(name,value){attributes.set(name,value);},getAttribute(name){return attributes.get(name)??null;},
    removeAttribute(name){attributes.delete(name);},
    addEventListener(name,callback){events.set(name,callback);},fire(name){events.get(name)?.();},
  };
}

test('the editor mirrors draft names and picker colors on an isolated cover',()=>{
  const title=element(),tab=element({attributes:{'data-open-folder':'existing'}});
  const cover=element({classes:['board-folder','folder-gold'],attributes:{'data-folder-target':'existing'}});
  cover.querySelectorAll=selector=>selector==='button'?[tab]:[title,tab];
  const name=element({value:'Original'}),color=element({value:'gold'}),hue=element({value:'217'}),tone=element({value:'pearl'});
  const wheel=element(),ivory=element({dataset:{leatherPreset:'ivory'}});
  const fields=new Map([
    ['.cover-editor-stage',{firstElementChild:cover}],['[data-leather-color]',color],
    ['[data-leather-hue]',hue],['[data-leather-tone-input]',tone],['.leather-color-wheel',wheel],
  ]);
  const form={querySelector:selector=>fields.get(selector),querySelectorAll:()=>[ivory],elements:{name}};

  bindCoverEditor(form);
  assert.equal(title.textContent,'Original');
  assert.equal(cover.getAttribute('data-folder-target'),null);
  assert.equal(tab.getAttribute('data-open-folder'),null);
  assert.equal(tab.type,'button');

  name.value='  <New & final>  ';name.fire('input');
  hue.fire('input');
  assert.equal(title.textContent,'<New & final>');
  assert.equal(tab.textContent,title.textContent);
  assert.equal(cover.dataset.leatherTone,'pearl');
  assert.equal(cover.style['--leather-hue'],'217');
  assert.equal(cover.classList.contains('folder-dye-217-pearl'),true);

  ivory.fire('click');
  assert.equal(cover.classList.contains('folder-ivory'),true);
  assert.equal(cover.classList.contains('folder-dye-217-pearl'),false);
  assert.equal(cover.dataset.leatherTone,undefined);
  assert.equal(color.value,'ivory');
});
