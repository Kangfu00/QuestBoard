import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');

test('ambience startup routes real playback status to controls without initialization races',()=>{
  let notify;const shown=[],settings=[];
  const prefs={rain:true,tavern:true,volume:.3,rainVolume:1,tavernVolume:.8};
  const atmosphere={getSettings:()=>prefs,setAudioStatus:value=>shown.push({...value})};
  const context={document:{},window:{},atmosphere:null,reducedMotion:()=>false,sound:{getSettings:()=>({muted:false})},
    createGuildAmbience(options){assert.equal(typeof options.onStatus,'function');notify=options.onStatus;notify({rain:'off',tavern:'off'});return {setMuted(){},setSettings:value=>settings.push(value),getStatus:()=>({rain:'loading',tavern:'loading'})};},
    createDaypartAmbience(){return {setMuted(){},setSettings(){},setPhase(){},getStatus:()=>({soundscape:'off'})};},
    createDeskAtmosphere(options){options.onAudioChange(prefs);return atmosphere;}};
  vm.createContext(context);const start=source.indexOf('const ambience=createGuildAmbience('),end=source.indexOf('const deskWindows=',start);
  vm.runInContext(source.slice(start,end),context);
  assert.equal(context.atmosphere,atmosphere);assert.ok(settings.every(value=>value.tavernVolume===.8));
  assert.deepEqual(shown,[{rain:'loading',tavern:'loading'},{soundscape:'off'}]);
  notify({rain:'playing',tavern:'error'});assert.deepEqual(shown.at(-1),{rain:'playing',tavern:'error'});
});
