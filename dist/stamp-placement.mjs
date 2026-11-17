import {STAMP_SPACE} from './paper-format.mjs';

// The centre of an affine-transformed rectangle is also its bounding-box centre.
// Invert the current paper transform separately from its board's zoom so an
// in-flight tilt, translation or compression cannot displace the clicked ink.
export function stampPoint(pointer,rect,matrix,scale=1,size=STAMP_SPACE){
  const {a,b,c,d}=matrix;
  const values=[pointer.x,pointer.y,rect.left,rect.top,rect.width,rect.height,a,b,c,d,scale,size.width,size.height];
  const determinant=a*d-b*c;
  if(!values.every(Number.isFinite)||scale<=0||size.width<=0||size.height<=0||Math.abs(determinant)<1e-8)throw new RangeError('ตำแหน่งกระดาษไม่พร้อมสำหรับปั๊มตรา');
  const x=(pointer.x-rect.left-rect.width/2)/scale,y=(pointer.y-rect.top-rect.height/2)/scale;
  const clamp=(value,max)=>Math.min(max,Math.round(Math.max(0,Math.min(max,value))*1000)/1000);
  return {x:clamp(size.width/2+(d*x-c*y)/determinant,size.width),y:clamp(size.height/2+(a*y-b*x)/determinant,size.height)};
}
