import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {access,readFile,writeFile,mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

// Only invented fixture state and an explicit static module/CSS allowlist are
// served. No app page, backup API, saved data or existing browser is accessed.
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const fixture=await readFile(new URL('./fixtures/native-prerequisite-flow.html',import.meta.url));
const assets=new Map([
  ['model.mjs','text/javascript'],['paper-format.mjs','text/javascript'],['photo-layout.mjs','text/javascript'],
  ['stamp-tools.mjs','text/javascript'],['stamp-surfaces.mjs','text/javascript'],['stamp-placement.mjs','text/javascript'],
  ['quest-dependencies.mjs','text/javascript'],['quest-dependency-view.mjs','text/javascript'],['quest-unlock.mjs','text/javascript'],
  ['quest-dependency-view.css','text/css'],['quest-unlock.css','text/css'],
].map(([name,type])=>['/'+name,[name,type]]));

async function browserPath(){
  const candidates=[process.env.PREREQUISITE_TEST_BROWSER,...(process.platform==='win32'?['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe']:[])].filter(Boolean);
  for(const candidate of candidates)try{await access(candidate);return candidate}catch{}
}

// This anonymous pipe belongs exclusively to the spawned test browser. Real
// animation frames advance normally; no dump-dom virtual clock is involved.
function browserPipe(child){
  let id=0,buffer=Buffer.alloc(0);const pending=new Map();
  const rejectAll=error=>{for(const entry of pending.values()){clearTimeout(entry.timer);entry.reject(error)}pending.clear()};
  child.once('error',rejectAll);child.once('close',()=>rejectAll(Error('isolated prerequisite browser closed')));
  child.stdio[3].on('error',rejectAll);child.stdio[4].on('error',rejectAll);
  child.stdio[4].on('data',chunk=>{
    buffer=Buffer.concat([buffer,chunk]);
    for(let end;(end=buffer.indexOf(0))!==-1;){
      const raw=buffer.subarray(0,end).toString();buffer=buffer.subarray(end+1);let message;
      try{message=JSON.parse(raw)}catch{rejectAll(Error('invalid isolated prerequisite browser protocol response'));continue}
      const entry=pending.get(message.id);if(!entry)continue;pending.delete(message.id);clearTimeout(entry.timer);
      if(message.error)entry.reject(Error(message.error.message));else entry.resolve(message.result);
    }
  });
  return (method,params={},sessionId)=>new Promise((resolve,reject)=>{
    const request=++id,timer=setTimeout(()=>{pending.delete(request);reject(Error('isolated prerequisite browser protocol timed out: '+method))},10000);
    pending.set(request,{resolve,reject,timer});child.stdio[3].write(JSON.stringify({id:request,method,params,...(sessionId?{sessionId}:{})})+'\0');
  });
}

async function runFixture(t,{reduced=false}={}){
  const executable=await browserPath();
  if(!executable){t.skip('Set PREREQUISITE_TEST_BROWSER to an installed Chromium executable for native prerequisite verification');return}
  const unexpected=[];
  const server=createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://127.0.0.1').pathname;
    if(pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'}).end(fixture);return}
    const asset=assets.get(pathname);
    if(!asset){if(pathname!=='/favicon.ico')unexpected.push(pathname);res.writeHead(404).end();return}
    try{res.writeHead(200,{'Content-Type':asset[1]}).end(await readFile(join(root,asset[0])))}catch{res.writeHead(404).end()}
  });
  const prefix=join(tmpdir(),'guild-prerequisite-native-'),profile=await mkdtemp(prefix);let child;
  try{
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
    const args=['--headless','--no-first-run','--no-startup-window','--disable-background-networking','--disable-component-update','--window-size=1440,1000','--user-data-dir='+profile,'--remote-debugging-pipe'];
    if(reduced)args.push('--force-prefers-reduced-motion');
    child=spawn(executable,args,{windowsHide:true,stdio:['ignore','ignore','pipe','pipe','pipe']});child.stderr.resume();
    const timer=setTimeout(()=>child.kill(),22000);let report;
    try{
      const send=browserPipe(child),{targetId}=await send('Target.createTarget',{url:'about:blank'});
      const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
      await send('Page.bringToFront',{},sessionId);
      await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false},sessionId);
      await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/?reduced='+(reduced?'1':'0')},sessionId);
      const start=Date.now();
      while(Date.now()-start<14000){
        let result;
        try{result=await send('Runtime.evaluate',{expression:'document.querySelector("#report")?.textContent',returnByValue:true},sessionId)}catch(error){if(!/context|navigation/i.test(error.message))throw error}
        const raw=result?.result?.value;if(raw&&raw!=='running'){report=JSON.parse(raw);break}
        await new Promise(resolve=>setTimeout(resolve,30));
      }
      assert.ok(report,'native prerequisite fixture completes within its deadline');
      if(process.env.PREREQUISITE_TEST_SCREENSHOTS){
        const directory=resolve(process.env.PREREQUISITE_TEST_SCREENSHOTS);await mkdir(directory,{recursive:true});
        const path=join(directory,'prerequisite-flow-'+(reduced?'reduced':'moving')+'.png');
        const screenshot=await send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false},sessionId);
        await writeFile(path,Buffer.from(screenshot.data,'base64'));await writeFile(path.replace(/\.png$/,'.json'),JSON.stringify(report,null,2)+'\n');t.diagnostic('Screenshot: '+path);
      }
      await send('Browser.close');
    }finally{clearTimeout(timer)}
    assert.equal(report.ok,true,report.error);assert.equal(report.mode,reduced?'native-reduced-motion':'moving');
    assert.ok(report.checks>=(reduced?40:60),'combined native behavioral assertions run');
    assert.deepEqual(report.surfaces,['board','tray','reader','folio']);assert.equal(report.input,'synthetic DOM clicks and direct real model calls');
    assert.deepEqual(unexpected,[],'fixture requests only approved prerequisite assets');
    t.diagnostic(report.checks+' native behavioral checks ('+report.mode+'); synthetic DOM input, real model/DOM/CSS/WAAPI');
  }finally{
    child?.kill();if(server.listening)await new Promise(resolve=>server.close(resolve));
    const resolved=resolve(profile),expectedParent=resolve(tmpdir())+sep;
    assert.ok(resolved.startsWith(expectedParent)&&resolved.startsWith(resolve(prefix)),'temporary profile cleanup stays under the intended test prefix');
    await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
}

test('native two-prerequisite flow guards completion and unlocks all live paper copies',{timeout:30000},async t=>{await runFixture(t)});
test('native reduced motion and CSS fallback keep prerequisite transitions immediate',{timeout:30000},async t=>{await runFixture(t,{reduced:true})});
