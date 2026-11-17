import test from 'node:test';
import assert from 'node:assert/strict';
import {PAPER} from '../dist/paper-format.mjs';
const photo=await import('../dist/photo-layout.mjs').catch(()=>({}));
const ready=()=>{assert.equal(typeof photo.photoFrame,'function','photo geometry is exported');return photo;};

test('automatic photos choose orientation and fit the image with frame chrome',()=>{
  const {photoOrientation,photoFrame}=ready();
  for(const [size,expected] of [
    [{width:600,height:900},{orientation:'portrait',x:24,y:158,width:108.66666666666667,height:162,rotation:-.6}],
    [{width:900,height:600},{orientation:'landscape',x:24,y:206,width:115,height:84,rotation:-.6}],
    [{width:600,height:600},{orientation:'square',x:24,y:158,width:126,height:130,rotation:-.6}],
    [{width:40,height:30},{orientation:'landscape',x:24,y:206,width:50,height:44,rotation:-.6}],
  ]){
    const frame=photoFrame(size);
    assert.equal(photoOrientation(size),expected.orientation);
    for(const key of ['orientation','x','y','rotation'])assert.equal(frame[key],expected[key]);
    for(const key of ['width','height'])assert.ok(Math.abs(frame[key]-expected[key])<1e-10,`${key} matches fitted image`);
  }
});

test('manual photo placement preserves image proportions and leaves an already safe pose intact',()=>{
  const {photoFrame}=ready(),draft={x:40,y:170,width:110,rotation:7};
  const frame=photoFrame({width:200,height:100},draft);
  assert.deepEqual(frame,{orientation:'landscape',...draft,height:64});
  assert.deepEqual(draft,{x:40,y:170,width:110,rotation:7});
});

test('manual frames fit all rotated corners inside the body after oversized drags and resize',()=>{
  const {photoFrame}=ready();
  for(const size of [{width:200,height:300},{width:300,height:200},{width:100,height:1000000},{width:1000000,height:100}]){
    for(const rotation of [-90,-15,0,15,90])for(const [x,y] of [[-10000,-10000],[10000,10000],[16,146],[284,PAPER.height-90]]){
      const frame=photoFrame(size,{x,y,width:10000,rotation});
      assert.ok(frame.width<=252&&frame.width>=10);
      assert.ok(frame.rotation>=-15&&frame.rotation<=15);
      const imageRatio=(frame.width-10)/(frame.height-14);
      assert.ok(Math.abs(imageRatio-size.width/size.height)<=1e-7*Math.max(1,size.width/size.height));
      const angle=frame.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
      const cx=frame.x+frame.width/2,cy=frame.y+frame.height/2;
      for(const dx of [-frame.width/2,frame.width/2])for(const dy of [-frame.height/2,frame.height/2]){
        const px=cx+dx*c-dy*s,py=cy+dx*s+dy*c;
        assert.ok(px>=16&&px<=284,`rotated x ${px} stays inside body`);
        assert.ok(py>=146&&py<=PAPER.height-90,`rotated y ${py} stays inside body`);
      }
    }
  }
});

test('finite extreme aspect ratios never produce nonfinite frame geometry',()=>{
  const {photoFrame,normalizePhotoLayout}=ready();
  for(const size of [{width:Number.MAX_VALUE,height:Number.MIN_VALUE},{width:Number.MIN_VALUE,height:Number.MAX_VALUE},{width:Number.MAX_VALUE,height:Number.MAX_VALUE}]){
    for(const layout of [null,{x:Number.MAX_VALUE,y:-Number.MAX_VALUE,width:Number.MAX_VALUE,rotation:15}]){
      const frame=photoFrame(size,layout);
      assert.ok(Object.values(frame).filter(value=>typeof value==='number').every(Number.isFinite));
      if(layout)assert.doesNotThrow(()=>normalizePhotoLayout(frame));
    }
  }
});

test('a minimum-width frame remains finite when an extreme portrait ratio underflows',()=>{
  const {photoFrame,normalizePhotoLayout}=ready();
  const frame=photoFrame({width:Number.MIN_VALUE,height:Number.MAX_VALUE},{x:24,y:158,width:10,rotation:0});
  assert.ok(Object.values(frame).filter(value=>typeof value==='number').every(Number.isFinite));
  assert.ok(frame.x>=16&&frame.y>=146&&frame.y+frame.height<=PAPER.height-90);
  assert.doesNotThrow(()=>normalizePhotoLayout(frame));
});

test('photo layout metadata validates saved bounds and normalizes an automatic reset',()=>{
  const {normalizePhotoLayout}=ready(),layout={x:30,y:160,width:120,rotation:-3,ignored:true};
  assert.equal(normalizePhotoLayout(null),null);
  assert.equal(normalizePhotoLayout(undefined),null);
  assert.deepEqual(normalizePhotoLayout(layout),{x:30,y:160,width:120,rotation:-3});
  assert.notEqual(normalizePhotoLayout(layout),layout);
  for(const bad of [[],{},'auto',{...layout,x:-1},{...layout,x:301},{...layout,y:500},{...layout,width:9},{...layout,width:253},{...layout,rotation:-16},{...layout,rotation:16}])assert.throws(()=>normalizePhotoLayout(bad),RangeError);
});

test('malformed intrinsic sizes and nonfinite saved or draft coordinates are rejected',()=>{
  const {photoOrientation,photoFrame,normalizePhotoLayout}=ready();
  for(const size of [null,{},[],{width:0,height:1},{width:-1,height:1},{width:'1',height:1},{width:Infinity,height:1},{width:1,height:NaN}]){
    assert.throws(()=>photoOrientation(size),RangeError);
    assert.throws(()=>photoFrame(size),RangeError);
  }
  const layout={x:24,y:158,width:100,rotation:0};
  for(const key of Object.keys(layout))for(const value of [NaN,Infinity,-Infinity,'2']){
    const bad={...layout,[key]:value};
    assert.throws(()=>normalizePhotoLayout(bad),RangeError);
    assert.throws(()=>photoFrame({width:200,height:100},bad),RangeError);
  }
});
