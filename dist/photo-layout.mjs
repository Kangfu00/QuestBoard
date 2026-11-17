import {PAPER} from './paper-format.mjs';

const CHROME_WIDTH=10,CHROME_HEIGHT=14,MAX_WIDTH=252;
const BODY={left:16,right:284,top:146,bottom:PAPER.height-90};
// Keep rotated corners strictly inside their boundary despite floating rounding.
const INSET=1e-9;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function object(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new RangeError('ข้อมูลการจัดรูปภาพไม่ถูกต้อง');
  return value;
}

function finite(value){
  if(typeof value!=='number'||!Number.isFinite(value))throw new RangeError('ขนาดหรือตำแหน่งรูปภาพต้องเป็นตัวเลขที่ใช้ได้');
  return value;
}

function intrinsic(size){
  object(size);
  const width=finite(size.width),height=finite(size.height);
  if(width<=0||height<=0)throw new RangeError('ขนาดรูปภาพต้องมากกว่าศูนย์');
  return {width,height};
}

function coordinates(value){
  object(value);
  return {x:finite(value.x),y:finite(value.y),width:finite(value.width),rotation:finite(value.rotation)};
}

export function photoOrientation(size){
  const {width,height}=intrinsic(size);
  return width===height?'square':width>height?'landscape':'portrait';
}

export function normalizePhotoLayout(value){
  if(value==null)return null;
  const layout=coordinates(value);
  if(layout.x<0||layout.x>PAPER.width||layout.y<0||layout.y>PAPER.height||layout.width<CHROME_WIDTH||layout.width>MAX_WIDTH||Math.abs(layout.rotation)>15){
    throw new RangeError('การจัดรูปภาพอยู่นอกขอบเขตกระดาษ');
  }
  return layout;
}

export function photoFrame(size,layout=null){
  const {width:intrinsicWidth,height:intrinsicHeight}=intrinsic(size);
  const orientation=photoOrientation(size),longest=Math.max(intrinsicWidth,intrinsicHeight);
  // A normalized direction avoids overflowing height/width for very tall photos.
  const u=intrinsicWidth/longest,v=intrinsicHeight/longest;
  if(layout==null){
    const landscape=orientation==='landscape',fitWidth=landscape?242:116,fitHeight=landscape?70:148;
    const scale=Math.min(longest,fitWidth/u,fitHeight/v);
    return {orientation,x:24,y:landscape?206:158,width:CHROME_WIDTH+u*scale,height:CHROME_HEIGHT+v*scale,rotation:-.6};
  }
  const draft=coordinates(layout),rotation=clamp(draft.rotation,-15,15);
  const angle=rotation*Math.PI/180,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
  const requestedWidth=clamp(draft.width,CHROME_WIDTH,MAX_WIDTH);
  const availableWidth=BODY.right-BODY.left-2*INSET,availableHeight=BODY.bottom-BODY.top-2*INSET;
  const scale=Math.min(
    u===0?Infinity:(requestedWidth-CHROME_WIDTH)/u,
    (availableWidth-c*CHROME_WIDTH-s*CHROME_HEIGHT)/(c*u+s*v),
    (availableHeight-s*CHROME_WIDTH-c*CHROME_HEIGHT)/(s*u+c*v),
  );
  const width=Math.min(requestedWidth,CHROME_WIDTH+u*scale),height=CHROME_HEIGHT+v*scale;
  const halfWidth=(c*width+s*height)/2,halfHeight=(s*width+c*height)/2;
  const centerX=clamp(draft.x+width/2,BODY.left+INSET+halfWidth,BODY.right-INSET-halfWidth);
  const centerY=clamp(draft.y+height/2,BODY.top+INSET+halfHeight,BODY.bottom-INSET-halfHeight);
  return {orientation,x:centerX-width/2,y:centerY-height/2,width,height,rotation};
}
