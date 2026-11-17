import {createFolioView} from './folio-view.mjs';
import {createFolioMotion} from './folio-motion.mjs';

/** Each folder keeps its own paper, bookmark, search and session window state. */
export function createFolioWindows({
  document=globalThis.document,window=globalThis.window,windows,
  renderQuest,icon,binding,onRead,onCue=()=>{},reducedMotion=()=>false,
}={}){
  const entries=new Map();let currentItems=[],activation=0;
  const visible=entry=>entry&&!entry.panel.hidden&&entry.panel.isConnected!==false;
  const activate=entry=>{entry.activation=++activation;};
  function activeId(){
    const top=windows?.top;
    for(const entry of entries.values())if(visible(entry)&&entry.panel===top)return entry.id;
    return [...entries.values()].filter(visible).sort((a,b)=>
      (Number.parseFloat(b.panel.style.zIndex)||0)-(Number.parseFloat(a.panel.style.zIndex)||0)||b.activation-a.activation
    )[0]?.id??null;
  }
  function makeEntry(folder){
    const panel=document.createElement('section');panel.hidden=true;
    panel.setAttribute('aria-label','แฟ้มบนโต๊ะ');
    const entry={id:folder.id,panel,search:'',activation:0,handle:null,view:null,motion:null};
    entry.motion=createFolioMotion({document,reducedMotion,onCue,
      setTimeout:window?.setTimeout?.bind(window)??globalThis.setTimeout,
      clearTimeout:window?.clearTimeout?.bind(window)??globalThis.clearTimeout,
    });
    entry.view=createFolioView({panel,document,renderQuest,icon,binding,onRead,onCue,reducedMotion,
      onSearch:value=>{entry.search=value;const current=currentItems.find(item=>item.type==='folder'&&item.id===entry.id);if(current&&visible(entry))entry.view.render({folder:current,items:currentItems,search:value});},
    });
    entry.pointerdown=event=>{
      activate(entry);
      if((event.button??0)!==0||event.isPrimary===false)return;
      const target=event.target;
      if(target?.closest?.('.folder-window-header')&&!target.closest('button, input, textarea, select, a, [contenteditable], [role="button"], [data-no-window-drag]'))entry.motion.finishOpen(panel);
    };
    entry.focusin=()=>activate(entry);
    entry.click=event=>{
      if(!event.target?.closest?.('[data-action="close-folder"]'))return;
      event.preventDefault();event.stopPropagation();close(entry.id,{animate:true,returnFocus:true});
    };
    // Settle the cover before the window manager measures a dragged header.
    panel.addEventListener('pointerdown',entry.pointerdown,true);
    panel.addEventListener('focusin',entry.focusin);panel.addEventListener('click',entry.click);
    entries.set(folder.id,entry);document.body.append(panel);return entry;
  }
  function open(folder,items,{focus=true}={}){
    if(!folder||folder.type!=='folder')return null;
    currentItems=items;
    const entry=entries.get(folder.id)??makeEntry(folder),wasOpen=visible(entry);
    entry.motion.cancelClose();entry.view.render({folder,items,search:entry.search});
    if(!entry.handle)entry.handle=windows?.register(entry.panel,{
      key:`folder:${folder.id}`,handle:'.folder-window-header',
      onEscape:()=>close(folder.id,{animate:true,returnFocus:true}),
    });
    entry.handle?.raise();activate(entry);
    if(!wasOpen)entry.motion.open(entry.panel);
    if(focus)entry.panel.querySelector('.folder-search')?.focus({preventScroll:true});
    return entry.panel;
  }
  function close(id,{animate=false,returnFocus=false}={}){
    const entry=entries.get(id);if(!visible(entry))return false;
    entry.handle?.cancelDrag();
    if(animate)entry.motion.close(entry.panel);else{entry.motion.finishOpen(entry.panel);entry.motion.cancelClose();}
    entry.panel.hidden=true;entry.panel.removeAttribute('data-folder-target');
    if(returnFocus)document.querySelector(`button[data-open-folder="${id}"]`)?.focus({preventScroll:true});
    return true;
  }
  function closeAll(options){for(const entry of entries.values())close(entry.id,options);}
  function dispose(entry){
    entry.motion.finishOpen(entry.panel);entry.motion.cancelClose();entry.handle?.cancelDrag();entry.handle?.destroy();entry.view.destroy();
    entry.panel.removeEventListener('pointerdown',entry.pointerdown,true);entry.panel.removeEventListener('focusin',entry.focusin);entry.panel.removeEventListener('click',entry.click);
    entry.panel.remove();entries.delete(entry.id);
  }
  function render(items){
    currentItems=items;
    for(const entry of entries.values()){
      const folder=items.find(item=>item.id===entry.id&&item.type==='folder');
      if(!folder){dispose(entry);continue;}
      if(visible(entry))entry.view.render({folder,items,search:entry.search});
    }
  }
  function finishOpening(panelOrId){
    for(const entry of entries.values())if(panelOrId===undefined||entry.id===panelOrId||entry.panel===panelOrId)entry.motion.finishOpen(entry.panel);
  }
  function cancelClosing(){for(const entry of entries.values())entry.motion.cancelClose();}
  return {open,render,close,closeAll,finishOpening,cancelClosing,get activeId(){return activeId();}};
}
