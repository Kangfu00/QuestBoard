import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {access,readFile,writeFile,mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

// Only a dummy fixture and these decorative static files are served. No real
// page, quests, backup API, saved profile or existing browser session is loaded.
// Native DOM/CSS/hit testing is real; clicks and visibility changes are synthetic.
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const fixture=await readFile(new URL('./fixtures/native-atmosphere.html',import.meta.url));
const assets=new Map([
  ['/atmosphere.mjs',['atmosphere.mjs','text/javascript']],
  ['/atmosphere.css',['atmosphere.css','text/css']],
  ['/sun-clouds.svg',['sun-clouds.svg','image/svg+xml']],
]);

async function browserPath(){
  const candidates=[process.env.ATMOSPHERE_TEST_BROWSER,...(process.platform==='win32'?['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe']:[])].filter(Boolean);
  for(const candidate of candidates){try{await access(candidate);return candidate}catch{}}
}

// A private anonymous pipe is needed only so this fixture can observe real
// animation frames; Chromium's dump-dom virtual clock can starve rAF callbacks.
// It never discovers or connects to an existing browser/session or TCP port.
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
    const request=++id,timer=setTimeout(()=>{pending.delete(request);reject(Error('isolated browser protocol timed out: '+method))},10000);
    pending.set(request,{resolve,reject,timer});
    child.stdio[3].write(JSON.stringify({id:request,method,params,...(sessionId?{sessionId}:{})})+'\0');
  });
}

async function runFixture(t,{media=false,capture,withoutLit=false}={}){
  const executable=await browserPath();
  if(!executable){t.skip('Set ATMOSPHERE_TEST_BROWSER to an installed Chromium executable for native sunlight verification');return}
  const unexpected=[];
  const server=createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://127.0.0.1').pathname;
    if(pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'}).end(fixture);return}
    const asset=assets.get(pathname);
    if(!asset){if(pathname!=='/favicon.ico')unexpected.push(pathname);res.writeHead(404).end();return}
    try{res.writeHead(200,{'Content-Type':asset[1]}).end(await readFile(join(root,asset[0])))}catch{res.writeHead(404).end()}
  });
  const prefix=join(tmpdir(),'guild-atmosphere-native-'),profile=await mkdtemp(prefix);
  let child;
  try{
    await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r)});
    const parameters=new URLSearchParams();if(media)parameters.set('media','1');if(capture)parameters.set('capture',capture);if(withoutLit)parameters.set('withoutLit','1');
    let screenshot;
    if(capture){
      const directory=resolve(process.env.ATMOSPHERE_TEST_SCREENSHOTS);await mkdir(directory,{recursive:true});screenshot=join(directory,'sunlight-'+capture+(withoutLit?'-without-lit':'')+'.png');
    }
    const args=['--headless','--no-first-run','--no-startup-window','--disable-background-networking','--disable-component-update','--window-size=1280,800','--user-data-dir='+profile,'--remote-debugging-pipe'];
    if(media)args.push('--force-prefers-reduced-motion');
    child=spawn(executable,args,{windowsHide:true,stdio:['ignore','ignore','pipe','pipe','pipe']});
    child.stderr.resume();
    const timer=setTimeout(()=>child.kill(),20000);
    let report;
    try{
      const send=browserPipe(child),{targetId}=await send('Target.createTarget',{url:'about:blank'});
      const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
      await send('Page.bringToFront',{},sessionId);
      await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false},sessionId);
      await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/?'+parameters},sessionId);
      // Poll only this newly-created dummy page. Native rAF advances normally;
      // timeout and the outer process deadline both fail closed.
      const started=Date.now();
      while(Date.now()-started<12000){
        let result;
        try{result=await send('Runtime.evaluate',{expression:'document.querySelector("#report")?.textContent',returnByValue:true},sessionId)}catch(error){if(!/context|navigation/i.test(error.message))throw error}
        const raw=result?.result?.value;
        if(raw&&raw!=='running'){report=JSON.parse(raw);break}
        await new Promise(resolve=>setTimeout(resolve,30));
      }
      assert.ok(report,'native atmosphere fixture completes within its deadline');
      if(screenshot){
        const image=await send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false},sessionId);
        await writeFile(screenshot,Buffer.from(image.data,'base64'));
        await writeFile(screenshot.replace(/\.png$/,'.json'),JSON.stringify(report,null,2)+'\n');
      }
      await send('Browser.close');
    }finally{clearTimeout(timer)}
    assert.equal(report.ok,true,report.error);
    assert.equal(report.mode,media?'native-reduced-motion':'moving');
    assert.ok(report.checks>=(media?7:200),'native behavioral assertions run');
    assert.deepEqual(unexpected,[],'fixture requests only approved decorative assets');
    if(screenshot){await access(screenshot);t.diagnostic('Screenshot: '+screenshot)}
  }finally{
    child?.kill();if(server.listening)await new Promise(r=>server.close(r));
    const resolved=resolve(profile),expectedParent=resolve(tmpdir())+sep;
    assert.ok(resolved.startsWith(expectedParent)&&resolved.startsWith(resolve(prefix)),'temporary profile cleanup stays under the intended test prefix');
    await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
}

test('native sunlight keeps paired dust aligned, clouds resetting invisibly, and dummy desk controls reachable',{timeout:30000},async t=>{
  await runFixture(t);
});

test('native reduced-motion preference and CSS fallback suppress all atmosphere animation',{timeout:30000},async t=>{
  await runFixture(t,{media:true});
});

if(process.env.ATMOSPHERE_TEST_SCREENSHOTS){
  for(const capture of ['morning','evening'])test('render isolated '+capture+' sunlight for visual QA',{timeout:30000},async t=>{
    await runFixture(t,{capture});
  });
  if(process.env.ATMOSPHERE_TEST_PIXEL_REFERENCES)for(const capture of ['morning','evening'])test('render '+capture+' without the lit copy for pixel comparison',{timeout:30000},async t=>{
    await runFixture(t,{capture,withoutLit:true});
  });
}
