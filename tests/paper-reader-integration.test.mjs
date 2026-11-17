import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {backMarkup} from '../dist/paper-reader.mjs';
const source=await readFile(new URL('../dist/paper-reader.mjs',import.meta.url),'utf8');
test('reader back escapes user text and exposes notes, checklist and save status controls',()=>{
  const html=backMarkup({title:'<img onerror="bad">',notes:'</textarea><script>bad()</script>'});
  assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;/textarea&gt;'));assert.ok(html.includes('maxlength="8000"'));assert.ok(html.includes('aria-label="โน้ตด้านหลังเควส"'));
  assert.ok(html.includes('back-task-list'));assert.ok(html.includes('role="status"'));
});
test('flip keeps keyboard focus on an enabled persistent control and blocks reentrant flips',async()=>{
  const controls=new Map(),calls=[];let resolve;
  const button={disabled:false,attrs:{},setAttribute(key,value){this.attrs[key]=value;},focus(){assert.equal(this.disabled,false);calls.push('focus');}};
  controls.set('.reader-turn',button);controls.set('.reader-front',{setAttribute(){}});controls.set('.reader-back',{setAttribute(){}});controls.set('.paper-reader-scene',{});
  const context={editor:{flush:()=>true},turning:false,generation:0,side:'front',dialog:{open:true},find:selector=>controls.get(selector),setSide(){calls.push('commit');},turn:{turn(){calls.push('turn');return new Promise(done=>resolve=done);}}};
  vm.createContext(context);vm.runInContext(source.slice(source.indexOf('async function flip('),source.indexOf('function close(')),context);
  const done=context.flip();assert.deepEqual(calls,['focus','turn']);assert.equal(button.attrs['aria-disabled'],'true');
  await context.flip();assert.equal(calls.filter(call=>call==='turn').length,1);
  resolve(false);await done;assert.equal(button.attrs['aria-disabled'],'false');assert.equal(context.turning,false);
});
test('closing during the animation cannot access stale reader controls on completion',async()=>{
  let resolve,reads=0;
  const control={setAttribute(){},focus(){}};
  const context={editor:{flush:()=>true},turning:false,generation:0,side:'front',dialog:{open:true},find(){reads++;return control;},setSide(){},turn:{turn(){return new Promise(done=>resolve=done);}}};
  vm.createContext(context);vm.runInContext(source.slice(source.indexOf('async function flip('),source.indexOf('function close(')),context);
  const done=context.flip(),before=reads;context.generation++;context.dialog.open=false;resolve(false);await done;
  assert.equal(reads,before);
});
test('an empty subquest rename restores the saved name on blur instead of showing a misleading blank',()=>{
  const start=source.indexOf("find('.back-task-list').onfocusout=")+"find('.back-task-list').onfocusout=".length;
  const end=source.indexOf("find('.back-task-list').onchange=",start);
  const handler=vm.runInNewContext(source.slice(start,end).trim().replace(/;$/,''),{editor:{snapshot:()=>({subquests:[{id:'a',text:'Prepare the map'}]})}});
  let validity='empty';const input={value:' ',matches:()=>true,closest:()=>({dataset:{taskId:'a'}}),setCustomValidity:value=>{validity=value;}};
  handler({target:input});assert.equal(input.value,'Prepare the map');assert.equal(validity,'');
  input.value='A new name';handler({target:input});assert.equal(input.value,'A new name');
});
