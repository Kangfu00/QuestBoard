import {stampPoint} from './stamp-placement.mjs';
import {PAPER,toStoredStampPosition} from './paper-format.mjs';

const hasClass=(node,name)=>node?.classList?.contains(name)===true;
const tag=node=>node?.tagName?.toLowerCase();
const ghosts=['paper-turn-ghost','paper-turn-strip','folio-closing-ghost','quest-drag-ghost'];
const unavailable=node=>node.hidden===true||node.inert===true||node.hasAttribute?.('hidden')||node.hasAttribute?.('inert')||node.getAttribute?.('aria-hidden')==='true'||ghosts.some(name=>hasClass(node,name));
function isControl(node){
  const printed=hasClass(node,'quest-title')||hasClass(node,'quest-top');
  return ['input','textarea','select','option','a','label','summary'].includes(tag(node))
    ||(tag(node)==='button'&&!printed)
    ||(['button','link','checkbox','textbox','combobox'].includes(node.getAttribute?.('role'))&&!printed)
    ||node.isContentEditable===true||(node.hasAttribute?.('contenteditable')&&node.getAttribute('contenteditable')!=='false')
    ||['paper-turn-corner','reader-turn','quest-bundle-select'].some(name=>hasClass(node,name))
    ||node.hasAttribute?.('data-bundle-select');
}

/** Find the live paper copy under the pointer, keeping its persistent window. */
export function resolveStampSurface(target){
  const element=target?.nodeType===3?target.parentElement:target;
  const paper=element?.closest?.('.quest-paper');
  if(!paper||paper.isConnected===false)return null;
  for(let node=element;node;node=node.parentElement){
    if(unavailable(node))return null;
    if(node===paper)break;
    if(isControl(node))return null;
  }
  for(let node=paper.parentElement;node;node=node.parentElement)if(unavailable(node))return null;

  const parent=paper.parentElement;
  if(parent?.id==='board-canvas'&&paper.dataset.id)return {id:paper.dataset.id,paper,kind:'board',host:parent};

  if(hasClass(parent,'reader-front')){
    const live=parent.parentElement,scene=live?.parentElement,host=scene?.parentElement;
    if(hasClass(live,'paper-reader-live')&&hasClass(scene,'paper-reader-scene')&&!hasClass(scene,'paper-is-turning')
      &&tag(host)==='dialog'&&hasClass(host,'paper-reader')&&host.open===true&&host.dataset.side==='front'&&scene.dataset.side==='front'&&host.dataset.readerQuest){
      return {id:host.dataset.readerQuest,paper,kind:'reader',host};
    }
  }
  if(hasClass(parent,'folio-paper-stage')){
    const viewport=parent.parentElement,right=viewport?.parentElement,host=right?.parentElement;
    if(hasClass(viewport,'folio-paper-viewport')&&hasClass(right,'folio-right')&&hasClass(host,'folder-window')&&hasClass(host,'folio-spread')&&host.dataset.openFolder&&paper.dataset.folioPaper){
      return {id:paper.dataset.folioPaper,paper,kind:'folio',host};
    }
  }
  return null;
}

/** Refreshes can replace a paper; never resolve its ID in another window. */
export function refreshStampSurface(surface){
  if(!surface?.host||surface.host.isConnected===false)return null;
  for(const paper of surface.host.querySelectorAll('.quest-paper')){
    const current=resolveStampSurface(paper);
    if(current?.host===surface.host&&current.id===surface.id&&current.kind===surface.kind)return current;
  }
  return null;
}

const invalid=()=>new RangeError('ตำแหน่งกระดาษไม่พร้อมสำหรับปั๊มตรา');
function affine(transform,Matrix){
  if(!transform||transform==='none')return {a:1,b:0,c:0,d:1};
  let matrix;
  try{matrix=new Matrix(transform);}catch{throw invalid();}
  if(![matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f].every(Number.isFinite))throw invalid();
  // rotateY(0deg) on the reader may serialize as matrix3d despite being affine.
  if(matrix.is2D===false){
    const expected={m13:0,m14:0,m23:0,m24:0,m31:0,m32:0,m33:1,m34:0,m43:0,m44:1};
    if(Object.entries(expected).some(([name,value])=>matrix[name]!==value))throw invalid();
  }
  return matrix;
}

/** Invert actual A4 presentation transforms, then preserve saved 300×350 ink coordinates. */
export function stampSurfacePoint(surface,pointer,{getComputedStyle=globalThis.getComputedStyle,Matrix=globalThis.DOMMatrix}={}){
  const current=resolveStampSurface(surface?.paper);
  if(!current||current.host!==surface.host||current.kind!==surface.kind||current.id!==surface.id||typeof getComputedStyle!=='function')throw invalid();
  let matrix={a:1,b:0,c:0,d:1};
  for(let node=surface.paper;node;node=node.parentElement){
    const own=affine(getComputedStyle(node).transform,Matrix),{a,b,c,d}=matrix;
    matrix={a:own.a*a+own.c*b,b:own.b*a+own.d*b,c:own.a*c+own.c*d,d:own.b*c+own.d*d};
    if(tag(node)==='body')break;
  }
  const rect=surface.paper.getBoundingClientRect();
  if(rect.width<=0||rect.height<=0)throw invalid();
  return toStoredStampPosition(stampPoint(pointer,rect,matrix,1,PAPER));
}
