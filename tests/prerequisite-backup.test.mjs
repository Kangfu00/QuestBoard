import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {startQuestboardServer} from '../server.mjs';
import {createQuest,parseState,serializeState,setItemStatus} from '../dist/model.mjs';
import {dependencyInfo,newlyUnlockedQuestIds} from '../dist/quest-dependencies.mjs';

async function closeServer(server){
  if(!server?.listening)return;
  server.closeAllConnections();
  await new Promise((resolveClose,reject)=>server.close(error=>error?reject(error):resolveClose()));
}

async function backupRequest(server,{method='GET',body}={}){
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/backup`,{
    method,body,signal:AbortSignal.timeout(5000),
    ...(method==='POST'?{headers:{'Content-Type':'application/json','X-Questboard-Backup':'1'}}:{}),
  });
  return {status:response.status,body:await response.json()};
}

test('prerequisite graphs and completion guards survive a disk backup restart while invalid uploads preserve the last good graph',{timeout:15000},async t=>{
  const directory=await mkdtemp(join(tmpdir(),'questboard-prerequisite-backup-'));
  assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));
  let server;
  t.after(async()=>{
    await closeServer(server);
    assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));
    await rm(directory,{recursive:true,force:true});
  });
  server=await startQuestboardServer({backupDir:directory,port:0});
  const post=(state,baseRevision)=>backupRequest(server,{method:'POST',body:JSON.stringify({state,baseRevision})});
  const initial={version:1,items:[],stamps:[],settings:{stampStyle:'seal',theme:'walnut',boardName:'Disposable prerequisite backup'}};
  for(const id of ['map','supplies'])initial.items.push({...createQuest({title:id},initial),id});
  initial.items.push({...createQuest({
    title:'Make camp',prerequisiteIds:['map','supplies'],notes:'Keep the route notes.',
    subquests:[{id:'tent',text:'Pitch the tent',done:false}],
  },initial),id:'camp',storagePosition:{x:140,y:280}});
  const original=serializeState(initial);
  assert.equal((await backupRequest(server)).body.state,null);
  const saved=await post(parseState(original),null);
  assert.equal(saved.status,200);
  assert.equal(serializeState(parseState(await readFile(join(directory,'latest.json'),'utf8'))),original);
  await closeServer(server);
  server=await startQuestboardServer({backupDir:directory,port:0});
  const restored=await backupRequest(server);
  assert.equal(restored.status,200);
  assert.equal(restored.body.revision,saved.body.revision);
  const loaded=parseState(JSON.stringify(restored.body.state));
  assert.equal(serializeState(loaded),original);
  assert.deepEqual(loaded.items[2].prerequisiteIds,['map','supplies']);
  assert.equal(Object.hasOwn(loaded.items[0],'prerequisiteIds'),false);
  assert.deepEqual(dependencyInfo(loaded.items,'camp').pending.map(quest=>quest.id),['map','supplies']);
  assert.throws(()=>setItemStatus(loaded,'camp','done'),/ก่อน|สำเร็จ/);
  const partial=setItemStatus(loaded,'map','done');
  assert.deepEqual(newlyUnlockedQuestIds(loaded.items,partial.items),[]);
  assert.throws(()=>setItemStatus(partial,'camp','done'),/ก่อน|สำเร็จ/);
  const ready=setItemStatus(partial,'supplies','done');
  assert.equal(dependencyInfo(ready.items,'camp').locked,false);
  assert.deepEqual(newlyUnlockedQuestIds(partial.items,ready.items),['camp']);
  assert.equal(setItemStatus(ready,'camp','done').items[2].status,'done');
  const readySave=await post(ready,restored.body.revision);
  assert.equal(readySave.status,200);
  assert.notEqual(readySave.body.revision,saved.body.revision);
  const goodBytes=await readFile(join(directory,'latest.json'));
  const goodHistory=await readdir(join(directory,'history'));
  assert.equal(goodHistory.length,1);
  const invalidGraphs=[
    {...ready,items:ready.items.map(quest=>quest.id==='camp'?{...quest,prerequisiteIds:'map'}:quest)},
    {...ready,items:ready.items.map(quest=>quest.id==='camp'?{...quest,prerequisiteIds:['missing']}:quest)},
    {...ready,items:ready.items.map(quest=>quest.id==='camp'?{...quest,prerequisiteIds:['map','map']}:quest)},
    {...ready,items:ready.items.map(quest=>quest.id==='map'?{...quest,prerequisiteIds:['camp']}:quest)},
  ];
  const bodies=[...invalidGraphs.map(state=>JSON.stringify({state,baseRevision:readySave.body.revision})),'{'];
  for(const body of bodies){
    const rejected=await backupRequest(server,{method:'POST',body});
    assert.equal(rejected.status,400);
    assert.equal(rejected.body.error,'invalid_backup');
    const current=await backupRequest(server);
    assert.equal(current.body.revision,readySave.body.revision);
    assert.equal(serializeState(current.body.state),serializeState(ready));
    assert.deepEqual(await readFile(join(directory,'latest.json')),goodBytes);
    assert.deepEqual(await readdir(join(directory,'history')),goodHistory);
  }
});
