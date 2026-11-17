import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {access,readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {dependencyMarkup} from '../dist/quest-dependency-view.mjs';

const quest=(id,status='active',extra={})=>({id,type:'quest',title:id,status,...extra});

test('legacy quests without prerequisites retain an empty dependency caption',()=>{
  assert.equal(dependencyMarkup(quest('legacy'),[quest('legacy')]),'');
  assert.equal(dependencyMarkup(quest('empty','active',{prerequisiteIds:[]}),[]),'');
});

test('a waiting badge counts only unfinished prerequisites and exposes their exact escaped names',()=>{
  const target=quest('target','active',{prerequisiteIds:['done','paused','failed']});
  const items=[target,quest('done','done'),quest('paused','paused',{title:'Map <img src=x onerror="bad">'}),quest('failed','failed',{title:"Gate & 'key'"})];
  const html=dependencyMarkup(target,items);
  assert.match(html,/class="quest-dependency-badge is-locked"/);
  assert.match(html,/รอ 2 เควส/);
  assert.match(html,/title="[^"]*Map &lt;img src=x onerror=&quot;bad&quot;&gt;[^"]*Gate &amp; &#39;key&#39;[^"]*"/);
  assert.match(html,/aria-label="[^"]*Map &lt;img src=x onerror=&quot;bad&quot;&gt;[^"]*Gate &amp; &#39;key&#39;[^"]*"/);
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<button'));
  assert.ok(!html.includes('data-'));
});

test('all successful prerequisites unlock the caption even when their papers are archived or in folders',()=>{
  const target=quest('target','active',{prerequisiteIds:['archive','folder']});
  const html=dependencyMarkup(target,[target,quest('archive','done',{archived:true}),quest('folder','done',{folderId:'f'})]);
  assert.match(html,/class="quest-dependency-badge is-ready"/);
  assert.match(html,/พร้อมเริ่ม/);
  assert.match(html,/สำเร็จครบ 2 เควส/);
});

test('completed history is described accurately after a prerequisite reopens',()=>{
  const target=quest('target','done',{prerequisiteIds:['reopened']});
  const html=dependencyMarkup(target,[target,quest('reopened','active',{title:'Return to the gate'})]);
  assert.match(html,/class="quest-dependency-badge is-ready"/);
  assert.match(html,/บันทึกสำเร็จแล้ว/);
  assert.match(html,/Return to the gate/);
  assert.ok(!html.includes('พร้อมเริ่ม'));
  assert.ok(!html.includes('is-locked'));
});

const root=fileURLToPath(new URL('../dist/',import.meta.url));
// This page serves only dummy graph data and isolated view modules. It never
// loads the app, backup endpoints, real user data or an existing browser profile.
const html=`<!doctype html><html><head><link rel="stylesheet" href="/quest-dependency-view.css"></head><body>
<pre id="report">running</pre><form id="form"><input name="title" value="Draft"><div id="mount"><span id="sentinel">kept</span></div></form>
<div id="other"></div><script type="module">
const report=document.querySelector('#report'),checks=[];
const check=(value,message)=>{if(!value)throw Error(message);checks.push(message)};
let picker,other;
try{
 const {createPrerequisitePicker,dependencyMarkup}=await import('/quest-dependency-view.mjs');
 const items=[
  {id:'q',type:'quest',title:'Current quest',status:'active',prerequisiteIds:['a']},
  {id:'a',type:'quest',title:'<img src=x onerror="window.bad=true"> & Map',status:'done',archived:true,folderId:'f'},
  {id:'b',type:'quest',title:'Blue map',description:'Route through the wood',status:'active',folderId:'f'},
  {id:'c',type:'quest',title:'Cycle child',status:'active',prerequisiteIds:['q']},
  {id:'d',type:'quest',title:'Cycle descendant',status:'active',prerequisiteIds:['c']},
  {id:'e',type:'quest',title:'Paused route',status:'paused'},
  {id:'f',type:'folder',name:'Field notes'}
 ];
 const original=JSON.stringify(items),mount=document.querySelector('#mount'),form=document.querySelector('#form');
 picker=createPrerequisitePicker({container:mount,items,questId:'q',selectedIds:['a']});
 const fieldset=mount.querySelector('fieldset'),search=mount.querySelector('input[type="search"]');
 const box=id=>mount.querySelector('input[type="checkbox"][value="'+id+'"]');
 const filter=value=>{search.value=value;search.dispatchEvent(new Event('input',{bubbles:true}))};
 check(fieldset?.querySelector('legend')?.textContent==='ต้องสำเร็จก่อน','named native fieldset');
 check(search?.labels?.length>0,'search has a visible label');
 check(fieldset.textContent.includes('ทุกเควส'),'helper explains all selected prerequisites');
 check(mount.querySelectorAll('input[type="checkbox"]').length===5&&!box('q')&&!box('f'),'all quests including archived and in-folder, except self');
 check(box('a').checked&&box('a').labels.length>0,'initial native checkbox selection and label');
 check(box('a').closest('label').textContent.includes('ลิ้นชัก')&&box('b').closest('label').textContent.includes('Field notes'),'hidden paper locations remain identifiable');
 check(!mount.querySelector('img')&&!window.bad,'quest titles are rendered as text');
 for(const id of ['c','d']){
  const input=box(id),reason=document.getElementById(input.getAttribute('aria-describedby'));
  check(input.disabled&&reason?.textContent.includes('วง'),'direct and transitive cycle choices explain native disabled state: '+id);
  input.click();check(!picker.getSelectedIds().includes(id),'disabled cycle choice cannot be selected: '+id);
 }
 check([...new FormData(form).keys()].join(',')==='title','picker controls do not leak into form payload');
 search.focus();filter('BLUE');
 check(document.activeElement===search&&mount.querySelectorAll('input[type="checkbox"]').length===1&&box('b'),'search is case insensitive and preserves input focus');
 box('b').click();check(picker.getSelectedIds().sort().join(',')==='a,b','select while earlier selection is filtered out');
 filter('route');check(box('b')&&box('e'),'description and title are searchable');
 box('e').click();filter('');
 check(box('a').checked&&box('b').checked&&box('e').checked,'multiple selections survive filtering');
 filter('no-match-129088');
 check(mount.querySelectorAll('input[type="checkbox"]').length===0&&fieldset.textContent.includes('ไม่พบ'),'empty search has a readable result');
 check(picker.getSelectedIds().sort().join(',')==='a,b,e','empty search preserves all selections');
 filter('img');box('a').click();
 const saved=picker.getSelectedIds();check(saved.sort().join(',')==='b,e','uncheck filtered choice and save exact remaining IDs');
 saved.push('c');check(!picker.getSelectedIds().includes('c'),'returned selection is a defensive copy');
 other=createPrerequisitePicker({container:document.querySelector('#other'),items,questId:'q',selectedIds:picker.getSelectedIds()});
 check(other.getSelectedIds().sort().join(',')==='b,e','saved selection round trips into another editor');
 const ids=[...document.querySelectorAll('[id]')].map(node=>node.id);check(ids.length===new Set(ids).size,'simultaneous editors have unique accessible IDs');
 const badge=document.createElement('div');badge.innerHTML=dependencyMarkup(items[0],items);document.body.append(badge);
 const ink=badge.querySelector('.quest-dependency-badge'),style=getComputedStyle(ink),rect=ink.getBoundingClientRect();
 check(style.position==='relative'&&style.overflow==='visible'&&rect.width<=150&&rect.height<=18,'badge leaves bounded metadata space and visible local effect overflow');
 check(parseFloat(style.fontSize)>=8&&parseFloat(style.fontSize)<=10,'badge uses compact legible metadata type');
 const oldContents=fieldset.textContent;picker.destroy();
 check(!mount.contains(fieldset)&&document.querySelector('#sentinel')?.textContent==='kept','destroy removes only owned markup');
 filter('Blue');check(fieldset.textContent===oldContents,'destroy releases search listener');
 check(JSON.stringify(items)===original,'picker never mutates quest status or model data');
 report.textContent=JSON.stringify({ok:true,checks:checks.length});
}catch(error){report.textContent=JSON.stringify({ok:false,checks:checks.length,error:error.stack??error.message})}
finally{picker?.destroy();other?.destroy()}
</script></body></html>`;

test('native prerequisite picker filters, prevents cycles, preserves multiple selections and saves without model changes',{timeout:30000},async t=>{
  const candidates=[process.env.PREREQUISITE_TEST_BROWSER,...(process.platform==='win32'?['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe']:[])].filter(Boolean);
  let executable;for(const path of candidates){try{await access(path);executable=path;break}catch{}}
  if(!executable){t.skip('Set PREREQUISITE_TEST_BROWSER to an installed Chromium executable for native DOM verification');return}
  const server=createServer(async(req,res)=>{
    if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(html);return}
    const path=resolve(root,'.'+req.url);
    if(!path.startsWith(resolve(root)+sep)||!['.mjs','.css'].includes(extname(path))){res.writeHead(404).end();return}
    try{res.writeHead(200,{'Content-Type':extname(path)==='.mjs'?'text/javascript':'text/css'}).end(await readFile(path))}catch{res.writeHead(404).end()}
  });
  const prefix=join(tmpdir(),'quest-prerequisite-view-'),profile=await mkdtemp(prefix);
  let child;
  try{
    await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r)});
    child=spawn(executable,['--headless','--no-first-run','--disable-background-networking','--user-data-dir='+profile,'--dump-dom','--virtual-time-budget=1500','http://127.0.0.1:'+server.address().port+'/'],{windowsHide:true});
    let stdout='';child.stdout.on('data',data=>stdout+=data);child.stderr.resume();
    const timer=setTimeout(()=>child.kill(),20000);
    const code=await new Promise((r,j)=>{child.once('close',r);child.once('error',j)}).finally(()=>clearTimeout(timer));
    assert.equal(code,0,'isolated browser exits successfully');
    const raw=stdout.match(/<pre id="report">([\s\S]*?)<\/pre>/)?.[1];
    assert.ok(raw&&raw!=='running','native DOM fixture completes');
    const result=JSON.parse(raw.replaceAll('&gt;','>').replaceAll('&lt;','<').replaceAll('&amp;','&'));
    assert.equal(result.ok,true,result.error);assert.ok(result.checks>=25,'all picker behavior checks completed');
  }finally{
    child?.kill();if(server.listening)await new Promise(r=>server.close(r));
    assert.ok(resolve(profile).startsWith(resolve(prefix)),'temporary profile stays under the intended test prefix');
    await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
});
