import {photoSheetSize,PHOTO_SHEET_SCALE} from './paper-format.mjs';
import {MAX_QUEST_NOTES} from './model.mjs';
import {createPaperTurn} from './paper-turn.mjs';
import {createBackEditor} from './quest-back.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function imageMarkup(photo) {
  return `<img class="photo-sheet-image ${photo.tone==='gold'?'photo-tone-gold':''}" src="${escape(photo.imageDataUrl)}" alt="${escape(photo.title)}" draggable="false" decoding="async">`;
}

export function renderPhotoSheet(photo,{storage=false,position=photo}={}) {
  const {width,height}=photoSheetSize(photo.aspect,photo.photoScale), id=escape(photo.id), title=escape(photo.title);
  const percent=Math.round((photo.photoScale??1)*100);
  return `<article class="board-item desk-photo-sheet" ${storage?'data-storage-id':'data-id'}="${id}" style="left:${position.x}px;top:${position.y}px;width:${width}px;height:${height}px;--rotation:${photo.rotation}deg;z-index:${photo.z}">
    <button type="button" class="photo-sheet-grip drag-handle" ${storage?`data-photo-drag="${id}"`:''} data-read-photo="${id}" aria-label="เปิดภาพ ${title}">${imageMarkup(photo)}</button>
    <button type="button" class="paper-turn-corner photo-sheet-corner" data-read-photo="${id}" data-photo-back aria-label="พลิกไปจดด้านหลังภาพ ${title}" title="พลิกไปจดด้านหลัง">↷</button>
    <span class="photo-sheet-resize" data-photo-resize="${id}" role="slider" tabindex="0" aria-label="ขนาดภาพ ${title}" aria-valuemin="${Math.round(PHOTO_SHEET_SCALE.min*100)}" aria-valuemax="${Math.round(PHOTO_SHEET_SCALE.max*100)}" aria-valuenow="${percent}" title="ลากเพื่อปรับขนาด หรือใช้ปุ่มลูกศร">↘</span>
  </article>`;
}

const resizeSelector='[data-photo-resize]';
const limitScale=value=>Math.max(PHOTO_SHEET_SCALE.min,Math.min(PHOTO_SHEET_SCALE.max,Math.round(value*100)/100));

/** Keep the live resize on the sheet until release. The desk saves once. */
export function bindPhotoSheetResizing({document,window,getPhoto,getPlaneScale,save,isBlocked,onError,onStart}) {
  let gesture=null,frame=null;
  const cardFor=handle=>handle?.closest('.desk-photo-sheet');

  function paint(current,scale){
    const {width,height}=photoSheetSize(current.photo.aspect,scale);
    current.card.style.width=`${width}px`;
    current.card.style.height=`${height}px`;
    current.handle.setAttribute('aria-valuenow',String(Math.round(scale*100)));
  }

  function stop(){
    const current=gesture;
    if(!current)return;
    gesture=null;
    if(frame!==null)window.cancelAnimationFrame(frame);
    frame=null;
    current.card.classList.remove('photo-is-resizing');
    paint(current,current.initial);
    if(current.handle.hasPointerCapture(current.pointerId))current.handle.releasePointerCapture(current.pointerId);
  }

  function start(event){
    const handle=event.target.closest(resizeSelector),card=cardFor(handle);
    if(!card||gesture||event.button!==0||event.isPrimary===false||isBlocked())return;
    const photo=getPhoto(handle.dataset.photoResize),planeScale=getPlaneScale(card);
    if(photo?.type!=='photo'||!(planeScale>0))return;
    event.preventDefault();event.stopPropagation();
    onStart(card);
    handle.focus({preventScroll:true});
    const {width,height}=photoSheetSize(photo.aspect),angle=photo.rotation*Math.PI/180;
    gesture={photo,card,handle,planeScale,x:event.clientX,y:event.clientY,pointerId:event.pointerId,
      width,height,cos:Math.cos(angle),sin:Math.sin(angle),initial:photo.photoScale??1,next:photo.photoScale??1};
    card.classList.add('photo-is-resizing');
    handle.setPointerCapture(event.pointerId);
  }

  function move(event){
    const current=gesture;
    if(!current||current.pointerId!==event.pointerId)return;
    if(!current.card.isConnected||current.planeScale!==getPlaneScale(current.card)||isBlocked()){stop();return;}
    const dx=(event.clientX-current.x)/current.planeScale,dy=(event.clientY-current.y)/current.planeScale;
    const across=dx*current.cos+dy*current.sin,down=dy*current.cos-dx*current.sin;
    const {width,height}=current;
    // Project onto the sheet diagonal so a single factor fits both axes.
    current.next=limitScale(current.initial+(across*width+down*height)/(width*width+height*height));
    if(frame!==null)return;
    frame=window.requestAnimationFrame(()=>{frame=null;if(gesture===current)paint(current,current.next);});
  }

  function commit(id,scale){
    try{save(id,scale);}catch(error){onError(error.message);}
  }

  function end(event){
    if(!gesture||gesture.pointerId!==event.pointerId)return;
    move(event);
    const current=gesture;
    stop();
    if(current&&current.next!==current.initial)commit(current.photo.id,current.next);
  }

  function cancel(event){if(event.pointerId===gesture?.pointerId)stop();}
  function keyboard(event){
    if(event.key==='Escape'&&gesture){event.preventDefault();event.stopImmediatePropagation();stop();return;}
    const id=event.target.dataset?.photoResize;
    const direction=['ArrowRight','ArrowUp'].includes(event.key)?1:['ArrowLeft','ArrowDown'].includes(event.key)?-1:0;
    if(!id||!direction||gesture||isBlocked()||event.altKey||event.metaKey||event.ctrlKey)return;
    const photo=getPhoto(id);
    if(photo?.type!=='photo')return;
    event.preventDefault();
    const previous=photo.photoScale??1,next=limitScale(previous+direction*(event.shiftKey?.25:.1));
    if(next!==previous)commit(id,next);
  }

  document.addEventListener('pointerdown',start,true);
  document.addEventListener('keydown',keyboard,true);
  document.addEventListener('lostpointercapture',cancel,true);
  window.addEventListener('pointermove',move,true);
  window.addEventListener('pointerup',end,true);
  window.addEventListener('pointercancel',cancel,true);
  window.addEventListener('blur',stop);
  window.addEventListener('pagehide',stop);
  return {cancel:stop,get active(){return gesture!==null;}};
}

/** Photo windows share desk stacking and the curved paper motion. */
export function createPhotoSheetReader({document,window,windows,getPhoto,onSave,onStore,onDelete,onCue,onError,icon,reducedMotion}) {
  const readers=new Map();
  const flush=()=>{let ready=true;for(const reader of readers.values())if(!reader.flush())ready=false;return ready;};
  const flushWhenHidden=()=>{if(document.hidden)flush();};
  const closeAll=()=>{
    if(!flush())return false;
    for(const reader of [...readers.values()])reader.close();
    return true;
  };
  window.addEventListener('pagehide',flush);
  window.addEventListener('blur',flush);
  document.addEventListener('visibilitychange',flushWhenHidden);

  function refreshStorage(){for(const reader of readers.values())reader.refreshStorage();}

  function open(id,{back=false}={}) {
    const existing=readers.get(id);
    if(existing){existing.raise();if(back)existing.showBack();return;}
    const photo=getPhoto(id);
    if(photo?.type!=='photo')return;
    const trigger=document.activeElement;
    const panel=document.createElement('dialog');
    const size=photoSheetSize(photo.aspect);
    panel.className='paper-reader photo-sheet-reader';
    panel.style.setProperty('--photo-sheet-ratio',String(size.width/size.height));
    panel.setAttribute('aria-label',`ภาพ ${photo.title}`);
    panel.innerHTML=`<div class="paper-reader-scene photo-sheet-scene">
      <div class="paper-reader-live">
        <div class="reader-face reader-front">${imageMarkup(photo)}</div>
        <div class="reader-face reader-back photo-sheet-back">
          <label for="photo-notes-${id}">โน้ตด้านหลังภาพ</label>
          <textarea id="photo-notes-${id}" class="photo-sheet-notes" maxlength="${MAX_QUEST_NOTES}" placeholder="จดเรื่องของภาพนี้…">${escape(photo.notes)}</textarea>
          <p class="photo-sheet-status" role="status"></p>
          <button type="button" class="photo-sheet-retry" hidden>ลองบันทึกอีกครั้ง</button>
        </div>
      </div>
      <div class="photo-sheet-toolbar">
        <button type="button" class="photo-sheet-tone"></button>
        <button type="button" class="photo-sheet-storage"></button>
        <button type="button" class="photo-sheet-delete" aria-label="ลบภาพ" title="ลบภาพ">${icon('trash')}</button>
        <button type="button" class="photo-sheet-close" aria-label="ปิดภาพ" title="ปิดภาพ">${icon('cross')}</button>
      </div>
      <button type="button" class="reader-turn-corner photo-sheet-flip"></button>
    </div>`;
    const find=selector=>panel.querySelector(selector);
    const scene=find('.photo-sheet-scene'),front=find('.reader-front'),rear=find('.reader-back'),image=front.firstElementChild;
    const flipButton=find('.photo-sheet-flip'),toneButton=find('.photo-sheet-tone'),notes=find('.photo-sheet-notes');
    const status=find('.photo-sheet-status'),retry=find('.photo-sheet-retry'),storageButton=find('.photo-sheet-storage');
    const turn=createPaperTurn({document,reducedMotion,onCue});
    let side='front',tone=photo.tone,opening=null,registration;
    let archived;

    const editor=createBackEditor({quest:photo,onSave:({notes})=>onSave(id,{notes}),onStatus:({mode,error})=>{
      status.textContent=mode==='error'?error:mode==='pending'?'กำลังบันทึก…':mode==='saved'?'บันทึกแล้ว':'';
      retry.hidden=mode!=='error';
    }});

    function paintTone() {
      image.classList.toggle('photo-tone-gold',tone==='gold');
      toneButton.textContent=tone==='gold'?'สีต้นฉบับ':'โทนทอง';
    }
    function paintStorage(){
      const stored=!!getPhoto(id)?.archived;
      if(stored===archived)return;
      archived=stored;
      const label=archived?'นำรูปกลับขึ้นโต๊ะ':'เก็บรูปเข้าลิ้นชัก';
      storageButton.innerHTML=icon(archived?'restore':'archive');
      storageButton.title=label;
      storageButton.setAttribute('aria-label',label);
    }

    function showSide(next) {
      side=next;
      scene.dataset.side=next;
      const isBack=next==='back';
      front.inert=isBack;
      rear.inert=!isBack;
      front.setAttribute('aria-hidden',String(isBack));
      rear.setAttribute('aria-hidden',String(!isBack));
      toneButton.hidden=isBack;
      flipButton.textContent=isBack?'↶':'↷';
      flipButton.setAttribute('aria-label',isBack?'พลิกกลับด้านหน้า':'พลิกไปจดด้านหลัง');
      flipButton.title=flipButton.getAttribute('aria-label');
    }

    async function flip() {
      if(turn.busy||!panel.open||!editor.flush())return;
      const to=side==='front'?'back':'front';
      flipButton.focus({preventScroll:true});
      flipButton.setAttribute('aria-disabled','true');
      front.inert=true;
      rear.inert=true;
      const completed=await turn.turn(scene,front,rear,{from:side,to,onCommit:showSide});
      if(!panel.open)return;
      if(!completed)showSide(side);
      flipButton.removeAttribute('aria-disabled');
    }

    function close() {
      if(!panel.open)return true;
      if(!editor.dispose())return false;
      if(opening!==null)window.cancelAnimationFrame(opening);
      turn.cancel();
      registration.destroy();
      panel.close();
      panel.remove();
      readers.delete(id);
      if(trigger?.isConnected)trigger.focus({preventScroll:true});
      return true;
    }

    notes.addEventListener('input',()=>editor.notes(notes.value));
    retry.onclick=()=>editor.flush();
    flipButton.onclick=flip;
    find('.photo-sheet-close').onclick=close;
    storageButton.onclick=()=>{if(close())onStore(id);};
    find('.photo-sheet-delete').onclick=()=>{if(close())onDelete(id);};
    toneButton.onclick=()=>{
      if(turn.busy)return;
      const next=tone==='gold'?'original':'gold';
      try{onSave(id,{tone:next});tone=next;paintTone();}
      catch(error){onError(error.message);}
    };
    panel.addEventListener('cancel',event=>{event.preventDefault();close();});
    paintTone();
    paintStorage();
    showSide('front');
    document.body.append(panel);
    panel.show();
    registration=windows.register(panel,{handle:scene,onEscape:close,key:`photo:${id}`});
    readers.set(id,{raise:()=>registration.raise(),flush:editor.flush,close,refreshStorage:paintStorage,showBack:()=>{if(side==='front')flip();}});
    onCue('paperPick');
    if(back)opening=window.requestAnimationFrame(()=>{opening=null;flip();});
  }

  return {open,closeAll,flush,refreshStorage};
}
