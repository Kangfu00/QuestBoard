import test from 'node:test';
import assert from 'node:assert/strict';
import {createPaperTurn} from '../dist/paper-turn.mjs';
function harness({reduced=false,throws=false}={}){
  const animations=[],commits=[],cues=[];
  class Node {
    constructor(){this.children=[];this.style={};this.attrs=new Map();this.classes=new Set();this.classList={add:n=>this.classes.add(n),remove:n=>this.classes.delete(n)};this.scrollTop=0;this.scrollLeft=0;}
    get attributes(){return [...this.attrs].map(([name,value])=>({name,value}));}
    setAttribute(name,value){this.attrs.set(name,value);}removeAttribute(name){this.attrs.delete(name);}
    append(node){node.parent=this;this.children.push(node);}remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);}
    querySelectorAll(){return this.children.flatMap(node=>[node,...node.querySelectorAll()]);}
    cloneNode(){const clone=new Node();clone.attrs=new Map(this.attrs);for(const child of this.children)clone.append(child.cloneNode());return clone;}
    animate(frames,options){let resolve,reject;const animation={frames,options,finished:new Promise((yes,no)=>{resolve=yes;reject=no;}),resolve:()=>resolve(),reject:()=>reject(Error('cancelled')),cancel(){this.cancelled=true;}};animations.push(animation);return animation;}
  }
  const document={createElement(){if(throws)throw Error('No animation resources');return new Node();}},scene=new Node(),front=new Node(),back=new Node();
  const input=new Node();input.value='Newest unsaved text';input.setAttribute('id','do-not-duplicate');input.setAttribute('data-edit','q');front.append(input);back.scrollTop=60;
  const turn=createPaperTurn({document,reducedMotion:()=>reduced,onCue:(...args)=>cues.push(args)});
  return {turn,scene,front,back,animations,commits,cues,run:options=>turn.turn(scene,front,back,{onCommit:side=>commits.push(side),...options})};
}
test('paper turns as curved segments with opposite clipped back faces and current form values',async()=>{
  const h=harness(),done=h.run();const ghost=h.scene.children[0];assert.equal(ghost.children.length,5);assert.equal(h.turn.busy,true);
  assert.equal(ghost.children[0].style.clipPath,undefined,'3D strip must not be flattened by a clipping parent');
  const [front,back]=ghost.children[0].children;
  assert.notEqual(front.style.clipPath,back.style.clipPath);assert.equal(front.children[0].value,'Newest unsaved text');
  assert.equal(front.children[0].attrs.has('id'),false);assert.equal(front.children[0].attrs.has('data-edit'),false);
  assert.equal(back.scrollTop,60);assert.equal(h.front.children[0].attrs.get('id'),'do-not-duplicate');
  assert.equal(h.animations.length,6);assert.ok(h.animations[0].frames.some(frame=>frame.transform.includes('translateY(-24px)')));
  h.animations[0].resolve();assert.equal(await done,true);assert.deepEqual(h.commits,['back']);assert.equal(h.scene.children.length,0);assert.equal(h.turn.busy,false);
  assert.ok(h.animations.every(animation=>animation.cancelled));assert.equal(h.cues[0][1].signal.aborted,false,'natural finish keeps playing tails');
});
test('cancel while turning restores the live sheet and aborts delayed contact audio without committing',async()=>{
  const h=harness(),done=h.run();h.turn.cancel();assert.equal(await done,false);assert.deepEqual(h.commits,[]);assert.equal(h.scene.children.length,0);assert.equal(h.cues[0][1].signal.aborted,true);assert.equal(h.scene.classes.has('paper-is-turning'),false);
});
test('a replacement turn retires the old turn and a backwards turn commits front',async()=>{
  const h=harness(),first=h.run(),second=h.run({from:'back',to:'front'});
  assert.equal(await first,false);assert.equal(h.scene.children.length,1);h.animations[6].resolve();assert.equal(await second,true);assert.deepEqual(h.commits,['front']);
});
test('reduced motion and unavailable animation resources still expose the requested face',async()=>{
  for(const options of [{reduced:true},{throws:true}]){
    const h=harness(options);assert.equal(await h.run(),true);assert.deepEqual(h.commits,['back']);assert.equal(h.scene.children.length,0);
  }
});
test('failing caller commit cannot leave a pending turn or unhandled animation promise',async()=>{
  const h=harness(),done=h.run({onCommit(){throw Error('Detached view');}});h.animations[0].resolve();assert.equal(await done,false);assert.equal(h.turn.busy,false);assert.equal(h.scene.children.length,0);
});
