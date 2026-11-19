import { MOTION_DURATION } from './motion-tokens.mjs';

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
  motions.get(element)?.finish(true,false);
}

// The returned promise always resolves (true when finished naturally, false
// when cancelled or unavailable). Replacing a motion retires its cleanup: only
// the newest motion may remove the element or invoke its completion callback.
export function animateTransient(element, keyframes, options, {remove=false,onFinish,onStart}={}) {
  motions.get(element)?.finish(false,false);
  return new Promise(resolve=>{
    let animation,settled=false;
    const state={finish(cleanup=true,completed=false){
      if(settled)return;
      settled=true;
      if(motions.get(element)===state)motions.delete(element);
      try{animation?.cancel();}catch{}
      if(cleanup){
        try{if(remove)element?.remove();}catch{}
        try{Promise.resolve(onFinish?.(completed)).catch(()=>{});}catch{}
      }
      resolve(completed);
    }};
    try{
      if(typeof element?.animate!=='function'){state.finish(true,false);return;}
      motions.set(element,state);
      animation=element.animate(keyframes,options);
      try{onStart?.(animation);}catch{}
      Promise.resolve(animation.finished).then(()=>state.finish(true,true),()=>state.finish(true,false));
    }catch{state.finish(true,false);}
  });
}

/**
 * Pure function computing keyframes for paper/prop landing.
 * Implements Release Inertia (damped spring overshoot opposite to drag velocity)
 * with Anticipation (brief squash/dip preparing for gravity impact).
 */
export function settleTiltKeyframes(rotation = 0, velocityTilt = 0, { anticipation = true } = {}) {
  const rot = Number.isFinite(rotation) ? rotation : 0;
  const tilt = Number.isFinite(velocityTilt) ? Math.max(-6, Math.min(6, velocityTilt)) : 0;

  if (anticipation) {
    return [
      {
        transform: `rotate(${rot + tilt * 0.35}deg) scale(1.025)`,
        easing: 'cubic-bezier(.2,.7,.3,1)',
      },
      {
        transform: `rotate(${rot + tilt * 0.45}deg) scale(1.018)`,
        offset: 0.18,
        easing: 'cubic-bezier(.4,0,.6,1)',
      },
      {
        transform: `rotate(${rot - tilt * 0.25 - 0.3}deg) scale(.998)`,
        offset: 0.72,
        easing: 'ease-out',
      },
      {
        transform: `rotate(${rot + tilt * 0.08 + 0.1}deg) scale(1.002)`,
        offset: 0.88,
        easing: 'ease-out',
      },
      {
        transform: `rotate(${rot}deg) scale(1)`,
      },
    ];
  }

  return [
    {
      transform: `rotate(${rot + tilt * 0.35}deg) scale(1.025)`,
      easing: 'cubic-bezier(.2,.7,.3,1)',
    },
    {
      transform: `rotate(${rot - tilt * 0.25 - 0.3}deg) scale(.998)`,
      offset: 0.72,
      easing: 'ease-out',
    },
    {
      transform: `rotate(${rot}deg) scale(1)`,
    },
  ];
}

/**
 * Accelerate running animations on an element rather than abruptly cancelling them.
 * Ideal for interrupting unfolding/opening animations so they finish crisply in ~100ms.
 */
export function fastForwardAnimations(element, rate = 4) {
  if (!element || typeof element.getAnimations !== 'function') return [];
  try {
    const list = element.getAnimations({ subtree: true });
    for (const anim of list) {
      try {
        if (anim.playbackRate !== undefined && anim.playState !== 'finished') {
          anim.playbackRate = rate;
        }
      } catch {}
    }
    return list;
  } catch {
    return [];
  }
}

/**
 * Crossfade an element smoothly over 120ms when reduced motion is preferred,
 * providing accessible transitions without motion sickness.
 */
export function reducedMotionCrossfade(element, { duration = MOTION_DURATION.reducedFade, onFinish } = {}) {
  return animateTransient(
    element,
    [{ opacity: 0 }, { opacity: 1 }],
    { duration, easing: 'ease-out' },
    { onFinish },
  );
}
