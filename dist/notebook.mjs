import {MAX_NOTEBOOK_PAGES,MAX_NOTEBOOK_PAGE_TEXT} from './model.mjs';
import {NOTEBOOK_SIZE} from './paper-format.mjs';
import {leatherDyeMarkup,paintLeatherDye} from './leather-colors.mjs';

const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function renderNotebookCover(book,{icon,storage=false,position=book}){
  const {width,height}=NOTEBOOK_SIZE,dye=leatherDyeMarkup(book.color);
  const id=escape(book.id),title=escape(book.title);
  const storageLabel=storage?'นำสมุดโน้ตกลับขึ้นโต๊ะ':'เก็บสมุดโน้ตเข้าลิ้นชัก';
  return `<article class="board-item board-daily-book notebook-cover book-${book.color}" ${storage?'data-storage-id':'data-id'}="${id}"${dye.attributes} style="left:${position.x}px;top:${position.y}px;width:${width}px;height:${height}px;${dye.style}--rotation:${book.rotation}deg;z-index:${book.z}">
    <div class="daily-book-pages-edge" aria-hidden="true"></div>
    <div class="daily-book-front">
      <div class="daily-book-cover-frame" aria-hidden="true"></div>
      <button type="button" class="notebook-grip drag-handle" data-open-notebook="${id}" ${storage?`data-notebook-drag="${id}"`:''} aria-label="เปิด ${title}">
        <span class="daily-book-emblem" aria-hidden="true">${icon('feather')}</span>
        <strong class="daily-book-title">${title}</strong>
      </button>
      <div class="daily-book-footer">
        <button type="button" class="daily-book-action-icon-btn" data-edit-notebook="${id}" title="แก้ไขชื่อและสีปก" aria-label="แก้ไขชื่อและสีปก ${title}">${icon('edit')}</button>
        <button type="button" class="daily-book-action-icon-btn" data-store-notebook="${id}" title="${storageLabel}" aria-label="${storageLabel}">${icon(storage?'restore':'archive')}</button>
      </div>
    </div>
  </article>`;
}

export function createNotebookWindows({document,window,windows,getBook,writePages,editCover,store,icon,onCue,reducedMotion}){
  const readers=new Map(),remembered=new Map();

  function flush(){
    let saved=true;
    for(const reader of readers.values())if(!reader.flush())saved=false;
    return saved;
  }
  window.addEventListener('pagehide',flush);
  window.addEventListener('blur',flush);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});

  function open(id){
    const existing=readers.get(id);
    if(existing){existing.raise();return;}
    const book=getBook(id);
    if(!book)return;
    const panel=document.createElement('section');
    panel.className='daily-book-window notebook-window';
    panel.setAttribute('role','dialog');
    panel.innerHTML=`
      <div class="daily-book-window-cover" aria-hidden="true">
        <div class="daily-book-cover-outer"><div class="daily-book-cover-frame"></div>
          <div class="daily-book-cover-content"><span class="daily-book-emblem">${icon('feather')}</span><strong class="daily-book-title"></strong></div>
        </div>
        <div class="daily-book-cover-inner"></div>
      </div>
      <section class="daily-book-page daily-book-left notebook-page">
        <header class="daily-book-header notebook-header">
          <h2></h2>
          <div class="notebook-actions">
            <button type="button" class="icon-button" data-notebook-action="edit" aria-label="แก้ไขชื่อและสีปก" title="แก้ไขชื่อและสีปก">${icon('edit')}</button>
            <button type="button" class="icon-button" data-notebook-action="store"></button>
            <button type="button" class="icon-button" data-notebook-action="close" aria-label="ปิดสมุดโน้ต" title="ปิดสมุดโน้ต (Esc)">${icon('cross')}</button>
          </div>
        </header>
        <label class="notebook-leaf"><span></span><textarea maxlength="${MAX_NOTEBOOK_PAGE_TEXT}" spellcheck="false" placeholder="เริ่มจดตรงนี้…"></textarea></label>
        <div class="notebook-save"><output role="status" aria-live="polite"></output><button type="button" data-notebook-action="retry" hidden>ลองบันทึกอีกครั้ง</button></div>
      </section>
      <section class="daily-book-page daily-book-right notebook-page">
        <label class="notebook-leaf"><span></span><textarea maxlength="${MAX_NOTEBOOK_PAGE_TEXT}" spellcheck="false" placeholder="เริ่มจดตรงนี้…"></textarea></label>
        <nav class="notebook-pagination" aria-label="หน้าสมุดโน้ต">
          <button type="button" class="icon-button" data-notebook-action="previous" aria-label="หน้าคู่ก่อนหน้า" title="หน้าคู่ก่อนหน้า">‹</button>
          <span class="notebook-page-number"></span>
          <button type="button" class="icon-button" data-notebook-action="next" aria-label="หน้าคู่ถัดไป" title="หน้าคู่ถัดไป">›</button>
          <button type="button" class="daily-btn" data-notebook-action="append">${icon('plus')}เพิ่มหน้าคู่</button>
        </nav>
      </section>`;
    const find=selector=>panel.querySelector(selector);
    const action=name=>find(`[data-notebook-action="${name}"]`);
    const fields=[...panel.querySelectorAll('textarea')];
    const numbers=[...panel.querySelectorAll('.notebook-leaf > span')];
    const status=find('output');
    const pending=new Map();
    let spread=Math.min(remembered.get(id)??0,book.pages.length-2),timer=null,opening=null,colorClass='';

    function saveStatus(message,error=false){
      status.textContent=message;
      action('retry').hidden=!error;
    }

    function flushPages(){
      if(timer!==null)window.clearTimeout(timer);
      timer=null;
      if(!pending.size)return true;
      try{
        const pages=[...getBook(id).pages];
        for(const [index,text] of pending)pages[index]=text;
        writePages(id,pages);
        pending.clear();
        saveStatus('บันทึกแล้ว');
        return true;
      }catch(error){saveStatus(error.message,true);return false;}
    }

    function refresh(){
      const current=getBook(id);
      if(!current)return;
      if(colorClass)panel.classList.remove(colorClass);
      colorClass=`book-${current.color}`;
      panel.classList.add(colorClass);
      paintLeatherDye(panel,current.color);
      panel.setAttribute('aria-label',current.title);
      find('h2').textContent=current.title;
      find('.daily-book-title').textContent=current.title;
      const label=current.archived?'นำสมุดโน้ตกลับขึ้นโต๊ะ':'เก็บสมุดโน้ตเข้าลิ้นชัก';
      const storage=action('store');
      storage.textContent='';
      storage.innerHTML=icon(current.archived?'restore':'archive');
      storage.setAttribute('aria-label',label);
      storage.title=label;
    }

    function showPages(){
      const pages=getBook(id).pages;
      fields.forEach((field,index)=>{
        field.value=pages[spread+index];
        field.scrollTop=0;
        numbers[index].textContent=`หน้า ${spread+index+1}`;
      });
      find('.notebook-page-number').textContent=`${spread+1}–${spread+2} / ${pages.length}`;
      action('previous').disabled=spread===0;
      action('next').disabled=spread+2>=pages.length;
      action('append').disabled=pages.length>=MAX_NOTEBOOK_PAGES;
    }

    function turn(direction){
      if(!flushPages())return;
      const pages=getBook(id).pages;
      const next=direction==='append'?pages.length:spread+direction*2;
      if(direction==='append'){
        if(pages.length>=MAX_NOTEBOOK_PAGES)return;
        try{writePages(id,[...pages,'','']);}
        catch(error){saveStatus(error.message);return;}
      }else if(next<0||next>=pages.length)return;
      spread=next;
      showPages();
      onCue('paperSlide');
      if(!reducedMotion()&&typeof fields[0].animate==='function'){
        panel.querySelectorAll('.notebook-leaf').forEach(leaf=>leaf.animate(
          [{opacity:.45,transform:`perspective(580px) rotateY(${direction===-1?8:-8}deg) translateY(3px)`},{opacity:1,transform:'none'}],
          {duration:240,easing:'ease-out'}
        ));
      }
      if(direction==='append'||document.activeElement?.disabled)fields[0].focus({preventScroll:true});
    }

    function close({animate=false,returnFocus=false}={}){
      if(!flushPages())return false;
      window.clearTimeout(opening);
      remembered.set(id,spread);
      registration.cancelDrag();
      if(animate){
        onCue('folderClose');
        if(!reducedMotion()){
          const rect=panel.getBoundingClientRect(),ghost=panel.cloneNode(true);
          ghost.inert=true;
          ghost.setAttribute('aria-hidden','true');
          ghost.classList.remove('is-unfolding');
          ghost.classList.add('daily-book-closing-ghost');
          Object.assign(ghost.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,margin:'0',pointerEvents:'none',zIndex:'9999'});
          document.body.append(ghost);
          window.setTimeout(()=>ghost.remove(),700);
        }
      }
      registration.destroy();
      panel.remove();
      readers.delete(id);
      if(returnFocus)document.querySelector(`[data-open-notebook="${id}"]`)?.focus({preventScroll:true});
      return true;
    }

    fields.forEach((field,index)=>field.addEventListener('input',()=>{
      pending.set(spread+index,field.value);
      saveStatus('กำลังบันทึก…');
      if(timer!==null)window.clearTimeout(timer);
      timer=window.setTimeout(flushPages,180);
    }));
    panel.addEventListener('click',event=>{
      switch(event.target.closest('[data-notebook-action]')?.dataset.notebookAction){
        case 'close':close({animate:true,returnFocus:true});break;
        case 'edit':if(flushPages())editCover(id);break;
        case 'store':if(flushPages())store(id);break;
        case 'retry':flushPages();break;
        case 'previous':turn(-1);break;
        case 'next':turn(1);break;
        case 'append':turn('append');break;
      }
    });
    document.body.append(panel);
    const registration=windows.register(panel,{key:`notebook-${id}`,handle:'.notebook-header',onEscape:()=>close({animate:true,returnFocus:true})});
    readers.set(id,{refresh,close,flush:flushPages,raise:()=>registration.raise()});
    refresh();showPages();registration.raise();
    onCue('folderOpen');
    if(!reducedMotion()){
      panel.classList.add('is-unfolding');
      opening=window.setTimeout(()=>panel.classList.remove('is-unfolding'),740);
    }
  }

  return {
    open,flush,
    refresh(){for(const reader of readers.values())reader.refresh();},
    closeAll(){if(!flush())return false;for(const reader of [...readers.values()])reader.close();return true;},
  };
}
