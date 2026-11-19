import {animateTransient,cancelMotion} from './desk-motion.mjs';
import {MOTION_DURATION,MOTION_EASING} from './motion-tokens.mjs';

// The viewer only accepts the raster data URLs used by saved quest photos.
function raster(value){
  if(typeof value!=='string'||value.length>2796244)return false;
  const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if(!match||match[2].length%4)return false;
  try{
    const bytes=atob(match[2].slice(0,32));
    return match[1]==='png'?bytes.startsWith('\x89PNG\r\n\x1a\n'):match[1]==='jpeg'?bytes.startsWith('\xff\xd8\xff'):bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WEBP';
  }catch{return false;}
}

export function createPhotoViewer({document=globalThis.document,window=globalThis.window,reducedMotion=()=>window?.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false,onCue=()=>{}}={}){
  let dialog,image,caption,button,current=null,destroyed=false;
  const listen=(node,type,fn)=>node?.addEventListener?.(type,fn);
  const unlisten=(node,type,fn)=>node?.removeEventListener?.(type,fn);
  const cue=name=>{try{onCue(name);}catch{/* Sound is optional. */}};
  const motion=()=>{try{return !(typeof reducedMotion==='function'?reducedMotion():reducedMotion);}catch{return false;}};
  const active=entry=>current===entry&&!destroyed;
  function cancelAnimation(entry){entry.animation=null;cancelMotion(image);}
  function restoreSources(entry){for(const [node,visibility] of entry.hidden){if(node.style.visibility==='hidden')node.style.visibility=visibility;}entry.hidden.clear();}
  function hideSource(entry,node){if(node&&!entry.hidden.has(node)){entry.hidden.set(node,node.style.visibility??'');node.style.visibility='hidden';}}
  function source(entry){
    let node;try{node=typeof entry.getSource==='function'?entry.getSource():entry.source;}catch{return null;}
    if(!node||node.isConnected===false||node.hidden||(node.src||node.getAttribute?.('src'))!==entry.src||(node.currentSrc&&node.currentSrc!==entry.src))return null;
    const rect=node.getBoundingClientRect?.();
    return rect&&[rect.left,rect.top,rect.width,rect.height].every(Number.isFinite)&&rect.width>0&&rect.height>0?{node,rect}:null;
  }
  function focusBack(entry){
    let target=entry.focus;
    if(!target||target.isConnected===false){
      const origin=source(entry)?.node;target=origin?.closest?.('button,a[href],[tabindex]')??origin;
    }
    if(!target||target.isConnected===false)return;
    // A rerender can replace the invoking button. Temporarily make its fresh
    // photograph focusable so focus never remains inside the closed dialog.
    const temporary=target.tagName==='IMG'&&target.getAttribute('tabindex')===null;
    if(temporary)target.setAttribute('tabindex','-1');
    try{target.focus?.({preventScroll:true});}catch{}
    finally{if(temporary)target.removeAttribute('tabindex');}
  }
  function removeLoading(entry){unlisten(image,'load',entry.load);unlisten(image,'error',entry.error);}
  function dispose(entry,{focus=true}={}){
    cancelAnimation(entry);removeLoading(entry);restoreSources(entry);unlisten(window,'resize',resize);
    if(current===entry)current=null;
    if(dialog?.open)try{dialog.close();}catch{dialog.removeAttribute('open');}
    image.style.transform='none';image.style.opacity='1';image.style.visibility='hidden';image.removeAttribute('src');
    dialog.removeAttribute('aria-busy');if(focus)focusBack(entry);
  }
  function animate(entry,keyframes,duration,done){
    if(!motion()||typeof image.animate!=='function'){done();return;}
    let token=Symbol('viewer-motion'),started=false;
    entry.animation=token;
    animateTransient(image,keyframes,{duration,easing:MOTION_EASING.hover,fill:'both'},{
      onStart(){started=true;},
      onFinish(){if(!active(entry)||entry.animation!==token)return;entry.animation=null;done();},
    });
    if(!started&&active(entry)&&entry.animation===token){entry.animation=null;done();}
  }
  function fit(entry){
    const width=entry.width,height=entry.height;
    if(!(width>0&&height>0))return null;
    const viewportWidth=window?.innerWidth||document.documentElement?.clientWidth||1000;
    const viewportHeight=window?.innerHeight||document.documentElement?.clientHeight||800;
    const scale=Math.min(1,Math.max(1,viewportWidth-72)/width,Math.max(1,viewportHeight-144)/height);
    image.style.width=`${width*scale}px`;image.style.height=`${height*scale}px`;
    const rect=image.getBoundingClientRect();
    return rect.width>0&&rect.height>0?rect:null;
  }
  function transform(from,to){
    const scale=Math.min(from.width/to.width,from.height/to.height);
    const x=from.left+from.width/2-to.left-to.width/2,y=from.top+from.height/2-to.top-to.height/2;
    return `translate(${x}px, ${y}px) scale(${scale})`;
  }
  function ready(entry){
    if(!active(entry)||entry.phase==='closing'||entry.ready||!(image.naturalWidth>0&&image.naturalHeight>0))return;
    entry.ready=true;entry.width=image.naturalWidth;entry.height=image.naturalHeight;entry.display=fit(entry);
    image.style.visibility='visible';dialog.removeAttribute('aria-busy');
    const origin=source(entry);hideSource(entry,origin?.node);
    const start=origin&&entry.display?transform(origin.rect,entry.display):'none';
    animate(entry,[{transform:start,opacity:origin?1:0},{transform:'none',opacity:1}],MOTION_DURATION.photoLift,()=>{entry.phase='open';image.style.transform='none';image.style.opacity='1';});
  }
  function resize(){
    const entry=current;if(!entry)return;
    if(entry.phase==='closing'){dispose(entry);return;}
    cancelAnimation(entry);image.style.transform='none';image.style.opacity='1';
    if(entry.ready){entry.phase='open';entry.display=fit(entry);}
  }
  function close(){
    const entry=current;if(!entry||destroyed||entry.phase==='closing')return false;
    let start='none',opacity=1;
    try{const style=window?.getComputedStyle?.(image);start=style?.transform||'none';opacity=Number(style?.opacity??1);}catch{}
    cancelAnimation(entry);removeLoading(entry);restoreSources(entry);entry.phase='closing';cue('paperDrop');
    if(!entry.ready){dispose(entry);return true;}
    entry.display=fit(entry);
    const target=source(entry);hideSource(entry,target?.node);
    const end=target&&entry.display?transform(target.rect,entry.display):'none';
    animate(entry,[{transform:start,opacity:Number.isFinite(opacity)?opacity:1},{transform:end,opacity:target?1:0}],220,()=>dispose(entry));
    return true;
  }
  const cancel=event=>{event.preventDefault();close();};
  const backdrop=event=>{if(event.target===dialog)close();};
  const nativeClose=()=>{if(current&&!dialog.open){if(current.phase!=='closing')cue('paperDrop');dispose(current);}};
  function build(){
    if(dialog)return;
    dialog=document.createElement('dialog');dialog.className='photo-viewer';dialog.setAttribute('aria-label','ดูรูปประกอบเควสเต็มภาพ');
    const sheet=document.createElement('div');sheet.className='photo-viewer-sheet';
    const toolbar=document.createElement('div');toolbar.className='photo-viewer-toolbar';
    button=document.createElement('button');button.type='button';button.className='photo-viewer-close';button.setAttribute('aria-label','วางรูปกลับบนใบเควส');button.textContent='×';
    image=document.createElement('img');image.className='photo-viewer-image';image.draggable=false;image.decoding='async';
    caption=document.createElement('p');caption.className='photo-viewer-caption';
    toolbar.append(button);sheet.append(toolbar,image,caption);dialog.append(sheet);document.body.append(dialog);
    listen(button,'click',close);listen(dialog,'cancel',cancel);listen(dialog,'click',backdrop);listen(dialog,'close',nativeClose);
  }
  function open({src,alt='',source:origin=null,getSource}={}){
    if(destroyed||!raster(src))return false;
    if(current?.src===src&&current.source===origin&&current.phase!=='closing'){
      if(typeof getSource==='function')current.getSource=getSource;
      return true;
    }
    build();
    const previous=current,focus=previous?.focus??document.activeElement;
    if(previous){cancelAnimation(previous);removeLoading(previous);restoreSources(previous);current=null;}
    const entry={src,source:origin,getSource,focus,hidden:new Map(),phase:'opening',ready:false,animation:null};current=entry;
    image.style.transform='none';image.style.opacity='1';image.style.visibility='hidden';image.style.width='';image.style.height='';image.alt=String(alt??'');caption.textContent=image.alt;caption.hidden=!image.alt;
    dialog.setAttribute('aria-busy','true');
    try{if(!dialog.open)dialog.showModal();}catch{dispose(entry);return false;}
    entry.load=()=>ready(entry);entry.error=()=>{if(active(entry))dispose(entry);};
    listen(image,'load',entry.load);listen(image,'error',entry.error);listen(window,'resize',resize);
    image.src=src;button.focus({preventScroll:true});cue('paperPick');
    if(image.complete&&image.naturalWidth>0)ready(entry);
    else if(typeof image.decode==='function')try{Promise.resolve(image.decode()).then(()=>ready(entry),()=>{if(image.complete&&image.naturalWidth>0)ready(entry);});}catch{/* The load/error events remain authoritative. */}
    return true;
  }
  function destroy(){
    if(destroyed)return;
    destroyed=true;if(current)dispose(current);
    if(dialog){unlisten(button,'click',close);unlisten(dialog,'cancel',cancel);unlisten(dialog,'click',backdrop);unlisten(dialog,'close',nativeClose);dialog.remove();}
  }
  return {open,close,destroy,get isOpen(){return !!current&&!!dialog?.open;}};
}
