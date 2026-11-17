import test from 'node:test';
import assert from 'node:assert/strict';
import {PAPER} from '../dist/paper-format.mjs';
const module=await import('../dist/stamp-placement.mjs').catch(()=>({}));
const point=(...args)=>{assert.equal(typeof module.stampPoint,'function');return module.stampPoint(...args);};

test('clicks map to the same local pixel on an unrotated paper at half zoom',()=>{
  assert.deepEqual(point({x:140,y:220},{left:100,top:200,width:150,height:175},{a:1,b:0,c:0,d:1},.5),{x:80,y:40});
});
test('a quarter-turned paper maps the click independently of its bounding rectangle',()=>{
  // Local (80,40) is (-70,-135) from centre; rotate90 => (135,-70).
  assert.deepEqual(point({x:475,y:440},{left:10,top:320,width:525,height:450},{a:0,b:1,c:-1,d:0},1.5),{x:80,y:40});
});
test('current scale/shear in an animated paper is inverted as well as board zoom',()=>{
  // Centre (300,300), local delta(-50,25), matrix[.5,.1,.2,.8] =>(-20,15), zoom2.
  assert.deepEqual(point({x:260,y:330},{left:80,top:-10,width:440,height:620},{a:.5,b:.1,c:.2,d:.8},2),{x:100,y:200});
});
test('edge clicks stay at the edge instead of shifting an entire stamp inward',()=>{
  assert.deepEqual(point({x:0,y:350},{left:0,top:0,width:300,height:350},{a:1,b:0,c:0,d:1},1),{x:0,y:350});
});

test('explicit A4 paper geometry reaches the bottom after a quarter turn and zoom',()=>{
  // A quarter turn at half zoom makes the A4 bounding box height150 and width212.143.
  // Physical local (80, height-20) lands at viewport (110,240).
  const actual=point({x:110,y:240},{left:100,top:200,width:PAPER.height/2,height:150},{a:0,b:1,c:-1,d:0},.5,PAPER);
  assert.equal(actual.x,80);
  assert.ok(Math.abs(actual.y-(PAPER.height-20))<.001);
});

test('rounding cannot place physical A4 ink beyond its fractional bottom edge',()=>{
  const rect={left:0,top:0,width:PAPER.width,height:PAPER.height},matrix={a:1,b:0,c:0,d:1};
  for(const y of [PAPER.height-.0001,PAPER.height,PAPER.height+20]){
    const actual=point({x:PAPER.width,y},rect,matrix,1,PAPER);
    assert.deepEqual(actual,{x:300,y:PAPER.height});
    assert.ok(actual.y<=PAPER.height);
  }
});
test('singular or nonfinite transforms are rejected instead of saving invalid ink coordinates',()=>{
  for(const matrix of [{a:0,b:0,c:0,d:0},{a:NaN,b:0,c:0,d:1}]){
    assert.throws(()=>point({x:10,y:10},{left:0,top:0,width:300,height:350},matrix,1));
  }
});
