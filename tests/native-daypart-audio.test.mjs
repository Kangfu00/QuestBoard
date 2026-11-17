import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {access,readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

// A fresh muted Chromium profile loads only this dummy fixture and an explicit
// static allowlist. No app, API, saved data, user browser or debug TCP port is used.
// The initial click is trusted CDP input; later control and visibility events are
// synthetic. Native contexts, buffers, decoding, gain automation and time are real.
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const fixture=await readFile(new URL('./fixtures/native-daypart-audio.html',import.meta.url));
const assets=new Map([
  ['/atmosphere.mjs',['atmosphere.mjs','text/javascript']],
  ['/atmosphere.css',['atmosphere.css','text/css']],
  ['/sun-clouds.svg',['sun-clouds.svg','image/svg+xml']],
  ['/ambience.mjs',['ambience.mjs','text/javascript']],
  ['/daypart-ambience.mjs',['daypart-ambience.mjs','text/javascript']],
  ...['morning','day','evening','night','tavern'].map(name=>['/audio/ambience/'+name+'.wav',['audio/ambience/'+name+'.wav','audio/wav']]),
]);

async function browserPath(){
  const candidates=[process.env.DAYPART_TEST_BROWSER,process.env.ATMOSPHERE_TEST_BROWSER,...(process.platform==='win32'?['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe']:[])].filter(Boolean);
  for(const candidate of candidates){try{await access(candidate);return candidate}catch{}}
}

// Same anonymous-pipe protocol as native-atmosphere. This runner creates its own
// target and never discovers or connects to any existing browser/session.
function browserPipe(child){
  let id=0,buffer=Buffer.alloc(0);
  const pending=new Map();
  const rejectAll=error=>{for(const entry of pending.values()){clearTimeout(entry.timer);entry.reject(error)}pending.clear()};
  child.once('error',rejectAll);child.once('close',()=>rejectAll(Error('isolated browser closed')));
  child.stdio[3].on('error',rejectAll);child.stdio[4].on('error',rejectAll);
  child.stdio[4].on('data',chunk=>{
    buffer=Buffer.concat([buffer,chunk]);
    for(let end;(end=buffer.indexOf(0))!==-1;){
      const raw=buffer.subarray(0,end).toString();buffer=buffer.subarray(end+1);
      let message;try{message=JSON.parse(raw)}catch{rejectAll(Error('invalid isolated browser protocol response'));continue}
      const entry=pending.get(message.id);if(!entry)continue;
      pending.delete(message.id);clearTimeout(entry.timer);
      if(message.error)entry.reject(Error(message.error.message));else entry.resolve(message.result);
    }
  });
  return (method,params={},sessionId)=>new Promise((resolve,reject)=>{
    const request=++id,timer=setTimeout(()=>{pending.delete(request);reject(Error('isolated browser protocol timed out: '+method))},8000);
    pending.set(request,{resolve,reject,timer});
    child.stdio[3].write(JSON.stringify({id:request,method,params,...(sessionId?{sessionId}:{})})+'\0');
  });
}

test('native daypart recordings honor trusted unlock, real crossfades and composed mute/clock lifecycle',{timeout:45000},async t=>{
  const executable=await browserPath();
  if(!executable){t.skip('Set DAYPART_TEST_BROWSER to an installed Chromium executable for native audio verification');return}
  const unexpected=[];
  const server=createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://127.0.0.1').pathname;
    if(pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'}).end(fixture);return}
    const asset=assets.get(pathname);
    if(!asset){if(pathname!=='/favicon.ico')unexpected.push(pathname);res.writeHead(404).end();return}
    try{res.writeHead(200,{'Content-Type':asset[1]}).end(await readFile(join(root,asset[0])))}catch{res.writeHead(404).end()}
  });
  const prefix=join(tmpdir(),'guild-daypart-native-'),profile=await mkdtemp(prefix);
  let child,deadline;
  try{
    await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r)});
    child=spawn(executable,['--headless','--mute-audio','--no-first-run','--no-startup-window','--disable-background-networking','--disable-component-update','--window-size=1100,900','--user-data-dir='+profile,'--remote-debugging-pipe'],{windowsHide:true,stdio:['ignore','ignore','pipe','pipe','pipe']});
    child.stderr.resume();deadline=setTimeout(()=>child.kill(),35000);
    const send=browserPipe(child),{targetId}=await send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
    await send('Page.bringToFront',{},sessionId);
    await send('Emulation.setDeviceMetricsOverride',{width:1100,height:900,deviceScaleFactor:1,mobile:false},sessionId);
    await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'},sessionId);
    const evaluate=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true},sessionId)).result?.value;
    const started=Date.now();let ready;
    while(Date.now()-started<6500){
      try{ready=await evaluate('window.__nativeReady')}catch(error){if(!/context|navigation/i.test(error.message))throw error}
      if(ready)break;
      await new Promise(r=>setTimeout(r,30));
    }
    assert.equal(ready,true,'native composed fixture is ready before trusted input: '+await evaluate('document.querySelector("#report")?.textContent'));
    const before=await evaluate('window.__nativeDebug()');
    assert.equal(before.contexts.length,0,'no realtime AudioContext before gesture');
    assert.deepEqual(before.requests,[],'no recording fetch before gesture');
    // Observe this fixture's own live button geometry, then dispatch a trusted
    // press/release. No autoplay policy or user-activation override is supplied.
    const rect=await evaluate('(()=>{const b=document.querySelector("#start"),r=b.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,width:r.width,height:r.height,hit:document.elementFromPoint(x,y)===b}})()');
    assert.ok(rect.width>0&&rect.height>0&&rect.hit,'the observed start button is visible and reachable');
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:rect.x,y:rect.y,button:'left',clickCount:1},sessionId);
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:rect.x,y:rect.y,button:'left',clickCount:1},sessionId);
    let report;
    while(Date.now()-started<31000){
      const raw=await evaluate('document.querySelector("#report")?.textContent');
      if(raw&&raw.startsWith('{')){report=JSON.parse(raw);break}
      await new Promise(r=>setTimeout(r,40));
    }
    assert.ok(report,'native composed fixture completes before deadline: '+JSON.stringify(await evaluate('window.__nativeDebug()')));
    assert.equal(report.ok,true,report.error+'\n'+JSON.stringify(report.debug));
    assert.equal(report.gesture.trusted,true);assert.equal(report.gesture.active,true);
    assert.equal(report.decodes.length,4,'all four actual recordings decode natively');
    assert.ok(report.checks>=65,'native lifecycle and signal assertions ran');
    assert.equal(report.maxDaypartVoices,2,'the real crossfade uses at most two time voices');
    assert.deepEqual(unexpected,[],'fixture requests only approved static files');
    t.diagnostic(JSON.stringify({gesture:report.gesture,decodes:report.decodes,crossfade:report.crossfade,signalPeak:report.signalPeak,maxDaypartVoices:report.maxDaypartVoices,sourceStarts:report.sourceStarts,checks:report.checks}));
    await send('Browser.close');
  }finally{
    clearTimeout(deadline);child?.kill();server.closeAllConnections?.();if(server.listening)await new Promise(r=>server.close(r));
    const resolved=resolve(profile),expectedParent=resolve(tmpdir())+sep;
    assert.ok(resolved.startsWith(expectedParent)&&resolved.startsWith(resolve(prefix)),'profile cleanup stays under the intended temporary test prefix');
    await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
});
