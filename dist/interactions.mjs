import { BOARD, BOARD_LIMIT, DAILY_BOOK_SIZE, PAPERWEIGHT_SIZE } from './model.mjs';
import {NOTEBOOK_SIZE,PAPER,photoSheetSize} from './paper-format.mjs';

export function dragPosition(start, pointer, scale, boardShift={x:0,y:0}) {
  return { x: start.x + (pointer.x - start.pointerX - boardShift.x) / scale, y: start.y + (pointer.y - start.pointerY - boardShift.y) / scale };
}

export function containsPoint(point, rect) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

export function drawerReveal(startReveal, startX, pointerX, travel) {
  return Math.max(0, Math.min(travel, startReveal + startX - pointerX));
}

export function shouldOpenDrawer(reveal, travel) {
  return reveal >= travel * .4;
}

export function drawerForDraggedItem(type, current, hovered=null) {
  if(type==='folder')return 'folder-drawer';
  if(type==='daily-book'||type==='photo'||type==='notebook')return 'quest-drawer';
  if(type!=='quest')return current;
  if(['quest-drawer','folder-drawer'].includes(hovered))return hovered;
  return current==='folder-drawer'?'folder-drawer':'quest-drawer';
}

export function storageTrayAccepts(type, drawer) {
  return type==='folder'&&drawer==='folder-drawer'||(type==='quest'||type==='daily-book'||type==='photo'||type==='notebook')&&drawer==='quest-drawer';
}

export function rotatedOrigin(bounds, width, height, rotation, scale) {
  const angle=rotation*Math.PI/180;
  const halfWidth=width*scale/2, halfHeight=height*scale/2;
  return {
    x:bounds.left+bounds.width/2-halfWidth*Math.cos(angle)+halfHeight*Math.sin(angle),
    y:bounds.top+bounds.height/2-halfWidth*Math.sin(angle)-halfHeight*Math.cos(angle),
  };
}

function rotatedDimensions(type, rotation, aspect, photoScale) {
  const sizedSheet=type==='photo'?photoSheetSize(aspect,photoScale):type==='notebook'?NOTEBOOK_SIZE:null;
  const width=sizedSheet?.width??(type==='label'?230:type==='daily-book'?DAILY_BOOK_SIZE.width:type==='paperweight'?PAPERWEIGHT_SIZE:PAPER.width);
  const height=sizedSheet?.height??(type==='label'?70:type==='folder'?210:type==='daily-book'?DAILY_BOOK_SIZE.height:type==='paperweight'?PAPERWEIGHT_SIZE:PAPER.height);
  const angle=rotation*Math.PI/180;
  const cos=Math.abs(Math.cos(angle)), sin=Math.abs(Math.sin(angle));
  return {width,height,halfX:(width*cos+height*sin)/2,halfY:(width*sin+height*cos)/2};
}

export function canvasLayout(viewport, items, zoom=1, compact=false) {
  // Stored papers may extend the desk, but must never change its fitted paper size.
  // Fit against the viewport before scrollbars consume space. Using client height
  // here can repeatedly create/remove a horizontal scrollbar as the scale changes.
  const fitWidth=viewport.fitWidth??viewport.width, fitHeight=viewport.fitHeight??viewport.height;
  const scale=Math.max(compact?.85:.65,Math.min(fitWidth/BOARD.width,fitHeight/BOARD.height,1.1))*zoom;
  let width=Math.max(BOARD.width,viewport.width/scale);
  let height=Math.max(BOARD.height,viewport.height/scale);
  for(const item of items){
    const size=rotatedDimensions(item.type,item.rotation??0,item.aspect,item.photoScale);
    const margin=item.type==='paperweight'?0:24;
    width=Math.max(width,item.x+(size.width/2+size.halfX)+margin);
    height=Math.max(height,item.y+(size.height/2+size.halfY)+margin);
  }
  // Keep fractional board units so fitting does not introduce subpixel scrollbars.
  return {scale,width:Math.min(BOARD_LIMIT.width,width),height:Math.min(BOARD_LIMIT.height,height)};
}

export function rotatedClampPosition(x, y, type='quest', rotation=0, bounds=BOARD, aspect, photoScale) {
  const size=rotatedDimensions(type,rotation,aspect,photoScale);
  const minX=Math.max(0,size.halfX-size.width/2), minY=Math.max(0,size.halfY-size.height/2);
  const maxX=Math.min(bounds.width-size.width,bounds.width-(size.width/2+size.halfX));
  const maxY=Math.min(bounds.height-size.height,bounds.height-(size.height/2+size.halfY));
  return {x:Math.max(minX,Math.min(maxX,x)),y:Math.max(minY,Math.min(maxY,y))};
}

export function storedDragAnchor(type='quest', rotation=0) {
  const {width,height}=rotatedDimensions(type,rotation);
  const centerX=width/2,centerY=height/2,gripY=28-centerY;
  const angle=rotation*Math.PI/180;
  return {x:centerX-gripY*Math.sin(angle),y:centerY+gripY*Math.cos(angle)};
}

export function storedDropPosition(pointer, canvasOrigin, scale, type='quest', rotation=0, bounds=BOARD) {
  const anchor=storedDragAnchor(type,rotation);
  return rotatedClampPosition((pointer.x-canvasOrigin.x)/scale-anchor.x,(pointer.y-canvasOrigin.y)/scale-anchor.y,type,rotation,bounds);
}
