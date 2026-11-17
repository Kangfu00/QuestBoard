import {MAX_QUEST_NOTES,MAX_SUBQUESTS} from './model.mjs';
import {createBackEditor} from './quest-back.mjs';
import {createPaperTurn} from './paper-turn.mjs';
import {createDeskWindows} from './desk-windows.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function backMarkup(quest){
  return `<div class="reader-back-sheet">
    <header class="back-heading"><small>ADVENTURER'S FIELD NOTES</small><h2>บันทึกการเดินทาง</h2><p>${esc(quest.title)}</p></header>
    <label class="back-notes-label">โน้ตของฉัน<textarea class="back-notes" maxlength="${MAX_QUEST_NOTES}" placeholder="เบาะแส สิ่งที่ต้องเตรียม หรือเรื่องที่อยากจำ…" aria-label="โน้ตด้านหลังเควส">${esc(quest.notes)}</textarea></label>
    <div class="back-tasks-heading"><strong>เควสย่อย</strong><span class="back-progress" aria-live="polite"></span></div>
    <div class="back-task-list"></div>
    <form class="back-add-form"><input class="back-add-input" maxlength="240" aria-label="ชื่อเควสย่อยใหม่" placeholder="เพิ่มก้าวเล็ก ๆ ของเควสนี้…" required><button type="submit" aria-label="เพิ่มเควสย่อย">＋</button></form>
    <p class="back-save-status" role="status">บันทึกอัตโนมัติในเครื่อง</p><button type="button" class="back-retry" hidden>ลองบันทึกอีกครั้ง</button>
  </div>`;
}

/** Independent desk readers. Their window positions never change quest placement. */
export function createPaperReader({document=globalThis.document,window=globalThis.window,windows=createDeskWindows({document,window}),getQuest,renderFront,onSave,onEdit,onClose=()=>{},onCue=()=>{},reducedMotion=()=>false}){
  const readers=new Map();let activation=0,listening=false;
  function flush(){let saved=true;for(const reader of [...readers.values()])if(!reader.flush())saved=false;return saved;}
  const hidden=()=>{if(document.visibilityState==='hidden')flush();};
  function lifecycle(attach){
    if(listening===attach)return;listening=attach;const action=attach?'addEventListener':'removeEventListener';
    window?.[action]('pagehide',flush);window?.[action]('blur',flush);document[action]('visibilitychange',hidden);
  }
  function createReader(questId,quest){
  let dialog=document.createElement('dialog'),editor=null,id=questId,side='front',trigger=document.activeElement,turning=false,generation=0,observer=null,registration=null,frame=null;
  dialog.className='paper-reader';dialog.dataset.readerQuest=questId;dialog.setAttribute('aria-label',`ใบเควสสองด้าน: ${quest.title}`);document.body.append(dialog);
  const turn=createPaperTurn({document,reducedMotion,onCue});
  const find=selector=>dialog.querySelector(selector);
  const active=()=>!!editor&&dialog.open;
  const entry={panel:dialog,order:0,raise(){entry.order=++activation;registration?.raise();},flush:()=>editor?.flush()??true,close,refresh};
  const activated=()=>{if(active())entry.order=++activation;};
  dialog.addEventListener('pointerdown',activated);dialog.addEventListener('focusin',activated);
  function status({mode,error}){
    if(!dialog?.open)return;
    const target=find('.back-save-status');target.textContent=mode==='error'?`ยังบันทึกไม่ได้: ${error}`:mode==='pending'?'กำลังจดบันทึก…':'บันทึกแล้ว · สำรองตามระบบของแอป';
    target.classList.toggle('is-error',mode==='error');find('.back-retry').hidden=mode!=='error';
  }
  function progress(){
    const tasks=editor.snapshot().subquests,done=tasks.filter(task=>task.done).length;
    find('.back-progress').textContent=`${done} / ${tasks.length}`;
  }
  function drawTasks(focusId){
    const tasks=editor.snapshot().subquests,list=find('.back-task-list'),scroll=list.scrollTop;
    list.innerHTML=tasks.length?tasks.map(task=>`<div class="back-task ${task.done?'is-done':''}" data-task-id="${esc(task.id)}"><label class="back-check"><input type="checkbox" aria-label="ทำเควสย่อยสำเร็จ: ${esc(task.text)}" ${task.done?'checked':''}><span aria-hidden="true">✓</span></label><span class="back-task-writing"><input class="back-task-text" maxlength="240" aria-label="ชื่อเควสย่อย" value="${esc(task.text)}"><i aria-hidden="true"></i></span><button class="back-remove" type="button" aria-label="ลบเควสย่อย ${esc(task.text)}">×</button></div>`).join(''):'<p class="back-tasks-empty">การเดินทางเริ่มจากก้าวเล็ก ๆ</p>';
    list.scrollTop=scroll;progress();
    if(focusId)find(`[data-task-id="${focusId}"] .back-task-text`)?.focus();
  }
  function fail(error){status({mode:'error',error:error.message});}
  function setSide(value){
    side=value;dialog.dataset.side=value;find('.paper-reader-scene').dataset.side=value;
    const back=value==='back';find('.reader-front').inert=back;find('.reader-front').setAttribute('aria-hidden',String(back));
    find('.reader-back').inert=!back;find('.reader-back').setAttribute('aria-hidden',String(!back));
    const turnButton=find('.reader-turn'),turnLabel=back?'พลิกกลับด้านหน้า':'พลิกไปจดบันทึกด้านหลัง';
    turnButton.setAttribute('aria-label',turnLabel);turnButton.setAttribute('title',turnLabel);
    find('.reader-turn-icon').textContent=back?'↶':'↷';
    find('.reader-side-label').textContent=back?'ด้านหลัง · บันทึกของนักผจญภัย':'ด้านหน้า · ใบเควสของกิลด์';
  }
  async function flip(){
    if(turning||!editor||!dialog.open||!editor.flush())return;
    const current=++generation;turning=true;find('.reader-turn').setAttribute('aria-disabled','true');
    // Keep focus outside the disappearing face while the physical copy turns.
    find('.reader-turn').focus({preventScroll:true});
    find('.reader-front').inert=true;find('.reader-back').inert=true;
    const to=side==='front'?'back':'front';
    const completed=await turn.turn(find('.paper-reader-scene'),find('.reader-front'),find('.reader-back'),{from:side,to,onCommit:value=>{if(current===generation&&dialog.open)setSide(value);}});
    if(current!==generation||!dialog.open)return;
    turning=false;find('.reader-turn').setAttribute('aria-disabled','false');
    if(!completed)setSide(side);
  }
  function close(){
    if(!dialog?.open)return true;
    if(!editor.dispose())return false;
    generation++;turn.cancel();turning=false;
    if(frame!==null){if(window?.cancelAnimationFrame)window.cancelAnimationFrame(frame);else clearTimeout(frame);frame=null;}
    observer?.disconnect();observer=null;registration?.destroy();registration=null;
    dialog.removeEventListener('pointerdown',activated);dialog.removeEventListener('focusin',activated);
    editor=null;dialog.close();dialog.remove();readers.delete(id);if(!readers.size)lifecycle(false);
    onClose(id);if(trigger?.isConnected!==false)trigger?.focus?.({preventScroll:true});trigger=null;return true;
  }
  function drawFront(quest){
    const front=find('.reader-front');front.innerHTML=renderFront(quest);
    const article=front.firstElementChild;if(!article)return;
    article.classList.remove('board-item');article.style.cssText='';
    front.querySelectorAll('.paper-pin,.paper-turn-corner,.paper-back-hint,.quest-bundle-select').forEach(node=>node.remove());
    front.querySelectorAll('button').forEach(button=>{const label=document.createElement('span');label.className=button.className;label.innerHTML=button.innerHTML;button.replaceWith(label);});
    for(const node of [article,...front.querySelectorAll('*')]){
      node.classList.remove('drag-handle');
      for(const {name} of [...node.attributes])if(name==='id'||name==='tabindex'||name==='role'||name.startsWith('data-'))node.removeAttribute(name);
    }
  }
  function refresh(quest){
    if(!active())return;
    drawFront(quest);find('.back-heading p').textContent=quest.title;
    dialog.setAttribute('aria-label',`ใบเควสสองด้าน: ${quest.title}`);
  }
  function show({back=true}={}){
    const current=++generation;
    dialog.innerHTML=`<div class="paper-reader-scene" data-side="front"><header class="paper-reader-toolbar"><span class="reader-side-label"></span><button type="button" class="reader-edit">แก้ไขใบเควส</button><button type="button" class="reader-close" aria-label="วางกระดาษกลับที่เดิม">×</button></header><div class="paper-reader-live"><div class="reader-face reader-front"></div><div class="reader-face reader-back">${backMarkup(quest)}</div></div><button type="button" class="reader-turn reader-turn-corner" aria-label="พลิกไปจดบันทึกด้านหลัง"><span class="reader-turn-icon" aria-hidden="true">↷</span></button></div>`;
    drawFront(quest);
    // A deleted quest must not be resurrected by a pending autosave or close.
    editor=createBackEditor({quest,onSave:patch=>{if(getQuest(questId)?.type==='quest')onSave(questId,patch);},onStatus:status});
    find('.back-notes').oninput=event=>{if(!active())return;try{editor.notes(event.target.value);}catch(error){fail(error);}};
    find('.back-task-list').oninput=event=>{
      if(!active())return;
      const row=event.target.closest('[data-task-id]');if(!row||!event.target.matches('.back-task-text'))return;
      // An empty rename stays local until a nonempty value is entered.
      if(!event.target.value.trim()){event.target.setCustomValidity('กรอกชื่อเควสย่อย');return;}
      event.target.setCustomValidity('');
      try{
        editor.task(row.dataset.taskId,{text:event.target.value});
        row.querySelector('input[type="checkbox"]').setAttribute('aria-label',`ทำเควสย่อยสำเร็จ: ${event.target.value.trim()}`);
        row.querySelector('.back-remove').setAttribute('aria-label',`ลบเควสย่อย ${event.target.value.trim()}`);
      }catch(error){fail(error);}
    };
    find('.back-task-list').onfocusout=event=>{
      if(!editor||!event.target.matches('.back-task-text')||event.target.value.trim())return;
      const row=event.target.closest('[data-task-id]'),task=editor.snapshot().subquests.find(task=>task.id===row?.dataset.taskId);
      if(task){event.target.value=task.text;event.target.setCustomValidity('');}
    };
    find('.back-task-list').onchange=event=>{
      if(!active())return;
      const row=event.target.closest('[data-task-id]');if(!row||event.target.type!=='checkbox')return;
      try{editor.task(row.dataset.taskId,{done:event.target.checked});row.classList.toggle('is-done',event.target.checked);progress();onCue('pen');}catch(error){fail(error);}
    };
    find('.back-task-list').onclick=event=>{
      if(!active())return;
      const button=event.target.closest('.back-remove');if(!button)return;
      try{editor.remove(button.closest('[data-task-id]').dataset.taskId);drawTasks();find('.back-add-input').focus();}catch(error){fail(error);}
    };
    find('.back-add-form').onsubmit=event=>{
      event.preventDefault();if(!active())return;const input=find('.back-add-input');
      try{if(editor.snapshot().subquests.length>=MAX_SUBQUESTS)throw Error(`เพิ่มเควสย่อยได้ไม่เกิน ${MAX_SUBQUESTS} ข้อ`);editor.add(input.value);input.value='';drawTasks();find('.back-task-list').scrollTop=find('.back-task-list').scrollHeight;input.focus();onCue('pen');}catch(error){fail(error);}
    };
    find('.back-retry').onclick=()=>editor?.flush()??true;
    find('.reader-turn').onclick=flip;find('.reader-close').onclick=close;
    find('.reader-edit').onclick=()=>{if(active()&&close())onEdit(id);};
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    drawTasks();setSide('front');dialog.show();
    registration=windows.register(dialog,{handle:'.paper-reader-scene',onEscape:close,key:`quest:${questId}`});entry.raise();
    const scene=find('.paper-reader-scene');
    const size=()=>scene.style.setProperty('--reader-scale',String(scene.getBoundingClientRect().width/300));
    size();
    const ResizeObserver=window?.ResizeObserver??globalThis.ResizeObserver;
    if(ResizeObserver){observer=new ResizeObserver(size);observer.observe(scene);}
    onCue('paperPick');
    // Let the lifted sheet appear before bending over to reveal the writing.
    if(back)frame=(window?.requestAnimationFrame?.bind(window)??(fn=>setTimeout(fn,0)))(()=>{frame=null;if(current===generation&&dialog.open)flip();});
    return true;
  }
  entry.show=show;return entry;
  }
  function open(questId,options={}){
    const quest=getQuest(questId);if(!quest||quest.type!=='quest')return false;
    const existing=readers.get(questId);if(existing){existing.raise();return true;}
    const reader=createReader(questId,quest);readers.set(questId,reader);lifecycle(true);return reader.show(options);
  }
  function close(questId){
    if(questId!==undefined)return readers.get(questId)?.close()??true;
    let closed=true;for(const reader of [...readers.values()])if(!reader.close())closed=false;return closed;
  }
  function refresh(){for(const [questId,reader] of [...readers]){const quest=getQuest(questId);if(quest?.type==='quest')reader.refresh(quest);else reader.close();}}
  return {open,close,flush,refresh,get ids(){return [...readers.keys()];},get id(){
    let latest=null;for(const [questId,reader] of readers){if(windows.top===reader.panel)return questId;if(!latest||reader.order>latest[1].order)latest=[questId,reader];}return latest?.[0]??null;
  }};
}
