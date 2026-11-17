import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {access,readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

// No app, backup API, real quests, user profile or existing browser session is
// loaded. The optional Chromium fixture checks native DOM focus propagation and
// actual CSS matrices; its pointer events are synthetic, not trusted OS input.
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const html=`<!doctype html><html><head><link rel="stylesheet" href="/quest-photos.css"><style>
body{margin:20px}.quest-paper{position:relative;width:300px;height:424.285714px}
.quest-photo{position:absolute}.quest-photo-controls{opacity:1!important;pointer-events:auto!important}
.paper-reader{position:relative;display:block;margin:0;padding:0;border:0}
.paper-reader-scene{transform:scale(.8);transform-origin:0 0}.paper-reader-live{transform:rotateY(0deg)}
.folio-paper-stage{transform:scale(.7) rotate(3deg);transform-origin:0 0}
</style></head><body><pre id="report">running</pre><script type="module">
import {createQuestPhotos} from '/quest-photos.mjs';
const report=document.querySelector('#report'),checks=[],quests=new Map(),saves=[];
const check=(value,message)=>{if(!value)throw Error(message);checks.push(message)};
const node=(tag,classes='',data={})=>{const n=document.createElement(tag);n.className=classes;Object.assign(n.dataset,data);return n};
const src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="232" height="296"></svg>');
let photos;
try{
 const views=[];
 for(const kind of ['board','reader','folio','tray']){
  const id=kind;quests.set(id,{id,type:'quest',imageDataUrl:src});
  let host,parent;
  if(kind==='reader'){
   host=node('dialog','paper-reader',{readerQuest:id,side:'front'});host.open=true;
   const scene=node('div','paper-reader-scene',{side:'front'}),live=node('div','paper-reader-live');parent=node('div','reader-front');host.append(scene);scene.append(live);live.append(parent);
  }else if(kind==='folio'){
   host=node('section','folder-window folio-spread',{openFolder:'test-folder'});
   const right=node('div','folio-right'),viewport=node('div','folio-paper-viewport');parent=node('div','folio-paper-stage');host.append(right);right.append(viewport);viewport.append(parent);
  }else{host=parent=node('div');host.id=kind==='board'?'board-canvas':'drawer-list'}
  document.body.append(host);
  const paper=node('article','quest-paper',kind==='reader'?{}:{[kind==='folio'?'folioPaper':kind==='tray'?'storageId':'id']:id}),photo=node('div','quest-photo'),image=node('img');image.src=src;parent.append(paper);paper.append(photo);photo.append(image);await image.decode();
  // Synthetic events have no active native pointer. Shim capture only; all DOM,
  // focus/blur propagation, computed transforms and bounding boxes remain real.
  const captured=new Set();photo.setPointerCapture=id=>captured.add(id);photo.hasPointerCapture=id=>captured.has(id);photo.releasePointerCapture=id=>captured.delete(id);
  views.push({id,paper,photo,image});
 }
 photos=createQuestPhotos({getQuest:id=>quests.get(id),onSave:(id,layout)=>{saves.push({id,layout});quests.get(id).photoLayout=layout}});
 for(const view of views){
  const {id,paper,photo,image}=view,button=action=>paper.querySelector('[data-photo-action="'+action+'"]');
  const pointer=(target,type,x=100,y=200)=>target.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,button:0,isPrimary:true,pointerId:1,clientX:x,clientY:y}));
  const click=target=>{pointer(target,'pointerdown');pointer(target,'pointerup');target.click()};
  click(button('edit'));check(photos.editing,id+': Edit survives native button blur');
  const beforeX=parseFloat(photo.style.left),beforeY=parseFloat(photo.style.top),r=image.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
  pointer(image,'pointerdown',x,y);pointer(window,'pointermove',x+8,y+5);pointer(window,'pointerup',x+8,y+5);
  check(photos.editing&&parseFloat(photo.style.left)>beforeX&&parseFloat(photo.style.top)>beforeY,id+': pointer move');
  const width=parseFloat(photo.style.width),resize=button('resize');pointer(resize,'pointerdown',x,y);pointer(window,'pointermove',x+10,y+15);pointer(window,'pointerup',x+10,y+15);
  check(photos.editing&&parseFloat(photo.style.width)>width,id+': pointer enlargement');
  const enlarged=parseFloat(photo.style.width);pointer(resize,'pointerdown',x,y);pointer(window,'pointermove',x-8,y-12);pointer(window,'pointerup',x-8,y-12);
  check(photos.editing&&parseFloat(photo.style.width)<enlarged,id+': pointer reduction');
  const rotate=button('rotate'),rotation=photo.style.transform;pointer(rotate,'pointerdown',x+50,y);pointer(window,'pointermove',x+40,y+20);pointer(window,'pointerup',x+40,y+20);
  check(photos.editing&&photo.style.transform!==rotation,id+': pointer rotation');
  const count=saves.length;click(button('done'));check(!photos.editing&&saves.length===count+1&&saves.at(-1).id===id,id+': save once');
  const saved=JSON.stringify(quests.get(id).photoLayout);click(button('edit'));button('move').dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'ArrowDown'}));click(button('cancel'));
  check(!photos.editing&&JSON.stringify(quests.get(id).photoLayout)===saved&&saves.length===count+1,id+': cancel preserves saved pose');
 }
 report.textContent=JSON.stringify({ok:true,checks:checks.length,surfaces:views.map(v=>v.id)});
}catch(error){report.textContent=JSON.stringify({ok:false,checks:checks.length,error:error.stack??error.message})}
finally{photos?.destroy()}
</script></body></html>`;

test('native DOM photo arrangement survives focus and supports all four live surfaces', {timeout:30000}, async t=>{
  const candidates=[process.env.PHOTO_TEST_BROWSER,...(process.platform==='win32'?['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe']:[])].filter(Boolean);
  let executable;for(const path of candidates){try{await access(path);executable=path;break}catch{}}
  if(!executable){t.skip('Set PHOTO_TEST_BROWSER to an installed Chromium executable for native DOM verification');return}
  const server=createServer(async(req,res)=>{
    if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html'}).end(html);return}
    const path=resolve(root,'.'+req.url);
    if(!path.startsWith(resolve(root)+sep)||!['.mjs','.css'].includes(extname(path))){res.writeHead(404).end();return}
    try{res.writeHead(200,{'Content-Type':extname(path)==='.mjs'?'text/javascript':'text/css'}).end(await readFile(path))}catch{res.writeHead(404).end()}
  });
  const prefix=join(tmpdir(),'quest-photo-dom-'),profile=await mkdtemp(prefix);
  let child;
  try{
    await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r)});
    child=spawn(executable,['--headless','--no-first-run','--disable-background-networking',
      '--user-data-dir='+profile,'--dump-dom','--virtual-time-budget=1500',
      'http://127.0.0.1:'+server.address().port+'/'],{windowsHide:true});
    let stdout='';child.stdout.on('data',d=>stdout+=d);child.stderr.resume();
    const timer=setTimeout(()=>child.kill(),20000);
    const code=await new Promise((r,j)=>{child.once('close',r);child.once('error',j)}).finally(()=>clearTimeout(timer));
    assert.equal(code,0,'isolated browser exits successfully');
    const raw=stdout.match(/<pre id="report">([\s\S]*?)<\/pre>/)?.[1];
    assert.ok(raw&&raw!=='running','native DOM fixture completes');
    const report=JSON.parse(raw.replaceAll('&gt;','>').replaceAll('&lt;','<').replaceAll('&amp;','&'));
    assert.equal(report.ok,true,report.error);assert.equal(report.checks,28);
    assert.deepEqual(report.surfaces,['board','reader','folio','tray']);
  }finally{
    child?.kill();if(server.listening)await new Promise(r=>server.close(r));
    assert.ok(resolve(profile).startsWith(resolve(prefix)),'temporary profile stays under the intended test prefix');
    await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
});
