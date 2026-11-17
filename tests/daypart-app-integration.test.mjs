import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');
const section=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a);return source.slice(a,b)};

test('audio bootstrap routes settings, initial clock and real status to independent manual/daypart players',()=>{
  const preferences={soundscape:'auto',soundscapeVolume:.7,rain:true,tavern:true,volume:.3},events=[],shown=[];let phase,status;
  const context={document:{},window:{},atmosphere:null,reducedMotion:()=>false,sound:{getSettings:()=>({muted:true})},
    createGuildAmbience:options=>({setMuted:value=>events.push(['manual-muted',value]),setSettings:value=>events.push(['manual',value]),getStatus:()=>({rain:'loading',tavern:'waiting'})}),
    createDaypartAmbience:options=>{status=options.onStatus;status({soundscape:'off'});return {setMuted:value=>events.push(['time-muted',value]),setSettings:value=>events.push(['time',value]),setPhase:value=>events.push(['phase',value]),getStatus:()=>({soundscape:'loading'})}},
    createDeskAtmosphere:options=>{phase=options.onPhaseChange;phase?.({phase:'night',time:'21:08'});options.onAudioChange(preferences);return {getSettings:()=>preferences,setAudioStatus:value=>shown.push({...value})}}};
  vm.createContext(context);vm.runInContext(section('const ambience=createGuildAmbience(','const deskWindows='),context);
  assert.ok(events.some(entry=>entry[0]==='time-muted'&&entry[1]===true));assert.ok(events.some(entry=>entry[0]==='time'&&entry[1]===preferences));
  assert.ok(events.some(entry=>entry[0]==='manual'&&entry[1]===preferences));assert.deepEqual(events.find(entry=>entry[0]==='phase'),['phase','night']);
  assert.equal(typeof phase,'function');phase({phase:'morning',time:'06:00'});assert.deepEqual(events.at(-1),['phase','morning']);
  assert.equal(typeof status,'function');status({soundscape:'playing'});assert.deepEqual(shown.at(-1),{soundscape:'playing'});
});

test('pointer and keyboard gestures unlock both ambient players with the desk sounds',()=>{
  const handlers=new Map(),calls=[];
  const context={document:{addEventListener:(type,fn)=>handlers.set(type,fn)},sound:{prime:()=>calls.push('desk')},ambience:{unlock:()=>calls.push('manual')},daypartAmbience:{unlock:()=>calls.push('time')}};
  vm.createContext(context);vm.runInContext(section("document.addEventListener('pointerdown',()=>{sound.prime()",'const $ ='),context);
  handlers.get('pointerdown')();handlers.get('keydown')();assert.deepEqual(calls,['desk','manual','time','desk','manual','time']);
});

test('global mute and unmute control time audio together with the existing ambience',()=>{
  let muted=false;const calls=[],button={};
  const context={$:()=>button,sound:{getSettings:()=>({muted}),setMuted:value=>{muted=value},play(){}},ambience:{setMuted:value=>calls.push(['manual',value]),unlock:()=>calls.push('manual-unlock')},daypartAmbience:{setMuted:value=>calls.push(['time',value]),unlock:()=>calls.push('time-unlock')},refreshSoundControls(){}};
  vm.createContext(context);vm.runInContext(section("$('#sound-toggle').onclick=", "$('#sound-volume').oninput="),context);
  button.onclick();button.onclick();assert.deepEqual(calls,[['manual',true],['time',true],['manual',false],['time',false],'manual-unlock','time-unlock']);
});
