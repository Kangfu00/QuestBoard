import test from 'node:test';
import assert from 'node:assert/strict';
import * as motion from '../dist/desk-motion.mjs';

const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);

test('grabPoint recovers the grabbed paper pixel through zoom and rotation',()=>{
  assert.equal(typeof motion.grabPoint,'function');
  for(const {pointer,scale,rotation,want} of [
    {pointer:{x:120,y:230},scale:1,rotation:0,want:{x:20,y:30}},
    {pointer:{x:70,y:220},scale:.5,rotation:90,want:{x:40,y:60}},
    {pointer:{x:-100,y:150},scale:2,rotation:180,want:{x:100,y:25}},
    {pointer:{x:155,y:167},scale:1.1,rotation:-90,want:{x:30,y:50}},
  ]){
    const point=motion.grabPoint(pointer,{x:100,y:200},scale,rotation);
    close(point.x,want.x);close(point.y,want.y);
  }
});

// Apply the returned CSS as a browser would, independently of ghostPose.
function screenPoint(pose,local){
  const [ox,oy]=pose.transformOrigin.split(' ').map(parseFloat);
  const angle=Number(pose.transform.match(/rotate\(([-.\d]+)deg\)/)[1])*Math.PI/180;
  const scale=Number(pose.transform.match(/scale\(([-.\d]+)\)/)[1]);
  const x=(local.x-ox)*scale,y=(local.y-oy)*scale;
  return {x:parseFloat(pose.left)+ox+x*Math.cos(angle)-y*Math.sin(angle),y:parseFloat(pose.top)+oy+x*Math.sin(angle)+y*Math.cos(angle)};
}

test('lifting and tilting a ghost keeps the exact grabbed pixel under the moving pointer',()=>{
  assert.equal(typeof motion.ghostPose,'function');
  const grab={x:53.25,y:281.75};
  for(const scale of [.35,.65,1,1.75,2.2])for(const rotation of [-137,-12,0,27,90])for(const tilt of [-3,0,3]){
    const pointer={x:817.5,y:449.25};
    const pose=motion.ghostPose(pointer,grab,scale,rotation,tilt);
    const screen=screenPoint(pose,grab);
    close(screen.x,pointer.x);close(screen.y,pointer.y);
    // A second paper pixel verifies the returned transform really includes lift,
    // zoom and tilt; anchoring alone could otherwise hide an identity transform.
    const adjacent=screenPoint(pose,{x:grab.x+100,y:grab.y});
    close(Math.hypot(adjacent.x-screen.x,adjacent.y-screen.y),100*scale*1.025);
    close(Math.atan2(adjacent.y-screen.y,adjacent.x-screen.x)*180/Math.PI,rotation+tilt);
  }
});

test('a ghost can settle back to its unlifted paper scale',()=>{
  assert.equal(typeof motion.ghostPose,'function');
  const pose=motion.ghostPose({x:90,y:120},{x:20,y:30},.5,0,0,1);
  assert.deepEqual(screenPoint(pose,{x:20,y:30}),{x:90,y:120});
  assert.deepEqual(screenPoint(pose,{x:120,y:30}),{x:140,y:120});
});

test('drag tilt follows horizontal velocity with a small bounded angle',()=>{
  assert.equal(typeof motion.dragTilt,'function');
  const previous={x:100,time:10};
  const slow=motion.dragTilt(previous,{x:102,time:30});
  const fast=motion.dragTilt(previous,{x:110,time:30});
  assert.ok(slow>0&&slow<fast&&fast<=3);
  close(motion.dragTilt(previous,{x:90,time:30}),-fast);
  assert.equal(motion.dragTilt(previous,{x:10000,time:11}),3);
  assert.equal(motion.dragTilt(previous,{x:-10000,time:11}),-3);
  assert.equal(motion.dragTilt(previous,{x:100,time:30}),0);
});

test('missing or invalid pointer samples never produce an invalid tilt',()=>{
  assert.equal(typeof motion.dragTilt,'function');
  for(const [previous,current]of [
    [null,{x:2,time:5}],
    [{x:0,time:5},{x:2,time:5}],
    [{x:0,time:6},{x:2,time:5}],
    [{x:0,time:0},{x:2,time:Infinity}],
    [{x:NaN,time:0},{x:2,time:5}],
    [{x:0,time:0},{x:Infinity,time:5}],
  ])assert.equal(motion.dragTilt(previous,current),0);
});

// Node has no DOM/WAAPI. This boundary double models its finished promise,
// cancellation rejection and retained animation effect, without browser access.
function paper(){
  const animations=[];
  const element={connected:true,animations,remove(){this.connected=false;},animate(keyframes,options){
    let resolve,reject;
    const finished=new Promise((yes,no)=>{resolve=yes;reject=no;});
    const animation={finished,keyframes,options,active:true,cancellations:0,
      finish(){resolve();},fail(){reject(new Error('Animation failed'));},
      cancel(){this.active=false;this.cancellations++;reject(new Error('Animation cancelled'));},
    };
    animations.push(animation);return animation;
  }};
  return element;
}
const frames=[{opacity:1},{opacity:0}],timing={duration:180,fill:'forwards'};

test('finished transient ghosts are removed and their retained effects released once',async()=>{
  assert.equal(typeof motion.animateTransient,'function');
  const element=paper();let finishes=0;
  const done=motion.animateTransient(element,frames,timing,{remove:true,onFinish:()=>finishes++});
  assert.equal(element.connected,true);
  assert.deepEqual(element.animations[0].keyframes,frames);
  assert.deepEqual(element.animations[0].options,timing);
  element.animations[0].finish();await done;
  assert.equal(element.connected,false);assert.equal(finishes,1);
  assert.equal(element.animations[0].active,false);
  motion.cancelMotion(element);assert.equal(finishes,1);
});

test('rejected native animation still removes its ghost and performs cleanup',async()=>{
  assert.equal(typeof motion.animateTransient,'function');
  const element=paper();let finishes=0;
  const done=motion.animateTransient(element,frames,timing,{remove:true,onFinish:()=>finishes++});
  element.animations[0].fail();await done;
  assert.equal(element.connected,false);assert.equal(finishes,1);
  assert.equal(element.animations[0].active,false);
});

test('replacement cancels a previous effect without letting stale cleanup remove the new animation',async()=>{
  assert.equal(typeof motion.animateTransient,'function');
  const element=paper();let oldFinishes=0,newFinishes=0;
  const oldDone=motion.animateTransient(element,frames,timing,{remove:true,onFinish:()=>oldFinishes++});
  const newDone=motion.animateTransient(element,frames,timing,{remove:true,onFinish:()=>newFinishes++});
  await oldDone;
  assert.equal(element.animations[0].active,false);
  assert.equal(element.connected,true);assert.equal(oldFinishes,0);assert.equal(newFinishes,0);
  assert.equal(element.animations[1].active,true);
  element.animations[1].finish();await newDone;
  assert.equal(element.connected,false);assert.equal(oldFinishes,0);assert.equal(newFinishes,1);
});

test('explicit cancellation releases the effect and completes current cleanup exactly once',async()=>{
  assert.equal(typeof motion.animateTransient,'function');assert.equal(typeof motion.cancelMotion,'function');
  const element=paper();let finishes=0;
  const done=motion.animateTransient(element,frames,timing,{remove:true,onFinish:()=>finishes++});
  motion.cancelMotion(element);motion.cancelMotion(element);await done;
  assert.equal(element.animations[0].active,false);
  assert.equal(element.connected,false);assert.equal(finishes,1);
});

test('without WAAPI, transient cleanup happens immediately and resolves',async()=>{
  assert.equal(typeof motion.animateTransient,'function');
  let removed=false,finished=false;
  await motion.animateTransient({remove(){removed=true;}},frames,timing,{remove:true,onFinish(){finished=true;}});
  assert.equal(removed,true);assert.equal(finished,true);
});

test('WAAPI setup and finished-access failures cannot prevent cleanup',async()=>{
  assert.equal(typeof motion.animateTransient,'function');
  for(const animate of [()=>{throw new Error('unsupported');},()=>({get finished(){throw new Error('detached');},cancel(){}})]){
    let removed=false,finishes=0;
    await motion.animateTransient({animate,remove(){removed=true;}},frames,timing,{remove:true,onFinish:()=>finishes++});
    assert.equal(removed,true);assert.equal(finishes,1);
  }
});

test('cancellation and cleanup failures never escape into the app',async()=>{
  assert.equal(typeof motion.animateTransient,'function');assert.equal(typeof motion.cancelMotion,'function');
  const element=paper();let finishes=0;
  element.remove=()=>{throw new Error('already detached');};
  const done=motion.animateTransient(element,frames,timing,{remove:true,onFinish(){finishes++;throw new Error('listener failed');}});
  element.animations[0].cancel=()=>{throw new Error('cancel failed');};
  assert.doesNotThrow(()=>motion.cancelMotion(element));
  await assert.doesNotReject(done);assert.equal(finishes,1);
  assert.doesNotThrow(()=>motion.cancelMotion(null));
});

test('ordinary element animations keep their element after cleanup',async()=>{
  assert.equal(typeof motion.animateTransient,'function');
  const element=paper();let finished=false;
  const done=motion.animateTransient(element,frames,timing,{onFinish(){finished=true;}});
  element.animations[0].finish();await done;
  assert.equal(element.connected,true);assert.equal(finished,true);
  assert.equal(element.animations[0].active,false);
});

test('settleTiltKeyframes returns anticipation-action-settle transforms without mutating layout', () => {
  assert.equal(typeof motion.settleTiltKeyframes, 'function');

  // Default parameters
  const defaults = motion.settleTiltKeyframes();
  assert.equal(defaults.length, 5);
  assert.equal(defaults[0].transform, 'rotate(0deg) scale(1.025)');
  assert.equal(defaults[1].offset, 0.18);
  assert.equal(defaults[2].offset, 0.72);
  assert.equal(defaults[3].offset, 0.88);
  assert.equal(defaults[4].transform, 'rotate(0deg) scale(1)');

  // Verifying no layout properties (left/top/width/height)
  for (const kf of defaults) {
    assert.equal(kf.left, undefined);
    assert.equal(kf.top, undefined);
    assert.ok(kf.transform.includes('rotate('));
    assert.ok(kf.transform.includes('scale('));
  }

  // Active tilt with rotation
  const tilted = motion.settleTiltKeyframes(10, 2);
  assert.equal(tilted.length, 5);
  // 0%: 10 + 2 * 0.35 = 10.7
  assert.ok(tilted[0].transform.includes('rotate(10.7deg)'));
  // 18% anticipation: 10 + 2 * 0.45 = 10.9
  assert.ok(tilted[1].transform.includes('rotate(10.9deg)'));
  // 55% overshoot opposite to tilt: 10 - 2 * 0.25 - 0.3 = 9.2
  assert.ok(tilted[2].transform.includes('rotate(9.2deg)'));
  // 100% final resting pose: rotate(10deg) scale(1)
  assert.equal(tilted[4].transform, 'rotate(10deg) scale(1)');

  // Without anticipation (e.g. quick settle)
  const direct = motion.settleTiltKeyframes(5, -1, { anticipation: false });
  assert.equal(direct.length, 3);
  assert.equal(direct[2].transform, 'rotate(5deg) scale(1)');

  // Robust against non-finite inputs
  const safe = motion.settleTiltKeyframes(NaN, Infinity);
  assert.equal(safe.length, 5);
  assert.equal(safe[4].transform, 'rotate(0deg) scale(1)');
});

test('fastForwardAnimations increases playbackRate of running animations', () => {
  assert.equal(typeof motion.fastForwardAnimations, 'function');
  assert.deepEqual(motion.fastForwardAnimations(null), []);
  assert.deepEqual(motion.fastForwardAnimations({}), []);

  const runningAnim = { playbackRate: 1, playState: 'running' };
  const finishedAnim = { playbackRate: 1, playState: 'finished' };
  const fakeElement = {
    getAnimations: () => [runningAnim, finishedAnim],
  };

  const accelerated = motion.fastForwardAnimations(fakeElement, 4);
  assert.equal(accelerated.length, 2);
  assert.equal(runningAnim.playbackRate, 4);
  assert.equal(finishedAnim.playbackRate, 1);
});

test('reducedMotionCrossfade performs a 120ms fade-in transition', async () => {
  assert.equal(typeof motion.reducedMotionCrossfade, 'function');
  const element = paper();
  let finished = false;
  const p = motion.reducedMotionCrossfade(element, { onFinish: () => { finished = true; } });
  assert.equal(element.animations.length, 1);
  assert.deepEqual(element.animations[0].keyframes, [{ opacity: 0 }, { opacity: 1 }]);
  assert.equal(element.animations[0].options.duration, 120);

  element.animations[0].finish();
  await p;
  assert.equal(finished, true);
});
