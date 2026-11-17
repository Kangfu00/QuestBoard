import {BOARD_LIMIT,validateState} from './model.mjs';
import {rotatedClampPosition} from './interactions.mjs';
import {PAPER} from './paper-format.mjs';

const finite=(...values)=>values.every(Number.isFinite);
const clean=value=>Math.round(value*1e6)/1e6;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const cleanClamp=(value,min,max)=>value<=min?min:value>=max?max:clamp(clean(value),min,max);

/** Recover the grabbed local pixel from the paper's current affine projection. */
export function sourceAnchor(pointer,rect,matrix){
  const {a,b,c,d}=matrix,det=a*d-b*c;
  if(!finite(pointer.x,pointer.y,rect.left,rect.top,rect.width,rect.height,a,b,c,d)||Math.abs(det)<1e-8||rect.width<=0||rect.height<=0)throw new RangeError('Paper geometry is unavailable');
  const x=pointer.x-rect.left-rect.width/2,y=pointer.y-rect.top-rect.height/2;
  return {grab:{x:cleanClamp(PAPER.width/2+(d*x-c*y)/det,0,PAPER.width),y:cleanClamp(PAPER.height/2+(a*y-b*x)/det,0,PAPER.height)},scale:Math.hypot(a,b),rotation:clean(Math.atan2(b,a)*180/Math.PI)};
}

export function bundleDropPosition(pointer,target,grab,rotation=0){
  const {origin,scale}=target??{};
  if(!origin||!pointer||!grab||!finite(pointer.x,pointer.y,origin.left,origin.top,scale,grab.x,grab.y,rotation)||scale<=0||grab.x<0||grab.x>PAPER.width||grab.y<0||grab.y>PAPER.height)throw new RangeError('Invalid bundle drop geometry');
  const angle=rotation*Math.PI/180,dx=grab.x-PAPER.width/2,dy=grab.y-PAPER.height/2;
  const x=(pointer.x-origin.left)/scale-PAPER.width/2-dx*Math.cos(angle)+dy*Math.sin(angle);
  const y=(pointer.y-origin.top)/scale-PAPER.height/2-dx*Math.sin(angle)-dy*Math.cos(angle);
  if(target.type==='tray')return {x:cleanClamp(x,0,BOARD_LIMIT.width-PAPER.width),y:cleanClamp(y,0,BOARD_LIMIT.height-PAPER.height)};
  const bounds=target.bounds;
  if(target.type!=='board'||!bounds||!finite(bounds.width,bounds.height)||bounds.width<PAPER.width||bounds.height<PAPER.height||bounds.width>BOARD_LIMIT.width||bounds.height>BOARD_LIMIT.height)throw new RangeError('Invalid bundle destination');
  const position=rotatedClampPosition(x,y,'quest',rotation,bounds);
  // Re-clamp after rounding so fractional A4 edges cannot round outside bounds.
  return rotatedClampPosition(clean(position.x),clean(position.y),'quest',rotation,bounds);
}

/** Build and validate one final state; the caller alone owns persistence. */
export function moveQuestBundle(state,ids,target,pointer,grab){
  if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)throw new Error('Invalid quest selection');
  const quests=ids.map(id=>state.items.find(item=>item.id===id));
  if(quests.some(item=>!item||item.type!=='quest'))throw new Error('A selected quest no longer exists');
  if(!target||!['folder','tray','board'].includes(target.type))throw new Error('Invalid bundle destination');
  if(target.type==='folder'&&!state.items.some(item=>item.id===target.id&&item.type==='folder'))throw new Error('The destination folder no longer exists');
  const base=target.type==='folder'?null:bundleDropPosition(pointer,target,grab,quests[0].rotation);
  const top=Math.max(0,...state.items.map(item=>item.z));
  const patches=new Map(quests.map((quest,index)=>{
    if(target.type==='folder')return [quest.id,{archived:true,folderId:target.id}];
    const offset=Math.min(index,4)*10;
    if(target.type==='tray')return [quest.id,{archived:true,folderId:null,z:top+index+1,storagePosition:{x:Math.min(BOARD_LIMIT.width-PAPER.width,base.x+offset),y:Math.min(BOARD_LIMIT.height-PAPER.height,base.y+offset)}}];
    const position=rotatedClampPosition(base.x+offset,base.y+offset,'quest',quest.rotation,target.bounds);
    return [quest.id,{...position,archived:false,folderId:null,z:top+index+1}];
  }));
  const next={...state,items:state.items.map(item=>patches.has(item.id)?{...item,...patches.get(item.id)}:item)};
  validateState(next);
  return next;
}
