import test from 'node:test';
import assert from 'node:assert/strict';
import * as grip from '../dist/paper-grip.mjs';
import {PAPER} from '../dist/paper-format.mjs';

const neutral={transform:'',shadeX:0,shadeY:0};
const pose=(grab,options)=>{
  assert.equal(typeof grip.paperGripPose,'function');
  return grip.paperGripPose(grab,options);
};
const angles=transform=>({
  pitch:Number(transform.match(/rotateX\(([-.\d]+)deg\)/)?.[1]??0),
  roll:Number(transform.match(/rotateY\(([-.\d]+)deg\)/)?.[1]??0),
});

test('center grip stays neutral without drag velocity',()=>{
  assert.deepEqual(pose({x:150,y:PAPER.height/2}),neutral);
  assert.deepEqual(pose({x:100,y:400},{width:200,height:800}),neutral);
});

test('each corner grip raises that corner relative to the opposite paper edge',()=>{
  for(const [grab,pitchSign,rollSign] of [
    [{x:0,y:0},-1,1],
    [{x:300,y:0},-1,-1],
    [{x:0,y:PAPER.height},1,1],
    [{x:300,y:PAPER.height},1,-1],
  ]){
    const result=pose(grab),{pitch,roll}=angles(result.transform);
    assert.ok(pitch*pitchSign>0,'pitch must sag away from the grabbed horizontal edge');
    assert.ok(roll*rollSign>0,'roll must sag away from the grabbed vertical edge');
    assert.equal(Math.sign(result.shadeX),Math.sign(grab.x-150));
    assert.equal(Math.sign(result.shadeY),Math.sign(grab.y-PAPER.height/2));
  }
});

test('grip response follows the same relative point on differently sized paper',()=>{
  assert.deepEqual(pose({x:30,y:PAPER.height/5}),pose({x:60,y:140},{width:600,height:700}));
  const edge=angles(pose({x:0,y:0}).transform);
  const inside=angles(pose({x:75,y:PAPER.height/4}).transform);
  assert.ok(Math.abs(inside.pitch)>0&&Math.abs(inside.pitch)<Math.abs(edge.pitch));
  assert.ok(Math.abs(inside.roll)>0&&Math.abs(inside.roll)<Math.abs(edge.roll));
});

test('drag velocity adds a slight reversible flex around a center grip',()=>{
  const forward=pose({x:150,y:PAPER.height/2},{tilt:3});
  const reverse=pose({x:150,y:PAPER.height/2},{tilt:-3});
  const a=angles(forward.transform),b=angles(reverse.transform);
  assert.ok(Math.abs(a.pitch)>0&&Math.abs(a.pitch)<1);
  assert.ok(Math.abs(a.roll)>0&&Math.abs(a.roll)<1);
  assert.equal(a.pitch,-b.pitch);assert.equal(a.roll,-b.roll);
  assert.equal(forward.shadeX,-reverse.shadeX);
  assert.equal(forward.shadeY,-reverse.shadeY);
});

test('extreme grabs and velocity keep every visual response bounded',()=>{
  for(const x of [-1e100,0,150,300,1e100])for(const y of [-1e100,0,PAPER.height/2,PAPER.height,1e100])for(const tilt of [-1e100,0,1e100]){
    const result=pose({x,y},{tilt}),{pitch,roll}=angles(result.transform);
    assert.ok(Number.isFinite(pitch)&&Math.abs(pitch)<=3);
    assert.ok(Number.isFinite(roll)&&Math.abs(roll)<=4);
    assert.ok(Number.isFinite(result.shadeX)&&Math.abs(result.shadeX)<=1);
    assert.ok(Number.isFinite(result.shadeY)&&Math.abs(result.shadeY)<=1);
  }
});

test('grip suffix uses only perspective and axis rotations so the held origin cannot move',()=>{
  for(const grab of [{x:0,y:0},{x:75,y:PAPER.height/4},{x:300,y:PAPER.height}]){
    const {transform}=pose(grab);
    assert.match(transform,/^perspective\(\d+px\) rotateX\([-.\d]+deg\) rotateY\([-.\d]+deg\)$/);
  }
});

test('reduced motion and malformed inputs return a neutral appendable pose',()=>{
  assert.deepEqual(pose({x:0,y:0},{reduced:true,tilt:3}),neutral);
  for(const grab of [undefined,null,{},[],{x:NaN,y:0},{x:0,y:Infinity},{x:'0',y:0}])assert.deepEqual(pose(grab),neutral);
  for(const options of [null,7,{width:0},{height:-1},{width:Infinity},{height:NaN},{tilt:Infinity},{tilt:'3'}])assert.deepEqual(pose({x:0,y:0},options),neutral);
});
