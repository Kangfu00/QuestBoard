// Physical A4 sheet dimensions; saved version-one ink coordinates stay stable.
export const PAPER=Object.freeze({width:300,height:300*297/210});
export const NOTEBOOK_SIZE=Object.freeze({width:232,height:328});
export const STAMP_SPACE=Object.freeze({width:300,height:350});
export const PHOTO_SHEET_SCALE = Object.freeze({min:.55,max:2.25});
export function photoSheetSize(aspect = 1,scale = 1){
  const base=aspect >= 1
    ? {width:300,height:Math.max(100,Math.round(300/aspect))}
    : {width:Math.max(100,Math.round(300*aspect)),height:300};
  return {width:base.width*scale,height:base.height*scale};
}
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
