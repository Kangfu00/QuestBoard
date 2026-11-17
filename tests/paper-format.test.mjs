import test from 'node:test';
import assert from 'node:assert/strict';
const module=await import('../dist/paper-format.mjs').catch(()=>({}));
const ready=()=>{assert.ok(module.PAPER,'physical paper format is exported');return module;};
test('physical quest paper has A4 proportions while persisted stamp space stays compatible',()=>{
  const {PAPER,STAMP_SPACE}=ready();
  assert.equal(PAPER.width,300);assert.equal(PAPER.height/PAPER.width,297/210);
  assert.deepEqual(STAMP_SPACE,{width:300,height:350});assert.ok(Object.isFrozen(PAPER));assert.ok(Object.isFrozen(STAMP_SPACE));
});
test('legacy ink keeps its relative place on A4 and round trips through actual paper coordinates',()=>{
  const {PAPER,toPaperStampPosition,toStoredStampPosition}=ready();
  for(const original of [{x:0,y:0},{x:300,y:350},{x:123.456,y:287.654},{x:150,y:175}]){
    const physical=toPaperStampPosition(original),restored=toStoredStampPosition(physical);
    assert.equal(physical.x,original.x);assert.ok(Math.abs(physical.y/PAPER.height-original.y/350)<1e-12);
    assert.ok(Math.abs(restored.x-original.x)<1e-10);assert.ok(Math.abs(restored.y-original.y)<1e-10);
    assert.notEqual(physical,original);
  }
});
test('click rounding at A4 edges cannot produce invalid saved ink coordinates',()=>{
  const {PAPER,toStoredStampPosition}=ready();
  assert.deepEqual(toStoredStampPosition({x:300.001,y:Math.ceil(PAPER.height*1000)/1000}),{x:300,y:350});
  assert.deepEqual(toStoredStampPosition({x:-.001,y:-.001}),{x:0,y:0});
});
test('format conversions reject malformed points rather than manufacturing NaN ink',()=>{
  const {toPaperStampPosition,toStoredStampPosition}=ready();
  for(const fn of [toPaperStampPosition,toStoredStampPosition])for(const point of [null,{},[],{x:0,y:NaN},{x:Infinity,y:0},{x:'1',y:1}])assert.throws(()=>fn(point),RangeError);
});
