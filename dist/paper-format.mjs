// Physical A4 sheet dimensions; saved version-one ink coordinates stay stable.
export const PAPER=Object.freeze({width:300,height:300*297/210});
export const STAMP_SPACE=Object.freeze({width:300,height:350});
const clamp=(value,max)=>Math.max(0,Math.min(max,value));
function point(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||!Number.isFinite(value.x)||!Number.isFinite(value.y))throw new RangeError('ตำแหน่งตราประทับไม่ถูกต้อง');
  return value;
}
export function toPaperStampPosition(value){
  const {x,y}=point(value);
  return {x:clamp(x,STAMP_SPACE.width)*PAPER.width/STAMP_SPACE.width,y:clamp(y,STAMP_SPACE.height)*PAPER.height/STAMP_SPACE.height};
}
export function toStoredStampPosition(value){
  const {x,y}=point(value);
  return {x:clamp(x*STAMP_SPACE.width/PAPER.width,STAMP_SPACE.width),y:clamp(y*STAMP_SPACE.height/PAPER.height,STAMP_SPACE.height)};
}
