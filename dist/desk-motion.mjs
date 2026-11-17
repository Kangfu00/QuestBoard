export function grabPoint(pointer, origin, scale, rotation) {
  const angle=rotation*Math.PI/180,dx=(pointer.x-origin.x)/scale,dy=(pointer.y-origin.y)/scale;
  return {x:dx*Math.cos(angle)+dy*Math.sin(angle),y:dy*Math.cos(angle)-dx*Math.sin(angle)};
}

export function ghostPose(pointer, grab, scale, rotation, tilt=0, lift=1.025) {
  // A CSS transform leaves its origin fixed. Anchor that origin at the grabbed
  // local pixel so rotation, desk zoom and lift cannot pull it off the pointer.
  return {
    left:`${pointer.x-grab.x}px`,top:`${pointer.y-grab.y}px`,
    transform:`rotate(${rotation+tilt}deg) scale(${scale*lift})`,
    transformOrigin:`${grab.x}px ${grab.y}px`,
  };
}

export function dragTilt(previous, current) {
  if(!previous||!current||![previous.x,previous.time,current.x,current.time].every(Number.isFinite))return 0;
  const elapsed=current.time-previous.time;
  if(elapsed<=0||!Number.isFinite(elapsed))return 0;
  return Math.max(-3,Math.min(3,(current.x-previous.x)/elapsed*1.7));
}

const motions=new WeakMap();

export function cancelMotion(element) {
  motions.get(element)?.finish();
}

// The returned promise always resolves, including cancellation and unavailable
// WAAPI. Replacing a motion retires its cleanup: only the newest motion may
// remove the element or invoke its completion callback.
export function animateTransient(element, keyframes, options, {remove=false,onFinish}={}) {
  motions.get(element)?.finish(false);
  return new Promise(resolve=>{
    let animation,settled=false;
    const state={finish(cleanup=true){
      if(settled)return;
      settled=true;
      if(motions.get(element)===state)motions.delete(element);
      try{animation?.cancel();}catch{}
      if(cleanup){
        try{if(remove)element?.remove();}catch{}
        try{Promise.resolve(onFinish?.()).catch(()=>{});}catch{}
      }
      resolve();
    }};
    try{
      if(typeof element?.animate!=='function'){state.finish();return;}
      motions.set(element,state);
      animation=element.animate(keyframes,options);
      Promise.resolve(animation.finished).then(()=>state.finish(),()=>state.finish());
    }catch{state.finish();}
  });
}
