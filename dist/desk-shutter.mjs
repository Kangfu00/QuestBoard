const clamp=(value,max)=>Math.max(0,Math.min(max,value));

export function bindDeskShutter({shutter,panel,handle,surface,window,canUse=()=>true,onChange=()=>{}}){
  let closed=false,gesture=null,suppressClick=false;
  const travel=()=>Math.max(0,shutter.clientHeight-handle.offsetHeight);

  function setClosed(next){
    const changed=closed!==next;
    closed=next;
    shutter.classList.toggle('is-closed',closed);
    surface.inert=closed;
    const label=closed?'ลากลงหรือคลิกเพื่อเปิดโต๊ะเควส':'ลากขึ้นหรือคลิกเพื่อปิดโต๊ะเควส';
    handle.setAttribute('aria-expanded',String(!closed));
    handle.setAttribute('aria-label',label);
    handle.title=label;
    if(changed){
      if(closed)handle.focus({preventScroll:true});
      onChange(closed);
    }
  }

  function paintPull(){
    const {offset,limit}=gesture;
    panel.style.setProperty('--shutter-offset',`${offset}px`);
    shutter.style.setProperty('--shutter-shade',String(limit?1-offset/limit:Number(closed)));
  }

  function start(event){
    if(event.button!==0||event.isPrimary===false||gesture||!canUse())return;
    suppressClick=false;
    const limit=travel();
    const startOffset=clamp(panel.getBoundingClientRect().top-shutter.getBoundingClientRect().top,limit);
    gesture={pointerId:event.pointerId,startY:event.clientY,startOffset,offset:startOffset,limit,moved:false};
    shutter.classList.add('is-pulling');
    paintPull();
    handle.setPointerCapture(event.pointerId);
  }

  function move(event){
    if(!gesture||gesture.pointerId!==event.pointerId)return;
    const distance=event.clientY-gesture.startY;
    gesture.moved||=Math.abs(distance)>5;
    if(!gesture.moved)return;
    gesture.offset=clamp(gesture.startOffset+distance,gesture.limit);
    paintPull();
  }

  function finish(event,cancelled=false){
    if(!gesture||gesture.pointerId!==event.pointerId)return;
    if(!cancelled)move(event);
    const previous=gesture;
    gesture=null;
    if(handle.hasPointerCapture(previous.pointerId))handle.releasePointerCapture(previous.pointerId);
    shutter.classList.remove('is-pulling');
    panel.style.removeProperty('--shutter-offset');
    shutter.style.removeProperty('--shutter-shade');
    if(cancelled){suppressClick=true;return;}
    if(previous.moved){
      suppressClick=true;
      const threshold=previous.limit*(closed?.4:.6);
      setClosed(previous.offset<=threshold);
    }else if(event.pointerType==='touch'&&canUse()){
      // Touch release also works when pointer capture suppresses the tap click.
      suppressClick=true;
      setClosed(!closed);
    }
  }

  function cancel(){if(gesture)finish({pointerId:gesture.pointerId},true);}
  handle.addEventListener('pointerdown',start);
  handle.addEventListener('pointermove',move);
  handle.addEventListener('pointerup',event=>finish(event));
  handle.addEventListener('pointercancel',event=>finish(event,true));
  handle.addEventListener('lostpointercapture',event=>finish(event,true));
  handle.addEventListener('click',event=>{
    if(event.detail!==0&&suppressClick){suppressClick=false;return;}
    if(!gesture&&canUse())setClosed(!closed);
  });
  handle.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||!gesture)return;
    event.preventDefault();event.stopPropagation();cancel();
  });
  window.addEventListener('blur',cancel);
  window.addEventListener('resize',cancel);
  setClosed(false);
  return {get pulling(){return gesture!==null;},get closed(){return closed;}};
}
