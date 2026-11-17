import { createInitialState, loadState, saveState, serializeState, parseState } from './model.mjs';

const SYNC_KEY='questboard-file-sync-v1';
const readSyncDefault=()=>{try{return JSON.parse(localStorage.getItem(SYNC_KEY));}catch{return null;}};
const writeSyncDefault=value=>{try{localStorage.setItem(SYNC_KEY,JSON.stringify(value));}catch{}};
const same=(a,b)=>serializeState(a)===serializeState(b);
async function fingerprint(json){
  try{return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(json))),v=>v.toString(16).padStart(2,'0')).join('');}catch{return null;}
}

export function createBackupClient({request=globalThis.fetch?.bind(globalThis),readLocal=loadState,writeLocal=saveState,readSync=readSyncDefault,writeSync=writeSyncDefault,onStatus=()=>{},timeoutMs=15000}={}){
  let revision=null,remoteKnown=false,lastSnapshot=null,conflict=null,queue=Promise.resolve(),localQueue=Promise.resolve(),sequence=0,latestFingerprint=null;
  let info={mode:'loading',backupDir:'',savedAt:null,error:null};
  function publish(patch){info={...info,...patch};onStatus({...info});return {...info};}
  function remember(pending,hash){try{writeSync({revision,pending,fingerprint:hash});}catch{}}
  async function call(options={}){
    if(!request)throw Error('ไม่สามารถติดต่อระบบสำรองไฟล์ได้');
    const controller=new AbortController();let timer;
    try{
      const response=await Promise.race([
        request('/api/backup',{cache:'no-store',...options,signal:controller.signal}),
        new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('ระบบสำรองไฟล์ไม่ตอบกลับ'));},timeoutMs);})
      ]);
      const data=await response.json();
      if(!response.ok){const error=Error(data.error||'สำรองไฟล์ไม่สำเร็จ');error.status=response.status;throw error;}
      if(!('revision' in data)||!(data.revision===null||typeof data.revision==='string'))throw Error('รูปแบบข้อมูลสำรองไม่ถูกต้อง');
      return data;
    }finally{clearTimeout(timer);}
  }
  async function readRemote(){const data=await call();if(data.state)data.state=parseState(JSON.stringify(data.state));else if(data.state!==null)throw Error('ข้อมูลสำรองไม่สมบูรณ์');return data;}
  function metadata(data){return {backupDir:data.backupDir||info.backupDir,savedAt:data.savedAt||null};}
  async function load(){
    const [localResult,remoteResult]=await Promise.allSettled([readLocal(),readRemote()]);
    const local=localResult.status==='fulfilled'?localResult.value:null;
    let sync;try{sync=readSync();}catch{}
    if(remoteResult.status==='rejected'){
      if(!local)throw Error('ยังอ่านไฟล์สำรองไม่ได้ กรุณาเปิดเซิร์ฟเวอร์กระดานแล้วลองใหม่');
      revision=sync?.revision??null;lastSnapshot=local;
      publish({mode:'browser-only',error:remoteResult.reason.message});
      return {state:local,source:'browser'};
    }
    const remote=remoteResult.value;revision=remote.revision;remoteKnown=true;
    publish({...metadata(remote),mode:remote.state?'saved':'pending',error:null});
    if(remote.state){
      const differs=local&&!same(local,remote.state);
      const hash=local?await fingerprint(serializeState(local)):null;
      const matchesSync=hash&&sync?.fingerprint===hash;
      const pendingAgainstCurrent=matchesSync&&sync?.pending===true&&sync.revision===revision;
      if(differs&&(remote.recovered||!matchesSync||sync.pending!==false&&!pendingAgainstCurrent)){
        conflict={browser:local,disk:remote.state};publish({mode:'conflict'});
        return {state:null,conflict};
      }
      lastSnapshot=differs&&pendingAgainstCurrent?local:remote.state;
      return {state:lastSnapshot,source:differs&&pendingAgainstCurrent?'browser':'disk'};
    }
    if(localResult.status==='rejected')throw localResult.reason;
    lastSnapshot=local||createInitialState();
    return {state:lastSnapshot,source:local?'browser':'new'};
  }
  async function performSave(snapshot,number,localError,hash){
    publish({mode:'pending',error:null});
    try{
      if(!remoteKnown){
        const remote=await readRemote();
        if(remote.state&&revision!==remote.revision&&!same(snapshot,remote.state)){
          const error=Error('ไฟล์สำรองมีข้อมูลใหม่จากอีกหน้าต่าง');error.status=409;throw error;
        }
        revision=remote.revision;remoteKnown=true;publish(metadata(remote));remember(true,latestFingerprint);
      }
      const result=await call({method:'POST',headers:{'Content-Type':'application/json','X-Questboard-Backup':'1'},body:JSON.stringify({state:snapshot,baseRevision:revision})});
      revision=result.revision;remember(number!==sequence,number===sequence?hash:latestFingerprint);
      return publish({...metadata(result),mode:number!==sequence?'pending':localError?'file-only':'saved',error:localError?.message||null});
    }catch(error){
      if(error.status===409){
        try{
          const remote=await readRemote();
          if(remote.state&&same(snapshot,remote.state)){
            revision=remote.revision;remoteKnown=true;remember(number!==sequence,number===sequence?hash:latestFingerprint);
            return publish({...metadata(remote),mode:number!==sequence?'pending':localError?'file-only':'saved',error:localError?.message||null});
          }
        }catch{}
      }
      return publish({mode:error.status===409?'conflict':localError?'failed':'browser-only',error:error.message});
    }
  }
  function save(value){
    let snapshot,json;try{json=serializeState(value);snapshot=parseState(json);}catch(error){return Promise.reject(error);}
    if(conflict)return Promise.reject(Error('กรุณาเลือกข้อมูลที่จะใช้ก่อนบันทึก'));
    lastSnapshot=snapshot;latestFingerprint=null;const number=++sequence,hashJob=fingerprint(json);
    publish({mode:'pending',error:null});
    // IndexedDB remains responsive even while a previous file upload is stalled.
    const localJob=localQueue.catch(()=>{}).then(async()=>{
      const hash=await hashJob;if(number===sequence)latestFingerprint=hash;remember(true,hash);
      try{await writeLocal(snapshot);return {hash};}catch(error){return {hash,error};}
    });
    localQueue=localJob;
    const job=queue.catch(()=>{}).then(async()=>{
      const local=await localJob;
      if(number!==sequence)return {...info};
      return performSave(snapshot,number,local.error,local.hash);
    });queue=job;return job;
  }
  function resolveConflict(source){
    if(!conflict||!['browser','disk'].includes(source))throw Error('ไม่มีข้อมูลที่เลือก');
    lastSnapshot=conflict[source];conflict=null;return lastSnapshot;
  }
  function retry(){
    if(!lastSnapshot||conflict||!['browser-only','failed'].includes(info.mode))return Promise.resolve({...info});
    return save(lastSnapshot);
  }
  return {load,save,retry,resolveConflict,status:()=>({...info})};
}
