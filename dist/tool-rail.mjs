export const TOOL_HANDLE=30;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const undockedFitHeight=(height,paddingTop,paddingBottom)=>height+Math.max(0,paddingTop-paddingBottom);

/** A shallow vertical rail; callbacks reserve its visible height above the desk. */
export function bindToolRail({rail,handle,isOpen,setOpen,onStart=()=>{},onReveal=()=>{},onPullChange=()=>{},window=globalThis.window,now=()=>performance.now()}){
  let gesture=null,suppressUntil=0;
  const travel=()=>Math.max(0,rail.offsetHeight-TOOL_HANDLE);
  const reveal=value=>{rail.style.setProperty('--drawer-reveal',`${value}px`);onReveal(Math.min(rail.offsetHeight,TOOL_HANDLE+value));};
  const sync=()=>{if(!gesture)reveal(isOpen()?travel():0);};
  handle.addEventListener('pointerdown',event=>{
    if(event.button!==0||onStart()===false)return;
    const visible=clamp(handle.getBoundingClientRect().bottom-TOOL_HANDLE,0,travel());
    gesture={pointer:event.pointerId,start:event.clientY,startReveal:visible,reveal:visible,before:isOpen(),moved:false};
    onPullChange(true);reveal(visible);rail.classList.add('is-pulling');handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove',event=>{
    if(!gesture||event.pointerId!==gesture.pointer)return;
    gesture.moved ||= Math.abs(event.clientY-gesture.start)>5;
    gesture.reveal=clamp(gesture.startReveal+event.clientY-gesture.start,0,travel());reveal(gesture.reveal);
  });
  const finish=(event,cancelled)=>{
    if(!gesture||event.pointerId!==gesture.pointer)return;
    const previous=gesture;gesture=null;
    if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
    rail.classList.remove('is-pulling');onPullChange(false);
    if(previous.moved||cancelled){suppressUntil=now()+450;setOpen(cancelled?previous.before:previous.reveal>=travel()*.4);}
    sync();
  };
  handle.addEventListener('pointerup',event=>finish(event,false));
  handle.addEventListener('pointercancel',event=>finish(event,true));
  handle.addEventListener('click',event=>{if(event.detail===0||now()>suppressUntil){setOpen(!isOpen());sync();}});
  window.addEventListener('resize',sync);
  window.addEventListener('blur',()=>{if(gesture)finish({pointerId:gesture.pointer},true);});
  sync();return {sync,travel};
}
