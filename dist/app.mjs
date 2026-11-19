import { BOARD, BOARD_LIMIT, STATUS, CATEGORIES, uid, createQuest, createPhotoSheet, createLabel, createFolder, moveQuestToFolder, updateItem, deleteItem, setItemStatus, setArchived, filterQuests, addStamp, MAX_BACKUP_BYTES, serializeState, parseState, validateState, DAILY_BOOK_SIZE, ensureDailyBook, updateDailyBookMeta, updateDailyTask, deleteDailyTask, DEFAULT_PAPERWEIGHT, PAPERWEIGHT_EMBLEMS, updatePaperweight, ensureNotebook, updateAdventurerCard, DEFAULT_ADVENTURER_CARD } from './model.mjs';
import {NOTEBOOK_SIZE,PAPER,toPaperStampPosition,photoSheetSize} from './paper-format.mjs';
import { chooseStampTool, applyHeldStamp } from './stamp-tools.mjs';
import { dragPosition, containsPoint, drawerReveal, shouldOpenDrawer, rotatedOrigin, canvasLayout, rotatedClampPosition, storedDropPosition, drawerForDraggedItem, storageTrayAccepts } from './interactions.mjs';
import { grabPoint, ghostPose, dragTilt, animateTransient, cancelMotion, settleTiltKeyframes } from './desk-motion.mjs';
import { MOTION_TIMING } from './motion-tokens.mjs';
import { createMotionDebug } from './motion-debug.mjs';
import {paperGripPose} from './paper-grip.mjs';
import {createFolioWindows} from './folio-windows.mjs';
import {createDeskWindows} from './desk-windows.mjs';
import { createPaperEffects } from './paper-effects.mjs';
import { TRAY_SCALE, TRAY_WIDTH, trayPosition, trayDrop, trayItems, ensureTrayPositions, bindStorageDrawer, undockedFitWidth } from './storage-tray.mjs';
import {bindToolRail,undockedFitHeight} from './tool-rail.mjs';
import {bindDeskShutter} from './desk-shutter.mjs';
import {createPaperReader} from './paper-reader.mjs';
import { stampPoint } from './stamp-placement.mjs';
import {resolveStampSurface,refreshStampSurface,stampSurfacePoint} from './stamp-surfaces.mjs';

import { createDeskSound } from './sound.mjs';
import { createBackupClient } from './backup-client.mjs';
import {createQuestBundles} from './quest-bundles.mjs';
import {createDeskAtmosphere} from './atmosphere.mjs';
import {createGuildAmbience} from './ambience.mjs';
import {createDaypartAmbience} from './daypart-ambience.mjs';
import {createQuestPhotos} from './quest-photos.mjs';
import {createPhotoViewer} from './photo-viewer.mjs';
import {dependencyInfo,newlyUnlockedQuestIds} from './quest-dependencies.mjs';
import {dependencyMarkup,createPrerequisitePicker} from './quest-dependency-view.mjs';
import {createQuestUnlockEffects} from './quest-unlock.mjs';
import {renderDailyBookCover,createDailyBookWindow} from './daily-book.mjs';
import {leatherDyeMarkup,renderLeatherColorPicker} from './leather-colors.mjs';
import {bindCoverEditor,renderCoverEditorFields} from './cover-editor.mjs';
import {createPaperweight,paperweightFace} from './paperweight.mjs';
import {bindPhotoSheetResizing,createPhotoSheetReader,renderPhotoSheet} from './photo-sheet.mjs';
import {createNotebookWindows,renderNotebookCover} from './notebook.mjs';
import {burnStage,burnVariant,paperAgeStage,burnWispAnchors,msUntilNextMidnight,installBurnLayers} from './burn-model.mjs';
import {createAdventurerCard} from './adventurer-card.mjs';
const sound=createDeskSound();
// Warm the local recordings on the first interaction, before delayed motion cues.
document.addEventListener('pointerdown',()=>{sound.prime();ambience.unlock();daypartAmbience.unlock();},{capture:true,passive:true});
document.addEventListener('keydown',()=>{sound.prime();ambience.unlock();daypartAmbience.unlock();},{capture:true,passive:true});

const $ = (q, scope = document) => scope.querySelector(q);
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
  sword:'m5 3 14 14m-3-2 4 4m-5 1 5-5M3 3l2 6 4-4Z',
  swords:'m4 3 14 15m-5 1 6-6m-2 4 4 4M20 3 5 18m0-5 6 6m-4-2-4 4M3 3l1 6 5-5m12-1-1 6-5-5',
  board:'M4 4h16v13H4zM8 17l-2 4m10-4 2 4M8 8h3m3 0h2m-8 4h8',
  scroll:'M5 3h13v15a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-2h11v2a3 3 0 0 0 3 3M5 3a2 2 0 0 0-2 2v2h4V5a2 2 0 0 0-2-2m5 4h5m-5 4h5',
  check:'m5 12 4 4L19 6',
  circlecheck:'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3',
  pause:'M9 5v14M15 5v14',
  cross:'m6 6 12 12M6 18 18 6',
  plus:'M12 5v14M5 12h14',
  search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  tag:'M3 3h8l10 10-8 8L3 11ZM7 7h.01',
  stamp:'M8 15h8l-1-5a4 4 0 1 0-6 0ZM5 15h14v4H5zM4 22h16',
  settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
  chevron:'m9 5 7 7-7 7',
  down:'m6 9 6 6 6-6',
  grip:'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',
  calendar:'M4 5h16v16H4zM8 3v4m8-4v4M4 10h16',
  star:'m12 3 2.8 5.7L21 9.6l-4.5 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.2-.9Z',
  feather:'M20 3C12 0 4 8 6 16l2 2c8 2 16-6 12-15ZM3 21 17 7M8 16h7M12 12h7',
  upload:'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',
  download:'M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4',
  grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  help:'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3m.1 4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1',
  edit:'m15 5 4 4M4 20l5-1L21 7l-4-4L5 15ZM3 21h18',
  trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  restore:'M3 11a9 9 0 1 1 2.7 7M3 4v7h7',
  eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  menu:'M4 6h16M4 12h16M4 18h16',
  shield:'m12 2 8 3v7c0 6-8 10-8 10S4 18 4 12V5Z',
  spark:'m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z',
  minus:'M5 12h14',
  archive:'M3 3h18v5H3zM5 8v13h14V8M10 12h4',
  folder:'M5 3h14v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM6 3v18M3 13h16m-7-2 3 2-3 2m3-2 2-3m-2 3 2 3',
  volume:'M11 5 6 9H3v6h3l5 4ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  photo:'M3 3h18v18H3zM3 16l5-5 5 5 3-3 5 5M15 7h.01',
};
const icon = (name, cls='') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.star}"/></svg>`;
const crest = (cls='') => `<svg class="guild-crest ${cls}" viewBox="0 0 90 100" fill="none" aria-hidden="true"><path d="M45 5 74 17v29c0 23-29 45-29 45S16 69 16 46V17Z" stroke="currentColor" stroke-width="1.5"/><path d="m45 12 22 9v25c0 16-22 36-22 36S23 62 23 46V21Z" stroke="currentColor" opacity=".4"/><path d="m31 59 29-33m-30 6 30 30m-35-8 13 10m13-38 13 11" stroke="currentColor" stroke-width="2.5"/><path d="m45 20 2 5-2 4-2-4Z" fill="currentColor"/><path d="M10 34 5 45l7 9M80 34l5 11-7 9M9 58l7 15 13 7m52-22-7 15-13 7" stroke="currentColor"/></svg>`;

let state;
let filters={status:'all', category:'all', search:''};
let zoom=1, currentScale=1, modalTrigger=null, toastTimer;
let canvasBounds={...BOARD};
let observer, saveUnavailable=false, drag=null;
let drawerOpen=false, toolsOpen=false, folderDrawerOpen=false, archiveSearch='',folderDrawerSearch='';
let storageDrawerControl=null,toolRailControl=null;
let deskShutter=null;
let storedDrag=null,suppressClickUntil=0,folioWindows=null,dailyBookWindow=null,bookDrag=null;
let notebookWindows=null;
let heldStamp=null, stampPointer={x:0,y:0}, stampPressTimer;
let stampPointerFrame=null, stampTargetPaper=null;
let bundleControl=null,atmosphere=null,questPhotos=null,photoViewer=null;
let questUnlockEffects=null,prerequisitePicker=null;
let paperweightControl=null;
let photoResizeControl=null;
let adventurerCard=null;
const stampCues=new Map();
const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const onSoundCue=(name,options)=>sound.play(name,options);
const ambience=createGuildAmbience({document,window,onStatus:status=>atmosphere?.setAudioStatus(status)});
const daypartAmbience=createDaypartAmbience({document,window,onStatus:status=>atmosphere?.setAudioStatus(status)});
ambience.setMuted(sound.getSettings().muted);
daypartAmbience.setMuted(sound.getSettings().muted);
atmosphere=createDeskAtmosphere({document,window,reducedMotion,
  onAudioChange:settings=>{ambience.setSettings(settings);daypartAmbience.setSettings(settings);},
  onPhaseChange:({phase})=>daypartAmbience.setPhase(phase),
});
ambience.setSettings(atmosphere.getSettings());
daypartAmbience.setSettings(atmosphere.getSettings());
atmosphere.setAudioStatus(ambience.getStatus());
atmosphere.setAudioStatus(daypartAmbience.getStatus());
const deskWindows=createDeskWindows({document,window,canHandleEscape:()=>!drag&&!storedDrag&&!heldStamp&&!questPhotos?.editing&&!photoViewer?.isOpen&&!bundleControl?.dragging&&!bundleControl?.selectedIds.length&&!paperweightControl?.dragging&&!photoResizeControl?.active&&!deskShutter?.pulling&&!deskShutter?.closed});
const paperEffects=createPaperEffects({document,window,reducedMotion,requestAnimationFrame,cancelAnimationFrame,onCue:onSoundCue});
const paperReader=createPaperReader({document,window,windows:deskWindows,reducedMotion,onCue:onSoundCue,
  getQuest:id=>state.items.find(item=>item.id===id),renderFront:quest=>renderQuest(quest,0),
  onSave:(id,patch)=>{state=updateItem(state,id,patch);persist();renderCounts();},
  onEdit:id=>openQuest(id),
  onClose:id=>{renderBoard();renderCounts();renderFolderWindow();($(`[data-id="${id}"] [data-read-back]`)||$(`[data-storage-id="${id}"] [data-read-back]`)||$(`[data-read-back="${id}"]`))?.focus({preventScroll:true});},
});
const photoSheetReader=createPhotoSheetReader({document,window,windows:deskWindows,reducedMotion,icon,onCue:onSoundCue,
  getPhoto:id=>state.items.find(item=>item.id===id),onSave:savePhotoSheet,onStore:storePhotoSheet,onDelete:id=>confirmDelete(id,'รูปนี้'),onError:showToast,
});
const dialog=$('#dialog');
let startup,loadError,lastBackupWarning='';
const backupClient=createBackupClient({onStatus:renderBackupStatus});
try { startup=await backupClient.load();state=startup.state; }
catch(error) { loadError=error;saveUnavailable=true; }

function showToast(message, action) {
  const el=$('#toast'); clearTimeout(toastTimer);
  el.replaceChildren(document.createTextNode(message));
  if(action){const b=document.createElement('button'); b.textContent=action.label;b.onclick=()=>{action.run();el.classList.remove('visible');};el.append(b);}
  el.classList.add('visible'); toastTimer=setTimeout(()=>el.classList.remove('visible'), action?8000:3800);
}
function renderBackupStatus(info){
  const labels={loading:'กำลังเปิดสมุดบันทึก',pending:'กำลังบันทึกและสำรองไฟล์',saved:'บันทึกแล้ว · สำรองลงไฟล์แล้ว','file-only':'สำรองลงไฟล์แล้ว · เบราว์เซอร์บันทึกไม่ได้','browser-only':'บันทึกในเบราว์เซอร์แล้ว · รอสำรองไฟล์',conflict:'พบข้อมูลใหม่จากอีกหน้าต่าง · กรุณาโหลดใหม่',failed:'ยังบันทึกไม่ได้ กรุณาส่งออกสำรอง'};
  const indicator=$('#save-indicator');
  if(indicator)indicator.innerHTML=`<span class="save-dot ${['pending','loading'].includes(info.mode)?'pending':['conflict','failed','browser-only'].includes(info.mode)?'error':''}"></span>${labels[info.mode]||''}`;
  const details=$('#file-backup-summary');
  if(details)details.textContent=`${labels[info.mode]||''}${info.savedAt?' · '+new Date(info.savedAt).toLocaleString('th-TH'):''}`;
  const path=$('#file-backup-path');if(path)path.textContent=info.backupDir||'รอการเชื่อมต่อเซิร์ฟเวอร์ในเครื่อง';
  if(indicator&&['conflict','failed','browser-only'].includes(info.mode)&&lastBackupWarning!==info.mode){lastBackupWarning=info.mode;showToast(labels[info.mode],info.mode==='conflict'?{label:'โหลดใหม่',run:()=>location.reload()}:undefined);}
  if(['saved','file-only'].includes(info.mode))lastBackupWarning='';
}
function persist() {
  const snapshot=structuredClone(state);
  $('#save-indicator').innerHTML=`<span class="save-dot pending"></span>กำลังบันทึก`;
  backupClient.save(snapshot).catch(error=>renderBackupStatus({mode:'failed',error:error.message}));
}
function commit(next, message,{animateUnlock=true}={}){
  const unlocked=animateUnlock?newlyUnlockedQuestIds(state.items,next.items):[];
  questUnlockEffects?.cancelAll();
  state=ensureTrayPositions(next);renderBoard();renderCounts();renderFolderWindow();paperReader.refresh();if(dailyBookWindow?.isOpen)dailyBookWindow.render();persist();
  if(message)showToast(message);
  else if(unlocked.length)showToast(unlocked.length===1?`ปลดล็อกเควส “${state.items.find(q=>q.id===unlocked[0])?.title??''}” แล้ว`:`ปลดล็อก ${unlocked.length} เควส พร้อมออกเดินทางแล้ว`);
  if(unlocked.length)questUnlockEffects?.play(unlocked);
}
const questItems=(includeArchived=false)=>state.items.filter(i=>i.type==='quest'&&(includeArchived||!i.archived));
function statCount(status){return questItems().filter(q=>q.status===status).length;}

function shell(){
  $('#app').innerHTML=`
  <div id="desk-workspace">
  <main class="main quiet-desk">
    <div class="page-content desk-content">
      <section class="board-frame desk-board" aria-label="โต๊ะเควสที่จัดวางได้อิสระ">
        <div class="desk-surface" id="desk-surface">
          <div class="board-scroll" id="board-scroll"><div class="canvas-size" id="canvas-size"><div class="board-canvas" id="board-canvas"></div></div></div>
          <div class="empty-board" id="empty-board" hidden>${icon('feather')}<p id="empty-description">หยิบปากกาจากรางด้านบน เพื่อเริ่มเรื่องราวใหม่</p><button class="button ghost" data-action="empty-action"><span id="empty-action-text">เปิดรางเครื่องมือ</span></button></div>
        </div>
      </section>
    </div>
  </main>
  <aside class="quest-drawer side-storage" id="quest-drawer" aria-label="ลิ้นชักเก็บกระดาษและแฟ้ม" style="--drawer-reveal:0px">
    <button class="drawer-handle" id="drawer-handle" aria-label="ดึงไปทางซ้ายหรือคลิกเพื่อเปิดลิ้นชักเก็บของด้านขวา" aria-expanded="false" aria-controls="drawer-content">${icon('archive')}<span>ลิ้นชักเก็บของ</span><b id="drawer-badge">0</b>${icon('grip')}</button>
    <div class="drawer-body" id="drawer-content" inert>
      <div class="tray-toolbar"><div><span class="eyebrow">THE GUILD'S KEEPSAKES</span><h2>ลิ้นชักเก็บของ</h2></div><label class="drawer-search">${icon('search')}<input id="archive-search" type="search" placeholder="ค้นหาเควส แฟ้ม หรือรูป…" aria-label="ค้นหาของในลิ้นชัก"></label><button class="button ghost small" data-action="new-folder">${icon('plus')}สร้างแฟ้ม</button><button class="icon-button" data-action="close-drawer" aria-label="ปิดลิ้นชัก">${icon('cross')}</button></div>
      <div class="storage-viewport drawer-dropzone" id="drawer-dropzone"><div id="drawer-list" class="storage-plane"></div><p class="tray-empty" id="tray-empty">ลากกระดาษ แฟ้ม หรือรูปมาวางที่นี่<br><small>จัดตำแหน่งได้เหมือนบนโต๊ะ · ลากออกไปวางบนโต๊ะเพื่อนำกลับ</small></p></div>
      <p class="tray-hint">ลากหัวกระดาษหรือสันแฟ้มเพื่อจัดวาง · คลิกชื่อเพื่อเปิดอ่าน · เลื่อนดูของในถาดได้</p>
    </div>
  </aside>
  <aside id="folder-drawer" hidden aria-hidden="true"><span id="folder-drawer-badge"></span><input id="folder-drawer-search" type="hidden"><div id="drawer-folders"></div><div id="folder-drawer-content" inert></div><button id="folder-drawer-handle" hidden></button></aside>
  <aside class="quest-drawer top-tools" id="tool-drawer" aria-label="รางเครื่องเขียนด้านบน" style="--drawer-reveal:0px">
    <button class="drawer-handle" id="tool-drawer-handle" aria-label="ดึงลงหรือคลิกเพื่อเปิดรางเครื่องมือด้านบน" aria-expanded="false" aria-controls="tool-drawer-content">${icon('feather')}<span>เครื่องเขียนของกิลด์</span>${icon('grip')}</button>
    <div class="drawer-body" id="tool-drawer-content" inert>
      <button class="pen-tool" data-action="new-quest"><span class="quill-illustration">${icon('feather')}</span><span><strong>เขียนเควสใหม่</strong><small>หยิบปากกา แล้วเริ่มเรื่องราว</small></span></button>
      <button class="pen-tool" data-action="new-photo-sheet"><span class="quill-illustration">${icon('photo')}</span><span><strong>วางรูปบนโต๊ะ</strong></span></button>
      <div class="stamp-rack" role="group" aria-label="หยิบตราประทับ">${['done','failed','paused'].map(status=>`<button class="stamp-pick" data-pick-stamp="${status}" style="--tool-ink:${STATUS[status].color}" aria-pressed="false" aria-label="หยิบตรา${STATUS[status].label}"><span class="mini-stamper">${icon(status==='done'?'check':status==='failed'?'cross':'pause')}</span><strong>${STATUS[status].label}</strong><small>${STATUS[status].en}</small></button>`).join('')}</div>
      <p class="tool-help">หยิบตรา → คลิกกระดาษเพื่อปั๊ม<br>คลิกขวาหรือกด Esc เพื่อเก็บตราคืน</p>
      <button class="button ghost small" data-action="return-stamp" id="return-stamp" hidden>${icon('stamp')}เก็บตราคืนลิ้นชัก</button>
      <button class="rail-more" data-action="tool-menu" aria-haspopup="dialog" aria-controls="tool-menu-dialog">${icon('menu')}<span>เครื่องมืออื่น ๆ</span></button>
      <button class="icon-button rail-close" data-action="close-tools" aria-label="พับเก็บรางเครื่องมือ">${icon('cross')}</button>
    </div>
  </aside>
  </div>
  <dialog id="tool-menu-dialog" class="tool-menu-dialog" aria-labelledby="tool-menu-title">
      <header class="tool-menu-header"><div><span class="eyebrow">THE ADVENTURER'S DESK</span><h2 id="tool-menu-title">เครื่องมือของกิลด์</h2></div><button class="icon-button" data-action="close-tool-menu" aria-label="ปิดเครื่องมืออื่น ๆ">${icon('cross')}</button></header>
      <section class="drawer-menu">
        <label class="tool-style-select">รูปแบบรอยตรา<select id="tool-stamp-style"><option value="seal">ตรากิลด์</option><option value="rectangle">ตราหมึก</option><option value="banner">ริบบิ้น</option></select></label>
        <label class="tool-custom-select">ตราของฉัน<select id="tool-custom-stamp" aria-label="เลือกตราที่อัปโหลด"></select></label>
        <label class="drawer-search">${icon('search')}<input id="search" type="search" aria-label="ค้นหาเควสบนโต๊ะ" placeholder="ค้นหาเควสบนโต๊ะ…" autocomplete="off"></label>
        <div class="drawer-filters" role="group" aria-label="กรองสถานะ"><button data-filter="all">ทั้งหมด <span id="all-badge"></span></button>${['active','done','failed','paused'].map(status=>`<button data-filter="${status}">${STATUS[status].label}</button>`).join('')}</div>
        <div class="drawer-menu-grid"><button data-action="new-label">${icon('tag')}เพิ่มป้าย</button><button data-action="arrange">${icon('grid')}จัดกระดาษ</button><button data-action="stamps">${icon('stamp')}คลังตรา / เพิ่มรูปตรา</button><button data-action="adventurer-card">${icon('pen')}บัตรนักผจญภัย</button><button data-action="settings">${icon('settings')}ตกแต่ง / สำรองข้อมูล</button><button data-action="help">${icon('help')}วิธีใช้งาน</button></div>
        <div class="sound-controls"><button id="sound-toggle" class="button ghost small" aria-pressed="false">${icon('volume')}<span></span></button><label>เสียงหยิบจับ<input id="sound-volume" type="range" min="0" max="100" aria-label="ความดังเสียงหยิบจับ"></label><button class="button ghost small" id="sound-preview">ลองฟัง</button></div>
        <div id="atmosphere-controls"></div>
        <div class="canvas-controls"><button class="zoom-button" data-action="zoom-out" aria-label="ย่อโต๊ะ">${icon('minus')}</button><button class="zoom-percent" data-action="zoom-reset" title="คืนขนาดเริ่มต้น">100%</button><button class="zoom-button" data-action="zoom-in" aria-label="ขยายโต๊ะ">${icon('plus')}</button></div>
        <div class="drawer-summary"><strong id="board-name"></strong><span>กำลังทำ <b id="active-count">0</b> · สำเร็จ <b id="done-count">0</b> · <b id="xp-count">0</b> XP</span><small id="adventurer-level"></small></div>
        <span id="save-indicator"><span class="save-dot"></span>บันทึกแล้วในเบราว์เซอร์</span>
      </section>
  </dialog>
  <div class="desk-shutter" id="desk-shutter">
    <div class="desk-shutter-veil" aria-hidden="true"></div>
    <div class="desk-shutter-panel">
      <div class="desk-shutter-light" aria-hidden="true"></div>
      <button class="desk-shutter-handle" id="desk-shutter-handle" type="button" aria-controls="desk-workspace"><span aria-hidden="true">✧</span></button>
      <span class="desk-shutter-star" aria-hidden="true">✧</span>
    </div>
  </div>
  <input id="photo-sheet-file" type="file" accept="image/png,image/jpeg,image/webp" hidden>
  <div id="stamp-cursor" class="stamp-cursor" aria-hidden="true"></div>`;
  $('#search').addEventListener('input',e=>{filters.search=e.target.value;renderBoard();});
  $('#tool-stamp-style').addEventListener('change',e=>{returnStamp(false);state={...state,settings:{...state.settings,stampStyle:e.target.value}};persist();});
  $('#tool-custom-stamp').addEventListener('change',e=>{const custom=state.stamps.find(s=>s.id===e.target.value);if(custom)pickStamp(custom.status,e,custom);});
  observer=new ResizeObserver(resizeBoard);observer.observe($('#board-scroll'));
  $('#board-canvas').addEventListener('pointerdown',startDailyBookDrag);
  $('#board-canvas').addEventListener('pointerdown',startDrag);
  $('#board-canvas').addEventListener('keydown',moveWithKeyboard);
  $('#drawer-list').addEventListener('keydown',event=>{if(event.target.matches('[data-photo-drag],[data-notebook-drag]'))moveWithKeyboard(event);});
  $('#photo-sheet-file').addEventListener('change',event=>{
    const file=event.target.files[0];event.target.value='';if(file)addPhotoSheet(file);
  });
  $('#board-scroll').addEventListener('dragover',event=>{
    if(event.dataTransfer?.types.includes('Files')){event.preventDefault();event.dataTransfer.dropEffect='copy';}
  });
  $('#board-scroll').addEventListener('drop',event=>{
    const file=event.dataTransfer?.files[0];if(!file)return;
    event.preventDefault();addPhotoSheet(file,{x:event.clientX,y:event.clientY});
  });
  setupDrawer();
  const coveredWindows=new Set();
  deskShutter=bindDeskShutter({window,shutter:$('#desk-shutter'),panel:$('.desk-shutter-panel'),
    handle:$('#desk-shutter-handle'),surface:$('#desk-workspace'),
    canUse:()=>!(drag||storedDrag||bookDrag||bundleControl?.dragging||photoResizeControl?.active||paperweightControl?.dragging||dialog.open||$('#tool-menu-dialog').open),
    onChange:closed=>{
      document.body.classList.toggle('desk-shutter-closed',closed);
      if(closed){
        returnStamp(false);
        for(const panel of document.querySelectorAll('[data-desk-window],.quest-bundle-selection,#toast')){
          if(panel.inert)continue;
          panel.inert=true;coveredWindows.add(panel);
        }
      }else{
        for(const panel of coveredWindows)panel.inert=false;
        coveredWindows.clear();
      }
      sound.play(closed?'drawerClose':'drawerOpen');
    },
  });
  folioWindows=createFolioWindows({document,window,windows:deskWindows,renderQuest,icon,binding:folioBindingMarkup,reducedMotion,onCue:onSoundCue,
    onRead:id=>{returnStamp(false);closeToolMenu();paperReader.open(id,{back:false});},
  });
  dailyBookWindow=createDailyBookWindow({document,window,windows:deskWindows,getState:()=>state,onCommit:(next,msg)=>commit(next,msg),
    onEditMeta:openDailyBookMetaEditor,onEditTask:openDailyTaskEditor,onDeleteTask:confirmDeleteDailyTask,icon,onCue:onSoundCue,reducedMotion,
  });
  notebookWindows=createNotebookWindows({document,window,windows:deskWindows,getBook:findNotebook,icon,onCue:onSoundCue,reducedMotion,
    writePages:(id,pages)=>{state=updateItem(state,id,{pages});persist();},
    editCover:openNotebookEditor,store:toggleNotebookStorage,
  });
  atmosphere.mount($('#board-scroll'));atmosphere.mountControls($('#atmosphere-controls'));
  setupQuestBundles();
  setupQuestPhotos();
  paperweightControl=createPaperweight({canvas:$('#board-canvas'),viewport:$('#board-scroll'),getState:()=>state,
    getLayout:()=>({bounds:canvasBounds,scale:currentScale}),save:savePaperweight,onEdit:openPaperweightEditor,icon,
    onCue:onSoundCue,onError:showToast,reducedMotion,
    onDragStateChange:dragging=>atmosphere?.setSuspended?.(dragging),
    isBlocked:()=>!!(drag||storedDrag||bookDrag||heldStamp||bundleControl?.dragging||questPhotos?.editing||photoViewer?.isOpen||dialog.open||$('#tool-menu-dialog')?.open),
  });
  photoResizeControl=bindPhotoSheetResizing({document,window,getPhoto:id=>state.items.find(item=>item.id===id),
    getPlaneScale:card=>card.parentElement?.id==='drawer-list'?TRAY_SCALE:card.parentElement?.id==='board-canvas'?currentScale:0,
    save:savePhotoSheetSize,onStart:cancelMotion,onError:showToast,
    isBlocked:()=>!!(drag||storedDrag||bookDrag||heldStamp||paperweightControl?.dragging||bundleControl?.dragging||questPhotos?.editing||photoViewer?.isOpen||dialog.open||$('#tool-menu-dialog')?.open),
  });
  questUnlockEffects??=createQuestUnlockEffects({document,window,reducedMotion});
  adventurerCard?.destroy();
  adventurerCard=createAdventurerCard({deskSurface:$('#desk-surface'),document,window,getState:()=>state,onSavePosition:cardPos=>{state=updateAdventurerCard(state,cardPos);persist();},onEdit:openAdventurerCardEditor,reducedMotion,onCue:onSoundCue,icon,boardName:()=>state.settings?.boardName||'THE QUESTBOARD'});
  $('#tool-menu-dialog').addEventListener('click',e=>{if(e.target===$('#tool-menu-dialog')){const rect=e.target.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)closeToolMenu();}});
  $('#sound-toggle').onclick=()=>{sound.setMuted(!sound.getSettings().muted);ambience.setMuted(sound.getSettings().muted);daypartAmbience.setMuted(sound.getSettings().muted);refreshSoundControls();if(!sound.getSettings().muted){ambience.unlock();daypartAmbience.unlock();sound.play('paperDrop');}};
  $('#sound-volume').oninput=e=>{sound.setVolume(Number(e.target.value)/100);refreshSoundControls();};
  $('#sound-preview').onclick=()=>sound.play('stamp');
  document.addEventListener('pointerdown',startStoredDrag);
  renderBoard();renderCounts();refreshToolOptions();refreshSoundControls();renderBackupStatus(backupClient.status());
}

function stampMarkup(status, style='seal', custom, extra='') {
  if(status==='active')return '';
  const st=STATUS[status]||STATUS.done;
  if(custom)return `<div class="stamp custom-stamp ${extra}"><img src="${esc(custom.dataUrl)}" alt="ตรา${esc(custom.name)} · ${esc(st.label)}"></div>`;
  const symbol=status==='done'?'check':status==='failed'?'cross':'pause';
  return `<div class="stamp stamp-${style} ${extra}" style="--stamp-color:${st.color}"><span class="stamp-top">ADVENTURER'S GUILD</span>${icon(symbol)}<strong>${st.en}</strong><span class="stamp-bottom">${st.label}</span></div>`;
}
function dateLabel(value){
  if(!value)return 'ไม่มีกำหนด';
  const d=new Date(value+'T12:00:00');return d.toLocaleDateString('th-TH',{day:'numeric',month:'short'});
}
function isOverdue(q){return q.due && q.status==='active' && q.due<new Date().toLocaleDateString('en-CA');}
function setupQuestPhotos(){
  if(questPhotos)return;
  photoViewer=createPhotoViewer({document,window,reducedMotion,onCue:onSoundCue});
  questPhotos=createQuestPhotos({document,window,reducedMotion,onCue:onSoundCue,
    getQuest:id=>state?.items.find(item=>item.id===id),
    onSave:(id,layout)=>{
      const quest=state.items.find(item=>item.id===id&&item.type==='quest');
      if(!quest?.imageDataUrl)throw new Error('ไม่พบรูปบนใบเควสนี้แล้ว');
      commit(updateItem(state,id,{photoLayout:layout}));
    },
    onView:payload=>photoViewer.open(payload),
    isBlocked:()=>!!(heldStamp||dialog.open||$('#tool-menu-dialog')?.open||drag||storedDrag||bundleControl?.dragging||photoViewer?.isOpen||document.querySelector?.('.is-window-dragging')),
  });
}
function paperStampMarkup(q,custom){
  if(q.status==='active')return '';
  const ink=stampMarkup(q.status,q.stampStyle,custom,'on-paper'+(q.stampPosition?' positioned-ink':''));
  const position=q.stampPosition?toPaperStampPosition(q.stampPosition):null;
  return `<div class="quest-ink-layer">${position?`<span class="stamp-anchor" style="left:${position.x}px;top:${position.y}px">${ink}</span>`:ink}</div>`;
}
function questPhotoPresentation(q){
  if(!q.imageDataUrl)return {className:'',markup:''};
  const frame=questPhotos?.presentation(q);
  const className=frame?`photo-sized photo-${frame.orientation}${q.photoLayout?' photo-manual':''}`:'';
  const style=frame?` style="left:${frame.x}px;top:${frame.y}px;width:${frame.width}px;height:${frame.height}px;transform:rotate(${frame.rotation}deg);transform-origin:center;"`:'';
  const imageStyle=frame?` style="width:${frame.width-10}px;height:${frame.height-14}px;max-width:none;max-height:none;"`:'';
  return {className,markup:`<div class="quest-photo"${style}><img src="${esc(q.imageDataUrl)}" alt="รูปประกอบเควส ${esc(q.title)}" draggable="false"${imageStyle}></div>`};
}
function renderBurnWisps(variant){
  const anchors=typeof burnWispAnchors==='function'?burnWispAnchors(variant):[];
  return `<span class="paper-wisp-layer" aria-hidden="true">${anchors.map(a=>`<span class="paper-wisp${a.thin?' thin':''}" style="left:${a.left}px;top:${a.top}px;--wisp-dur:${a.dur};--wisp-delay:${a.delay};--wisp-mid:${a.mid};--wisp-end:${a.end}"></span>`).join('')}</span>`;
}
function renderQuest(q,index){
  const custom=state.stamps.find(s=>s.id===q.stampId);
  const priorities={high:['A','เควสสำคัญ'],normal:['B','เควสทั่วไป'],low:['C','เควสสบาย ๆ']};
  const [rank,priority]=priorities[q.priority]||priorities.normal;
  const photo=questPhotoPresentation(q);
  const dependencies=q.prerequisiteIds?.length?dependencyMarkup(q,state.items):'';
  const stage=typeof burnStage==='function'?burnStage(q.due,undefined,q.status):0;
  const variant=typeof burnVariant==='function'?burnVariant(q.id):0;
  const ageStage=typeof paperAgeStage==='function'?paperAgeStage(q.createdAt):0;
  const burnAttrs=stage>=1?` data-burn="${stage}" data-burn-variant="${variant}"`:'';
  const ageAttr=ageStage>=1?` data-age="${ageStage}"`:'';
  const ageLayer=ageStage>=1?'<span class="paper-age" aria-hidden="true"></span>':'';
  const burnLayer=stage>=1?'<span class="paper-burn" aria-hidden="true"></span>':'';
  const wispLayer=stage===3?renderBurnWisps(variant):'';
  return `<article class="quest-paper board-item paper-${index%3} ${q.status!=='active'?'has-stamp':''} ${q.imageDataUrl?'has-photo':''} ${photo.className}" data-id="${esc(q.id)}"${burnAttrs}${ageAttr} style="left:${q.x}px;top:${q.y}px;--rotation:${q.rotation}deg;z-index:${q.z}" aria-label="เควส ${esc(q.title)}">
    <span class="paper-wear" aria-hidden="true"></span>
    ${ageLayer}
    ${burnLayer}
    ${wispLayer}
    <button type="button" class="quest-bundle-select" data-bundle-select="${esc(q.id)}" aria-pressed="false" aria-label="เลือกเควส ${esc(q.title)} เพื่อหยิบเป็นมัด" title="เลือกหลายใบด้วย Shift+คลิก หรือกดช่องเลือก">${icon('check')}</button>
    <div class="quest-top drag-handle" tabindex="0" role="button" aria-label="ลากเควส ${esc(q.title)} หรือใช้ปุ่มลูกศรเพื่อย้าย"><span class="quest-type">${icon(q.category==='พัฒนาตัวเอง'?'feather':q.category==='ชีวิตประจำวัน'?'sun':'swords')}${esc(q.category)}</span>${icon('grip')}</div>
    <div class="paper-rule"><span>QUEST No. ${String(state.items.filter(i=>i.type==='quest').findIndex(i=>i.id===q.id)+1).padStart(3,'0')}</span><span class="rank rank-${q.priority}" title="${priority}">${rank}</span></div>
    <button class="quest-title" data-read-front="${esc(q.id)}">${esc(q.title)}</button>
    <p class="quest-description">${esc(q.description)||'ทุกภารกิจมีความหมาย เริ่มก้าวแรกได้เลย'}</p>
    ${photo.markup}
    <div class="quest-metadata">${dependencies||`<span class="priority priority-${q.priority}"><i></i>${priority}</span>`}<span class="quest-xp">${icon('spark')}${q.xp} XP</span></div>
    <div class="quest-date ${isOverdue(q)?'overdue':''}">${icon('calendar')}<span>${q.due?'ภายใน '+dateLabel(q.due):'ออกเดินทางเมื่อพร้อม'}</span>${isOverdue(q)?'<small>เลยกำหนด</small>':''}</div>
    ${paperStampMarkup(q,custom)}
    ${q.subquests?.length?`<span class="paper-back-hint">${q.subquests.filter(task=>task.done).length} / ${q.subquests.length} เควสย่อย</span>`:q.notes?.trim()?'<span class="paper-back-hint">มีบันทึกด้านหลัง</span>':''}
    <button class="paper-turn-corner" data-read-back="${esc(q.id)}" aria-label="พลิกเควส ${esc(q.id)} เพื่อจดโน้ตและเควสย่อย" title="พลิกด้านหลัง · โน้ตและเควสย่อย">${icon('restore')}</button>
  </article>`;
}
function renderLabel(item){return `<div class="board-label board-item label-${esc(item.color)}" data-id="${esc(item.id)}" style="left:${item.x}px;top:${item.y}px;--rotation:${item.rotation}deg;z-index:${item.z}"><div class="drag-handle" role="button" tabindex="0" aria-label="ลากป้าย ${esc(item.text)} หรือใช้ลูกศร">${icon('grip')}<span>${esc(item.text)}</span></div><button data-edit-label="${esc(item.id)}" aria-label="แก้ไขป้าย ${esc(item.text)}">${icon('edit')}</button></div>`;}
function refreshSoundControls(){
  const settings=sound.getSettings(),button=$('#sound-toggle');if(!button)return;
  button.setAttribute('aria-pressed',String(settings.muted));$('span',button).textContent=settings.muted?'เสียงปิดอยู่':'เสียงเปิดอยู่';
  $('#sound-volume').value=Math.round(settings.volume*100);
}
const folderMembers=id=>state.items.filter(i=>i.type==='quest'&&i.folderId===id);
function folioBindingMarkup(){
  return '<span class="folio-binding" aria-hidden="true"><span class="folio-cord folio-cord-left"></span><span class="folio-cord folio-cord-right"></span><span class="folio-knot"><i></i><i></i></span><span class="folio-cord-tail folio-tail-left"></span><span class="folio-cord-tail folio-tail-right"></span><span class="folio-eyelet"></span></span>';
}
function renderFolder(folder){
  const dye=leatherDyeMarkup(folder.color);
  return `<article class="board-folder board-item folder-${folder.color}" data-id="${folder.id}" data-folder-target="${folder.id}"${dye.attributes} style="left:${folder.x}px;top:${folder.y}px;${dye.style}--rotation:${folder.rotation}deg;z-index:${folder.z}" aria-label="แฟ้มหนัง ${esc(folder.name)}">
    <div class="folder-tab drag-handle" role="button" tabindex="0" aria-label="ลากแฟ้ม ${esc(folder.name)} หรือใช้ปุ่มลูกศร">${icon('grip')}<span>${esc(folder.name)}</span></div>
    <button class="folder-cover" data-open-folder="${folder.id}">${icon('shield')}<strong class="folder-title">${esc(folder.name)}</strong><span>${folderMembers(folder.id).length} เควส</span><small>คลายเชือกเปิดอ่าน · ลากเควสมาวางเพื่อเก็บ</small></button>
    ${folioBindingMarkup()}
    <div class="folder-actions"><button data-edit-folder="${folder.id}" title="แก้ไขชื่อและสีแฟ้ม" aria-label="แก้ไขชื่อและสีแฟ้ม ${esc(folder.name)}">${icon('edit')}</button><button data-store-folder="${folder.id}" aria-label="เก็บแฟ้ม ${esc(folder.name)} เข้าลิ้นชัก">${icon('archive')}</button></div>
  </article>`;
}
function openFolderEditor(id){
  const folder=state.items.find(i=>i.id===id&&i.type==='folder');
  const fields=`<label class="field">ชื่อแฟ้ม<input name="name" maxlength="60" required autofocus value="${esc(folder?.name||'')}" placeholder="เช่น งานเขียน / เควสประจำสัปดาห์"></label>
    ${renderLeatherColorPicker('สีหนังแฟ้ม',folder?.color)}`;
  const cover=renderFolder(folder??{id:'',name:'แฟ้มหนัง',color:'gold',x:0,y:0,rotation:0,z:0});
  openDialog(folder?'จัดแฟ้มหนัง':'สร้างแฟ้มหนังใหม่','รวมเควสที่เกี่ยวข้องไว้ด้วยกัน หยิบมาดูได้ทุกเมื่อ',`<form class="dialog-body" id="folder-form">
    ${renderCoverEditorFields(fields,cover,{width:PAPER.width,height:210})}
    <p id="form-error" class="form-error" hidden></p>
    <footer class="dialog-footer">${folder?`<button class="button danger-ghost" type="button" id="delete-folder">${icon('trash')}นำแฟ้มออก</button>`:'<span></span>'}<div><button type="button" class="button ghost" data-close>ยกเลิก</button><button type="submit" class="button primary">${icon('folder')}${folder?'บันทึกแฟ้ม':'สร้างแฟ้มในลิ้นชัก'}</button></div></footer>
  </form>`,'cover-editor-dialog');
  const form=$('#folder-form');
  bindCoverEditor(form);
  form.onsubmit=e=>{e.preventDefault();try{const values=Object.fromEntries(new FormData(e.target));let next;if(folder)next=updateItem(state,id,values);else next={...state,items:[...state.items,createFolder(values,state)]};if(!folder){folderDrawerSearch='';$('#folder-drawer-search').value='';}closeDialog();sound.play(folder?'pen':'folderDrop');commit(next,folder?'บันทึกแฟ้มแล้ว':'สร้างแฟ้มในลิ้นชักแฟ้มแล้ว');if(!folder)setFolderDrawerOpen(true);}catch(err){formError(err.message);}};
  if(folder)$('#delete-folder').onclick=()=>confirmDelete(id,'แฟ้มนี้ (เควสข้างในจะกลับไปอยู่ในลิ้นชัก)');
}
function finishFolderOpening(panel){folioWindows?.finishOpening(panel);}
function placeFolder(id,open=true){
  const folder=state.items.find(i=>i.id===id&&i.type==='folder');if(!folder)return;
  if(folder.archived&&!open){const viewport=$('#board-scroll');const pos=rotatedClampPosition(viewport.scrollLeft/currentScale+80,viewport.scrollTop/currentScale+80,'folder',folder.rotation,canvasBounds);commit(updateItem(setArchived(state,id,false),id,{...pos,z:Math.max(...state.items.map(i=>i.z),0)+1}));}
  if(!folder.archived||!open)setActiveDrawer(null,false,false);if(!open)sound.play('folderDrop');
  if(open)folioWindows.open(folder,state.items);
}
function closeFolderWindow(animate=false,id=folioWindows?.activeId){
  folioWindows?.close(id,{animate,returnFocus:animate});
}
function renderFolderWindow(){
  folioWindows?.render(state.items);
  if(typeof dailyBookWindow!=='undefined')dailyBookWindow?.render?.();
  notebookWindows?.refresh();
  bundleControl?.refresh();
}
function folderTargetAt(e,questId){
  const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-folder-target]');
  if(!target||target.closest('[inert]'))return null;
  const id=target.dataset.folderTarget;
  if(!state.items.some(i=>i.type==='folder'&&i.id===id)||!state.items.some(i=>i.id===questId&&i.type==='quest'))return null;
  const surface=target.classList.contains('folder-window')?'folder-window':target.closest('.storage-plane')||target.classList.contains('drawer-folder-row')?'drawer-folder-row':'board-folder';
  return {id,surface};
}
function bundleTargetAt(e,ids){
  const hit=document.elementFromPoint(e.clientX,e.clientY);if(!hit||hit.closest('[inert]'))return null;
  const folder=hit.closest('[data-folder-target]');
  if(folder&&!folder.hidden&&state.items.some(item=>item.id===folder.dataset.folderTarget&&item.type==='folder'))return {type:'folder',id:folder.dataset.folderTarget,element:folder,drawer:!!folder.closest('.quest-drawer')};
  if(overStorageTray(e,'quest'))return {type:'tray',element:$('#drawer-dropzone'),origin:$('#drawer-list').getBoundingClientRect(),scale:TRAY_SCALE};
  if(hit.closest('[data-desk-window],.quest-drawer,.desk-shutter,dialog'))return null;
  const viewport=$('#board-scroll').getBoundingClientRect();
  if(!containsPoint({x:e.clientX,y:e.clientY},viewport))return null;
  return {type:'board',element:$('#board-canvas'),origin:$('#board-canvas').getBoundingClientRect(),scale:currentScale,bounds:canvasBounds};
}
function setupQuestBundles(){
  bundleControl?.destroy();let drawerBefore=null,dropTarget=null;
  bundleControl=createQuestBundles({document,window,getState:()=>state,commit:next=>{if(dropTarget?.type==='board'){filters={status:'all',category:'all',search:''};$('#search').value='';}commit(next);},renderQuest,reducedMotion,
    getDropTarget:bundleTargetAt,onAssist:e=>followStorageHandle(e,'quest'),onCue:onSoundCue,
    isBlocked:()=>!!(drag||storedDrag||heldStamp||deskShutter?.closed||deskShutter?.pulling||paperweightControl?.dragging||photoResizeControl?.active||questPhotos?.editing||photoViewer?.isOpen||dialog.open||$('#tool-menu-dialog')?.open||document.querySelector('.is-window-dragging')),
    onTarget:target=>{dropTarget=target;highlightFolder(target?.type==='folder'?target.id:null);highlightStorageTray(target?.type==='tray'?'quest-drawer':null);},
    onStart:({ids,source})=>{if(typeof atmosphere!=='undefined'&&atmosphere)atmosphere.setSuspended?.(true);drawerBefore=activeDrawerId();paperEffects.cancelAll();storageDrawerControl?.rest();for(const id of ids){stampCues.get(id)?.abort();stampCues.delete(id);}const panel=source?.closest?.('.folder-window');if(panel)finishFolderOpening(panel);},
    onEnd:({committed,target})=>{if(typeof atmosphere!=='undefined'&&atmosphere)atmosphere.setSuspended?.(false);clearStorageFeedback();highlightFolder(null);setActiveDrawer(committed&&(target?.type==='tray'||target?.drawer)?'quest-drawer':drawerBefore,false,false);},
  });
}
function highlightFolder(id){document.querySelectorAll('[data-folder-target]').forEach(el=>el.classList.toggle('folder-drop-ready',el.dataset.folderTarget===id));}
function overStorageTray(e,type){
  if(!['quest','folder','daily-book','photo','notebook'].includes(type)||!drawerOpen)return null;
  const hit=document.elementFromPoint(e.clientX,e.clientY);
  if(hit?.closest('.drawer-dropzone,#drawer-list,#quest-drawer'))return 'quest-drawer';
  const drawerEl=$('#quest-drawer');
  if(drawerEl){
    const r=drawerEl.getBoundingClientRect();
    if(r.width>60&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){
      return 'quest-drawer';
    }
  }
  return null;
}
function highlightStorageTray(id){
  for(const key of ['quest-drawer','folder-drawer'])$('#'+key).classList.toggle('drop-ready',key===id);
}
function clearStorageFeedback(){
  for(const key of ['quest-drawer','folder-drawer'])$('#'+key).classList.remove('receiving','drop-ready');
}
function activateStorageDrawer(id){
  // Automatic storage assistance should not mask the sound of the held item.
  clearStorageFeedback();$('#quest-drawer').classList.add('receiving');setActiveDrawer('quest-drawer',false,false);
}
function followStorageHandle(e,type){
  if(!['quest','folder','daily-book','photo','notebook'].includes(type))return;
  const hovered=document.elementFromPoint(e.clientX,e.clientY)?.closest('.drawer-handle')?.closest('.quest-drawer')?.id;
  const nearEdge=e.clientX>=window.innerWidth-55;
  if(['quest-drawer','folder-drawer'].includes(hovered)||nearEdge)activateStorageDrawer(drawerForDraggedItem(type,activeDrawerId(),hovered??'quest-drawer'));
}
function updateHeldGhost(d,e){
  const now=performance.now();
  d.pointer={x:e.clientX,y:e.clientY};
  if(!d.sample||d.sample.x!==e.clientX){d.targetTilt=d.sample?dragTilt(d.sample,{x:e.clientX,time:now}):0;d.sample={x:e.clientX,time:now};}
  d.motionStarted??=now;
  const paint=()=>{
    const time=performance.now(),reduce=reducedMotion();
    const tiltTarget=reduce||time-d.sample.time>90?0:d.targetTilt;
    d.tilt=reduce?0:(d.tilt??0)+(tiltTarget-(d.tilt??0))*.24;
    const lift=reduce?1:1+.025*(1-Math.pow(1-Math.min(1,(time-d.motionStarted)/150),3));
    const pose=ghostPose(d.pointer,d.grab,d.scale??currentScale,d.rotation??d.item.rotation,d.tilt,lift);
    if((d.type??d.item?.type)==='quest'){
      const grip=paperGripPose(d.grab,{tilt:d.tilt,reduced:reduce});
      if(grip.transform)pose.transform+=' '+grip.transform;
      d.ghost.style.setProperty('--paper-grip-shade-x',String(grip.shadeX));
      d.ghost.style.setProperty('--paper-grip-shade-y',String(grip.shadeY));
    }
    Object.assign(d.ghost.style,pose);
  };
  paint();
  if(!d.motionFrame&&!reducedMotion()){
    const tick=()=>{paint();d.motionFrame=reducedMotion()?null:requestAnimationFrame(tick);};
    d.motionFrame=requestAnimationFrame(tick);
  }
}
function stopHeldMotion(d){if(d.motionFrame)cancelAnimationFrame(d.motionFrame);d.motionFrame=null;}
function settlePaper(id,tilt=0){
  const item=state.items.find(i=>i.id===id),el=$(`[data-id="${id}"]`);
  if(!item||!el||item.type==='label')return;
  queueContactSound(id,['folder','notebook'].includes(item.type)?'folderDrop':'paperDrop',typeof el.animate==='function'?166:0);
  if(item.type==='quest'&&typeof paperEffects!=='undefined')paperEffects?.shedAsh?.(el,{stage:Number(el.dataset?.burn||0),mode:'drop'});
  if(reducedMotion())return;
  const rotation=item.rotation;
  const keyframes=typeof settleTiltKeyframes==='function'?settleTiltKeyframes(rotation,tilt):[
    {transform:`rotate(${rotation+tilt*.35}deg) scale(1.025)`,easing:'cubic-bezier(.2,.7,.3,1)'},
    {transform:`rotate(${rotation-.3}deg) scale(.998)`,offset:.72,easing:'ease-out'},
    {transform:`rotate(${rotation}deg) scale(1)`}
  ];
  animateTransient(el,keyframes,{duration:230,easing:'linear'});
}
function animateFolderInsert(ghost,folderId,surface='board-folder'){
  if(!ghost)return false;
  if(reducedMotion()||typeof ghost.animate!=='function'){ghost.remove();return false;}
  const targets=[...document.querySelectorAll('[data-folder-target]')].filter(el=>el.dataset.folderTarget===folderId&&!el.hidden&&!el.closest('[inert]'));
  const target=targets.find(el=>el.classList.contains(surface))||targets[0];
  if(!target){ghost.remove();return false;}
  const slot=target.getBoundingClientRect(),isBoard=target.classList.contains('board-folder');
  target.classList.add('folder-receiving');setTimeout(()=>target.classList.remove('folder-receiving'),820);
  const scale=Math.min(slot.width/300*.82,currentScale*.76),grab={x:150,y:28};
  const rotation=isBoard?(state.items.find(i=>i.id===folderId)?.rotation??0):0;
  const destination=ghostPose({x:slot.left+slot.width/2,y:slot.top+slot.height*.48},grab,scale,rotation,0,1);
  const from={left:ghost.style.left,top:ghost.style.top,transform:ghost.style.transform,transformOrigin:ghost.style.transformOrigin};
  animateTransient(ghost,[
    {...from,opacity:.98,clipPath:'inset(0 0 0 0)',easing:'cubic-bezier(.25,.7,.25,1)'},
    {...destination,opacity:.95,clipPath:'inset(0 0 8% 0)',offset:.5,easing:'cubic-bezier(.35,.08,.5,1)'},
    {...destination,top:parseFloat(destination.top)+slot.height*.2+'px',opacity:0,clipPath:'inset(0 0 100% 0)'}
  ],{duration:430,easing:'linear',fill:'forwards'},{remove:true});
  return true;
}
function storeInFolder(questId,folderId,ghost=null,surface='board-folder'){
  try{commit(moveQuestToFolder(state,questId,folderId));}catch(err){ghost?.remove();showToast(err.message);return;}
  showToast(`เก็บเข้าแฟ้ม “${state.items.find(i=>i.id===folderId).name}” แล้ว`);
  let animated=false;
  try{animated=animateFolderInsert(ghost,folderId,surface);}catch{ghost?.remove();}
  const cue=queueContactSound(questId,'paperSlide',animated?215:0);
  if(animated)cue.signal.addEventListener('abort',()=>{cancelMotion(ghost);ghost.remove();},{once:true});
}
function startStoredDrag(e){
  const grip=e.target.closest('[data-quest-drag],[data-folder-drag],[data-daily-book-drag],[data-photo-drag],[data-notebook-drag]');if(!grip||e.button!==0||drag||storedDrag||heldStamp||questPhotos?.editing||photoViewer?.isOpen||dialog.open)return;
  const isBook=Boolean(grip.matches('[data-daily-book-drag]'));
  const surface=grip.closest('[data-storage-id]');
  if(isBook&&(!surface||e.target.closest('button')))return;
  const id=isBook?'daily-book':(grip.dataset.questDrag||grip.dataset.folderDrag||grip.dataset.photoDrag||grip.dataset.notebookDrag);
  const item=isBook?{...ensureDailyBook(state).dailyBook,id:'daily-book',type:'daily-book'}:state.items.find(i=>i.id===id);if(!item)return;
  stampCues.get(id)?.abort();stampCues.delete(id);
  storageDrawerControl?.rest();
  e.preventDefault();window.getSelection()?.removeAllRanges();
  const preview=grip.closest('[data-folio-paper]');
  let localGrab={x:item.type==='daily-book'?DAILY_BOOK_SIZE.width/2:150,y:28};
  if(surface){const transform=getComputedStyle(surface).transform;const matrix=transform==='none'?{a:1,b:0,c:0,d:1}:new DOMMatrix(transform);const size=item.type==='notebook'?NOTEBOOK_SIZE:item.type==='photo'?photoSheetSize(item.aspect,item.photoScale):{width:item.type==='daily-book'?DAILY_BOOK_SIZE.width:PAPER.width,height:item.type==='folder'?210:item.type==='daily-book'?DAILY_BOOK_SIZE.height:PAPER.height};localGrab=stampPoint({x:e.clientX,y:e.clientY},surface.getBoundingClientRect(),matrix,TRAY_SCALE,size);}
  let scale=surface?TRAY_SCALE:currentScale;
  if(preview){
    // Capture the actual curved/lifted presentation before settling it. Each
    // ancestor contributes rotation/scale; translation is already in the rect.
    let matrix={a:1,b:0,c:0,d:1};
    for(let node=preview;node&&node!==document.body;node=node.parentElement){
      const transform=getComputedStyle(node).transform,own=transform==='none'?{a:1,b:0,c:0,d:1}:new DOMMatrix(transform);
      const {a,b,c,d}=matrix;
      matrix={a:own.a*a+own.c*b,b:own.b*a+own.d*b,c:own.a*c+own.c*d,d:own.b*c+own.d*d};
    }
    localGrab=stampPoint({x:e.clientX,y:e.clientY},preview.getBoundingClientRect(),matrix,1,PAPER);
    scale=Math.hypot(matrix.a,matrix.b);
    const stage=preview.closest('.folio-paper-stage');if(stage)cancelMotion(stage);
    const sourcePanel=preview.closest('.folder-window');if(sourcePanel)finishFolderOpening(sourcePanel);
  }
  storedDrag={surface:surface??preview,scale,rotation:preview?0:item.rotation,id,item,startX:e.clientX,startY:e.clientY,pointerId:e.pointerId,moved:false,ghost:null,grab:localGrab,drawerBefore:activeDrawerId()};
  document.body.setPointerCapture(e.pointerId);
  window.addEventListener('pointermove',moveStoredDrag);window.addEventListener('pointerup',endStoredDrag);window.addEventListener('pointercancel',cancelStoredDrag);
}
function moveStoredDrag(e){
  const d=storedDrag;if(!d||e.pointerId!==d.pointerId)return;
  if(!d.moved&&Math.abs(e.clientX-d.startX)+Math.abs(e.clientY-d.startY)>5){
    d.moved=true;if(typeof atmosphere!=='undefined'&&atmosphere)atmosphere.setSuspended?.(true);sound.play(['folder','daily-book','notebook'].includes(d.item.type)?'folderPick':'paperPick');
    const container=document.createElement('div');
    if(d.item.type==='photo'){
      container.innerHTML=renderPhotoSheet(d.item);
    }else if(d.item.type==='daily-book'){
      container.innerHTML=renderDailyBookCover(d.item,{icon});
    }else if(d.item.type==='notebook'){
      container.innerHTML=renderNotebookCover(d.item,{icon});
    }else{
      container.innerHTML=d.item.type==='folder'?renderFolder(d.item):renderQuest(d.item,0);
    }
    const ghost=container.firstElementChild;ghost.removeAttribute('data-id');ghost.removeAttribute('data-folder-target');ghost.removeAttribute('data-daily-book');ghost.setAttribute('aria-hidden','true');ghost.inert=true;
    ghost.classList.add(['daily-book','notebook'].includes(d.item.type)?'book-drag-ghost':d.item.type==='folder'?'folder-drag-ghost':'quest-drag-ghost');
    const sheet=d.item.type==='notebook'?NOTEBOOK_SIZE:d.item.type==='photo'?photoSheetSize(d.item.aspect,d.item.photoScale):null;
    const ghostW=sheet?.width??(d.item.type==='daily-book'?DAILY_BOOK_SIZE.width:PAPER.width);
    const ghostH=sheet?.height??(d.item.type==='folder'?210:d.item.type==='daily-book'?DAILY_BOOK_SIZE.height:PAPER.height);
    // Keep the cover's rendered leather color while adding drag geometry.
    Object.assign(ghost.style,{
      position:'fixed',width:`${ghostW}px`,height:`${ghostH}px`,zIndex:'10000',pointerEvents:'none',
      transform:`scale(${d.scale}) rotate(${d.rotation}deg)`,transformOrigin:'center',
    });
    ghost.classList.add('paper-in-hand');document.body.append(ghost);d.ghost=ghost;
    if(d.item.type==='quest'&&typeof paperEffects!=='undefined')paperEffects?.shedAsh?.(d.surface||ghost,{stage:Number(ghost.dataset?.burn||0),mode:'pickup'});
    d.surface?.classList.add('storage-source');
    activateStorageDrawer('quest-drawer');
  }
  if(!d.moved)return;
  updateHeldGhost(d,e);
  followStorageHandle(e,d.item.type);
  const receiver=d.item.type==='quest'?folderTargetAt(e,d.id):null;
  d.folderTarget=receiver?.id;d.folderSurface=receiver?.surface;highlightFolder(d.folderTarget);
  d.overTray=!d.folderTarget&&overStorageTray(e,d.item.type);
  highlightStorageTray(d.overTray);
}
function cleanupStoredDrag(keepGhost=false){
  const d=storedDrag;if(!d)return;
  if(typeof atmosphere!=='undefined'&&atmosphere)atmosphere.setSuspended?.(false);
  storedDrag=null;window.removeEventListener('pointermove',moveStoredDrag);window.removeEventListener('pointerup',endStoredDrag);window.removeEventListener('pointercancel',cancelStoredDrag);
  if(document.body.hasPointerCapture(d.pointerId))document.body.releasePointerCapture(d.pointerId);
  stopHeldMotion(d);d.surface?.classList.remove('storage-source');if(!keepGhost)d.ghost?.remove();highlightFolder(null);clearStorageFeedback();
  if(d.moved)suppressClickUntil=performance.now()+400;
}
function endStoredDrag(e){
  if(!storedDrag||e.pointerId!==storedDrag.pointerId)return;moveStoredDrag(e);const d=storedDrag;
  const viewport=$('#board-scroll').getBoundingClientRect(),origin=$('#board-canvas').getBoundingClientRect();
  const overBoard=containsPoint({x:e.clientX,y:e.clientY},viewport)&&!document.elementFromPoint(e.clientX,e.clientY)?.closest('.quest-drawer,[data-desk-window],.desk-shutter');
  cleanupStoredDrag(!!d.folderTarget||!!d.overTray);
  try{
    if(!d.moved){
      if(d.item.type==='daily-book')openDailyBook();
      else if(d.item.type==='photo')openPhotoSheet(d.id);
      else if(d.item.type==='notebook')openNotebook(d.id);
      else renderFolderWindow();
      return;
    }
    if(d.item.type==='daily-book'){
      if(d.overTray){
        const pos=trayDrop({x:e.clientX,y:e.clientY},$('#drawer-list').getBoundingClientRect(),d.grab,TRAY_SCALE,d.item.rotation,'daily-book');
        commit(updateDailyBookMeta(state,{storagePosition:pos}));
        settleTrayDailyBook(d.ghost,d.grab);
        renderFolderWindow();
        return;
      }
      if(overBoard){
        const angle=d.item.rotation*Math.PI/180,cx=DAILY_BOOK_SIZE.width/2,cy=DAILY_BOOK_SIZE.height/2,gx=d.grab.x-cx,gy=d.grab.y-cy;
        const pos=rotatedClampPosition((e.clientX-origin.left)/currentScale-cx-gx*Math.cos(angle)+gy*Math.sin(angle),(e.clientY-origin.top)/currentScale-cy-gx*Math.sin(angle)-gy*Math.cos(angle),'daily-book',d.item.rotation,canvasBounds);
        const topZ=Math.max(...state.items.map(i=>i.z),0)+1;
        const next=updateDailyBookMeta(state,{archived:false,...pos,z:topZ});
        setActiveDrawer(null,false,false);commit(next,'นำสมุดงานประจำวันวางบนโต๊ะแล้ว');settleDailyBook(d.tilt);return;
      }
    }else{
      if(d.folderTarget){storeInFolder(d.id,d.folderTarget,d.ghost,d.folderSurface);renderFolderWindow();return;}
      if(d.overTray){storeAtTray(d.id,e,d.grab);settleTrayItem(d.id,d.ghost,d.grab);renderFolderWindow();return;}
      if(overBoard){
        const size=d.item.type==='notebook'?NOTEBOOK_SIZE:d.item.type==='photo'?photoSheetSize(d.item.aspect,d.item.photoScale):{width:PAPER.width,height:d.item.type==='folder'?210:PAPER.height};
        const angle=d.item.rotation*Math.PI/180,cx=size.width/2,cy=size.height/2,gx=d.grab.x-cx,gy=d.grab.y-cy;
        const pos=rotatedClampPosition((e.clientX-origin.left)/currentScale-cx-gx*Math.cos(angle)+gy*Math.sin(angle),(e.clientY-origin.top)/currentScale-cy-gx*Math.sin(angle)-gy*Math.cos(angle),d.item.type,d.item.rotation,canvasBounds,d.item.aspect,d.item.photoScale);
        const next=updateItem(setArchived(state,d.id,false),d.id,{...pos,z:Math.max(...state.items.map(i=>i.z),0)+1});
        filters={status:'all',category:'all',search:''};$('#search').value='';
        setActiveDrawer(null,false,false);commit(next,'วางบนโต๊ะแล้ว');settlePaper(d.id,d.tilt);return;
      }
    }
  }catch(err){showToast(err.message);}
  setActiveDrawer(d.drawerBefore,false,false);renderFolderWindow();
}
function cancelStoredDrag(e){const d=storedDrag;if(!d||(e?.pointerId!==undefined&&e.pointerId!==d.pointerId))return;cleanupStoredDrag();setActiveDrawer(d.drawerBefore,false,false);renderFolderWindow();if(d.item.folderId)($(`[data-folio-paper="${d.id}"] .quest-top`)||$(`[data-folio-select="${d.id}"]`))?.focus({preventScroll:true});}
function renderBoard(){
  if(!$('#board-canvas'))return;
  for(const cue of stampCues.values())cue.abort();stampCues.clear();
  paperEffects.cancelAll();
  const quests=filterQuests(state.items,filters);
  const filtered=filters.status!=='all'||filters.search||filters.category!=='all';
  const bookHtml=typeof renderDailyBookCover==='function'&&state.dailyBook&&!state.dailyBook.archived?renderDailyBookCover(state.dailyBook,{icon}):'';
  const notebooks=state.items.filter(item=>item.type==='notebook'&&!item.archived);
  const search=filters.search.trim().toLocaleLowerCase('th');
  const photos=state.items.filter(item=>item.type==='photo'&&!item.archived&&(!search||`${item.title}\n${item.notes}`.toLocaleLowerCase('th').includes(search)));
  $('#board-canvas').innerHTML=state.items.filter(i=>i.type==='label').map(renderLabel).join('')+state.items.filter(i=>i.type==='folder'&&!i.archived).map(renderFolder).join('')+bookHtml+notebooks.map(book=>renderNotebookCover(book,{icon})).join('')+quests.map(renderQuest).join('')+photos.map(photo=>renderPhotoSheet(photo)).join('');
  $('#board-name').textContent=state.settings.boardName;
  $('.board-frame').dataset.theme=state.settings.theme;
  $('#empty-board').hidden=quests.length>0||photos.length>0||(!filtered&&(Boolean(bookHtml)||notebooks.length>0||state.items.some(i=>i.type==='label'||(i.type==='folder'&&!i.archived))));
  $('#empty-description').textContent=filtered?'ไม่พบเควสที่ตรงกับการค้นหาหรือตัวกรอง':'หยิบปากกาจากรางด้านบน เพื่อเริ่มเรื่องราวใหม่';
  $('#empty-action-text').textContent=filtered?'แสดงเควสทั้งหมด':'เปิดรางเครื่องมือ';
  document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===filters.status));
  document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===filters.status));
  resizeBoard();
  paperweightControl?.render();
  photoSheetReader.refreshStorage();
  bundleControl?.refresh();
  questPhotos?.refresh();
}
function renderCounts(){
  const quests=questItems();const done=statCount('done');const xp=questItems(true).filter(q=>q.status==='done').reduce((a,q)=>a+q.xp,0);
  document.querySelectorAll('[data-count]').forEach(e=>e.textContent=e.dataset.count==='all'?quests.length:statCount(e.dataset.count));
  $('#active-count').textContent=statCount('active');$('#done-count').textContent=done;$('#xp-count').textContent=xp.toLocaleString();$('#all-badge').textContent=quests.length;
  $('#adventurer-level').textContent=`LEVEL ${Math.floor(xp/500)+1} · ${xp.toLocaleString()} XP`;
  adventurerCard?.update(xp,{doneCount:done,name:state?.adventurerCard?.name,emblem:state?.adventurerCard?.emblem||state?.paperweight?.emblem||'shield',imageDataUrl:state?.adventurerCard?.emblem==='custom'?state?.adventurerCard?.imageDataUrl:(state?.adventurerCard?.emblem?null:state?.paperweight?.imageDataUrl),boardName:state?.settings?.boardName});
  renderDrawer();
}
function resizeBoard(){
  const viewport=$('#board-scroll');if(!viewport)return;
  paperEffects.cancelAll();
  const rect=viewport.getBoundingClientRect(),css=getComputedStyle(viewport);
  const pageCSS=getComputedStyle($('.desk-content'));
  // Use the full desk's fitting width while the dock divider moves. The actual
  // viewport gets narrower, but papers retain their scale during cross-desk drags.
  const fitWidth=undockedFitWidth(rect.width-parseFloat(css.borderLeftWidth)-parseFloat(css.borderRightWidth),parseFloat(pageCSS.paddingLeft),parseFloat(pageCSS.paddingRight));
  const fitHeight=undockedFitHeight(rect.height-parseFloat(css.borderTopWidth)-parseFloat(css.borderBottomWidth),parseFloat(pageCSS.paddingTop),parseFloat(pageCSS.paddingBottom));
  const items=state.paperweight ? [...state.items,{...state.paperweight,type:'paperweight',rotation:0}] : state.items;
  const layout=canvasLayout({width:viewport.clientWidth,height:viewport.clientHeight,fitWidth,fitHeight},items,zoom,window.innerWidth<=760);
  if(Math.abs(layout.scale-currentScale)<.001)layout.scale=currentScale;
  if(drag&&layout.scale!==currentScale)cancelDrag();
  if(storedDrag&&layout.scale!==currentScale)cancelStoredDrag();
  if(layout.scale!==currentScale)paperweightControl?.cancel();
  if(layout.scale!==currentScale)photoResizeControl?.cancel();
  currentScale=layout.scale;canvasBounds={width:layout.width,height:layout.height};
  $('#board-canvas').style.width=layout.width+'px';$('#board-canvas').style.height=layout.height+'px';$('#board-canvas').style.transform=`scale(${currentScale})`;
  $('#canvas-size').style.width=layout.width*currentScale+'px';$('#canvas-size').style.height=layout.height*currentScale+'px';
  $('.zoom-percent').textContent=Math.round(zoom*100)+'%';
}

function drawerTravel(id='quest-drawer'){return id==='tool-drawer'?Math.max(0,($('#'+id)?.offsetHeight||144)-30):Math.max(0,($('#'+id)?.offsetWidth||376)-44);}
const DRAWERS={
  'quest-drawer':{handle:'drawer-handle',body:'drawer-content',search:'archive-search'},
  'folder-drawer':{handle:'folder-drawer-handle',body:'folder-drawer-content',search:'folder-drawer-search'},
  'tool-drawer':{handle:'tool-drawer-handle',body:'tool-drawer-content',search:'search'},
};
const activeDrawerId=()=>folderDrawerOpen?'folder-drawer':drawerOpen?'quest-drawer':toolsOpen?'tool-drawer':null;
function setActiveDrawer(id,focus=false,audible=true){
  if(id==='folder-drawer')id='quest-drawer';
  if(id==='tool-drawer'){setToolsOpen(true);id=null;}
  const previous=activeDrawerId();
  if(previous!==id)paperEffects.cancelAll();
  if(previous!==id&&audible)sound.play(id?'drawerOpen':'drawerClose');
  const returnFocus=previous&&previous!==id&&$('#'+DRAWERS[previous].body)?.contains(document.activeElement);
  drawerOpen=id==='quest-drawer';folderDrawerOpen=false;
  for(const [key,parts]of Object.entries(DRAWERS)){
    if(key==='tool-drawer')continue;
    const drawer=$('#'+key);if(!drawer)continue;
    const open=key===id;drawer.classList.toggle('is-open',open);
    // A held drawer follows its pointer, even when another drawer's resize
    // callback synchronizes open/closed state. Settle it only after release.
    if(!drawer.classList.contains('is-pulling'))drawer.style.setProperty('--drawer-reveal',(open?drawerTravel(key):0)+'px');
    $('#'+parts.handle).setAttribute('aria-expanded',String(open));$('#'+parts.body).inert=!open;
  }
  storageDrawerControl?.sync();
  if(toolsOpen)refreshToolOptions();
  if(returnFocus)$('#'+DRAWERS[id||previous].handle)?.focus({preventScroll:true});
  if(focus&&id)$('#'+DRAWERS[id].search)?.focus({preventScroll:true});
}
function setDrawerOpen(open,focus=false){setActiveDrawer(open?'quest-drawer':drawerOpen?null:activeDrawerId(),focus);}
function setFolderDrawerOpen(open,focus=false){setActiveDrawer(open?'folder-drawer':folderDrawerOpen?null:activeDrawerId(),focus);}
function setToolsOpen(open,audible=true){
  if(!open)closeToolMenu();
  const content=$('#tool-drawer-content'),returnFocus=!open&&content.contains(document.activeElement);
  if(toolsOpen!==open){paperEffects.cancelAll();if(audible)sound.play(open?'drawerOpen':'drawerClose');}
  toolsOpen=open;
  $('#tool-drawer').classList.toggle('is-open',open);
  $('#tool-drawer-handle').setAttribute('aria-expanded',String(open));content.inert=!open;
  toolRailControl?.sync();
  if(returnFocus)$('#tool-drawer-handle').focus({preventScroll:true});
  if(open)refreshToolOptions();
}
function openToolMenu(){questPhotos?.cancel();const menu=$('#tool-menu-dialog');returnStamp(false);if(!menu.open)menu.showModal();}
function closeToolMenu(){const menu=$('#tool-menu-dialog');if(menu?.open)menu.close();}
function setupDrawer(){
  storageDrawerControl=bindStorageDrawer({window,now:()=>performance.now(),drawer:$('#quest-drawer'),handle:$('#drawer-handle'),isOpen:()=>drawerOpen,setOpen:setDrawerOpen,onStart:()=>{if(drag||storedDrag)return false;paperEffects.cancelAll();return true;},onReveal:width=>document.body.style.setProperty('--storage-space',width+'px'),onPullChange:pulling=>document.body.classList.toggle('storage-resizing',pulling),onMotion:(offset,{from,settle})=>{
    const plane=$('#drawer-list');if(!plane)return;
    cancelMotion(plane);plane.style.setProperty('--tray-drift',(reducedMotion()?0:offset)+'px');
    if(settle&&from&&!reducedMotion())animateTransient(plane,[{translate:from+'px 0'},{translate:from*-.2+'px 0',offset:.72},{translate:'0px 0'}],{duration:240,easing:'cubic-bezier(.2,.7,.3,1)'});
  }});
  toolRailControl=bindToolRail({window,now:()=>performance.now(),rail:$('#tool-drawer'),handle:$('#tool-drawer-handle'),isOpen:()=>toolsOpen,setOpen:setToolsOpen,onStart:()=>{if(drag||storedDrag)return false;paperEffects.cancelAll();return true;},onReveal:height=>document.body.style.setProperty('--tool-space',height+'px'),onPullChange:pulling=>document.body.classList.toggle('tools-resizing',pulling)});
  $('#archive-search').addEventListener('input',e=>{archiveSearch=e.target.value;renderDrawer();});
  $('#folder-drawer-search').addEventListener('input',e=>{folderDrawerSearch=e.target.value;renderFolderDrawer();});
}

function refreshToolOptions(){
  if(!$('#tool-stamp-style'))return;
  $('#tool-stamp-style').value=state.settings.stampStyle;
  $('#tool-custom-stamp').innerHTML=`<option value="">${state.stamps.length?'เลือกตราที่อัปโหลด…':'เพิ่มรูปตราได้ที่คลังตรา'}</option>`+state.stamps.map(s=>`<option value="${esc(s.id)}">${esc(s.name)} · ${STATUS[s.status].label}</option>`).join('');
  $('#tool-custom-stamp').disabled=!state.stamps.length;
  refreshStampToolButtons();
}
function refreshStampToolButtons(){
  document.querySelectorAll('[data-pick-stamp]').forEach(b=>{const selected=heldStamp?.status===b.dataset.pickStamp&&!heldStamp.stampId;b.classList.toggle('is-selected',selected);b.setAttribute('aria-pressed',String(selected));});
  $('#return-stamp').hidden=!heldStamp;
}
function pickStamp(status,event,custom=null){
  questPhotos?.cancel();
  if(drag)cancelDrag();
  try{heldStamp=chooseStampTool(status,state.settings.stampStyle,custom);}catch(err){showToast(err.message);return;}
  if(Number.isFinite(event?.clientX))stampPointer={x:event.clientX,y:event.clientY};
  const symbol=status==='done'?'check':status==='failed'?'cross':'pause';
  const cursor=$('#stamp-cursor');cursor.style.setProperty('--tool-ink',STATUS[status].color);
  cursor.innerHTML=`<span class="cursor-stamper">${custom?`<img class="cursor-stamp-image" src="${esc(custom.dataUrl)}" alt="">`:icon(symbol)}</span><span class="cursor-caption">${esc(heldStamp.name)}</span>`;
  sound.play('stampPick');document.body.classList.add('is-stamping');refreshStampToolButtons();setToolsOpen(false,false);queueStampPointer();
  if(event?.detail===0){
    const top=deskWindows.top;
    (top?.querySelector('.paper-reader-scene[data-side="front"]')||top?.querySelector('.folio-paper-stage .quest-top')||$('#board-canvas .quest-paper .drag-handle'))?.focus({preventScroll:true});
  }
  showToast(`หยิบตรา “${STATUS[status].label}” · คลิกกระดาษเพื่อปั๊ม · คลิกขวาเพื่อเก็บ`);
}
function updateStampPointer(event){
  if(event)stampPointer={x:event.clientX,y:event.clientY};
  const cursor=$('#stamp-cursor');if(!cursor)return;
  const under=document.elementFromPoint(stampPointer.x,stampPointer.y);
  const surface=heldStampSurface(under);
  const visible=!!heldStamp&&!dialog.open&&!$('#tool-menu-dialog')?.open&&(!!surface||!!under?.closest('.desk-surface'));
  const zIndex=String(deskWindows.topZ+2);
  if(cursor.style.zIndex!==zIndex)cursor.style.zIndex=zIndex;
  cursor.style.translate=`${stampPointer.x}px ${stampPointer.y}px`;
  cursor.classList.toggle('is-visible',visible);
  setStampTarget(surface?.paper ?? null);
}
function setStampTarget(paper){
  if(stampTargetPaper===paper)return;
  stampTargetPaper?.classList.remove('stamp-target');
  stampTargetPaper=paper;
  paper?.classList.add('stamp-target');
}
function queueStampPointer(event){
  if(!heldStamp)return;
  if(event)stampPointer={x:event.clientX,y:event.clientY};
  if(stampPointerFrame!==null)return;
  stampPointerFrame=requestAnimationFrame(()=>{
    stampPointerFrame=null;
    if(heldStamp)updateStampPointer();
  });
}
function hideStampPointer(){
  if(stampPointerFrame!==null)cancelAnimationFrame(stampPointerFrame);
  stampPointerFrame=null;
  $('#stamp-cursor')?.classList.remove('is-visible');
  setStampTarget(null);
}
function returnStamp(animate=true){
  if(!heldStamp)return;
  const cursor=$('#stamp-cursor');
  if(animate&&!reducedMotion()&&cursor?.classList.contains('is-visible')){
    const ghost=cursor.cloneNode(true),handle=$('#tool-drawer-handle').getBoundingClientRect();ghost.removeAttribute('id');document.body.append(ghost);
    const destination=`${handle.left+handle.width/2}px ${handle.top+handle.height/2}px`;
    animateTransient(ghost,[{translate:cursor.style.translate,opacity:1},{translate:destination,transform:'translate(-50%,-50%) scale(.12)',opacity:0}],MOTION_TIMING.stampReturn,{remove:true});
  }
  heldStamp=null;clearTimeout(stampPressTimer);document.body.classList.remove('is-stamping');cursor?.classList.remove('is-pressing');
  hideStampPointer();refreshStampToolButtons();
  if(animate){sound.play('stampReturn');showToast('เก็บตราคืนลิ้นชักแล้ว');}
}
function heldStampSurface(target){
  if(!heldStamp||questPhotos?.editing||photoViewer?.isOpen||dialog.open||$('#tool-menu-dialog')?.open)return null;
  return resolveStampSurface(target);
}
function prepareStampPointer(event){
  if(event.defaultPrevented||event.button!==0||event.isPrimary===false)return;
  const surface=heldStampSurface(event.target);if(!surface)return;
  event.preventDefault();event.stopPropagation();
  if(surface.kind==='folio')finishFolderOpening(surface.host);
  if(surface.kind!=='board')deskWindows.register(surface.host).raise();
}
function handleStampClick(event){
  if(performance.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();return;}
  if(event.defaultPrevented||event.button!==0)return;
  const surface=heldStampSurface(event.target);if(!surface)return;
  event.preventDefault();event.stopImmediatePropagation();stampPaper(surface.id,event,surface);
}
function handleStampKey(event){
  if(event.defaultPrevented||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||!['Enter',' '].includes(event.key))return;
  const target=event.target;
  const readerHandle=target.matches?.('.paper-reader-scene[data-desk-window-handle]');
  if(!readerHandle&&!target.matches?.('.drag-handle,.quest-top,.quest-title'))return;
  const candidate=readerHandle?target.querySelector('.reader-front > .quest-paper'):target;
  const surface=heldStampSurface(candidate);if(!surface)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(!event.repeat)stampPaper(surface.id,{detail:0},surface);
}
function stampPaper(id,event,source=null){
  if(!heldStamp)return;
  try{
    const surface=source??resolveStampSurface($(`#board-canvas .quest-paper[data-id="${id}"]`));
    if(!surface||surface.id!==id||!['board','reader','folio'].includes(surface.kind))return;
    const restoreFocus=!!document.activeElement&&surface.paper.contains(document.activeElement);
    if(surface.kind==='folio')finishFolderOpening(surface.host);
    let position;
    if(event&&event.detail!==0&&Number.isFinite(event.clientX)&&Number.isFinite(event.clientY)){
      position=stampSurfacePoint(surface,{x:event.clientX,y:event.clientY},{getComputedStyle,Matrix:DOMMatrix});
      if(surface.kind==='board')paperEffects.cancelEntry(surface.paper);
    }
    const previousStage=Number(surface.paper?.dataset?.burn||0);
    const variant=Number(surface.paper?.dataset?.burnVariant||0);
    const calcDoneXp=s=>(s?.items??[]).filter(q=>q.type==='quest'&&q.status==='done').reduce((a,q)=>a+(q.xp||0),0);
    const prevXp=typeof questItems==='function'?questItems(true).filter(q=>q.status==='done').reduce((a,q)=>a+q.xp,0):calcDoneXp(state);
    const prevLevel=Math.floor(prevXp/500)+1;
    const next=applyHeldStamp(state,id,heldStamp,position,{allowArchived:surface.kind!=='board'});if(next===state)return;
    if(filters.status!=='all'&&filters.status!==heldStamp.status)filters.status='all';
    commit(next);playStampImpact(id,true,surface);updateStampPointer(event?.detail===0?undefined:event);
    const nextXp=typeof questItems==='function'?questItems(true).filter(q=>q.status==='done').reduce((a,q)=>a+q.xp,0):calcDoneXp(next);
    const nextLevel=Math.floor(nextXp/500)+1;
    const deltaXp=nextXp-prevXp;
    if(heldStamp?.status==='done'&&deltaXp>0&&typeof adventurerCard!=='undefined'&&adventurerCard){
      let origin=null;
      if(event&&Number.isFinite(event.clientX)&&Number.isFinite(event.clientY)&&event.clientX>0&&event.clientY>0){
        origin={x:event.clientX,y:event.clientY};
      }else if(surface?.paper){
        const r=surface.paper.getBoundingClientRect();
        origin={x:r.left+r.width/2,y:r.top+r.height/2};
      }
      adventurerCard.flyMana({origin,deltaXp});
      if(nextLevel>prevLevel){
        adventurerCard.celebrateLevelUp(nextLevel);
      }
    }
    if(previousStage>=1){
      const refreshed=refreshStampSurface(surface)?.paper;
      if(refreshed)paperEffects.extinguish(refreshed,{stage:previousStage,variant});
    }
    if(restoreFocus)refreshStampSurface(surface)?.paper.querySelector('.drag-handle,.quest-top')?.focus({preventScroll:true});
    const cursor=$('#stamp-cursor');cursor.classList.remove('is-pressing');void cursor.offsetWidth;cursor.classList.add('is-pressing');clearTimeout(stampPressTimer);stampPressTimer=setTimeout(()=>cursor.classList.remove('is-pressing'),600);
  }catch(err){showToast(err.message);}
}
function renderFolderDrawer(){renderDrawer();}
function renderDrawer(){
  const plane=$('#drawer-list');if(!plane)return;
  const all=trayItems(state),found=trayItems(state,archiveSearch);
  const bookInTray=Boolean(state.dailyBook?.archived&&(!archiveSearch.trim()||[state.dailyBook.title,state.dailyBook.subtitle,...state.dailyBook.tasks.map(t=>t.title)].some(v=>v?.toLocaleLowerCase().includes(archiveSearch.trim().toLocaleLowerCase()))));
  $('#drawer-badge').textContent=all.length+(state.dailyBook?.archived?1:0);
  let width=TRAY_WIDTH,height=540;
  let bookMarkup='';
  if(bookInTray&&typeof renderDailyBookCover==='function'){
    const pos=state.dailyBook.storagePosition??{x:34,y:30};
    width=Math.max(width,pos.x+PAPER.width+40);height=Math.max(height,pos.y+PAPER.height+40);
    bookMarkup=renderDailyBookCover({...state.dailyBook,x:pos.x,y:pos.y},{icon});
  }
  plane.innerHTML=bookMarkup+found.map(item=>{
    const index=all.findIndex(i=>i.id===item.id),position=trayPosition(item,index);
    if(item.type==='notebook'){
      width=Math.max(width,position.x+NOTEBOOK_SIZE.width+40);height=Math.max(height,position.y+NOTEBOOK_SIZE.height+40);
      return renderNotebookCover(item,{icon,storage:true,position});
    }
    if(item.type==='photo'){
      const size=photoSheetSize(item.aspect,item.photoScale);
      width=Math.max(width,position.x+size.width+40);height=Math.max(height,position.y+size.height+40);
      return renderPhotoSheet(item,{storage:true,position});
    }
    width=Math.max(width,position.x+PAPER.width+40);height=Math.max(height,position.y+(item.type==='folder'?210:PAPER.height)+40);
    let html=item.type==='folder'?renderFolder(item):renderQuest(item,index);
    html=html.replace(`data-id="${item.id}"`,`data-storage-id="${item.id}"`).replace(/left:[^;]+;top:[^;]+;/,`left:${position.x}px;top:${position.y}px;`);
    if(item.type==='folder')html=html.replace('class="folder-tab drag-handle"',`data-folder-drag="${item.id}" class="folder-tab drag-handle"`);
    else html=html.replace('class="quest-top drag-handle"',`data-quest-drag="${item.id}" class="quest-top drag-handle"`);
    return html;
  }).join('');
  plane.style.width=width+'px';plane.style.height=height+'px';
  plane.parentElement.style.setProperty('--tray-width',width*TRAY_SCALE+'px');
  plane.parentElement.style.setProperty('--tray-height',height*TRAY_SCALE+'px');
  const empty=$('#tray-empty');empty.hidden=found.length>0||bookInTray;empty.firstChild.textContent=archiveSearch?'ไม่พบของที่ค้นหา':'ลากกระดาษ แฟ้ม หรือรูปมาวางที่นี่';
  bundleControl?.refresh();
}
function storeAtTray(id,event,grab){
  const item=state.items.find(i=>i.id===id);if(!item)return;
  const position=event?trayDrop({x:event.clientX,y:event.clientY},$('#drawer-list').getBoundingClientRect(),grab,TRAY_SCALE,item.rotation,item.type,item.aspect,item.photoScale):trayPosition(item,trayItems(state).length);
  commit(updateItem(setArchived(state,id,true),id,{storagePosition:position,z:Math.max(...state.items.map(i=>i.z),0)+1}));
}
function settleTrayItem(id,ghost,grab={x:150,y:28}){
  const target=$(`[data-storage-id="${id}"]`),item=state.items.find(i=>i.id===id);
  const animated=target&&ghost&&!reducedMotion()&&typeof ghost.animate==='function';
  const cue=queueContactSound(id,['folder','notebook'].includes(item?.type)?'folderDrop':'paperDrop',animated?144:0);
  if(!animated){ghost?.remove();return;}
  const size=item.type==='notebook'?NOTEBOOK_SIZE:item.type==='photo'?photoSheetSize(item.aspect,item.photoScale):{width:PAPER.width,height:item.type==='folder'?210:PAPER.height};
  const rect=target.getBoundingClientRect(),cx=size.width/2,cy=size.height/2,angle=item.rotation*Math.PI/180;
  const dx=grab.x-cx,dy=grab.y-cy;
  const anchor={x:rect.left+rect.width/2+(dx*Math.cos(angle)-dy*Math.sin(angle))*TRAY_SCALE,y:rect.top+rect.height/2+(dx*Math.sin(angle)+dy*Math.cos(angle))*TRAY_SCALE};
  const from={left:ghost.style.left,top:ghost.style.top,transform:ghost.style.transform,transformOrigin:ghost.style.transformOrigin};
  target.classList.add('storage-source');
  const retire=()=>{cancelMotion(ghost);ghost.remove();target.classList.remove('storage-source');};
  cue.signal.addEventListener('abort',retire,{once:true});
  const contact=ghostPose(anchor,grab,TRAY_SCALE,item.rotation,0,1);
  animateTransient(ghost,[{...from,easing:'cubic-bezier(.2,.8,.3,1)'},{...contact,offset:.8},contact],{duration:180,easing:'linear'},{remove:true,onFinish:()=>{
    cue.signal.removeEventListener('abort',retire);
    target.classList.remove('storage-source');
  }});
}
function archiveQuest(id,ghost,event,grab={x:150,y:28}){
  closeFolderWindow(false,id);
  let next;try{next=setArchived(state,id,true);}catch(err){showToast(err.message);ghost?.remove();return;}
  setActiveDrawer('quest-drawer',false,false);archiveSearch='';$('#archive-search').value='';
  if(event){const item=state.items.find(i=>i.id===id);const position=trayDrop({x:event.clientX,y:event.clientY},$('#drawer-list').getBoundingClientRect(),grab,TRAY_SCALE,item.rotation,item.type,item.aspect,item.photoScale);next=updateItem(next,id,{storagePosition:position,z:Math.max(...state.items.map(i=>i.z),0)+1});}
  commit(next);
  settleTrayItem(id,ghost,grab);showToast('เก็บเข้าลิ้นชักแล้ว',{label:'นำกลับ',run:()=>restoreQuest(id)});
}
function restoreQuest(id){
  filters={status:'all',category:'all',search:''};$('#search').value='';
  const next=updateItem(setArchived(state,id,false),id,{z:Math.max(...state.items.map(i=>i.z),0)+1});
  sound.play(next.items.find(i=>i.id===id)?.type==='folder'?'folderDrop':'paperDrop');commit(next,'นำกลับขึ้นโต๊ะแล้ว');
  const el=$(`[data-id="${id}"]`);el?.classList.add('restored-paper');el?.scrollIntoView({block:'nearest',inline:'nearest',behavior:reducedMotion()?'instant':'smooth'});
}
function startDrag(e){
  if(heldStamp||questPhotos?.editing||photoViewer?.isOpen||e.button!==0||!e.target.closest('.drag-handle')||e.target.closest('[data-daily-book]')||drag||storedDrag)return;
  e.preventDefault();window.getSelection()?.removeAllRanges();
  const el=e.target.closest('.board-item');const item=state.items.find(i=>i.id===el.dataset.id);if(!item)return;
  if(state.paperweight?.questId===item.id){showToast('ยกที่ทับกระดาษออกก่อนย้ายใบเควส');return;}
  stampCues.get(item.id)?.abort();stampCues.delete(item.id);
  const handle=e.target.closest('.drag-handle');handle.focus({preventScroll:true});
  let arrivingGrab=null;
  if(el.classList.contains('paper-arriving')){
    const transform=getComputedStyle(el).transform;
    const matrix=transform==='none'?{a:1,b:0,c:0,d:1}:new DOMMatrix(transform);
    arrivingGrab=stampPoint({x:e.clientX,y:e.clientY},el.getBoundingClientRect(),matrix,currentScale,{width:el.offsetWidth,height:el.offsetHeight});
  }
  paperEffects.cancelEntry(el);
  el.classList.remove('restored-paper','stamp-hit');cancelMotion(el);
  const canvasOrigin=$('#board-canvas').getBoundingClientRect();
  let position={x:item.x,y:item.y};
  if(arrivingGrab){
    const angle=item.rotation*Math.PI/180,cx=el.offsetWidth/2,cy=el.offsetHeight/2;
    const gx=arrivingGrab.x-cx,gy=arrivingGrab.y-cy;
    position={x:(e.clientX-canvasOrigin.left)/currentScale-cx-gx*Math.cos(angle)+gy*Math.sin(angle),y:(e.clientY-canvasOrigin.top)/currentScale-cy-gx*Math.sin(angle)-gy*Math.cos(angle)};
    el.style.left=position.x+'px';el.style.top=position.y+'px';
  }
  const bounds=rotatedOrigin(el.getBoundingClientRect(),el.offsetWidth,el.offsetHeight,item.rotation,currentScale);
  drag={id:item.id,type:item.type,aspect:item.aspect,photoScale:item.photoScale,rotation:item.rotation,el,handle,startX:e.clientX,startY:e.clientY,...position,originalX:item.x,originalY:item.y,arrivingPickup:!!arrivingGrab,next:arrivingGrab?rotatedClampPosition(position.x,position.y,item.type,item.rotation,canvasBounds,item.aspect,item.photoScale):null,moved:false,pointerId:e.pointerId,drawerBefore:activeDrawerId(),ghost:null,grab:arrivingGrab??grabPoint({x:e.clientX,y:e.clientY},bounds,currentScale,item.rotation),bounds,overTray:false,canvasOrigin};
  handle.setPointerCapture(e.pointerId);el.classList.add('dragging');el.style.zIndex=Math.max(...state.items.map(i=>i.z),0)+1;
  handle.addEventListener('pointermove',onDrag);handle.addEventListener('pointerup',endDrag);handle.addEventListener('pointercancel',cancelDrag);
}
function onDrag(e){
  if(!drag)return;
  const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
  if(!drag.moved&&Math.abs(dx)+Math.abs(dy)>4){
    drag.moved=true;
    if(typeof atmosphere!=='undefined'&&atmosphere)atmosphere.setSuspended?.(true);
    sound.play(['folder','notebook'].includes(drag.type)?'folderPick':'paperPick');
    if(drag.type==='quest'&&typeof paperEffects!=='undefined')paperEffects?.shedAsh?.(drag.el,{stage:Number(drag.el.dataset?.burn||0),mode:'pickup'});
    if(['quest','folder','photo','notebook'].includes(drag.type)){
      const ghost=drag.el.cloneNode(true);ghost.removeAttribute('data-id');ghost.removeAttribute('data-folder-target');ghost.removeAttribute('aria-label');ghost.setAttribute('aria-hidden','true');ghost.inert=true;ghost.classList.remove('dragging');ghost.classList.add(drag.type==='notebook'?'book-drag-ghost':drag.type==='folder'?'folder-drag-ghost':'quest-drag-ghost','paper-in-hand');ghost.style.setProperty('--drag-scale',currentScale);ghost.style.zIndex='10000';ghost.querySelectorAll('[tabindex],button').forEach(el=>el.setAttribute('tabindex','-1'));document.body.append(ghost);drag.ghost=ghost;drag.el.classList.add('drag-source');
      // Storage opens when its side handle is approached, leaving the desk free.
    }
  }
  if(!drag.moved)return;
  const origin=$('#board-canvas').getBoundingClientRect();
  const raw=dragPosition({x:drag.x,y:drag.y,pointerX:drag.startX,pointerY:drag.startY},{x:e.clientX,y:e.clientY},currentScale,{x:origin.left-drag.canvasOrigin.left,y:origin.top-drag.canvasOrigin.top});
  const p=rotatedClampPosition(raw.x,raw.y,drag.type,drag.rotation,canvasBounds,drag.aspect,drag.photoScale);drag.next=p;
  if(drag.ghost)updateHeldGhost(drag,e);
  else {drag.el.style.left=p.x+'px';drag.el.style.top=p.y+'px';}
  followStorageHandle(e,drag.type);
  const receiver=drag.type==='quest'?folderTargetAt(e,drag.id):null;
  drag.folderTarget=receiver?.id;drag.folderSurface=receiver?.surface;
  highlightFolder(drag.folderTarget);
  drag.overTray=!drag.folderTarget&&overStorageTray(e,drag.type);
  highlightStorageTray(drag.overTray);
}
function cleanupDrag(keepGhost=false){
  if(!drag)return;const {handle,pointerId,el,ghost}=drag;
  if(typeof atmosphere!=='undefined'&&atmosphere)atmosphere.setSuspended?.(false);
  handle.removeEventListener('pointermove',onDrag);handle.removeEventListener('pointerup',endDrag);handle.removeEventListener('pointercancel',cancelDrag);
  if(handle.hasPointerCapture(pointerId))handle.releasePointerCapture(pointerId);stopHeldMotion(drag);el.classList.remove('dragging','drag-source');if(!keepGhost)ghost?.remove();clearStorageFeedback();highlightFolder(null);drag=null;
}
function endDrag(e){
  if(!drag)return;
  if(e&&drag.moved)onDrag(e);
  const {id,moved,arrivingPickup,next,overTray,ghost,drawerBefore,folderTarget,folderSurface,tilt,grab}=drag;cleanupDrag(!!overTray||!!folderTarget);
  if(moved||arrivingPickup)suppressClickUntil=performance.now()+400;
  if(moved&&folderTarget){setActiveDrawer(folderSurface==='drawer-folder-row'?'quest-drawer':drawerBefore,false,false);storeInFolder(id,folderTarget,ghost,folderSurface);return;}
  if(moved&&overTray){archiveQuest(id,ghost,e,grab);return;}
  if((moved||arrivingPickup)&&next){state=updateItem(state,id,{...next,z:Math.max(...state.items.map(i=>i.z),0)+1});const el=$(`[data-id="${id}"]`);el.style.left=next.x+'px';el.style.top=next.y+'px';persist();settlePaper(id,tilt);}
  setActiveDrawer(drawerBefore,false,false);
}
function cancelDrag(){if(!drag)return;const{el,x,y,originalX=x,originalY=y,id,drawerBefore}=drag;el.style.left=originalX+'px';el.style.top=originalY+'px';el.style.zIndex=state.items.find(i=>i.id===id).z;cleanupDrag();setActiveDrawer(drawerBefore,false,false);}
function moveWithKeyboard(e){
  if(e.target.matches('[data-daily-book-drag]')){
    if(['Enter',' '].includes(e.key)){e.preventDefault();openDailyBook();return;}
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
      e.preventDefault();const book=ensureDailyBook(state).dailyBook,step=e.shiftKey?25:5;
      const x=Math.max(0,Math.min(canvasBounds.width-DAILY_BOOK_SIZE.width,book.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0)));
      const y=Math.max(0,Math.min(canvasBounds.height-DAILY_BOOK_SIZE.height,book.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0)));
      commit(updateDailyBookMeta(state,{x,y,z:Math.max(...state.items.map(i=>i.z),book.z)+1}));
      $('#board-canvas [data-daily-book-drag]')?.focus({preventScroll:true});
    }
    return;
  }
  const stored=e.target.closest('[data-storage-id]');
  if(stored&&e.target.matches('.drag-handle')){
    const id=stored.dataset.storageId,item=state.items.find(i=>i.id===id);
    if(['Enter',' '].includes(e.key)){e.preventDefault();if(item.type==='folder')placeFolder(id,true);else if(item.type==='photo')openPhotoSheet(id);else if(item.type==='notebook')openNotebook(id);else openQuest(id);return;}
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
      e.preventDefault();const p=trayPosition(item,trayItems(state).findIndex(i=>i.id===id)),step=e.shiftKey?25:5;
      const size=item.type==='notebook'?NOTEBOOK_SIZE:item.type==='photo'?photoSheetSize(item.aspect,item.photoScale):{width:PAPER.width,height:item.type==='folder'?210:PAPER.height};
      const position={x:Math.max(0,Math.min(BOARD_LIMIT.width-size.width,p.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0))),y:Math.max(0,Math.min(BOARD_LIMIT.height-size.height,p.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0)))};
      commit(updateItem(state,id,{storagePosition:position}));$(`[data-storage-id="${id}"] .drag-handle`)?.focus({preventScroll:true});return;
    }
    return;
  }
  if(heldStamp){if(['Enter',' '].includes(e.key)&&e.target.matches('.drag-handle')&&!e.target.matches('[data-read-photo],[data-open-notebook]')){e.preventDefault();stampPaper(e.target.closest('[data-id]').dataset.id);}return;}
  if(!e.target.matches('.drag-handle')||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
  e.preventDefault();const id=e.target.closest('[data-id]').dataset.id;const item=state.items.find(i=>i.id===id);const step=e.shiftKey?25:5;
  if(state.paperweight?.questId===id){showToast('ยกที่ทับกระดาษออกก่อนย้ายใบเควส');return;}
  const x=item.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),y=item.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0);
  state=updateItem(state,id,{...rotatedClampPosition(x,y,item.type,item.rotation,canvasBounds,item.aspect,item.photoScale),z:Math.max(...state.items.map(i=>i.z),0)+1});
  const el=e.target.closest('[data-id]');el.style.left=state.items.find(i=>i.id===id).x+'px';el.style.top=state.items.find(i=>i.id===id).y+'px';el.style.zIndex=state.items.find(i=>i.id===id).z;persist();
}

function openDialog(title,subtitle,body,cls=''){
  prerequisitePicker?.destroy();prerequisitePicker=null;
  questPhotos?.cancel();
  paperReader.flush();closeToolMenu();returnStamp(false);if(drag)cancelDrag();if(storedDrag)cancelStoredDrag();
  if(!dialog.open)modalTrigger=document.activeElement;
  dialog.className=cls;dialog.innerHTML=`<header class="dialog-header"><div><div class="dialog-eyebrow">THE ADVENTURER'S DESK</div><h2 id="dialog-title">${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div><button class="icon-button" data-close aria-label="ปิดหน้าต่าง">${icon('cross')}</button></header>${body}`;
  if(!dialog.open)dialog.showModal();
  dialog.querySelector('[autofocus]')?.focus();
}
function closeDialog(){prerequisitePicker?.destroy();prerequisitePicker=null;dialog.close();refreshToolOptions();modalTrigger?.focus?.({preventScroll:true});}
dialog.addEventListener('click',e=>{if(e.target.closest('[data-close]'))closeDialog();if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
dialog.addEventListener('cancel',()=>{prerequisitePicker?.destroy();prerequisitePicker=null;setTimeout(()=>modalTrigger?.focus?.(),0);});
function formError(message){const target=$('#form-error',dialog);if(target){target.textContent=message;target.hidden=false;}else showToast(message);}
function createVisibleQuest(values){
  const viewport=$('#board-scroll');
  const pos=rotatedClampPosition(viewport.scrollLeft/currentScale+Math.max(24,(viewport.clientWidth/currentScale-PAPER.width)*.42),viewport.scrollTop/currentScale+Math.max(24,(viewport.clientHeight/currentScale-PAPER.height)*.32),'quest',0,canvasBounds);
  return createQuest({...values,...pos,rotation:0},state);
}
function animateNewQuest(id){
  const paper=$(`[data-id="${id}"]`),item=state.items.find(i=>i.id===id);if(!paper||!item)return;
  paper.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
  const source=$('#tool-drawer-handle').getBoundingClientRect();
  paperEffects.enter(paper,{source:{x:source.left+source.width/2,y:source.top+source.height/2},scale:currentScale,rotation:item.rotation});
}
function openQuest(id){
  const q=state.items.find(i=>i.id===id);const editing=!!q;
  const pinned=editing&&state.paperweight?.questId===id;
  const item=q||{title:'',description:'',category:CATEGORIES[0],priority:'normal',due:'',xp:100,rotation:0};
  let questImage=item.imageDataUrl||null,imageBusy=false,imageVersion=0;
  openDialog(editing?'บันทึกการผจญภัย':'ลงประกาศเควสใหม่',editing?'รายละเอียดเล็ก ๆ ของภารกิจที่ยิ่งใหญ่':'ทุกการผจญภัย เริ่มต้นจากเป้าหมายหนึ่งอย่าง',`
    <form id="quest-form" class="dialog-body"><label class="field">ชื่อเควส <span>*</span><input name="title" required maxlength="100" placeholder="วันนี้อยากพิชิตอะไร?" value="${esc(item.title)}" autofocus></label>
    <label class="field">รายละเอียด<textarea name="description" maxlength="1000" rows="3" placeholder="เขียนรายละเอียด หรือก้าวเล็ก ๆ ที่ต้องทำ…">${esc(item.description)}</textarea></label>
    <div class="quest-image-field"><p class="field-caption">รูปบนกระดาษเควส</p><img class="quest-image-preview" id="quest-image-preview" ${questImage?`src="${esc(questImage)}"`:'hidden'} alt="ตัวอย่างรูปประกอบเควส"><div class="quest-image-controls"><label class="button ghost quest-image-upload">${icon('photo')}<span id="quest-image-label">${questImage?'เปลี่ยนรูป':'เพิ่มรูปภาพ'}</span><input type="file" id="quest-image-file" accept="image/png,image/jpeg,image/webp"></label><button class="button danger-ghost remove-quest-image" type="button" id="remove-quest-image" ${questImage?'':'hidden'}>${icon('cross')}นำรูปออก</button></div><small class="quest-image-note">PNG / JPG / WebP · สูงสุด 5 MB · รูปจะถูกย่อก่อนเก็บในเบราว์เซอร์</small></div>
    <div class="form-row"><label class="field">หมวดหมู่<select name="category">${CATEGORIES.map(c=>`<option ${c===item.category?'selected':''}>${c}</option>`).join('')}</select></label><label class="field">ระดับความสำคัญ<select name="priority"><option value="normal" ${item.priority==='normal'?'selected':''}>B · เควสทั่วไป</option><option value="high" ${item.priority==='high'?'selected':''}>A · เควสสำคัญ</option><option value="low" ${item.priority==='low'?'selected':''}>C · เควสสบาย ๆ</option></select></label></div>
    <div class="form-row"><label class="field">กำหนดเสร็จ<input type="date" name="due" value="${esc(item.due)}"></label><label class="field">รางวัลประสบการณ์ (XP)<input type="number" name="xp" min="0" max="9999" step="1" value="${item.xp}"></label></div>
    <div id="quest-prerequisite-picker"></div>
    ${editing?`<details class="position-details"><summary>ตำแหน่งและมุมกระดาษ</summary>${pinned?'<p class="field-caption">ยกที่ทับกระดาษออกก่อนเปลี่ยนตำแหน่ง</p>':`<div class="form-row three"><label class="field">แนวนอน (X)<input type="number" name="x" min="0" max="${canvasBounds.width-PAPER.width}" step="any" value="${item.x}"></label><label class="field">แนวตั้ง (Y)<input type="number" name="y" min="0" max="${canvasBounds.height-PAPER.height}" step="any" value="${item.y}"></label><label class="field">มุมเอียง (องศา)<input type="number" name="rotation" min="-180" max="180" step="any" value="${item.rotation}"></label></div>`}</details>`:''}
    ${editing?`<div class="quest-storage-action"><span>${item.folderId?'เก็บอยู่ในแฟ้ม “'+esc(state.items.find(i=>i.id===item.folderId)?.name)+'”':item.archived?'เควสนี้เก็บอยู่ในลิ้นชัก':'อยากพักกระดาษใบนี้ไว้ก่อน?'}</span><button class="button ghost small" type="button" id="quest-archive">${icon(item.archived?'restore':'archive')}${item.archived?'นำกลับขึ้นโต๊ะ':'เก็บเข้าลิ้นชัก'}</button><button class="button ghost small" type="button" id="quest-status">${icon('stamp')}ประทับตรา</button></div>`:''}
    <p class="form-error" id="form-error" hidden></p><footer class="dialog-footer">${editing?`<button type="button" class="button danger-ghost" id="delete-quest">${icon('trash')}ลบเควส</button>`:`<span class="form-note">${icon('feather')}เขียนเรื่องราวบทใหม่ของคุณ</span>`}<div><button type="button" class="button ghost" data-close>ยกเลิก</button><button class="button primary" type="submit" id="save-quest">${icon(editing?'check':'plus')}${editing?'บันทึกเควส':'ติดเควสบนโต๊ะ'}</button></div></footer></form>`);
  const form=$('#quest-form'),preview=$('#quest-image-preview'),removeImage=$('#remove-quest-image'),saveButton=$('#save-quest'),fileInput=$('#quest-image-file'),imageLabel=$('#quest-image-label');
  const picker=createPrerequisitePicker({container:$('#quest-prerequisite-picker'),items:state.items,questId:id,selectedIds:item.prerequisiteIds??[]});prerequisitePicker=picker;
  const refreshImage=()=>{preview.hidden=!questImage;if(questImage)preview.src=questImage;else preview.removeAttribute('src');removeImage.hidden=!questImage;imageLabel.textContent=questImage?'เปลี่ยนรูป':'เพิ่มรูปภาพ';};
  fileInput.onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    const version=++imageVersion;imageBusy=true;saveButton.disabled=true;imageLabel.textContent='กำลังเตรียมรูป…';$('#form-error',form).hidden=true;
    try{const data=await prepareImage(file,{maxSizeMB:5,maxDimension:960,format:'image/webp'});if(version!==imageVersion||!form.isConnected)return;questImage=data;refreshImage();}
    catch(err){if(form.isConnected&&version===imageVersion){formError(err.message);refreshImage();fileInput.value='';}}
    finally{if(form.isConnected&&version===imageVersion){imageBusy=false;saveButton.disabled=false;}}
  };
  removeImage.onclick=()=>{imageVersion++;imageBusy=false;questImage=null;fileInput.value='';saveButton.disabled=false;refreshImage();};
  const setPositionFields=values=>{
    if(pinned)return;
    values.rotation=Number(values.rotation);
    Object.assign(values,rotatedClampPosition(Number(values.x),Number(values.y),'quest',values.rotation,canvasBounds));
  };
  form.onsubmit=e=>{
    e.preventDefault();if(imageBusy){formError('รอเตรียมรูปภาพสักครู่');return;}const fd=Object.fromEntries(new FormData(e.target));fd.xp=Number(fd.xp);fd.imageDataUrl=questImage;fd.prerequisiteIds=picker.getSelectedIds();
    if(questImage!==(item.imageDataUrl??null))fd.photoLayout=null;
    if(!fd.title.trim()){formError('กรุณาเขียนชื่อเควสก่อน');return;}
    try{
      let createdId=null,next;
      if(editing){setPositionFields(fd);next=updateItem(state,id,fd);}
      else{const created=createVisibleQuest(fd);createdId=created.id;next={...state,items:[...state.items,created]};filters={status:'all',category:'all',search:''};$('#search').value='';}
      closeDialog();commit(next,editing?'บันทึกเรื่องราวเรียบร้อย':'เควสใหม่ติดบนโต๊ะแล้ว ขอให้โชคดี!');
      if(createdId)animateNewQuest(createdId);
    }catch(err){formError(err.message);}
  };
  if(editing){
    $('#delete-quest').onclick=()=>confirmDelete(id,'เควสนี้');
    const saveBeforeAction=()=>{
      if(imageBusy||!form.reportValidity())return false;
      try{const values=Object.fromEntries(new FormData(form));values.xp=Number(values.xp);setPositionFields(values);values.imageDataUrl=questImage;values.prerequisiteIds=picker.getSelectedIds();return updateItem(state,id,values);}catch(err){formError(err.message);return null;}
    };
    $('#quest-archive').onclick=()=>{const next=saveBeforeAction();if(!next)return;commit(next);closeDialog();if(item.archived)restoreQuest(id);else archiveQuest(id);};
    $('#quest-status').onclick=()=>{const next=saveBeforeAction();if(!next)return;commit(next);openStamp(id);};
  }
}
function restoreDeletedSnapshot(current,before,id){
  const removed=before.items.find(item=>item.id===id);if(!removed)return current;
  const members=new Set(before.items.filter(item=>item.type==='quest'&&item.folderId===id).map(item=>item.id));
  const edges=new Map(before.items.filter(item=>item.type==='quest'&&item.prerequisiteIds?.includes(id)).map(item=>[item.id,item.prerequisiteIds]));
  const items=current.items.filter(item=>item.id!==id).map(item=>{
    let restored=item;
    if(removed.type==='folder'&&members.has(item.id)&&item.archived&&!item.folderId)restored={...restored,folderId:id};
    if(edges.has(item.id))restored={...restored,prerequisiteIds:[...edges.get(item.id)]};
    return restored;
  });
  return validateState({...current,items:[...items,removed]});
}
function confirmDelete(id,noun){
  const before=state,removed=state.items.find(i=>i.id===id);
  const affected=state.items.filter(item=>item.type==='quest'&&item.prerequisiteIds?.includes(id));
  openDialog(`เก็บ${noun}ออกจากโต๊ะ?`,'คุณสามารถย้อนกลับได้หลังลบ',`<div class="dialog-body"><p class="confirm-copy">${esc(removed?.title||removed?.text||removed?.name||'')}</p><footer class="dialog-footer end"><button class="button ghost" data-close>ยกเลิก</button><button class="button danger" id="confirm-delete">${icon('trash')}ลบออกจากโต๊ะ</button></footer></div>`,'small-dialog');
  if(affected.length)$('.confirm-copy',dialog).insertAdjacentHTML('afterend',`<p class="quest-prerequisite-warning">มี ${affected.length} เควสอ้างอิงใบนี้ การลบจะนำใบนี้ออกจากเงื่อนไขของเควสเหล่านั้นด้วย</p>`);
  $('#confirm-delete').onclick=()=>{closeDialog();commit(deleteItem(state,id));showToast('นำออกจากโต๊ะแล้ว',{label:'เลิกทำ',run:()=>{try{commit(restoreDeletedSnapshot(state,before,id),'คืนรายการและเงื่อนไขแล้ว');}catch(error){showToast('คืนรายการไม่ได้: '+error.message);}}});};
}
function openLabel(id){
  const item=state.items.find(i=>i.id===id);
  openDialog(item?'แก้ไขป้ายบนโต๊ะ':'เพิ่มป้ายบนโต๊ะ','แบ่งพื้นที่ เขียนคำเตือน หรือฝากกำลังใจให้ตัวเอง',`<form class="dialog-body" id="label-form"><label class="field">ข้อความบนป้าย<input name="text" required maxlength="40" placeholder="เช่น ภารกิจประจำวัน" value="${esc(item?.text||'')}" autofocus></label><label class="field">สีป้าย<select name="color"><option value="gold" ${item?.color==='gold'?'selected':''}>ทองเก่า</option><option value="sage" ${item?.color==='sage'?'selected':''}>เขียวมอส</option><option value="red" ${item?.color==='red'?'selected':''}>แดงอิฐ</option></select></label><p id="form-error" class="form-error" hidden></p><footer class="dialog-footer">${item?`<button type="button" class="button danger-ghost" id="delete-label">${icon('trash')}ลบป้าย</button>`:'<span></span>'}<div><button type="button" class="button ghost" data-close>ยกเลิก</button><button class="button primary" type="submit">${icon('tag')}${item?'บันทึกป้าย':'ติดป้าย'}</button></div></footer></form>`,'small-dialog');
  $('#label-form').onsubmit=e=>{e.preventDefault();const fd=Object.fromEntries(new FormData(e.target));try{const next=item?updateItem(state,id,fd):{...state,items:[...state.items,createLabel(fd,state)]};closeDialog();commit(next,'ป้ายพร้อมแล้ว ลากไปวางได้ตามใจ');}catch(err){formError(err.message);}};
  if(item)$('#delete-label').onclick=()=>confirmDelete(id,'ป้ายนี้');
}
function openStamp(id){
  const quest=state.items.find(i=>i.id===id);let selectedStatus=quest.status==='active'?'done':quest.status;let selectedStyle=quest.stampStyle||state.settings.stampStyle;let selectedStamp=quest.stampId;
  function draw(){
    const waiting=dependencyInfo(state.items,quest);
    openDialog('ลงตราบันทึกการผจญภัย',esc(quest.title),`<div class="dialog-body"><div class="status-options">${['done','failed','paused'].map(s=>`<button class="status-option ${selectedStatus===s?'selected':''}" data-status-choice="${s}" style="--status-color:${STATUS[s].color}">${icon(s==='done'?'circlecheck':s==='failed'?'cross':'pause')}<span>${STATUS[s].label}</span></button>`).join('')}</div><p class="field-caption">เลือกรูปแบบตราประทับ</p><div class="stamp-options">${['seal','rectangle','banner'].map((s,i)=>`<button class="stamp-choice ${selectedStyle===s&&!selectedStamp?'selected':''}" data-style-choice="${s}">${stampMarkup(selectedStatus,s)}<span class="style-name">${['ตรากิลด์','ตราหมึก','ริบบิ้น'][i]}</span></button>`).join('')}</div>${state.stamps.filter(s=>s.status===selectedStatus).length?`<p class="field-caption">ตราของคุณ</p><div class="custom-choices">${state.stamps.filter(s=>s.status===selectedStatus).map(s=>`<button class="custom-choice ${selectedStamp===s.id?'selected':''}" data-custom-choice="${esc(s.id)}"><img src="${esc(s.dataUrl)}" alt=""><span>${esc(s.name)}</span></button>`).join('')}</div>`:''}<p class="stamp-tip">${icon('stamp')}อยากใช้ตราของตัวเอง? เพิ่มได้ที่คลังตราประทับ</p><footer class="dialog-footer">${quest.status!=='active'?`<button class="button ghost" id="remove-stamp">${icon('restore')}นำตราออก</button>`:'<span></span>'}<div><button class="button ghost" data-close>ยกเลิก</button><button class="button primary" id="apply-stamp">${icon('stamp')}ประทับตรา</button></div></footer></div>`);
    dialog.querySelectorAll('[data-status-choice]').forEach(b=>b.onclick=()=>{selectedStatus=b.dataset.statusChoice;selectedStamp=null;draw();});
    dialog.querySelectorAll('[data-style-choice]').forEach(b=>b.onclick=()=>{selectedStyle=b.dataset.styleChoice;selectedStamp=null;draw();});
    dialog.querySelectorAll('[data-custom-choice]').forEach(b=>b.onclick=()=>{selectedStamp=b.dataset.customChoice;draw();});
    $('#apply-stamp').disabled=selectedStatus==='done'&&waiting.locked;
    if(waiting.locked)$('.dialog-body',dialog).insertAdjacentHTML('afterbegin',`<p class="quest-prerequisite-warning" role="status">ต้องสำเร็จก่อน: ${waiting.pending.map(item=>esc(item.title)).join(' · ')}</p>`);
    $('#apply-stamp').onclick=()=>{
      try{
        const next=setItemStatus(state,id,selectedStatus,selectedStamp,selectedStyle);
        closeDialog();if(!quest.archived&&filters.status!=='all'&&filters.status!==selectedStatus)filters.status='all';
        commit(next,selectedStatus==='done'?'พิชิตเควสแล้ว! อีกหนึ่งก้าวของการผจญภัย':'บันทึกสถานะเควสแล้ว');playStampImpact(id);
        if(quest.archived&&quest.folderId){if(state.items.find(i=>i.id===quest.folderId)?.archived)setFolderDrawerOpen(true);}else if(quest.archived)setDrawerOpen(true);
      }catch(error){formError(error.message);}
    };
    if($('#remove-stamp'))$('#remove-stamp').onclick=()=>{closeDialog();commit(setItemStatus(state,id,'active'),'นำตราออกแล้ว พร้อมออกเดินทางอีกครั้ง');};
  }draw();
}

function queueContactSound(id,name,delay=0){
  stampCues.get(id)?.abort();
  const cue=new AbortController();stampCues.set(id,cue);
  sound.play(name,{delay:reducedMotion()?0:delay,signal:cue.signal});
  setTimeout(()=>{if(stampCues.get(id)===cue)stampCues.delete(id);},delay+1000);
  return cue;
}
function playStampImpact(id,usingHeldTool=false,source=null){
  const paper=source?refreshStampSurface(source)?.paper:$(`[data-id="${id}"]`),stamp=paper?.querySelector('.stamp');
  stampCues.get(id)?.abort();
  if(!paper||!stamp){sound.play('stamp');return;}
  const cue=new AbortController();stampCues.set(id,cue);
  sound.play('stamp',{delay:reducedMotion()?0:250,signal:cue.signal});
  setTimeout(()=>{if(stampCues.get(id)===cue)stampCues.delete(id);},900);
  stamp.classList.add('just-stamped');if(reducedMotion())return;
  if(!usingHeldTool)paper.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
  const rect=stamp.getBoundingClientRect(),effect=document.createElement('div');effect.className='stamp-impact';
  effect.style.cssText=`left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;--stamp-color:${STATUS[state.items.find(i=>i.id===id).status].color}`;
  effect.style.zIndex=String(Math.max(190,Number(source?.host?.style?.zIndex)||0)+1);
  effect.innerHTML=`${usingHeldTool?'':`<span class="stamp-tool">${icon('shield')}</span>`}<span class="ink-burst"></span>${Array.from({length:6},(_,i)=>`<i class="ink-speck" style="--i:${i}"></i>`).join('')}`;document.body.append(effect);
  // The board's impact keyframe replaces transform; expanded paper must keep
  // its reader/folio scale. Ink, burst and the held tool animate in every view.
  if(!source||source.kind==='board')paper.classList.add('stamp-hit');
  setTimeout(()=>{effect.remove();paper.classList.remove('stamp-hit');},850);
}

async function prepareImage(file,{maxSizeMB=2,maxDimension=512,format='image/png',withSize=false}={}){
  if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('ใช้รูป PNG, JPG หรือ WebP เท่านั้น');
  if(file.size>maxSizeMB*1024*1024)throw new Error(`รูปต้องมีขนาดไม่เกิน ${maxSizeMB} MB`);
  const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('อ่านรูปนี้ไม่ได้ ลองใช้ไฟล์รูปอื่น');});
  try{if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>40000000)throw new Error('รูปมีความละเอียดสูงเกินไป กรุณาย่อรูปก่อน');
    const ratio=Math.min(1,maxDimension/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);const data=canvas.toDataURL(format,.82);if(data.length>2796200)throw new Error('รูปที่ย่อแล้วยังใหญ่เกินไป กรุณาใช้รูปที่เล็กลง');return withSize?{data,aspect:canvas.width/canvas.height}:data;
  }finally{bitmap.close();}
}
async function addPhotoSheet(file,point){
  const canvas=$('#board-canvas'),viewport=$('#board-scroll');
  if(!canvas||!viewport)return;
  const origin=canvas.getBoundingClientRect();
  const dropped=point&&{x:(point.x-origin.left)/currentScale,y:(point.y-origin.top)/currentScale};
  try{
    const {data,aspect}=await prepareImage(file,{maxSizeMB:5,maxDimension:960,format:'image/webp',withSize:true});
    if(!canvas.isConnected)return;
    const {width,height}=photoSheetSize(aspect);
    const center=dropped??{x:(viewport.scrollLeft+viewport.clientWidth/2)/currentScale,y:(viewport.scrollTop+viewport.clientHeight/2)/currentScale};
    const position=rotatedClampPosition(center.x-width/2,center.y-height/2,'photo',0,canvasBounds,aspect);
    const title=file.name.replace(/\.[^.]+$/,'').trim().slice(0,120)||'รูปถ่าย';
    const photo=createPhotoSheet({title,imageDataUrl:data,aspect,...position},state);
    filters.search='';$('#search').value='';
    commit({...state,items:[...state.items,photo]},'วางรูปบนโต๊ะแล้ว');
    settlePaper(photo.id);
  }catch(error){showToast(error.message);}
}
function openPhotoSheet(id,back=false){
  returnStamp(false);closeToolMenu();photoSheetReader.open(id,{back});
}
function storePhotoSheet(id){
  const photo=state.items.find(item=>item.type==='photo'&&item.id===id);
  if(!photo)return;
  if(photo.archived){setActiveDrawer(null,false,false);restoreQuest(id);}
  else archiveQuest(id);
}
function savePhotoSheet(id,patch){
  state=updateItem(state,id,patch);
  if(patch.tone){
    const item=$(`.desk-photo-sheet[data-id="${id}"],.desk-photo-sheet[data-storage-id="${id}"]`);
    item?.querySelector('.photo-sheet-image').classList.toggle('photo-tone-gold',patch.tone==='gold');
  }
  persist();
}
function savePhotoSheetSize(id,scale){
  const photo=state.items.find(item=>item.id===id&&item.type==='photo');
  if(!photo)return;
  const position=photo.archived?photo.storagePosition??{x:34,y:30}:photo;
  const fitted=rotatedClampPosition(position.x,position.y,'photo',photo.rotation,BOARD_LIMIT,photo.aspect,scale);
  const patch=photo.archived?{storagePosition:fitted}:fitted;
  commit(updateItem(state,id,{...patch,photoScale:scale}));
  $(`[data-photo-resize="${id}"]`)?.focus({preventScroll:true});
}
function savePaperweight(next, options){
  state=next;
  paperweightControl.render(options);
  bundleControl?.refresh();
  persist();
}
function openPaperweightEditor(){
  const weight = state.paperweight ?? DEFAULT_PAPERWEIGHT;
  const emblems = [...Object.entries(PAPERWEIGHT_EMBLEMS),['custom','รูปตราของฉัน']];
  openDialog('เปลี่ยนตราที่ทับกระดาษ','',`<form class="dialog-body paperweight-editor" id="paperweight-form">
    <span class="paperweight-preview" aria-hidden="true"><span class="paperweight-metal"><span class="paperweight-face"></span></span></span>
    <label class="field">ตราบนตุ้ม<select name="emblem">${emblems.map(([id,label])=>`<option value="${id}" ${weight.emblem===id?'selected':''}>${label}</option>`).join('')}</select></label>
    <label class="field">อัปโหลดรูปตรา<input name="image" type="file" accept="image/png,image/jpeg,image/webp"><small>PNG, JPG หรือ WebP สูงสุด 2 MB</small></label>
    <p class="form-error" id="form-error" hidden></p>
    <footer class="dialog-footer end"><button type="button" class="button ghost" data-close>ยกเลิก</button><button type="submit" class="button primary">${icon('check')}บันทึกตรา</button></footer>
  </form>`,'small-dialog');
  const form = $('#paperweight-form',dialog), select = form.elements.emblem;
  const preview = $('.paperweight-face',form), errorText = $('#form-error',form), submit = $('button[type="submit"]',form);
  let imageDataUrl = weight.imageDataUrl, version = 0;
  const refresh = () => {preview.innerHTML=paperweightFace({emblem:select.value,imageDataUrl},icon);};
  select.addEventListener('change',()=>{errorText.hidden=true;refresh();});
  form.elements.image.addEventListener('change',async event=>{
    const file = event.target.files[0];
    if (!file) return;
    const token = ++version;
    const live = () => token === version && form.isConnected && dialog.open;
    select.value='custom';errorText.hidden=true;submit.disabled=true;
    try{
      const data = await prepareImage(file,{maxDimension:192});
      if (!live()) return;
      imageDataUrl=data;refresh();
    }catch(error){if(live())formError(error.message);}
    finally{if(live())submit.disabled=false;}
  });
  form.addEventListener('submit',event=>{
    event.preventDefault();
    if(submit.disabled)return;
    try{
      if(select.value==='custom'&&!imageDataUrl)throw new Error('เลือกรูปตราที่ต้องการใช้ก่อนบันทึก');
      const prop=$('[data-paperweight]');
      const position=state.paperweight ? {} : {x:parseFloat(prop.style.left),y:parseFloat(prop.style.top)};
      const next=updatePaperweight(state,{...position,emblem:select.value,imageDataUrl});
      closeDialog();savePaperweight(next,{focus:true});showToast('เปลี่ยนตราที่ทับกระดาษแล้ว');
    }catch(error){formError(error.message);}
  });
  refresh();
}
function openAdventurerCardEditor(){
  const cardData = state.adventurerCard ?? DEFAULT_ADVENTURER_CARD;
  const emblems = [...Object.entries(PAPERWEIGHT_EMBLEMS),['custom','รูปประจำตัวของฉัน']];
  openDialog('แก้ไขบัตรประจำตัวนักผจญภัย','ปรับแต่งชื่อบนบัตรและรูปภาพประจำตัว',`<form class="dialog-body adventurer-card-editor" id="adventurer-card-form">
    <label class="field">ชื่อบนบัตร<input name="name" maxlength="50" placeholder="เช่น กระดานนักผจญภัย หรือ ชื่อของคุณ" value="${esc(cardData.name || state.settings?.boardName || '')}"><small>เว้นว่างเพื่อใช้ชื่อกระดานเริ่มต้น</small></label>
    <label class="field">ตราประจำตัว<select name="emblem">${emblems.map(([id,label])=>`<option value="${id}" ${(cardData.emblem||'shield')===id?'selected':''}>${label}</option>`).join('')}</select></label>
    <label class="field">อัปโหลดรูปประจำตัว<input name="image" type="file" accept="image/png,image/jpeg,image/webp"><small>PNG, JPG หรือ WebP สูงสุด 2 MB</small></label>
    <p class="form-error" id="form-error" hidden></p>
    <footer class="dialog-footer end"><button type="button" class="button ghost" data-close>ยกเลิก</button><button type="submit" class="button primary">${icon('check')}บันทึกข้อมูลบัตร</button></footer>
  </form>`,'small-dialog');
  const form = $('#adventurer-card-form',dialog), select = form.elements.emblem, nameInput = form.elements.name;
  const errorText = $('#form-error',form), submit = $('button[type="submit"]',form);
  let imageDataUrl = cardData.imageDataUrl, version = 0;
  select.addEventListener('change',()=>{errorText.hidden=true;});
  form.elements.image.addEventListener('change',async event=>{
    const file = event.target.files[0];
    if (!file) return;
    const token = ++version;
    const live = () => token === version && form.isConnected && dialog.open;
    select.value='custom';errorText.hidden=true;submit.disabled=true;
    try{
      const data = await prepareImage(file,{maxDimension:256});
      if (!live()) return;
      imageDataUrl=data;
    }catch(error){if(live())formError(error.message);}
    finally{if(live())submit.disabled=false;}
  });
  form.addEventListener('submit',event=>{
    event.preventDefault();
    if(submit.disabled)return;
    try{
      if(select.value==='custom'&&!imageDataUrl)throw new Error('เลือกรูปประจำตัวที่ต้องการใช้ก่อนบันทึก');
      const next=updateAdventurerCard(state,{
        name: nameInput.value.trim(),
        emblem: select.value,
        imageDataUrl: select.value==='custom' ? imageDataUrl : null,
      });
      state=next;persist();renderCounts();closeDialog();showToast('บันทึกข้อมูลบัตรนักผจญภัยแล้ว');
    }catch(error){formError(error.message);}
  });
}
function openLibrary(){
  openDialog('คลังตราประทับ','ร่องรอยของทุกชัยชนะ ทุกบทเรียน และวันที่อยากพัก',`<div class="dialog-body library-body"><div class="section-heading"><h3>ตราประจำกิลด์</h3><span>3 รูปแบบ · 3 สถานะ</span></div><div class="library-grid">${['seal','rectangle','banner'].map((style,i)=>`<div class="library-card">${stampMarkup(['done','failed','paused'][i],style)}<strong>${['ตรากิลด์','ตราหมึก','ริบบิ้น'][i]}</strong><span>${['ขอบวงกลมคลาสสิก','รอยหมึกบนกระดาษ','แถบประกาศเกียรติคุณ'][i]}</span><button class="button small ${state.settings.stampStyle===style?'selected-button':'ghost'}" data-default-style="${style}">${state.settings.stampStyle===style?icon('check')+'ค่าเริ่มต้น':'ตั้งเป็นค่าเริ่มต้น'}</button></div>`).join('')}</div><div class="section-heading custom-heading"><h3>ตราประทับของคุณ <span>${state.stamps.length}</span></h3></div><div class="uploaded-stamps">${state.stamps.map(s=>`<div class="uploaded-stamp"><img src="${esc(s.dataUrl)}" alt="${esc(s.name)}"><div><strong>${esc(s.name)}</strong><small>${STATUS[s.status].label}</small></div><button class="icon-button" data-delete-stamp="${esc(s.id)}" aria-label="ลบตรา ${esc(s.name)}">${icon('trash')}</button></div>`).join('')||'<p class="no-custom-stamps">ยังไม่มีตราของตัวเอง เพิ่มเครื่องหมายที่เป็นคุณได้ด้านล่าง</p>'}</div><form id="upload-form" class="upload-panel"><label class="upload-drop" for="stamp-file">${icon('upload')}<strong id="upload-label">เลือกรูปตราประทับของคุณ</strong><span>PNG พื้นหลังโปร่งใสเหมาะที่สุด · JPG / WebP · สูงสุด 2 MB</span><input id="stamp-file" type="file" accept="image/png,image/jpeg,image/webp" required><img id="upload-preview" alt="ตัวอย่างตราที่เลือก" hidden></label><div class="form-row"><label class="field">ชื่อตราประทับ<input name="name" required maxlength="40" placeholder="เช่น ตราแห่งชัยชนะ"></label><label class="field">ใช้กับสถานะ<select name="status"><option value="done">สำเร็จแล้ว</option><option value="failed">ไม่สำเร็จ</option><option value="paused">พักไว้ก่อน</option></select></label></div><p class="form-error" id="form-error" hidden></p><button class="button primary" type="submit">${icon('plus')}เพิ่มเข้าคลังตรา</button></form><footer class="dialog-footer end"><button class="button ghost" data-close>กลับสู่โต๊ะ</button></footer></div>`,'wide-dialog');
  let imageData=null,uploadVersion=0;
  $('#stamp-file').onchange=async e=>{const v=++uploadVersion;imageData=null;$('#form-error').hidden=true;$('#upload-preview').hidden=true;try{const file=e.target.files[0];if(!file)return;const data=await prepareImage(file);if(v!==uploadVersion)return;imageData=data;$('#upload-preview').src=data;$('#upload-preview').hidden=false;$('#upload-label').textContent=file.name;const input=$('[name="name"]');if(!input.value)input.value=file.name.replace(/\.[^.]+$/,'').slice(0,40);}catch(err){if(v===uploadVersion)formError(err.message);}};
  $('#upload-form').onsubmit=e=>{e.preventDefault();if(!imageData){formError('กรุณาเลือกรูปและรอให้แสดงตัวอย่างก่อน');return;}const fd=Object.fromEntries(new FormData(e.target));if(!fd.name.trim()){formError('กรุณาตั้งชื่อตราประทับ');return;}try{state=addStamp(state,{id:uid(),name:fd.name.trim(),status:fd.status,dataUrl:imageData});}catch(err){formError(err.message);return;}persist();showToast('เพิ่มตราของคุณแล้ว เลือกใช้ตอนประทับตราบนเควสได้เลย');openLibrary();};
  dialog.querySelectorAll('[data-default-style]').forEach(b=>b.onclick=()=>{state={...state,settings:{...state.settings,stampStyle:b.dataset.defaultStyle}};persist();openLibrary();});
  dialog.querySelectorAll('[data-delete-stamp]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.deleteStamp;const removed=state.stamps.find(s=>s.id===id);const affected=state.items.filter(i=>i.stampId===id).map(i=>i.id);
    state={...state,stamps:state.stamps.filter(s=>s.id!==id),items:state.items.map(i=>i.stampId===id?{...i,stampId:null}:i)};persist();renderBoard();openLibrary();showToast('ลบตราออกจากคลังแล้ว',{label:'เลิกทำ',run:()=>{commit({...state,stamps:[...state.stamps,removed],items:state.items.map(i=>affected.includes(i.id)?{...i,stampId:id}:i)});if(dialog.open)openLibrary();}});
  });
}
function downloadBackup(){
  if(!paperReader.flush()||!photoSheetReader.flush()||!notebookWindows.flush()){
    showToast('ยังบันทึกโน้ตไม่ได้ กรุณาลองบันทึกอีกครั้งก่อนส่งออก');
    return;
  }
  const blob=new Blob([serializeState(state)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`questboard-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);showToast('ส่งออกสมุดบันทึกการผจญภัยแล้ว');
}
function openSettings(){
  openDialog('จัดแต่งโต๊ะของคุณ','พื้นที่เล็ก ๆ ที่เป็นจุดเริ่มต้นของเรื่องราวมากมาย',`<form class="dialog-body" id="settings-form"><label class="field">ชื่อโต๊ะ<input name="boardName" required maxlength="50" value="${esc(state.settings.boardName)}" autofocus></label><p class="field-caption">บรรยากาศของโต๊ะ</p><div class="theme-options">${[['walnut','โรงเตี๊ยมไม้เก่า'],['midnight','กิลด์ยามค่ำคืน'],['parchment','ห้องทำงานนักสำรวจ']].map(([k,n])=>`<label class="theme-choice theme-${k}"><input type="radio" name="theme" value="${k}" ${state.settings.theme===k?'checked':''}><span class="theme-swatch"></span><span>${n}</span></label>`).join('')}</div><p id="form-error" class="form-error" hidden></p><footer class="dialog-footer end"><button type="button" class="button ghost" data-close>ยกเลิก</button><button type="submit" class="button primary">${icon('check')}บันทึกการตกแต่ง</button></footer></form><section class="backup-section"><div><h3>สมุดบันทึกสำรอง</h3><p>ข้อมูลเก็บในเบราว์เซอร์นี้ ส่งออกเพื่อเก็บสำรองหรือย้ายเครื่อง<br>การนำเข้าจะแทนที่ข้อมูลบนโต๊ะปัจจุบัน</p></div><div class="backup-buttons"><button class="button ghost" id="export-data">${icon('download')}ส่งออก</button><label class="button ghost import-label">${icon('upload')}นำเข้า<input type="file" id="import-data" accept="application/json,.json"></label></div></section>`);
  $('.backup-section',dialog).insertAdjacentHTML('beforebegin',`<section class="file-backup-info"><h3>สำรองไฟล์อัตโนมัติในเครื่อง</h3><p id="file-backup-summary"></p><code id="file-backup-path"></code><p>เก็บไฟล์ล่าสุดและย้อนหลัง 30 รุ่น เควสจะกลับมาอัตโนมัติเมื่อเปิดเว็บหลังล้างข้อมูลเบราว์เซอร์</p><button class="button ghost small" id="retry-file-backup">สำรองตอนนี้</button></section>`);
  renderBackupStatus(backupClient.status());$('#retry-file-backup').onclick=()=>{if(backupClient.status().mode==='conflict'){location.reload();return;}persist();};
  $('#settings-form').onsubmit=e=>{e.preventDefault();const fd=Object.fromEntries(new FormData(e.target));if(!fd.boardName.trim()){formError('กรุณาตั้งชื่อโต๊ะ');return;}closeDialog();commit({...state,settings:{...state.settings,...fd,boardName:fd.boardName.trim()}},'บรรยากาศใหม่ พร้อมสำหรับการผจญภัย');};
  $('#export-data').onclick=downloadBackup;
  $('#import-data').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>MAX_BACKUP_BYTES)throw new Error('ไฟล์สำรองต้องไม่เกิน 90 MB');const incoming=parseState(await file.text());confirmImport(incoming);}catch(err){formError('นำเข้าไม่ได้: '+err.message);e.target.value='';}};
}
function confirmImport(incoming){
  openDialog('แทนที่โต๊ะด้วยไฟล์สำรอง?','แนะนำให้ส่งออกโต๊ะเดิมก่อน เพื่อเก็บการผจญภัยไว้ครบ',`<div class="dialog-body"><div class="import-summary">${icon('scroll')}<div><strong>${esc(incoming.settings.boardName)}</strong><span>${incoming.items.filter(i=>i.type==='quest').length} เควส · ${incoming.items.filter(i=>i.type==='folder').length} แฟ้ม · ${incoming.items.filter(i=>i.type==='label').length} ป้าย · ${incoming.stamps.length} ตราประทับ</span></div></div><footer class="dialog-footer"><button class="button ghost" id="export-before">${icon('download')}สำรองโต๊ะเดิม</button><div><button class="button ghost" data-close>ยกเลิก</button><button class="button primary" id="confirm-import">นำเข้าโต๊ะนี้</button></div></footer></div>`);
  $('#export-before').onclick=downloadBackup;$('#confirm-import').onclick=()=>{if(!paperReader.close()||!photoSheetReader.closeAll()||!notebookWindows.closeAll()){showToast('ยังบันทึกโน้ตไม่ได้ กรุณาลองบันทึกอีกครั้งก่อนนำเข้า');return;}folioWindows?.closeAll();if(typeof dailyBookWindow!=='undefined')dailyBookWindow?.close?.();closeDialog();filters={status:'all',category:'all',search:''};$('#search').value='';commit(ensureNotebook(incoming),'นำเข้าโต๊ะเรียบร้อย',{animateUnlock:false});};
}
function openHelp(){
  openDialog('ยินดีต้อนรับสู่กิลด์','เปลี่ยนเรื่องที่ต้องทำ ให้กลายเป็นการผจญภัยของคุณ',`<div class="dialog-body"><div class="help-list">${[['scroll','เขียนเควสของคุณ','ดึงรางเครื่องเขียนด้านบนลงมา แล้วคลิกปากกา ใส่เป้าหมาย รายละเอียด กำหนดเสร็จ และ XP ที่อยากให้รางวัลตัวเอง'],['grip','จัดโต๊ะในแบบที่ชอบ','ลากที่หัวกระดาษหรือป้ายเพื่อย้ายตำแหน่ง ใช้ Tab ไปที่หัวกระดาษแล้วกดลูกศรเพื่อย้ายได้เช่นกัน (Shift ย้ายเร็วขึ้น)'],['stamp','ฝากรอยตราของการเดินทาง','หยิบตรา สำเร็จ / ไม่สำเร็จ / พักไว้ก่อน จากรางเครื่องมือ ตราจะตามเมาส์ คลิกซ้ายบนกระดาษเพื่อปั๊มได้หลายใบ คลิกขวาหรือ Esc เพื่อเก็บคืน ใช้ Tab และ Enter เพื่อปั๊มด้วยคีย์บอร์ดได้'],['upload','ใช้ตราที่เป็นคุณ','เปิด “เครื่องมืออื่น ๆ” ในลิ้นชัก แล้วเข้าคลังตราเพื่อเพิ่มรูป PNG, JPG หรือ WebP เลือกตราที่อัปโหลดจากเมนูตราของฉันได้'],['archive','ลิ้นชักแห่งความทรงจำ','ดึงหูจับด้านขวาไปทางซ้าย หรือคลิกเพื่อเปิด ลากกระดาษและแฟ้มมาจัดวางในถาดได้ ค้นหาเควสที่เก็บไว้และกดลูกศรนำกลับได้'],['grip','หยิบหลายเควสเป็นมัด','กด Shift ค้างแล้วคลิกกระดาษ หรือกดช่องเลือกบนแต่ละใบ จากนั้นลากหัวกระดาษที่เลือกเพื่อหยิบทั้งมัด วางบนแฟ้มหรือในลิ้นชักได้พร้อมกัน กด Esc เพื่อยกเลิก'],['sun','บรรยากาศของกิลด์','เปิดเครื่องมืออื่น ๆ แล้วดูบรรยากาศกิลด์ เลือกแสงกลางวันหรือกลางคืน เปิดฝุ่น เสียงฝนและเสียงโรงเตี๊ยมแยกกันได้ ปุ่มปิดเสียงทั้งหมดจะปิดทั้งเสียงบรรยากาศและเสียงหยิบจับ'],['photo','เพิ่มภาพให้การผจญภัย','เปิดแก้ไขเควสแล้วกดเพิ่มรูปภาพ รองรับ PNG, JPG และ WebP สูงสุด 5 MB ระบบย่อภาพก่อนเก็บไว้ในเครื่อง'],['download','เก็บเรื่องราวให้ปลอดภัย','ข้อมูลและรูปตราอยู่ในเบราว์เซอร์นี้ สามารถส่งออกและนำเข้าไฟล์สำรองได้ที่ “จัดแต่งโต๊ะ”']].map(([i,t,d])=>`<div>${icon(i)}<section><h3>${t}</h3><p>${d}</p></section></div>`).join('')}</div><footer class="dialog-footer end"><button class="button primary" data-close>${icon('swords')}พร้อมออกผจญภัย</button></footer></div>`);
  $('.help-list',dialog).insertAdjacentHTML('beforeend',[
    ['folder','แฟ้มสำหรับเรื่องราวเดียวกัน','เปิดลิ้นชักด้านขวาแล้วกดสร้างแฟ้ม ค้นหาได้ทั้งชื่อแฟ้มและเควสข้างใน ลากแฟ้มออกมาวางบนโต๊ะหรือเก็บคืนถาดเดิมได้ ลากเควสลงบนแฟ้มเพื่อจัดเก็บ เมื่อเปิดแฟ้มจะมีสารบัญและที่คั่นใบที่อ่านค้าง การลบแฟ้มจะเก็บเควสข้างในไว้ในลิ้นชัก'],
    ['scroll','สมุดงานประจำวันแบบขีดนับ','คลิกที่ปกสมุดบนโต๊ะหรือในลิ้นชักเก็บของเพื่อเปิด จดงานที่ทำซ้ำ แล้วคลิกขีดนับทีละขีด ครบ 5 ขีดจะรวมเป็นมัด'],
    ['feather','สมุดโน้ต','คลิกปกสมุดเพื่อจดบนหน้ากระดาษ เลื่อนหน้าคู่ด้วยลูกศรหรือกดเพิ่มหน้าคู่ ข้อความบันทึกอัตโนมัติและค้นหาได้เมื่อนำสมุดไปเก็บในลิ้นชัก'],
    ['star','แผงไม้ปิดโต๊ะ','ลากแถบรูปดาวจากขอบล่างขึ้นเพื่อปิดโต๊ะ ลากลงเพื่อเปิด หรือคลิกแถบเพื่อสลับทันที'],
    ['shield','ที่ทับกระดาษ','ลากตุ้มไปวางบนใบเควสเพื่อยึดไว้ คลิกตุ้มเพื่อเปลี่ยนตรา ใช้ปุ่มลูกศรเลื่อนตุ้ม และกด Shift+Enter เมื่อตุ้มอยู่เหนือใบที่ต้องการยึด'],
    ['photo','รูปถ่ายบนโต๊ะ','ลากไฟล์ภาพมาวางบนโต๊ะ หรือกดวางรูปบนโต๊ะในรางเครื่องมือด้านบน ลากมือจับลูกศรข้างมุมภาพเพื่อปรับขนาด คลิกมุมภาพเพื่อจดด้านหลัง ลากรูปไปเก็บในลิ้นชักขวาและลากกลับได้'],
    ['volume','เสียงบนโต๊ะนักผจญภัย','เสียงปั๊มตรา หยิบกระดาษ เปิดลิ้นชักและแฟ้มเริ่มหลังการคลิก ปรับความดังหรือปิดเสียงได้ในเครื่องมืออื่น ๆ ของลิ้นชักเครื่องมือ']
  ].map(([i,t,d])=>`<div>${icon(i)}<section><h3>${t}</h3><p>${d}</p></section></div>`).join(''));
}
function openDailyBook(){
  returnStamp(false);closeToolMenu();
  state=ensureDailyBook(state);
  dailyBookWindow?.open();
}
function findNotebook(id){return state.items.find(item=>item.id===id&&item.type==='notebook');}
function openNotebook(id){
  returnStamp(false);closeToolMenu();
  notebookWindows.open(id);
}
function toggleNotebookStorage(id){
  const book=findNotebook(id);
  if(!book)return;
  if(book.archived)restoreQuest(id);
  else archiveQuest(id);
}
function openNotebookEditor(id){
  const book=findNotebook(id);
  if(!book)return;
  const fields=`<label class="field">ชื่อสมุด<input name="title" maxlength="60" required autofocus value="${esc(book.title)}"></label>
    ${renderLeatherColorPicker('สีปกหนัง',book.color)}`;
  openDialog('ปกสมุดโน้ต','',`<form class="dialog-body" id="notebook-cover-form">
    ${renderCoverEditorFields(fields,renderNotebookCover(book,{icon}),NOTEBOOK_SIZE)}
    <p id="form-error" class="form-error" hidden></p>
    <footer class="dialog-footer end"><button type="button" class="button ghost" data-close>ยกเลิก</button><button type="submit" class="button primary">${icon('check')}บันทึกปกสมุด</button></footer>
  </form>`,'cover-editor-dialog');
  const form=$('#notebook-cover-form');
  bindCoverEditor(form);
  form.onsubmit=event=>{
    event.preventDefault();
    try{
      const next=updateItem(state,id,Object.fromEntries(new FormData(form)));
      closeDialog();sound.play('pen');commit(next,'บันทึกปกสมุดโน้ตแล้ว');
    }catch(error){formError(error.message);}
  };
}
function toggleDailyBookArchive(){
  state=ensureDailyBook(state);
  const nextArchived=!state.dailyBook.archived;
  sound.play(nextArchived?'drawerOpen':'folderDrop');
  commit(updateDailyBookMeta(state,{archived:nextArchived,z:Math.max(...state.items.map(i=>i.z),state.dailyBook.z)+1}),nextArchived?'เก็บสมุดงานประจำวันเข้าลิ้นชักแล้ว':'นำสมุดงานประจำวันวางบนโต๊ะแล้ว');
}
function openDailyBookMetaEditor(){
  const book=ensureDailyBook(state).dailyBook;
  const fields=`<label class="field">ชื่อสมุด<input name="title" maxlength="60" required autofocus value="${esc(book.title)}" placeholder="เช่น สมุดงานประจำวัน"></label>
    <label class="field">คำโปรยปกสมุด<input name="subtitle" maxlength="100" value="${esc(book.subtitle||'')}" placeholder="เช่น ขีดนับกิจวัตรประจำวันของนักผจญภัย"></label>
    ${renderLeatherColorPicker('สีปกหนัง',book.color)}`;
  openDialog('ปกสมุดงานประจำวัน','ปรับชื่อสมุด คำโปรย และสีปกหนังของสมุดขีดนับประจำกิลด์',`<form class="dialog-body" id="daily-book-meta-form">
    ${renderCoverEditorFields(fields,renderDailyBookCover(book,{icon}),DAILY_BOOK_SIZE)}
    <p id="form-error" class="form-error" hidden></p>
    <footer class="dialog-footer end"><button type="button" class="button ghost" data-close>ยกเลิก</button><button type="submit" class="button primary">${icon('check')}บันทึกปกสมุด</button></footer>
  </form>`,'cover-editor-dialog');
  const form=$('#daily-book-meta-form');
  bindCoverEditor(form);
  form.onsubmit=e=>{
    e.preventDefault();
    try{
      const values=Object.fromEntries(new FormData(e.target));
      const next=updateDailyBookMeta(state,values);
      closeDialog();sound.play('pen');commit(next,'บันทึกปกสมุดงานประจำวันแล้ว');
    }catch(err){formError(err.message);}
  };
}
function openDailyTaskEditor(taskId){
  const book=ensureDailyBook(state).dailyBook;
  const task=book.tasks.find(t=>t.id===taskId);if(!task)return;
  openDialog('แก้ไขรายการงานประจำ','ปรับชื่องาน หมายเหตุ หรือจำนวนขีดนับได้โดยตรง',`<form class="dialog-body" id="daily-task-edit-form"><label class="field">ชื่องานประจำ<input name="title" maxlength="80" required autofocus value="${esc(task.title)}"></label><label class="field">หมายเหตุ<input name="note" maxlength="160" value="${esc(task.note||'')}" placeholder="เช่น หลังอาหาร, ก่อนนอน"></label><div class="form-row"><label class="field">ขีดรอบนี้<input name="count" type="number" min="0" max="9999" step="1" value="${task.count}"></label><label class="field">ขีดสะสมรวมทั้งหมด<input name="totalCount" type="number" min="0" max="99990" step="1" value="${task.totalCount}"></label></div><p id="form-error" class="form-error" hidden></p><footer class="dialog-footer"><span></span><div><button type="button" class="button ghost" data-close>ยกเลิก</button><button type="submit" class="button primary">${icon('check')}บันทึกรายการ</button></div></footer></form>`,'small-dialog');
  $('#daily-task-edit-form').onsubmit=e=>{
    e.preventDefault();
    try{
      const values=Object.fromEntries(new FormData(e.target));
      values.count=Number(values.count);values.totalCount=Math.max(values.count,Number(values.totalCount));
      const next=updateDailyTask(state,taskId,values);
      closeDialog();sound.play('pen');commit(next,'บันทึกรายการงานประจำแล้ว');
    }catch(err){formError(err.message);}
  };
}
function confirmDeleteDailyTask(taskId){
  const before=state,book=ensureDailyBook(state).dailyBook;
  const task=book.tasks.find(t=>t.id===taskId);if(!task)return;
  openDialog('ลบรายการออกจากสมุด?','สามารถกดเลิกทำได้ทันทีหลังลบ',`<div class="dialog-body"><p class="confirm-copy">${esc(task.title)} (${task.count} ขีด)</p><footer class="dialog-footer end"><button class="button ghost" data-close>ยกเลิก</button><button class="button danger" id="confirm-delete-daily-task">${icon('trash')}ลบรายการ</button></footer></div>`,'small-dialog');
  $('#confirm-delete-daily-task').onclick=()=>{
    closeDialog();
    commit(deleteDailyTask(state,taskId));
    showToast(`ลบ “${task.title}” ออกจากสมุดแล้ว`,{label:'เลิกทำ',run:()=>commit(before,'คืนรายการในสมุดแล้ว')});
  };
}
function settleDailyBook(tilt=0){
  const el=$('#board-canvas [data-daily-book]');if(!el)return;
  sound.play('folderDrop');
  if(reducedMotion())return;
  const book=ensureDailyBook(state).dailyBook;const rotation=book.rotation??0;
  animateTransient(el,settleTiltKeyframes(rotation,tilt),{duration:230,easing:'linear'});
}
function settleTrayDailyBook(ghost,grab={x:DAILY_BOOK_SIZE.width/2,y:28}){
  const target=$(`[data-storage-id="daily-book"]`),book=ensureDailyBook(state).dailyBook;
  const animated=target&&ghost&&!reducedMotion()&&typeof ghost.animate==='function';
  sound.play('folderDrop');
  if(!animated){ghost?.remove();return;}
  const rect=target.getBoundingClientRect(),cx=DAILY_BOOK_SIZE.width/2,cy=DAILY_BOOK_SIZE.height/2;
  const angle=(book.rotation??0)*Math.PI/180;
  const dx=grab.x-cx,dy=grab.y-cy;
  const anchor={x:rect.left+rect.width/2+(dx*Math.cos(angle)-dy*Math.sin(angle))*TRAY_SCALE,y:rect.top+rect.height/2+(dx*Math.sin(angle)+dy*Math.cos(angle))*TRAY_SCALE};
  const from={left:ghost.style.left,top:ghost.style.top,transform:ghost.style.transform,transformOrigin:ghost.style.transformOrigin};
  target.classList.add('storage-source');
  const contact=ghostPose(anchor,grab,TRAY_SCALE,book.rotation??0,0,1);
  animateTransient(ghost,[{...from,easing:'cubic-bezier(.2,.8,.3,1)'},{...contact,offset:.8},contact],{duration:180,easing:'linear'},{
    remove:true,
    onFinish:()=>{target.classList.remove('storage-source');}
  });
}
function archiveDailyBook(ghost,event,grab={x:DAILY_BOOK_SIZE.width/2,y:28}){
  let next=updateDailyBookMeta(state,{archived:true});
  setActiveDrawer('quest-drawer',false,false);archiveSearch='';$('#archive-search').value='';
  if(event){
    const book=ensureDailyBook(state).dailyBook;
    const position=trayDrop({x:event.clientX,y:event.clientY},$('#drawer-list').getBoundingClientRect(),grab,TRAY_SCALE,book.rotation??0,'daily-book');
    next=updateDailyBookMeta(next,{storagePosition:position,z:Math.max(...state.items.map(i=>i.z),0)+1});
  }
  commit(next);
  settleTrayDailyBook(ghost,grab);
  showToast('เก็บสมุดงานประจำวันเข้าลิ้นชักแล้ว',{label:'นำกลับ',run:()=>restoreDailyBook()});
}
function restoreDailyBook(){
  const topZ=Math.max(...state.items.map(i=>i.z),0)+1;
  const next=updateDailyBookMeta(state,{archived:false,z:topZ});
  sound.play('folderDrop');
  commit(next,'นำสมุดงานประจำวันวางบนโต๊ะแล้ว');
  const el=$('#board-canvas [data-daily-book]');
  el?.classList.add('restored-paper');el?.scrollIntoView({block:'nearest',inline:'nearest',behavior:reducedMotion()?'instant':'smooth'});
}
function startDailyBookDrag(e){
  const handle=e.target.closest('[data-daily-book-drag]');
  if(!handle||heldStamp||questPhotos?.editing||photoViewer?.isOpen||e.button!==0||drag||storedDrag||bookDrag)return;
  if(e.target.closest('[data-toggle-daily-book-archive],[data-edit-daily-book]'))return;
  const el=handle.closest('[data-daily-book]');
  if(!el||el.closest('#drawer-list, .quest-drawer'))return;
  e.preventDefault();e.stopPropagation();window.getSelection()?.removeAllRanges();
  handle.focus({preventScroll:true});
  const book=ensureDailyBook(state).dailyBook;
  const topZ=Math.max(...state.items.map(i=>i.z),book.z)+1;
  el.style.zIndex=String(topZ);

  const canvasOrigin=$('#board-canvas').getBoundingClientRect();
  const bounds=rotatedOrigin(el.getBoundingClientRect(),el.offsetWidth,el.offsetHeight,book.rotation,currentScale);
  const grab=grabPoint({x:e.clientX,y:e.clientY},bounds,currentScale,book.rotation);

  bookDrag={
    type:'daily-book',el,handle,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,
    origX:book.x,origY:book.y,x:book.x,y:book.y,rotation:book.rotation,scale:currentScale,
    grab,bounds,canvasOrigin,drawerBefore:activeDrawerId(),moved:false,ghost:null,overTray:false,
    tilt:0,topZ,
  };
  handle.setPointerCapture(e.pointerId);

  const move=ev=>{
    if(!bookDrag||ev.pointerId!==bookDrag.pointerId)return;
    const dx=ev.clientX-bookDrag.startX,dy=ev.clientY-bookDrag.startY;
    if(!bookDrag.moved&&Math.abs(dx)+Math.abs(dy)>4){
      bookDrag.moved=true;if(typeof atmosphere!=='undefined'&&atmosphere)atmosphere.setSuspended?.(true);sound.play('folderPick');
      const ghost=bookDrag.el.cloneNode(true);
      ghost.removeAttribute('data-daily-book');ghost.removeAttribute('aria-label');
      ghost.setAttribute('aria-hidden','true');ghost.inert=true;ghost.classList.remove('dragging');
      ghost.classList.add('book-drag-ghost','paper-in-hand');
      ghost.style.setProperty('--drag-scale',currentScale);
      ghost.style.zIndex='10000';
      ghost.querySelectorAll('[tabindex],button').forEach(b=>b.setAttribute('tabindex','-1'));
      document.body.append(ghost);
      bookDrag.ghost=ghost;bookDrag.el.classList.add('drag-source');
    }
    if(!bookDrag.moved)return;
    const origin=$('#board-canvas').getBoundingClientRect();
    const raw=dragPosition(
      {x:bookDrag.x,y:bookDrag.y,pointerX:bookDrag.startX,pointerY:bookDrag.startY},
      {x:ev.clientX,y:ev.clientY},currentScale,
      {x:origin.left-bookDrag.canvasOrigin.left,y:origin.top-bookDrag.canvasOrigin.top}
    );
    const p=rotatedClampPosition(raw.x,raw.y,'daily-book',bookDrag.rotation,canvasBounds);
    bookDrag.next=p;
    if(bookDrag.ghost)updateHeldGhost(bookDrag,ev);
    else{bookDrag.el.style.left=p.x+'px';bookDrag.el.style.top=p.y+'px';}
    followStorageHandle(ev,'daily-book');
    bookDrag.overTray=overStorageTray(ev,'daily-book');
    highlightStorageTray(bookDrag.overTray);
  };

  const cleanup=(keepGhost=false)=>{
    if(!bookDrag)return;
    if(typeof atmosphere!=='undefined'&&atmosphere)atmosphere.setSuspended?.(false);
    const {handle:h,pointerId,el:element,ghost}=bookDrag;
    h.removeEventListener('pointermove',move);h.removeEventListener('pointerup',end);h.removeEventListener('pointercancel',cancel);
    if(h.hasPointerCapture(pointerId))h.releasePointerCapture(pointerId);
    stopHeldMotion(bookDrag);
    element.classList.remove('dragging','drag-source');
    if(!keepGhost)ghost?.remove();
    clearStorageFeedback();
    bookDrag=null;
  };

  const end=ev=>{
    if(!bookDrag||ev.pointerId!==bookDrag.pointerId)return;
    if(ev&&bookDrag.moved)move(ev);
    const {moved,next,overTray,ghost,drawerBefore,tilt,grab:localGrab,topZ:z}=bookDrag;
    cleanup(!!overTray);
    if(moved)suppressClickUntil=performance.now()+400;
    if(moved&&overTray){
      archiveDailyBook(ghost,ev,localGrab);
      return;
    }
    if(moved&&next){
      state=updateDailyBookMeta(state,{...next,z});
      const currentEl=$('#board-canvas [data-daily-book]');
      if(currentEl){currentEl.style.left=next.x+'px';currentEl.style.top=next.y+'px';}
      persist();
      settleDailyBook(tilt);
    }
    if(!moved){
      openDailyBook();
    }
    setActiveDrawer(drawerBefore,false,false);
  };

  const cancel=ev=>{
    if(!bookDrag||(ev?.pointerId!==undefined&&ev.pointerId!==bookDrag.pointerId))return;
    const {el:element,origX,origY,drawerBefore}=bookDrag;
    element.style.left=origX+'px';element.style.top=origY+'px';
    cleanup();
    setActiveDrawer(drawerBefore,false,false);
  };

  handle.addEventListener('pointermove',move);
  handle.addEventListener('pointerup',end);
  handle.addEventListener('pointercancel',cancel);
}
function arrangeBoard(){
  const before=state.items.map(i=>({id:i.id,x:i.x,y:i.y,rotation:i.rotation}));let q=0,l=0,f=0;
  const quests=questItems();if(quests.length>6){showToast('โต๊ะมีมากกว่า 6 เควส จะจัดซ้อนเป็นชั้นให้หยิบแต่ละใบได้');}
  const folderY=quests.length?85+(Math.min(2,Math.ceil(quests.length/3))-1)*(PAPER.height+60)+PAPER.height+60+Math.min(Math.floor((quests.length-1)/6),5)*18:110;
  state={...state,items:state.items.map(i=>{if(i.archived||i.type==='photo'||i.type==='notebook')return i;if(i.type==='folder')return {...i,x:55+(f++%3)*370,y:folderY,rotation:0};if(i.type==='label')return {...i,x:55+(l++%3)*370,y:24,rotation:0};const index=q++;if(state.paperweight?.questId===i.id)return i;const layer=Math.floor(index/6);return{...i,x:55+(index%3)*370,y:85+Math.floor((index%6)/3)*(PAPER.height+60)+Math.min(layer,5)*18,rotation:0,z:index+10};})};
  commit(state);showToast('จัดกระดาษเป็นระเบียบแล้ว',{label:'เลิกทำ',run:()=>commit({...state,items:state.items.map(i=>i.type==='photo'||state.paperweight?.questId===i.id?i:{...i,...before.find(p=>p.id===i.id)})})});
}
document.addEventListener('pointerdown',prepareStampPointer,true);
document.addEventListener('click',handleStampClick,true);
document.addEventListener('keydown',handleStampKey,true);
document.addEventListener('pointermove',queueStampPointer,{passive:true});
document.addEventListener('pointerleave',hideStampPointer);
document.addEventListener('contextmenu',e=>{if(heldStamp){e.preventDefault();e.stopPropagation();returnStamp();}},true);
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.editDailyBook){if(typeof openDailyBookMetaEditor==='function')openDailyBookMetaEditor();return;}
  if(b.dataset.toggleDailyBookArchive){if(typeof toggleDailyBookArchive==='function')toggleDailyBookArchive();return;}
  if(b.dataset.dailyAction==='close'||b.dataset.action==='close-daily-book'){if(typeof dailyBookWindow!=='undefined')dailyBookWindow?.close?.({animate:true,returnFocus:true});return;}
  if(b.dataset.readPhoto){openPhotoSheet(b.dataset.readPhoto,b.hasAttribute('data-photo-back'));return;}
  if(b.dataset.openNotebook){openNotebook(b.dataset.openNotebook);return;}
  if(b.dataset.editNotebook){openNotebookEditor(b.dataset.editNotebook);return;}
  if(b.dataset.storeNotebook){toggleNotebookStorage(b.dataset.storeNotebook);return;}
  if(b.dataset.action==='new-photo-sheet'){setToolsOpen(false,false);$('#photo-sheet-file').click();return;}
  if(b.dataset.readFront){returnStamp(false);closeToolMenu();paperReader.open(b.dataset.readFront,{back:false});return;}
  if(b.dataset.readBack){returnStamp(false);closeToolMenu();paperReader.open(b.dataset.readBack);return;}
  if(e.detail===0&&b.dataset.folderDrag){placeFolder(b.dataset.folderDrag,true);return;}
  if(e.detail===0&&b.dataset.questDrag){restoreQuest(b.dataset.questDrag);return;}
  if(b.dataset.openFolder){placeFolder(b.dataset.openFolder,true);return;}
  if(b.dataset.placeFolder){placeFolder(b.dataset.placeFolder,false);return;}
  if(b.dataset.storeFolder){archiveQuest(b.dataset.storeFolder);return;}
  if(b.dataset.editFolder){openFolderEditor(b.dataset.editFolder);return;}
  if(b.dataset.action==='close-folder'){closeFolderWindow(true,b.closest('[data-open-folder]')?.dataset.openFolder);return;}
  if(b.dataset.action==='close-folder-drawer'){setFolderDrawerOpen(false);return;}
  if(b.dataset.pickStamp){pickStamp(b.dataset.pickStamp,e);return;}
  if(b.dataset.nav!==undefined||b.dataset.filter!==undefined){filters.status=b.dataset.nav??b.dataset.filter;renderBoard();document.body.classList.remove('menu-open');return;}
  if(b.dataset.edit){openQuest(b.dataset.edit);return;}if(b.dataset.stamp){openStamp(b.dataset.stamp);return;}if(b.dataset.editLabel){openLabel(b.dataset.editLabel);return;}
  if(b.dataset.openArchived){openQuest(b.dataset.openArchived);return;}if(b.dataset.restore){restoreQuest(b.dataset.restore);return;}
  if(b.dataset.action==='open-drawer'){document.body.classList.remove('menu-open');setDrawerOpen(true,true);return;}if(b.dataset.action==='close-drawer'){setDrawerOpen(false);return;}
  const actions={'tool-menu':openToolMenu,'close-tool-menu':closeToolMenu,'new-quest':()=>{sound.play('pen');setToolsOpen(false,false);openQuest();},'close-daily-book':()=>dailyBookWindow?.close?.({animate:true,returnFocus:true}),'new-folder':()=>openFolderEditor(),'close-tools':()=>setToolsOpen(false),'return-stamp':()=>returnStamp(),'new-label':()=>openLabel(),stamps:openLibrary,'adventurer-card':()=>openAdventurerCardEditor?.(),settings:openSettings,help:openHelp,arrange:arrangeBoard,menu:()=>document.body.classList.toggle('menu-open'),'zoom-in':()=>{zoom=Math.min(1.5,zoom+.1);resizeBoard();},'zoom-out':()=>{zoom=Math.max(.6,zoom-.1);resizeBoard();},'zoom-reset':()=>{zoom=1;resizeBoard();},'empty-action':()=>{if(filters.status!=='all'||filters.search||filters.category!=='all'){filters={status:'all',category:'all',search:''};$('#search').value='';renderBoard();}else setToolsOpen(true);}};
  if(b.dataset.action&&!['tool-menu','close-tool-menu','zoom-in','zoom-out','zoom-reset'].includes(b.dataset.action))closeToolMenu();
  actions[b.dataset.action]?.();
});
document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.isComposing||deskShutter?.closed||photoViewer?.isOpen||questPhotos?.editing)return;
  if(['Enter',' '].includes(e.key)&&e.target.matches('[data-storage-id="daily-book"][data-open-daily-book]')){
    e.preventDefault();openDailyBook();return;
  }
  if(e.key==='Escape'&&$('#tool-menu-dialog')?.open){e.preventDefault();closeToolMenu();return;}
  if(e.key==='/'&&!dialog.open&&!e.target.matches('input,textarea,select')){e.preventDefault();returnStamp(false);setToolsOpen(true);openToolMenu();$('#search')?.focus();}
  if(e.key==='Escape'){if(drag)cancelDrag();else if(storedDrag)cancelStoredDrag();else if(heldStamp){e.preventDefault();returnStamp();}else if(!dialog.open){setActiveDrawer(null);setToolsOpen(false);closeFolderWindow(true);if(typeof dailyBookWindow!=='undefined')dailyBookWindow?.close?.({animate:true});}}
});
window.addEventListener('blur',()=>{if(drag)cancelDrag();if(storedDrag)cancelStoredDrag();for(const cue of stampCues.values())cue.abort();stampCues.clear();paperEffects.cancelAll();if(typeof adventurerCard!=='undefined'&&adventurerCard)adventurerCard.cancelAll();});
window.addEventListener('pagehide',()=>{if(drag)cancelDrag();if(storedDrag)cancelStoredDrag();for(const cue of stampCues.values())cue.abort();stampCues.clear();finishFolderOpening();folioWindows?.cancelClosing();paperEffects.cancelAll();if(typeof adventurerCard!=='undefined'&&adventurerCard)adventurerCard.cancelAll();returnStamp(false);});
if(saveUnavailable){
  $('#app').innerHTML=`<div class="loading-screen">${crest()}<h1>เปิดสมุดบันทึกไม่ได้</h1><p>${esc(loadError?.message)}<br>ข้อมูลเดิมยังไม่ได้ถูกแทนที่</p><button class="button primary" id="retry-load">${icon('restore')}ลองเปิดอีกครั้ง</button></div>`;
  $('#retry-load').onclick=()=>location.reload();
}else if(startup.conflict){
  const count=s=>s.items.filter(i=>i.type==='quest').length;
  $('#app').innerHTML=`<div class="loading-screen backup-conflict">${crest()}<h1>พบสมุดบันทึกสองฉบับ</h1><p>ข้อมูลในเบราว์เซอร์กับไฟล์สำรองมีการแก้ไขต่างกัน<br>เลือกฉบับที่ต้องการใช้ ฉบับในไฟล์เดิมยังเก็บเป็นประวัติย้อนหลัง</p><button class="button primary" id="use-disk">ใช้ไฟล์สำรอง · ${count(startup.conflict.disk)} เควส</button><button class="button ghost" id="download-browser-copy">ดาวน์โหลดฉบับในเบราว์เซอร์ไว้ก่อน</button><button class="button ghost" id="use-browser">ใช้ฉบับในเบราว์เซอร์ · ${count(startup.conflict.browser)} เควส</button></div>`;
  $('#download-browser-copy').onclick=()=>{const blob=new Blob([serializeState(startup.conflict.browser)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='questboard-browser-recovery.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),5000);};
  $('#use-disk').onclick=()=>{state=backupClient.resolveConflict('disk');startBoard();};
  $('#use-browser').onclick=()=>{state=backupClient.resolveConflict('browser');startBoard();};
}else{
  startBoard();
}
let midnightTimer=null;
function scheduleMidnightRefresh(){
  clearTimeout(midnightTimer);
  const ms=msUntilNextMidnight();
  midnightTimer=setTimeout(()=>{
    syncBurnStages();
    scheduleMidnightRefresh();
  },ms);
}
function syncBurnStages(){
  const quests=state.items.filter(i=>i.type==='quest');
  const now=new Date();
  for(const q of quests){
    const stage=burnStage(q.due,now,q.status);
    const variant=burnVariant(q.id);
    const ageStage=paperAgeStage(q.createdAt,now);
    const overdue=isOverdue(q);
    const elements=document.querySelectorAll(`.quest-paper[data-id="${q.id}"]`);
    for(const el of elements){
      const prevStage=Number(el.dataset.burn||0);
      if(stage!==prevStage){
        if(stage>=1){
          el.dataset.burn=String(stage);
          el.dataset.burnVariant=String(variant);
          if(!el.querySelector('.paper-burn')){
            const wear=el.querySelector('.paper-wear');
            const burn=document.createElement('span');
            burn.className='paper-burn';
            burn.setAttribute('aria-hidden','true');
            if(wear)wear.after(burn);
            else el.prepend(burn);
          }
        }else{
          delete el.dataset.burn;
          delete el.dataset.burnVariant;
          el.querySelector('.paper-burn')?.remove();
        }
        const existingWisp=el.querySelector('.paper-wisp-layer');
        if(stage===3&&!existingWisp){
          const box=document.createElement('div');
          box.innerHTML=renderBurnWisps(variant);
          const burnEl=el.querySelector('.paper-burn');
          if(burnEl)burnEl.after(box.firstElementChild);
          else el.prepend(box.firstElementChild);
        }else if(stage!==3&&existingWisp){
          existingWisp.remove();
        }
      }
      const prevAge=Number(el.dataset.age||0);
      if(ageStage!==prevAge){
        if(ageStage>=1){
          el.dataset.age=String(ageStage);
          if(!el.querySelector('.paper-age')){
            const wear=el.querySelector('.paper-wear');
            const ageEl=document.createElement('span');
            ageEl.className='paper-age';
            ageEl.setAttribute('aria-hidden','true');
            if(wear)wear.after(ageEl);
            else el.prepend(ageEl);
          }
        }else{
          delete el.dataset.age;
          el.querySelector('.paper-age')?.remove();
        }
      }
      const dateEl=el.querySelector('.quest-date');
      if(dateEl){
        dateEl.classList.toggle('overdue',overdue);
        const small=dateEl.querySelector('small');
        if(overdue&&!small){
          const s=document.createElement('small');
          s.textContent='เลยกำหนด';
          dateEl.append(s);
        }else if(!overdue&&small){
          small.remove();
        }
      }
    }
  }
}
function startBoard(){
  document.addEventListener('visibilitychange',()=>document.body.classList.toggle('page-hidden',document.hidden));
  createMotionDebug({document,window});
  installBurnLayers(document);
  state=ensureDailyBook(ensureNotebook(ensureTrayPositions(state)));
  shell();persist();
  syncBurnStages();
  scheduleMidnightRefresh();
  window.addEventListener('online',()=>backupClient.retry());
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'){
      backupClient.retry();
      syncBurnStages();
      scheduleMidnightRefresh();
    }
  });
  setInterval(()=>backupClient.retry(),15000);
}
