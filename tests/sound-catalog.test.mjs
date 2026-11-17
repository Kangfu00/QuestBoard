import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DESK_SOUNDS} from '../dist/sound-catalog.mjs';

test('every desk recording is a bundled audio file with bounded playback settings',async()=>{
  const files=new Set();
  for(const recipe of Object.values(DESK_SOUNDS)){
    assert.ok(recipe.clips.length>0);
    assert.equal(new Set(recipe.clips).size,recipe.clips.length,'duplicate entries would defeat variation');
    assert.ok(recipe.gain>0&&recipe.gain<=1.5);
    assert.ok(recipe.rate[0]>=.75&&recipe.rate[1]<=1.35);
    for(const path of recipe.clips){
      assert.match(path,/^audio\/[a-z0-9-]+\/[\w-]+\.(ogg|wav|mp3)$/i);
      files.add(path);
    }
  }
  assert.ok(files.size>=25,'use a range of genuine recorded gestures');
  for(const path of files){
    const bytes=await readFile(new URL(`../dist/${path}`,import.meta.url));
    assert.ok(bytes.length>100);
    if(path.endsWith('.ogg'))assert.equal(bytes.toString('ascii',0,4),'OggS',path);
    if(path.endsWith('.wav'))assert.equal(bytes.toString('ascii',0,4),'RIFF',path);
  }
});

test('paper, leather and stamp contact do not share the same recordings',()=>{
  const paper=new Set(['paperPick','paperDrop','paperSlide','paperUnfold'].flatMap(name=>DESK_SOUNDS[name].clips));
  const leather=new Set(['folderPick','folderDrop','folderOpen','folderClose'].flatMap(name=>DESK_SOUNDS[name].clips));
  for(const path of leather)assert.ok(!paper.has(path),`leather/paper overlap: ${path}`);
  for(const path of DESK_SOUNDS.stamp.clips)assert.ok(!paper.has(path)&&!leather.has(path));
  for(const name of ['paperPick','paperDrop','paperSlide','folderPick','stamp','drawerOpen','drawerClose']){
    assert.ok(DESK_SOUNDS[name].clips.length>=2,`${name} needs recorded variants`);
  }
});
