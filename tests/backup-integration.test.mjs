import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {startQuestboardServer} from '../server.mjs';
import {createBackupClient} from '../dist/backup-client.mjs';
import {createInitialState,createFolder,moveQuestToFolder,setItemStatus,serializeState,updateItem} from '../dist/model.mjs';

test('real disk backup restores quests, folders and photo layouts after server restart and browser cache clearing',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'questboard-integration-'));
  assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));
  let server=await startQuestboardServer({backupDir:directory,port:0});
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});});
  let local=createInitialState(),sync=null;
  local.settings.boardName='Disposable integration board';
  const folder=createFolder({name:'Saved folder'},local);local.items.push(folder);
  const stampedQuest=local.items.find(item=>item.type==='quest').id;
  local=setItemStatus(local,stampedQuest,'paused',null,'seal',{x:221,y:144});
  const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0WQAAAAASUVORK5CYII=';
  const photoLayout={x:28,y:158,width:114,rotation:5};
  local=updateItem(local,stampedQuest,{imageDataUrl:photo,photoLayout,notes:'Remember the northern trail\nBring provisions.',subquests:[{id:'map',text:'Prepare the map',done:true},{id:'supplies',text:'Buy provisions',done:false}]});
  local=moveQuestToFolder(local,local.items[0].id,folder.id);
  local=updateItem(local,folder.id,{storagePosition:{x:544,y:288}});
  const original=serializeState(local);
  const client=()=>createBackupClient({
    request:(path,options)=>fetch(`http://127.0.0.1:${server.address().port}${path}`,options),
    readLocal:async()=>local,writeLocal:async value=>{local=structuredClone(value);},
    readSync:()=>sync,writeSync:value=>{sync=value;},
  });
  const first=client();await first.save((await first.load()).state);
  assert.equal(first.status().mode,'saved');
  assert.equal(serializeState(JSON.parse(await readFile(join(directory,'latest.json'),'utf8'))),original);
  server.closeAllConnections();await new Promise(r=>server.close(r));
  local=null;sync=null;
  server=await startQuestboardServer({backupDir:directory,port:0});
  const restored=client(),loaded=await restored.load();
  assert.equal(loaded.source,'disk');assert.equal(serializeState(loaded.state),original);
  assert.deepEqual(loaded.state.items.find(item=>item.id===stampedQuest).stampPosition,{x:221,y:144});
  assert.equal(loaded.state.items.find(item=>item.id===stampedQuest).imageDataUrl,photo);
  assert.deepEqual(loaded.state.items.find(item=>item.id===stampedQuest).photoLayout,photoLayout);
  assert.equal(loaded.state.items.find(item=>item.id===stampedQuest).notes,'Remember the northern trail\nBring provisions.');
  assert.deepEqual(loaded.state.items.find(item=>item.id===stampedQuest).subquests,[{id:'map',text:'Prepare the map',done:true},{id:'supplies',text:'Buy provisions',done:false}]);
  assert.deepEqual(loaded.state.items.find(item=>item.id===folder.id).storagePosition,{x:544,y:288});
  await restored.save(loaded.state);
  assert.equal(serializeState(local),original);assert.equal(restored.status().mode,'saved');
});
