import {BOARD_LIMIT} from './model.mjs';
import {PAPER} from './paper-format.mjs';

export const TRAY_SCALE=.62;
export const TRAY_WIDTH=1600;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

export function trayPosition(item,index=0){
  const rowHeight=PAPER.height+40;
  const rows=Math.floor((BOARD_LIMIT.height-30-PAPER.height)/rowHeight)+1,bandSize=rows*4;
  return item.storagePosition??{x:34+(index%4+Math.floor(index/bandSize)*4)*(PAPER.width+80),y:30+Math.floor(index%bandSize/4)*rowHeight};
}
export function trayDrop(pointer,origin,grab={x:PAPER.width/2,y:28},scale=TRAY_SCALE,rotation=0,type='quest'){
  const height=type==='folder'?210:PAPER.height;
  const angle=rotation*Math.PI/180,cx=PAPER.width/2,cy=height/2;
  const dx=grab.x-cx,dy=grab.y-cy;
  return {x:clamp((pointer.x-origin.left)/scale-cx-dx*Math.cos(angle)+dy*Math.sin(angle),0,BOARD_LIMIT.width-PAPER.width),y:clamp((pointer.y-origin.top)/scale-cy-dx*Math.sin(angle)-dy*Math.cos(angle),0,BOARD_LIMIT.height-height)};
}
export function trayItems(state,search=''){
  const term=search.trim().toLocaleLowerCase();
  return state.items.filter(item=>item.archived&&(item.type==='folder'||item.type==='quest'&&!item.folderId))
    .filter(item=>!term||[item.title,item.name,item.description,item.category].some(value=>value?.toLocaleLowerCase().includes(term))
      ||item.type==='folder'&&state.items.some(q=>q.folderId===item.id&&[q.title,q.description,q.category].some(value=>value?.toLocaleLowerCase().includes(term))));
}

export function ensureTrayPositions(state){
  const all=trayItems(state),missing=all.filter(item=>!item.storagePosition);
  if(!missing.length)return state;
  const positions=new Map(missing.map(item=>[item.id,trayPosition(item,all.findIndex(i=>i.id===item.id))]));
  return {...state,items:state.items.map(item=>positions.has(item.id)?{...item,storagePosition:positions.get(item.id)}:item)};
}

export function storageInset(reveal,width){return Math.min(width,44+Math.max(0,reveal));}
export function undockedFitWidth(width,paddingLeft,paddingRight){return width+Math.max(0,paddingRight-paddingLeft);}

/** Horizontal dock. Its visible width is also reserved beside the board. */
export function bindStorageDrawer({drawer,handle,isOpen,setOpen,onStart=()=>{},onReveal=()=>{},onPullChange=()=>{},onMotion=()=>{},window=globalThis.window,now=()=>performance.now()}){
  let gesture=null,suppressUntil=0,drift=0;
  const motion=(offset=0,{from=drift,settle=false}={})=>{drift=offset;onMotion(offset,{from,settle});};
  const travel=()=>Math.max(0,drawer.offsetWidth-44);
  const reveal=value=>{
    drawer.style.setProperty('--drawer-reveal',`${value}px`);
    onReveal(storageInset(value,drawer.offsetWidth));
  };
  const sync=()=>{if(!gesture){reveal(isOpen()?travel():0);motion();}};
  handle.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    if(onStart()===false)return;
    const visible=clamp(window.innerWidth-handle.getBoundingClientRect().left-44,0,travel());
    gesture={pointer:event.pointerId,start:event.clientX,reveal:visible,current:visible,before:isOpen(),moved:false};
    motion();onPullChange(true);reveal(visible);
    drawer.classList.add('is-pulling');handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove',event=>{
    if(!gesture||event.pointerId!==gesture.pointer)return;
    gesture.moved ||= Math.abs(event.clientX-gesture.start)>5;
    const before=gesture.current;
    gesture.current=clamp(gesture.reveal+gesture.start-event.clientX,0,travel());
    reveal(gesture.current);
    motion(clamp((gesture.current-before)*.06,-3,3));
  });
  const finish=(event,cancelled)=>{
    if(!gesture||event.pointerId!==gesture.pointer)return;
    const previous=gesture,from=drift;gesture=null;
    if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
    drawer.classList.remove('is-pulling');
    onPullChange(false);
    if(previous.moved||cancelled){suppressUntil=now()+450;setOpen(cancelled?previous.before:previous.current>=travel()*.4);}
    sync();
    motion(0,{from,settle:previous.moved&&!cancelled});
  };
  handle.addEventListener('pointerup',event=>finish(event,false));
  handle.addEventListener('pointercancel',event=>finish(event,true));
  handle.addEventListener('click',event=>{if(event.detail===0||now()>suppressUntil){const open=!isOpen();setOpen(open);sync();motion(0,{from:open?2:-2,settle:true});}});
  window.addEventListener('resize',()=>{motion();sync();});
  window.addEventListener('blur',()=>{if(gesture)finish({pointerId:gesture.pointer},true);});
  sync();
  return {sync,travel,rest:()=>motion()};
}
