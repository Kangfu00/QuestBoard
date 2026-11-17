import {photoFrame} from './photo-layout.mjs';
import {PAPER} from './paper-format.mjs';
import {resolveStampSurface} from './stamp-surfaces.mjs';

const srcOf=image=>image?.getAttribute?.('src')??image?.src??'';
const has=(node,name)=>node?.classList?.contains(name)===true;
const consume=event=>{event.preventDefault();event.stopImmediatePropagation();};
const saved=frame=>({x:frame.x,y:frame.y,width:frame.width,rotation:frame.rotation});
const ghosts='.quest-drag-ghost,.quest-bundle-ghost,.paper-turn-ghost,.paper-turn-strip,.folio-closing-ghost,.folder-drag-ghost';
const ownUI='.quest-photo-controls,.quest-photo-editor';
const availability=['hidden','inert','aria-hidden','data-side','open'];
const input=node=>node?.closest?.('input,textarea,select,[contenteditable="true"]')||node?.isContentEditable;

/** Photo arrangements are local DOM drafts until the user chooses Done. */
export function createQuestPhotos({document=globalThis.document,window=globalThis.window,getQuest,onSave=()=>{},isBlocked=()=>false,onView=()=>{},onCue=()=>{},reducedMotion=()=>false}={}){
  const sizes=new Map(),images=new Map(),records=new Map(),listeners=[];
  let edit=null,gesture=null,destroyed=false,refreshing=false,scheduled=false;
  const listen=(target,type,fn,options=true)=>{target.addEventListener(type,fn,options);listeners.push(()=>target.removeEventListener(type,fn,options));};
  const blocked=()=>destroyed||isBlocked();

  function surface(paper){
    if(!paper||paper.isConnected===false||paper.closest?.(ghosts))return null;
    for(let node=paper;node;node=node.parentElement){
      if(node.hidden||node.inert||node.hasAttribute?.('hidden')||node.hasAttribute?.('inert')||node.getAttribute?.('aria-hidden')==='true')return null;
      const style=window.getComputedStyle?.(node);
      if(style?.display==='none'||style?.visibility==='hidden')return null;
    }
    const resolved=resolveStampSurface(paper);if(resolved)return resolved;
    const host=paper.closest?.('#drawer-list');
    if(host&&paper.dataset.storageId)return {id:paper.dataset.storageId,paper,host,kind:'tray'};
    return null;
  }
  function cache(image){
    const width=image.naturalWidth,height=image.naturalHeight;
    if(Number.isFinite(width)&&Number.isFinite(height)&&width>0&&height>0)sizes.set(srcOf(image),{width,height});
  }
  function presentation(quest){
    const size=sizes.get(quest?.imageDataUrl);return size?photoFrame(size,quest.photoLayout??null):null;
  }
  function button(action,label,title=label){
    const node=document.createElement('button');node.type='button';node.dataset.photoAction=action;node.textContent=label;node.title=title;node.setAttribute('aria-label',title);return node;
  }
  function controls(record){
    if(record.photo.querySelector('.quest-photo-controls'))return;
    const row=document.createElement('div');row.className='quest-photo-controls';row.append(button('edit','จัดรูป','จัดตำแหน่งรูป'),button('view','ขยาย','ดูรูปเต็ม'));record.photo.append(row);
  }
  function paint(record,layout){
    const quest=getQuest(record.id),size=sizes.get(quest?.imageDataUrl);if(!size)return;
    const active=edit?.paper===record.paper,frame=photoFrame(size,layout===undefined?quest.photoLayout??null:layout);
    for(const orientation of ['portrait','square','landscape'])record.paper.classList.toggle(`photo-${orientation}`,orientation===frame.orientation);
    record.paper.classList.add('photo-sized');record.paper.classList.toggle('photo-manual',(layout===undefined?quest.photoLayout:layout)!=null);record.paper.classList.toggle('photo-editing',active);
    Object.assign(record.photo.style,{left:`${frame.x}px`,top:`${frame.y}px`,width:`${frame.width}px`,height:`${frame.height}px`,maxWidth:'none',transform:`rotate(${frame.rotation}deg)`,transformOrigin:'center'});
    Object.assign(record.image.style,{width:`${Math.max(0,frame.width-10)}px`,height:`${Math.max(0,frame.height-14)}px`,maxWidth:'none',maxHeight:'none'});
    controls(record);if(active)edit.frame=frame;
  }
  function release(){
    if(!gesture)return;const current=gesture;gesture=null;
    try{if(current.photo.hasPointerCapture?.(current.pointerId))current.photo.releasePointerCapture(current.pointerId);}catch{}
  }
  function retire(){
    release();if(!edit)return null;const old=edit;edit=null;old.paper.classList.remove('photo-editing');old.editor?.remove();return old;
  }
  function cancel(){const old=retire();if(old&&!destroyed)refresh();}
  function refresh(){
    if(destroyed||refreshing)return;refreshing=true;
    try{
      const live=new Map();
      for(const paper of document.querySelectorAll('.quest-paper')){
        const current=surface(paper);if(!current)continue;
        const quest=getQuest(current.id),photo=paper.querySelector('.quest-photo'),image=photo?.querySelector('img');
        if(quest?.type!=='quest'||!quest.imageDataUrl||!image||srcOf(image)!==quest.imageDataUrl)continue;
        live.set(paper,{...current,photo,image});cache(image);
        if(!images.has(image)){
          const loaded=()=>{if(!destroyed){cache(image);refresh();}};
          image.addEventListener('load',loaded);images.set(image,loaded);
        }
      }
      if(edit){const current=live.get(edit.paper);if(!current||current.image!==edit.image||srcOf(current.image)!==edit.src||blocked())retire();}
      for(const [paper,record]of records)if(!live.has(paper)||live.get(paper).image!==record.image){record.photo.querySelector('.quest-photo-controls')?.remove();paper.querySelector('.quest-photo-editor')?.remove();paper.classList.remove('photo-editing');}
      records.clear();for(const [paper,record]of live)records.set(paper,record);
      const kept=new Set([...live.values()].map(record=>record.image));
      for(const [image,loaded]of images)if(!kept.has(image)){image.removeEventListener('load',loaded);images.delete(image);}
      for(const record of records.values())paint(record,edit?.paper===record.paper?edit.draft:undefined);
    }finally{refreshing=false;}
  }
  function recordAt(target){
    const editor=target?.closest?.('.quest-photo-editor'),activeEditor=edit&&editor===edit.editor&&editor.parentElement===edit.paper;
    const photo=activeEditor?edit.photo:target?.closest?.('.quest-photo'),paper=activeEditor?edit.paper:photo?.closest?.('.quest-paper'),record=records.get(paper);
    if(!record||record.photo!==photo||!surface(paper)||srcOf(record.image)!==getQuest(record.id)?.imageDataUrl)return null;
    return record;
  }
  function startEdit(record){
    if(!presentation(getQuest(record.id)))return;
    cancel();edit={...record,src:srcOf(record.image),draft:getQuest(record.id).photoLayout?{...getQuest(record.id).photoLayout}:null,frame:null};paint(record,edit.draft);
    const row=document.createElement('div');row.className='quest-photo-editor';row.setAttribute('role','group');row.setAttribute('aria-label','จัดตำแหน่งรูป');
    row.append(button('move','✥','ย้ายรูป · ปุ่มลูกศร'),button('resize','↘','ปรับขนาดรูป · ปุ่มลูกศร'),button('rotate','↻','หมุนรูป · ปุ่มลูกศร'),button('reset','อัตโนมัติ','คืนตำแหน่งอัตโนมัติ'),button('done','เสร็จ','บันทึกตำแหน่งรูป'),button('cancel','ยกเลิก','ยกเลิกการจัดรูป'));
    edit.editor=row;record.paper.append(row);row.querySelector('[data-photo-action="move"]')?.focus?.({preventScroll:true});onCue('paperPick',{reduced:reducedMotion()});
  }
  function apply(layout){
    if(!edit)return;const frame=photoFrame(sizes.get(edit.src),layout);edit.draft=saved(frame);paint(edit,edit.draft);
  }
  function done(){
    if(!edit)return;const layout=edit.draft===null?null:saved(edit.frame),old=retire();
    try{onSave(old.id,layout);onCue('paperDrop',{reduced:reducedMotion()});}finally{refresh();}
  }
  function focusSource(record,target){
    const button=target?.closest?.('button'),node=button&&record.paper.contains(button)?button:record.photo;
    if(node===record.photo)node.tabIndex=-1;
    node.focus?.({preventScroll:true});
  }
  function view(record,target){
    focusSource(record,target);
    const {id,host}=record,src=srcOf(record.image);
    onView({src,alt:record.image.alt??record.image.getAttribute('alt')??'',source:record.image,getSource(){
      if(host.isConnected===false)return null;
      for(const paper of host.querySelectorAll('.quest-paper')){
        const current=surface(paper),image=paper.querySelector('.quest-photo')?.querySelector('img');
        if(current?.host===host&&current.id===id&&srcOf(image)===src)return image;
      }return null;
    }});
  }
  // Use the real linear transform of every ancestor. The bounding-box center
  // removes translation and transform-origin offsets before affine inversion.
  function point(record,event){
    let matrix={a:1,b:0,c:0,d:1};
    for(let node=record.paper;node;node=node.parentElement){
      const style=window.getComputedStyle(node);let own={a:1,b:0,c:0,d:1,e:0,f:0};
      if(style.transform&&style.transform!=='none')own=new window.DOMMatrix(style.transform);
      if(![own.a,own.b,own.c,own.d,own.e,own.f].every(Number.isFinite))throw new RangeError('Invalid photo transform');
      if(own.is2D===false&&Object.entries({m13:0,m14:0,m23:0,m24:0,m31:0,m32:0,m33:1,m34:0,m43:0,m44:1}).some(([key,value])=>own[key]!==value))throw new RangeError('Photo is turning');
      const zoom=style.zoom&&style.zoom!=='normal'?Number(style.zoom):1;
      if(!Number.isFinite(zoom)||zoom<=0)throw new RangeError('Invalid photo zoom');
      const {a,b,c,d}=matrix;matrix={a:zoom*(own.a*a+own.c*b),b:zoom*(own.b*a+own.d*b),c:zoom*(own.a*c+own.c*d),d:zoom*(own.b*c+own.d*d)};
    }
    const rect=record.paper.getBoundingClientRect(),{a,b,c,d}=matrix,det=a*d-b*c,x=event.clientX-rect.left-rect.width/2,y=event.clientY-rect.top-rect.height/2;
    if(![x,y,rect.width,rect.height,a,b,c,d,det].every(Number.isFinite)||rect.width<=0||rect.height<=0||Math.abs(det)<1e-8)throw new RangeError('Invalid photo position');
    return {x:PAPER.width/2+(d*x-c*y)/det,y:PAPER.height/2+(a*y-b*x)/det};
  }
  function down(event){
    if(blocked()||event.button!==0||event.isPrimary===false)return;
    const record=recordAt(event.target);if(!record)return;
    focusSource(record,event.target);consume(event);if(!edit||edit.paper!==record.paper)return;
    const action=event.target.closest?.('[data-photo-action]')?.dataset.photoAction;
    if(action&&!['move','resize','rotate'].includes(action))return;
    release();try{
      const origin=point(record,event),frame={...edit.frame};gesture={action:action??'move',origin,frame,pointerId:event.pointerId,photo:record.photo};record.photo.setPointerCapture?.(event.pointerId);
    }catch{cancel();}
  }
  function move(event){
    if(!gesture||event.pointerId!==gesture.pointerId)return;
    consume(event);if(blocked()||!edit||!surface(edit.paper)||srcOf(edit.image)!==getQuest(edit.id)?.imageDataUrl){cancel();return;}
    try{
      const current=point(edit,event),{origin,frame,action}=gesture,dx=current.x-origin.x,dy=current.y-origin.y;
      if(action==='move')apply({...frame,x:frame.x+dx,y:frame.y+dy});
      else if(action==='rotate'){
        const cx=frame.x+frame.width/2,cy=frame.y+frame.height/2,angle=Math.atan2(current.y-cy,current.x-cx)-Math.atan2(origin.y-cy,origin.x-cx);
        apply({...frame,rotation:frame.rotation+Math.atan2(Math.sin(angle),Math.cos(angle))*180/Math.PI});
      }else{
        const angle=frame.rotation*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle),ratio=(frame.height-14)/(frame.width-10),localX=dx*cos+dy*sin,localY=dy*cos-dx*sin;
        const width=Math.max(20,frame.width+(localX+ratio*localY)/(1+ratio*ratio)),next=photoFrame(sizes.get(edit.src),{...frame,width}),dw=next.width-frame.width,dh=next.height-frame.height;
        apply({...next,x:frame.x+(cos-1)*dw/2-sin*dh/2,y:frame.y+sin*dw/2+(cos-1)*dh/2});
      }
    }catch{cancel();}
  }
  function up(event){if(gesture&&event.pointerId===gesture.pointerId){consume(event);release();}}
  function click(event){
    if(blocked())return;const record=recordAt(event.target);if(!record)return;consume(event);
    const action=event.target.closest?.('[data-photo-action]')?.dataset.photoAction;
    if(action==='edit'&&!edit)startEdit(record);
    else if(action==='view'&&!edit)view(record,event.target);
    else if(edit?.paper===record.paper){if(action==='done')done();else if(action==='cancel')cancel();else if(action==='reset'){release();edit.draft=null;paint(edit,null);}}
  }
  function doubleClick(event){const record=recordAt(event.target);if(!record||blocked())return;consume(event);if(!edit&&!event.target.closest?.('[data-photo-action]'))view(record,event.target);}
  function keydown(event){
    if(!edit||input(event.target)||blocked())return;
    if(event.key==='Escape'){consume(event);cancel();return;}
    if(recordAt(event.target)?.paper!==edit.paper)return;
    const action=event.target.closest?.('[data-photo-action]')?.dataset.photoAction;
    if(!['move','resize','rotate'].includes(action)||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    consume(event);const step=event.shiftKey?10:1,sign=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1,frame=edit.frame;
    if(action==='rotate')apply({...frame,rotation:frame.rotation+sign*step});
    else if(action==='resize')apply({...frame,width:Math.max(20,frame.width+sign*step)});
    else apply({...frame,x:frame.x+(['ArrowLeft','ArrowRight'].includes(event.key)?sign*step:0),y:frame.y+(['ArrowUp','ArrowDown'].includes(event.key)?sign*step:0)});
  }
  listen(document,'pointerdown',down);listen(document,'click',click);listen(document,'dblclick',doubleClick);listen(document,'keydown',keydown);
  const pointerCancelled=event=>{if(gesture&&gesture.pointerId===event.pointerId)cancel();};
  listen(window,'pointermove',move);listen(window,'pointerup',up);listen(window,'pointercancel',pointerCancelled);listen(document,'lostpointercapture',pointerCancelled);
  // Capture also sees blur from photo buttons when focus moves inside the editor.
  // Only leaving the browser window should discard an arrangement draft.
  listen(window,'blur',cancel,false);listen(window,'resize',cancel);listen(window,'pagehide',cancel);
  const observer=window.MutationObserver?new window.MutationObserver(changes=>{
    if(destroyed||scheduled)return;
    const relevant=changes.some(change=>{
      if(change.target?.closest?.(ownUI))return false;
      if(change.type==='attributes')return availability.includes(change.attributeName)&&(change.target.matches?.('.quest-paper')||change.target.querySelector?.('.quest-paper'));
      return [...(change.addedNodes??[]),...(change.removedNodes??[])].some(node=>{
        if(node.nodeType===3||node.matches?.(ownUI))return false;
        return node.matches?.('.quest-paper')||node.querySelector?.('.quest-paper')||(change.target?.closest?.('.quest-paper')&&(node.matches?.('img,.quest-photo')||node.querySelector?.('img')));
      });
    });
    if(relevant){scheduled=true;queueMicrotask(()=>{scheduled=false;refresh();});}
  }):null;
  observer?.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:availability});refresh();
  function destroy(){
    if(destroyed)return;retire();destroyed=true;observer?.disconnect();for(const remove of listeners)remove();for(const [image,loaded]of images)image.removeEventListener('load',loaded);
    for(const record of records.values()){record.photo.querySelector('.quest-photo-controls')?.remove();record.paper.querySelector('.quest-photo-editor')?.remove();}images.clear();records.clear();sizes.clear();
  }
  return {refresh,presentation,cancel,destroy,get editing(){return !!edit;}};
}
