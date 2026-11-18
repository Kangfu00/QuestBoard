// Match the cover, paper and cord phases in folio-spread.css. The hinge opens
// for 700ms after untying; closing first squares the paper, then ties the cord.
export const FOLIO_MOTION_TIMING=Object.freeze({
  open:1020,
  close:880,
  unfold:180,
  refold:130,
  tie:690,
});

// Motion owns temporary classes and visual copies only. The caller owns panel
// visibility and folder state, including when a closing panel becomes hidden.
export function createFolioMotion({
  document=globalThis.document,
  reducedMotion=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false,
  setTimeout=globalThis.setTimeout,
  clearTimeout=globalThis.clearTimeout,
  onCue,
}={}) {
  let opening=null,closing=null;

  // The sound layer owns scheduling; the visual lifetime only cancels cues
  // when interrupted. Natural cleanup lets already playing clips finish.
  function cues(first,second,delay=0,firstDelay=0) {
    const controller=new AbortController();
    for(const [name,wait] of [[first,firstDelay],[second,delay]]){
      try{Promise.resolve(onCue?.(name,{delay:wait,signal:controller.signal})).catch(()=>{});}catch{}
    }
    return controller;
  }

  function finishOpen(panel,interrupted=true) {
    const previous=opening;opening=null;
    if(previous){
      if(interrupted)previous.cues?.abort();
      try{if(previous.timer!==null)clearTimeout(previous.timer);}catch{}
      try{previous.panel?.classList.remove('is-unfolding');}catch{}
      previous.timer=null;previous.panel=null;
    }
    try{panel?.classList.remove('is-unfolding');}catch{}
  }

  function cancelClose(interrupted=true) {
    const previous=closing;closing=null;
    if(!previous)return;
    if(interrupted)previous.cues?.abort();
    try{if(previous.timer!==null)clearTimeout(previous.timer);}catch{}
    try{previous.node?.remove();}catch{}
    previous.timer=null;previous.node=null;
  }

  function open(panel) {
    cancelClose();finishOpen(panel);
    try{
      if(!panel||panel.hidden)return;
      if(reducedMotion()){cues('cordUntie','folderOpen');return;}
      // Flush the settled pose before adding the opening class again.
      void panel.offsetWidth;
      panel.classList.add('is-unfolding');
      const current={panel,timer:null,cues:null};opening=current;
      current.timer=setTimeout(()=>{if(opening===current)finishOpen(undefined,false);},FOLIO_MOTION_TIMING.open);
      current.cues=cues('cordUntie','folderOpen',FOLIO_MOTION_TIMING.unfold);
    }catch{finishOpen(panel);}
  }

  function close(panel) {
    finishOpen(panel);cancelClose();
    let ghost;
    try{
      if(!panel||panel.hidden)return;
      if(!document?.body||reducedMotion()){cues('folderClose','cordTie');return;}
      const rect=panel.getBoundingClientRect();
      if(![rect.left,rect.top,rect.width,rect.height].every(Number.isFinite)||rect.width<=0||rect.height<=0)return;
      ghost=panel.cloneNode(true);
      const originals=[panel,...panel.querySelectorAll('*')],copies=[ghost,...ghost.querySelectorAll('*')];
      // Preserve the leather, text and decoration without duplicating IDs or
      // exposing the copy to delegated actions and folder drop targeting.
      for(const node of copies){
        for(const {name} of [...node.attributes]){
          const keepsCoverTone=node===ghost&&name==='data-leather-tone';
          if(name==='id'||name==='autofocus'||(name.startsWith('data-')&&!keepsCoverTone))node.removeAttribute(name);
        }
      }
      ghost.inert=true;ghost.setAttribute('inert','');
      ghost.setAttribute('aria-hidden','true');ghost.setAttribute('role','presentation');
      ghost.classList.remove('is-unfolding','folder-drop-ready');
      ghost.classList.add('folio-closing-ghost');
      Object.assign(ghost.style,{
        position:'fixed',inset:'auto',left:`${rect.left}px`,top:`${rect.top}px`,
        width:`${rect.width}px`,height:`${rect.height}px`,margin:'0',boxSizing:'border-box',
        minWidth:'0',maxWidth:'none',minHeight:'0',maxHeight:'none',
        transform:'none',translate:'none',rotate:'none',scale:'none',pointerEvents:'none',
      });
      document.body.append(ghost);
      // cloneNode does not preserve scroll offsets; detached nodes have no
      // scrollable layout, so restore the visible rows after attachment.
      originals.forEach((node,index)=>{
        if(node.scrollTop)copies[index].scrollTop=node.scrollTop;
        if(node.scrollLeft)copies[index].scrollLeft=node.scrollLeft;
      });
      const current={node:ghost,timer:null,cues:null};closing=current;
      current.timer=setTimeout(()=>{if(closing===current)cancelClose(false);},FOLIO_MOTION_TIMING.close);
      current.cues=cues('folderClose','cordTie',FOLIO_MOTION_TIMING.tie,FOLIO_MOTION_TIMING.refold);
    }catch{
      cancelClose();
      try{ghost?.remove();}catch{}
    }
  }

  return {open,finishOpen,close,cancelClose};
}
