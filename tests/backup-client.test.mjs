import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { createInitialState, serializeState } from '../dist/model.mjs';
import { createBackupClient } from '../dist/backup-client.mjs';

const board=name=>({...createInitialState(),settings:{...createInitialState().settings,boardName:name}});
const fingerprint=state=>createHash('sha256').update(serializeState(state)).digest('hex');
function harness({local=null,disk=null,meta=null,offline=false,localFails=false}={}){
  let stored=local,remote=disk,revision=disk?'r1':null,sync=meta,writes=0;
  const io={offline,localFails};
  const client=createBackupClient({
    readLocal:async()=>stored,
    writeLocal:async value=>{if(io.localFails)throw Error('storage blocked');stored=structuredClone(value);io.localSaved?.(stored);},
    readSync:()=>sync,writeSync:value=>{sync=structuredClone(value);},
    request:async(_url,options={})=>{
      if(io.offline)throw Error('offline');
      if(options.method==='POST'){
        io.postStarted?.();if(io.holdPost)await io.holdPost;
        assert.equal(options.headers['X-Questboard-Backup'],'1');
        const body=JSON.parse(options.body);
        if(body.baseRevision!==revision)return new Response(JSON.stringify({error:'conflict',revision}),{status:409});
        remote=body.state;revision='r'+(++writes+1);
        if(io.loseResponse){io.loseResponse=false;throw Error('response lost after commit');}
      }
      return new Response(JSON.stringify({state:remote,revision,savedAt:remote?'2026-11-15T12:00:00Z':null,backupDir:'D:\\Backups',recovered:io.recovered||false}));
    },
  });
  return {client,io,local:()=>stored,disk:()=>remote,sync:()=>sync,writes:()=>writes,otherTab:value=>{remote=value;revision='other';}};
}

test('empty browser restores the disk board instead of sample quests',async()=>{
  const h=harness({disk:board('My saved quests')});const loaded=await h.client.load();
  assert.equal(loaded.source,'disk');assert.equal(loaded.state.settings.boardName,'My saved quests');
  await h.client.save(loaded.state);assert.equal(h.local().settings.boardName,'My saved quests');
});
test('existing browser data migrates to the first disk backup',async()=>{
  const h=harness({local:board('Legacy')});const loaded=await h.client.load();
  await h.client.save(loaded.state);
  assert.equal(h.disk().settings.boardName,'Legacy');assert.equal(h.client.status().mode,'saved');
});
test('offline edits survive and retry uploads them using their original revision',async()=>{
  const h=harness({local:board('Before'),disk:board('Before')});
  // Use the same seed IDs in both stores.
  h.otherTab(h.local());await h.client.load();h.io.offline=true;
  await h.client.save({...h.local(),settings:{...h.local().settings,boardName:'Offline edit'}});
  assert.equal(h.client.status().mode,'browser-only');assert.equal(h.sync().pending,true);
  h.io.offline=false;await h.client.retry();
  assert.equal(h.disk().settings.boardName,'Offline edit');assert.equal(h.sync().pending,false);
});
test('stale tab cannot replace a newer disk board and keeps its local draft',async()=>{
  const original=board('Original'),h=harness({local:original,disk:original});await h.client.load();
  h.otherTab(board('Other tab'));
  await h.client.save({...original,settings:{...original.settings,boardName:'My draft'}});
  assert.equal(h.disk().settings.boardName,'Other tab');assert.equal(h.local().settings.boardName,'My draft');
  assert.equal(h.client.status().mode,'conflict');
});
test('startup preserves both divergent copies until a source is chosen',async()=>{
  const h=harness({local:board('Browser'),disk:board('File')});const loaded=await h.client.load();
  assert.ok(loaded.conflict);assert.equal(h.writes(),0);
  const chosen=h.client.resolveConflict('browser');await h.client.save(chosen);
  assert.equal(h.disk().settings.boardName,'Browser');
});
test('known unsynced edits are retained when disk still has their baseline',async()=>{
  const local=board('Unsynced'),h=harness({local,disk:board('Previous'),meta:{revision:'r1',pending:true,fingerprint:fingerprint(local)}});
  const loaded=await h.client.load();assert.equal(loaded.state.settings.boardName,'Unsynced');
  await h.client.save(loaded.state);assert.equal(h.disk().settings.boardName,'Unsynced');
});
test('a previously synced browser cache yields to a newer disk copy',async()=>{
  const local=board('Stale cache'),h=harness({local,disk:board('File'),meta:{revision:'old',pending:false,fingerprint:fingerprint(local)}});
  assert.equal((await h.client.load()).state.settings.boardName,'File');
});
test('missing browser plus unavailable backup never seeds or overwrites data',async()=>{
  const h=harness({offline:true});await assert.rejects(h.client.load());assert.equal(h.writes(),0);
});
test('disk save remains usable when browser storage rejects writes',async()=>{
  const h=harness({local:board('Local'),localFails:true});const loaded=await h.client.load();
  await h.client.save(loaded.state);assert.equal(h.client.status().mode,'file-only');
  assert.equal(h.disk().settings.boardName,'Local');
});
test('invalid snapshots are rejected without changing either copy',async()=>{
  const original=board('Original'),h=harness({local:original,disk:original});await h.client.load();
  await assert.rejects(h.client.save({version:1,items:'broken'}));
  assert.equal(serializeState(h.disk()),serializeState(original));assert.equal(h.writes(),0);
});
test('a lost response is reconciled without falsely reporting conflicting data',async()=>{
  const original=board('Original'),h=harness({local:original,disk:original});await h.client.load();
  h.io.loseResponse=true;await h.client.save({...original,settings:{...original.settings,boardName:'Saved before disconnect'}});
  assert.equal(h.client.status().mode,'browser-only');await h.client.retry();
  assert.equal(h.client.status().mode,'saved');assert.equal(h.sync().pending,false);
});
test('recovered older history cannot silently replace a newer browser copy',async()=>{
  const local=board('Newer browser'),h=harness({local,disk:board('Older recovered file'),meta:{revision:'latest',pending:false,fingerprint:fingerprint(local)}});
  h.io.recovered=true;
  assert.ok((await h.client.load()).conflict);assert.equal(h.local().settings.boardName,'Newer browser');
});
test('another tab acknowledgement cannot mark a different browser snapshot as synced',async()=>{
  const draft=board('Unsynced draft'),acknowledged=board('Acknowledged other tab');
  const h=harness({local:draft,disk:acknowledged,meta:{revision:'r1',pending:false,fingerprint:fingerprint(acknowledged)}});
  assert.ok((await h.client.load()).conflict);assert.equal(h.local().settings.boardName,'Unsynced draft');
});
test('slow disk upload does not block subsequent edits from reaching browser storage',async()=>{
  const original=board('Original'),h=harness({local:original,disk:original});await h.client.load();
  let release,started;h.io.holdPost=new Promise(r=>{release=r;});const waiting=new Promise(r=>{started=r;});h.io.postStarted=started;
  const first=h.client.save(original);await waiting;
  let saved;const localSaved=new Promise(r=>{saved=r;});h.io.localSaved=value=>{if(value.settings.boardName==='Newest edit')saved();};
  const second=h.client.save({...original,settings:{...original.settings,boardName:'Newest edit'}});
  let timer;await Promise.race([localSaved,new Promise(r=>{timer=setTimeout(r,1000);})]);clearTimeout(timer);
  try{assert.equal(h.local().settings.boardName,'Newest edit');assert.equal(h.sync().pending,true);}finally{release();await Promise.all([first,second]);}
  assert.equal(h.disk().settings.boardName,'Newest edit');assert.equal(h.sync().pending,false);
});
