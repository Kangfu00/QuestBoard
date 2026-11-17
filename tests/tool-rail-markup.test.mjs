import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {STATUS} from '../dist/model.mjs';

const source=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');
const start=source.indexOf("$('#app').innerHTML=",source.indexOf('function shell('))+"$('#app').innerHTML=".length;
const end=source.indexOf("  $('#search')",start);
const html=vm.runInNewContext(source.slice(start,end).trim().replace(/;$/,''),{STATUS,icon:()=>'<svg></svg>'});
test('top tool rail holds the pen and three stamp tools while advanced controls live in one dedicated dialog',()=>{
  const rail=html.slice(html.indexOf('<aside class="quest-drawer top-tools"'),html.indexOf('<dialog id="tool-menu-dialog"'));
  const menu=html.slice(html.indexOf('<dialog id="tool-menu-dialog"'),html.indexOf('</dialog>',html.indexOf('<dialog id="tool-menu-dialog"')));
  assert.ok(rail.includes('data-action="new-quest"'));
  for(const status of ['done','failed','paused'])assert.ok(rail.includes(`data-pick-stamp="${status}"`));
  assert.ok(rail.includes('data-action="tool-menu"'));assert.ok(!rail.includes('id="search"'));
  for(const id of ['search','tool-stamp-style','tool-custom-stamp','sound-volume','save-indicator'])assert.ok(menu.includes(`id="${id}"`));
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(ids.length,new Set(ids).size,'each active control must have one ID/binding');
});
