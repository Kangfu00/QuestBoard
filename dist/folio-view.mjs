import {STATUS,filterQuests} from './model.mjs';
import {animateTransient,cancelMotion} from './desk-motion.mjs';
import {PAPER} from './paper-format.mjs';
const esc=(value='')=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let nextFolioScope=0;
const folioScope=()=>`folio-${++nextFolioScope}`;

export function folioSelection(items,folderId,search,selectedId){
  const members=filterQuests(items,{folderId,search});
  return {members,selected:members.find(item=>item.id===selectedId)??members[0]??null};
}
export function folioPaperScale(width,height){return Math.max(0,Math.min((width-16)/PAPER.width,(height-16)/PAPER.height,1.15));}
export function folioMarkup(folder,{icon,binding,scope=folioScope()}){
  return `<div class="folder-window-cover" aria-hidden="true"><div class="folio-cover-outer"><span class="folio-cover-label">${esc(folder.name)}</span>${binding}</div><div class="folio-cover-inner"></div></div>
    <div class="folio-spine" aria-hidden="true"></div>
    <section class="folio-left"><header class="folder-window-header"><div>${icon('shield')}<h2 id="${esc(scope)}-title" class="folder-window-title">${esc(folder.name)}</h2><small>บันทึกแห่งกิลด์</small></div><div><button class="icon-button" data-edit-folder="${folder.id}" aria-label="แก้ไขชื่อแฟ้ม">${icon('edit')}</button><button class="icon-button" data-store-folder="${folder.id}" aria-label="เก็บแฟ้มกลับลิ้นชัก">${icon('archive')}</button><button class="icon-button" data-action="close-folder" aria-label="ปิดแฟ้ม">${icon('cross')}</button></div></header>
    <div class="folio-index-paper"><label class="drawer-search">${icon('search')}<input id="${esc(scope)}-search" class="folder-search" type="search" placeholder="ค้นหาในแฟ้ม…" aria-label="ค้นหาเควสในแฟ้ม"></label><div class="folio-index-heading"><span>สารบัญเควส</span><b id="${esc(scope)}-total" class="folio-total"></b></div><div id="${esc(scope)}-list" class="folder-window-list"></div></div>
    <div class="folder-window-drop">${icon('folder')}<strong>กระเป๋าเก็บเรื่องราว</strong><small>ลากเควสมาวางเพื่อเก็บในแฟ้มนี้</small></div></section>
    <section class="folio-right" aria-label="ใบเควสที่เลือก"><div class="folio-preview-heading"><span id="${esc(scope)}-selected-title" class="folio-selected-title"></span><small id="${esc(scope)}-page-count" class="folio-page-count"></small></div><div class="folio-paper-viewport"><div class="folio-stack" aria-hidden="true" hidden></div><div class="folio-paper-stage"></div><div class="folio-preview-empty"></div></div><div class="folio-paper-actions"></div><p class="folder-window-footnote">ลากหัวกระดาษออกไปวางบนโต๊ะ · กดมุมกระดาษเพื่อจดบันทึก</p></section>`;
}
export function folioIndexMarkup(members,selectedId,icon,rememberedId=selectedId){
  return members.map((quest,index)=>`<article class="folio-index-row ${quest.id===selectedId?'is-selected':''}" data-quest-id="${quest.id}"><button class="folder-quest-grip" data-quest-drag="${quest.id}" aria-label="ลากเควส ${esc(quest.title)} ออกจากแฟ้ม">${icon('grip')}</button><button class="folio-index-pick" data-folio-select="${quest.id}" aria-current="${quest.id===selectedId?'true':'false'}"><span class="folio-index-number">${String(index+1).padStart(2,'0')}</span><span class="folio-index-copy"><strong>${esc(quest.title)}</strong><small>${STATUS[quest.status].label}${quest.subquests?.length?` · ${quest.subquests.filter(task=>task.done).length}/${quest.subquests.length}`:''}</small></span></button>${quest.id===rememberedId?`<i class="folio-bookmark" data-folio-bookmark="${quest.id}" aria-hidden="true"></i>`:''}</article>`).join('');
}

/** Search/selection are view state. The app remains the owner of all quest data. */
export function createFolioView({panel,document=globalThis.document,renderQuest,icon,binding,onSearch,onRead,onCue=()=>{},reducedMotion=()=>false}){
  let folderId=null,selectedId=null,current=null,previewed=null,previewVersion=null,previewDependencies=null,observer=null,colorClass=null,searchInput=null;
  const scope=folioScope();
  const remembered=new Map();
  const find=selector=>panel.querySelector(selector);
  const input=event=>onSearch(event.target.value);
  function size(){
    const viewport=find('.folio-paper-viewport');if(!viewport||panel.hidden)return;
    const scale=folioPaperScale(viewport.clientWidth,viewport.clientHeight);
    // Inline priorities keep the measured fit authoritative over legacy mobile CSS.
    panel.style.setProperty('--folio-paper-scale',String(scale),'important');panel.style.setProperty('--folio-paper-width',scale*PAPER.width+'px','important');panel.style.setProperty('--folio-paper-height',scale*PAPER.height+'px','important');
  }
  function updatePreview(quest,{animate=false}={}){
    const stage=find('.folio-paper-stage'),empty=find('.folio-preview-empty'),actions=find('.folio-paper-actions');
    stage.hidden=!quest;panel.classList.toggle('folio-is-empty',!quest);
    cancelMotion(stage);
    if(!quest){
      stage.replaceChildren();empty.hidden=false;empty.innerHTML=`${icon('scroll')}<p>${current.search?'ไม่พบเควสที่ค้นหา':'แฟ้มนี้ยังว่าง'}</p><small>${current.search?'ลองค้นหาด้วยคำอื่น':'วางกระดาษลงในกระเป๋าฝั่งซ้ายได้เลย'}</small>`;
      actions.replaceChildren();find('.folio-selected-title').textContent='';find('.folio-page-count').textContent='';previewed=null;previewVersion=null;return;
    }
    empty.hidden=true;
    // Search keystrokes and unrelated saves must not replace the held/focused sheet.
    const version=quest,dependencies=JSON.stringify((quest.prerequisiteIds??[]).map(id=>{const source=current.items.find(item=>item.id===id);return [id,source?.status,source?.title]}));
    if(previewed!==quest.id||previewVersion!==version||previewDependencies!==dependencies){
      stage.innerHTML=renderQuest(quest,0);const paper=stage.firstElementChild;
      paper.removeAttribute('data-id');paper.dataset.folioPaper=quest.id;paper.classList.remove('board-item');paper.style.cssText='--rotation:0deg;';
      const grip=paper.querySelector('.quest-top');grip.dataset.questDrag=quest.id;grip.setAttribute('aria-label',`ลากเควส ${quest.title} ออกจากแฟ้ม หรือกด Enter เพื่ออ่าน`);
      previewed=quest.id;previewVersion=version;previewDependencies=dependencies;
    }
    find('.folio-selected-title').textContent=quest.title;
    find('.folio-page-count').textContent=`${current.members.findIndex(item=>item.id===quest.id)+1} / ${current.members.length}`;
    actions.innerHTML=`<button data-edit="${quest.id}">${icon('edit')}แก้ไขใบเควส</button><button data-read-back="${quest.id}">${icon('feather')}พลิกจดบันทึก</button><button data-restore="${quest.id}">${icon('restore')}นำกลับโต๊ะ</button>`;
    size();
    if(animate&&!reducedMotion())animateTransient(stage,[{transform:'translateY(9px) rotate(-1deg)',opacity:.35},{transform:'translateY(-2px) rotate(.3deg)',opacity:1,offset:.75},{transform:'translateY(0) rotate(0deg)',opacity:1}],{duration:280,easing:'cubic-bezier(.2,.8,.3,1)'});
  }
  function drawIndex(){
    const list=find('.folder-window-list'),scroll=list.scrollTop,scrollLeft=list.scrollLeft;
    list.innerHTML=current.members.length?folioIndexMarkup(current.members,selectedId,icon,remembered.get(folderId)):`<div class="folder-empty">${icon(current.search?'search':'folder')}<p>${current.search?'ไม่พบเควสที่ค้นหา':'ยังไม่มีเควสในแฟ้ม'}</p></div>`;
    list.scrollTop=scroll;list.scrollLeft=scrollLeft;
  }
  function select(id,{focus=false,animate=true}={}){
    const quest=current?.members.find(item=>item.id===id);if(!quest||(selectedId===id&&remembered.get(folderId)===id))return false;
    const changed=selectedId!==id;
    remembered.set(folderId,id);selectedId=id;drawIndex();updatePreview(quest,{animate:animate&&changed});
    if(focus)find(`[data-folio-select="${id}"]`)?.focus({preventScroll:true});
    if(changed)try{onCue('paperSlide');}catch{}
    return true;
  }
  const click=event=>{const button=event.target.closest('[data-folio-select]');if(button)select(button.dataset.folioSelect,{focus:true});};
  const keydown=event=>{
    const pick=event.target.closest('[data-folio-select]');
    if(pick&&['ArrowUp','ArrowDown','Home','End'].includes(event.key)){
      event.preventDefault();let index=current.members.findIndex(item=>item.id===pick.dataset.folioSelect);
      index=event.key==='Home'?0:event.key==='End'?current.members.length-1:Math.max(0,Math.min(current.members.length-1,index+(event.key==='ArrowDown'?1:-1)));
      select(current.members[index].id,{focus:true});return;
    }
    if(event.target.matches('.quest-top[data-quest-drag]')&&['Enter',' '].includes(event.key)){event.preventDefault();onRead(event.target.dataset.questDrag);}
  };
  panel.addEventListener('click',click);panel.addEventListener('keydown',keydown);
  function render({folder,items,search=''}){
    if(folderId!==folder.id){
      observer?.disconnect();searchInput?.removeEventListener?.('input',input);folderId=folder.id;selectedId=null;previewed=null;previewVersion=null;
      panel.innerHTML=folioMarkup(folder,{icon,binding:binding(),scope});
      searchInput=find('.folder-search');searchInput.addEventListener('input',input);
      const ResizeObserver=document.defaultView?.ResizeObserver??globalThis.ResizeObserver;
      if(ResizeObserver){observer=new ResizeObserver(size);observer.observe(find('.folio-paper-viewport'));}
    }
    if(colorClass)panel.classList.remove(colorClass);colorClass=`folder-${folder.color}`;
    panel.classList.add('folder-window','folio-spread',colorClass);
    panel.setAttribute('aria-labelledby',`${scope}-title`);
    panel.hidden=false;panel.dataset.folderTarget=folder.id;panel.dataset.openFolder=folder.id;
    find('.folder-window-title').textContent=folder.name;find('.folio-cover-label').textContent=folder.name;
    if(searchInput.value!==search)searchInput.value=search;
    // Filtering may hide the bookmark; it must not replace it with a search fallback.
    const members=filterQuests(items,{folderId:folder.id});
    if(!members.some(item=>item.id===remembered.get(folder.id)))remembered.set(folder.id,members[0]?.id??null);
    const selection=folioSelection(items,folder.id,search,remembered.get(folder.id));selectedId=selection.selected?.id??null;current={...selection,search,items};
    const stack=find('.folio-stack'),edges=Math.min(4,Math.max(0,members.length-1));
    stack.hidden=edges===0;stack.innerHTML='<i class="folio-stack-sheet"></i>'.repeat(edges);
    find('.folio-total').textContent=String(members.length);drawIndex();updatePreview(selection.selected);
    return selectedId;
  }
  function destroy(){observer?.disconnect();observer=null;searchInput?.removeEventListener?.('input',input);searchInput=null;cancelMotion(find('.folio-paper-stage'));panel.removeEventListener?.('click',click);panel.removeEventListener?.('keydown',keydown);}
  return {render,select,size,destroy,get selectedId(){return selectedId;}};
}
