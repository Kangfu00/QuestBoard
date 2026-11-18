import test from 'node:test';
import assert from 'node:assert/strict';
import {bindDeskShutter} from '../dist/desk-shutter.mjs';

function setup(){
  const events=new Map(),windowEvents=new Map(),classes=new Set(),attributes=new Map(),changes=[];
  const surface={inert:false};
  const shades=new Map();
  const shutter={clientHeight:500,style:{
    setProperty:(name,value)=>shades.set(name,Number(value)),removeProperty:name=>shades.delete(name),
  },classList:{
    add:name=>classes.add(name),remove:name=>classes.delete(name),
    toggle(name,on){if(on)classes.add(name);else classes.delete(name);},
  },getBoundingClientRect:()=>({top:30})};
  let capture,offset,allowed=true;
  const handle={offsetHeight:30,addEventListener:(name,fn)=>events.set(name,fn),
    setPointerCapture:id=>{capture=id;},hasPointerCapture:id=>capture===id,releasePointerCapture:()=>{capture=null;},
    setAttribute:(name,value)=>attributes.set(name,value),focus(){this.focused=true;},
  };
  const panel={getBoundingClientRect:()=>({top:30+(offset??(classes.has('is-closed')?0:470))}),style:{
    setProperty:(name,value)=>{offset=parseFloat(value);},removeProperty:()=>{offset=undefined;},
  }};
  const control=bindDeskShutter({shutter,panel,handle,surface,window:{addEventListener:(name,fn)=>windowEvents.set(name,fn)},
    canUse:()=>allowed,onChange:closed=>changes.push(closed)});
  return {surface,classes,attributes,changes,control,shades,handle,block(){allowed=false;},
    emit(name,y=0,{pointerId=1,detail=1,pointerType='mouse'}={}){events.get(name)({clientY:y,pointerId,button:0,detail,pointerType});},
    windowEvent:name=>windowEvents.get(name)(),
    get offset(){return offset;},get capture(){return capture;},
  };
}

test('dragging the wooden shutter up closes the tabletop, then pulling it down opens it',()=>{
  const h=setup();
  assert.equal(h.attributes.get('aria-expanded'),'true');
  h.emit('pointerdown',510);h.emit('pointermove',300);
  assert.equal(h.offset,260);assert.equal(h.surface.inert,false);assert.equal(h.control.pulling,true);
  h.emit('pointerup',297);h.emit('click');
  assert.deepEqual(h.changes,[true]);
  assert.equal(h.surface.inert,true);assert.equal(h.offset,undefined);assert.equal(h.capture,null);
  assert.equal(h.attributes.get('aria-expanded'),'false');
  h.emit('pointerdown',44);h.emit('pointermove',240);h.emit('pointerup',245);h.emit('click');
  assert.deepEqual(h.changes,[true,false]);assert.equal(h.surface.inert,false);
});

test('cancelling the pull or releasing near the start returns to the original position',()=>{
  const h=setup();
  h.emit('pointerdown',510);h.emit('pointermove',450);h.emit('pointerup',448);h.emit('click');
  assert.deepEqual(h.changes,[]);assert.equal(h.offset,undefined);
  h.emit('pointerdown',510);h.emit('pointermove',215);h.windowEvent('blur');h.emit('click');
  assert.deepEqual(h.changes,[]);assert.equal(h.surface.inert,false);assert.equal(h.control.pulling,false);
});

test('click and keyboard activation work after a completed pull and while the desk is available',()=>{
  const h=setup();
  h.emit('click',0,{detail:0});assert.equal(h.surface.inert,true);
  h.emit('pointerdown',44);h.emit('pointerup',44);h.emit('click');
  assert.equal(h.surface.inert,false);
  h.block();h.emit('pointerdown',492);h.emit('click',0,{detail:0});
  assert.equal(h.control.pulling,false);assert.deepEqual(h.changes,[true,false]);
});

test('a touch tap toggles the shutter once whether or not the browser sends a click',()=>{
  const h=setup(),touch={pointerType:'touch'};
  h.emit('pointerdown',510,touch);h.emit('pointerup',510,touch);
  assert.equal(h.surface.inert,true);
  h.emit('click',0,touch);assert.deepEqual(h.changes,[true]);
  h.emit('pointerdown',44,touch);h.emit('pointerup',44,touch);
  assert.equal(h.surface.inert,false);assert.deepEqual(h.changes,[true,false]);
});

test('the light gives way to desk ambience proportionally as the shutter opens',()=>{
  const h=setup();
  h.emit('click',0,{detail:0});
  assert.equal(h.control.closed,true);
  assert.equal(h.handle.focused,true);
  h.emit('pointerdown',44);
  assert.equal(h.shades.get('--shutter-shade'),1);
  h.emit('pointermove',279);
  assert.equal(h.shades.get('--shutter-shade'),.5);
  h.emit('pointermove',514);
  assert.equal(h.shades.get('--shutter-shade'),0);
  h.emit('pointerup',514);
  assert.equal(h.control.closed,false);
  assert.equal(h.shades.has('--shutter-shade'),false);
  assert.equal(h.surface.inert,false);
});
