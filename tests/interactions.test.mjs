import test from 'node:test';
import * as drawerInteractions from '../dist/interactions.mjs';
import assert from 'node:assert/strict';
import {PAPER} from '../dist/paper-format.mjs';

test('picking up a quest keeps an open folder drawer available and hovering switches storage',()=>{
  assert.equal(drawerInteractions.drawerForDraggedItem?.('quest','folder-drawer'),'folder-drawer');
  assert.equal(drawerInteractions.drawerForDraggedItem?.('quest','folder-drawer','quest-drawer'),'quest-drawer');
  assert.equal(drawerInteractions.drawerForDraggedItem?.('quest','quest-drawer','folder-drawer'),'folder-drawer');
});
test('whole folders route to their own drawer and cannot be dropped into the loose-paper tray',()=>{
  assert.equal(drawerInteractions.drawerForDraggedItem?.('folder','quest-drawer','quest-drawer'),'folder-drawer');
  assert.equal(drawerInteractions.storageTrayAccepts?.('folder','quest-drawer'),false);
  assert.equal(drawerInteractions.storageTrayAccepts?.('folder','folder-drawer'),true);
  assert.equal(drawerInteractions.storageTrayAccepts?.('quest','folder-drawer'),false);
  assert.equal(drawerInteractions.storageTrayAccepts?.('quest','quest-drawer'),true);
});
test('dragging papers does not open the tools drawer and labels do not enter storage',()=>{
  assert.equal(drawerInteractions.drawerForDraggedItem?.('quest','tool-drawer','tool-drawer'),'quest-drawer');
  assert.equal(drawerInteractions.drawerForDraggedItem?.('label','tool-drawer'),'tool-drawer');
  assert.equal(drawerInteractions.storageTrayAccepts?.('label','quest-drawer'),false);
});
import { dragPosition, containsPoint, drawerReveal, shouldOpenDrawer, rotatedOrigin } from '../dist/interactions.mjs';
import * as geometry from '../dist/interactions.mjs';
import { BOARD_LIMIT, createInitialState, updateItem, serializeState, parseState } from '../dist/model.mjs';

test('dragging at different zoom levels lands at the same board position', () => {
  const start = { x: 55, y: 85, pointerX: 200, pointerY: 300 };
  assert.deepEqual(dragPosition(start, { x: 250, y: 350 }, .5), { x:155, y:185 });
  assert.deepEqual(dragPosition(start, { x: 350, y: 450 }, 1.5), { x:155, y:185 });
});

test('a paper dropped outside the tray is not archived and edges count as inside', () => {
  const tray = { left:100, right:400, top:200, bottom:300 };
  assert.equal(containsPoint({x:250,y:250},tray),true);
  assert.equal(containsPoint({x:100,y:200},tray),true);
  assert.equal(containsPoint({x:99,y:250},tray),false);
  assert.equal(containsPoint({x:250,y:301},tray),false);
});

test('pulling left opens the drawer and pulling right closes it with bounded travel', () => {
  assert.equal(drawerReveal(0,700,500,332),200);
  assert.equal(drawerReveal(200,500,900,332),0);
  assert.equal(drawerReveal(100,700,0,332),332);
  assert.equal(shouldOpenDrawer(190,332),true);
  assert.equal(shouldOpenDrawer(30,332),false);
});

test('the drag ghost keeps the paper anchor when rotated and zoomed', () => {
  assert.deepEqual(rotatedOrigin({left:100,top:200,width:150,height:PAPER.height/2},PAPER.width,PAPER.height,0,.5),{x:100,y:200});
  const turned=rotatedOrigin({left:100,top:200,width:PAPER.height/2,height:150},PAPER.width,PAPER.height,90,.5);
  assert.ok(Math.abs(turned.x-312.1428571428571)<1e-8);
  assert.ok(Math.abs(turned.y-200)<1e-8);
});

test('scrolling the board during a drag preserves the pointer drop location', () => {
  const start={x:55,y:85,pointerX:200,pointerY:300};
  assert.deepEqual(dragPosition(start,{x:200,y:300},.5,{x:0,y:-120}),{x:55,y:325});
  assert.deepEqual(dragPosition(start,{x:220,y:310},1,{x:-80,y:-40}),{x:155,y:135});
});

test('a wide desk has usable canvas across the entire viewport at its fitted scale', () => {
  assert.equal(typeof geometry.canvasLayout,'function');
  const layout=geometry.canvasLayout({width:1280,height:720},[]);
  assert.equal(layout.scale,.72);
  assert.ok(Math.abs(layout.width-1777.777777777778)<1e-9);
  assert.equal(layout.height,1000);
  assert.ok(Math.abs(layout.width*layout.scale-1280)<1e-9);
  assert.ok(Math.abs(layout.height*layout.scale-720)<1e-9);
});

test('zoom changes paper scale while keeping the full viewport usable', () => {
  assert.equal(typeof geometry.canvasLayout,'function');
  const zoomedOut=geometry.canvasLayout({width:1280,height:720},[],.6);
  const zoomedIn=geometry.canvasLayout({width:1280,height:720},[],1.5);
  assert.ok(Math.abs(zoomedOut.scale-.432)<1e-12);
  assert.ok(Math.abs(zoomedIn.scale-1.08)<1e-12);
  assert.ok(Math.abs(zoomedOut.width-2962.962962962963)<1e-9);
  assert.ok(Math.abs(zoomedOut.height-1666.666666666667)<1e-9);
  assert.ok(Math.abs(zoomedIn.width-1185.185185185185)<1e-9);
  assert.equal(zoomedIn.height,1000);
  assert.ok(Math.abs(zoomedOut.width*zoomedOut.scale-1280)<1e-9);
  assert.ok(Math.abs(zoomedOut.height*zoomedOut.scale-720)<1e-9);
});

test('fractional canvas dimensions do not create a horizontal scrollbar on a fitted desk', () => {
  const layout=geometry.canvasLayout({width:996,height:720},[]);
  assert.ok(Math.abs(layout.width*layout.scale-996)<1e-9);
});

test('a narrow desk retains archived positions without shrinking the papers to fit them', () => {
  assert.equal(typeof geometry.canvasLayout,'function');
  const viewport={width:360,height:720};
  const empty=geometry.canvasLayout(viewport,[],1,true);
  const restoredSpace=geometry.canvasLayout(viewport,[{type:'quest',x:3500,y:2000,rotation:0,archived:true}],1,true);
  assert.equal(empty.scale,.85);
  assert.equal(restoredSpace.scale,empty.scale);
  assert.equal(restoredSpace.width,3824);
  assert.equal(restoredSpace.height,2000+PAPER.height+24);
});

test('desktop fit preserves readable minimum and maximum paper scales', () => {
  assert.equal(typeof geometry.canvasLayout,'function');
  assert.equal(geometry.canvasLayout({width:320,height:400},[]).scale,.65);
  assert.equal(geometry.canvasLayout({width:4000,height:3000},[]).scale,1.1);
});

test('rotated labels keep their bottom corners inside the computed canvas', () => {
  assert.equal(typeof geometry.canvasLayout,'function');
  const layout=geometry.canvasLayout({width:800,height:600},[{type:'label',x:2000,y:1500,rotation:90}]);
  assert.equal(layout.width,2174);
  assert.equal(layout.height,1674);
});

test('canvas expansion stops at the supported storage boundary', () => {
  assert.equal(typeof geometry.canvasLayout,'function');
  const layout=geometry.canvasLayout({width:1280,height:720},[{type:'quest',x:19700,y:19650,rotation:0}]);
  assert.equal(layout.width,20000);
  assert.equal(layout.height,20000);
});

test('a forty-five degree paper cannot lose its corners over the left or top wall', () => {
  assert.equal(typeof geometry.rotatedClampPosition,'function');
  const position=geometry.rotatedClampPosition(-500,-500,'quest',45,{width:1280,height:720});
  assert.ok(Math.abs(position.x-106.07367004398543)<1e-8);
  assert.ok(Math.abs(position.y-43.93081290112829)<1e-8);
});

test('a forty-five degree paper stops before its right or bottom corner crosses the wall', () => {
  assert.equal(typeof geometry.rotatedClampPosition,'function');
  const position=geometry.rotatedClampPosition(3000,3000,'quest',-45,{width:1280,height:720});
  assert.ok(Math.abs(position.x-873.9263299560146)<1e-8);
  assert.ok(Math.abs(position.y-251.78347281315743)<1e-8);
});

test('unrotated paper can reach both walls of an expanded canvas', () => {
  assert.equal(typeof geometry.rotatedClampPosition,'function');
  assert.deepEqual(geometry.rotatedClampPosition(-200,0,'quest',0,{width:1778,height:1000}),{x:0,y:0});
  assert.deepEqual(geometry.rotatedClampPosition(3000,2000,'quest',0,{width:1778,height:1000}),{x:1478,y:1000-PAPER.height});
});

test('turned labels use their own dimensions and preserve valid positions', () => {
  assert.equal(typeof geometry.rotatedClampPosition,'function');
  assert.deepEqual(geometry.rotatedClampPosition(3000,3000,'label',90,{width:1180,height:1000}),{x:950,y:850});
  assert.deepEqual(geometry.rotatedClampPosition(100,200,'label',90,{width:1180,height:1000}),{x:100,y:200});
});

test('turned papers and labels at the global limit retain their position through model backup', () => {
  let state=createInitialState();
  const expected={quest:{x:19637.85714285714,y:19575.714285714286},label:{x:19770,y:19850}};
  for(const type of ['quest','label']){
    const item=state.items.find(item=>item.type===type);
    const position=geometry.rotatedClampPosition(30000,30000,type,90,BOARD_LIMIT);
    assert.deepEqual(position,expected[type]);
    state=updateItem(state,item.id,{...position,rotation:90});
    const restored=parseState(serializeState(state)).items.find(restored=>restored.id===item.id);
    assert.deepEqual({x:restored.x,y:restored.y},position);
  }
});

test('scrollbars settle after archiving a paper near the fitted desk edge', () => {
  const outer={width:1200,height:1015};
  const items=[{type:'quest',x:860,y:495,rotation:1,archived:true}];
  let horizontal=false,vertical=false;
  const states=[];
  const scales=[];
  for(let pass=0;pass<8;pass++){
    const viewport={width:outer.width-(vertical?6:0),height:outer.height-(horizontal?6:0),fitWidth:outer.width,fitHeight:outer.height};
    const layout=geometry.canvasLayout(viewport,items);
    scales.push(layout.scale);
    horizontal=layout.width*layout.scale>viewport.width+.5;
    vertical=layout.height*layout.scale>viewport.height+.5;
    states.push([horizontal,vertical]);
  }
  assert.equal(new Set(scales).size,1,'paper scale must not depend on a scrollbar that it creates');
  assert.deepEqual(states.slice(-3),[[true,true],[true,true],[true,true]],'overflow must settle rather than toggle every observer delivery');
});

test('folder geometry uses its shorter cover instead of quest paper height', () => {
  assert.deepEqual(geometry.rotatedClampPosition(3000,3000,'folder',0,{width:1180,height:1000}),{x:880,y:790});
  const layout=geometry.canvasLayout({width:800,height:600},[{type:'folder',x:2000,y:1500,rotation:90}]);
  assert.equal(layout.width,2279);
  assert.equal(layout.height,1779);
});

test('stored drag anchors rotate the top grip around each item center', () => {
  assert.equal(typeof geometry.storedDragAnchor,'function');
  const cases=[
    ['quest',0,150,28],
    ['quest',45,280.20866299278,81.93419415007716],
    ['quest',90,334.1428571428571,212.14285714285714],
    ['folder',0,150,28],
    ['folder',45,204.44722215136417,50.55277784863584],
    ['folder',90,227,105],
  ];
  for(const [type,rotation,x,y] of cases){
    const anchor=geometry.storedDragAnchor(type,rotation);
    assert.ok(Math.abs(anchor.x-x)<1e-8,`${type} ${rotation} horizontal anchor`);
    assert.ok(Math.abs(anchor.y-y)<1e-8,`${type} ${rotation} vertical anchor`);
  }
});

test('extracted papers and folders keep the rotated grip under the pointer at reduced scale', () => {
  assert.equal(typeof geometry.storedDropPosition,'function');
  const origin={x:40,y:60},bounds={width:1600,height:1000};
  const cases=[
    ['quest',0,397.5,208.2],
    ['quest',45,482.135630945307,243.25722619755015],
    ['quest',90,517.1928571428571,327.8928571428571],
    ['folder',0,397.5,208.2],
    ['folder',45,432.8906943983867,222.8593056016133],
    ['folder',90,447.55,258.25],
  ];
  for(const [type,rotation,x,y] of cases){
    const position=geometry.storedDropPosition({x,y},origin,.65,type,rotation,bounds);
    assert.ok(Math.abs(position.x-400)<1e-8,`${type} ${rotation} horizontal drop`);
    assert.ok(Math.abs(position.y-200)<1e-8,`${type} ${rotation} vertical drop`);
  }
});

test('extracted rotated items clamp their corners when dropped past the left board edge', () => {
  assert.equal(typeof geometry.storedDropPosition,'function');
  const cases=[['quest',0,0],['quest',45,106.07367004398543],['quest',90,62.14285714285714],['folder',45,30.3122292025696]];
  for(const [type,rotation,wantX] of cases){
    const position=geometry.storedDropPosition({x:50,y:400},{x:40,y:60},.65,type,rotation,{width:1180,height:1000});
    assert.ok(Math.abs(position.x-wantX)<1e-8,`${type} ${rotation} left edge`);
  }
});
