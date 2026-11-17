import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {canvasLayout} from '../dist/interactions.mjs';
import {undockedFitHeight} from '../dist/tool-rail.mjs';
import {undockedFitWidth} from '../dist/storage-tray.mjs';

const source=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');
test('actual board resize keeps the held paper and its zoom while the dock divider moves',()=>{
  let inset=44,top=30;const cancellations=[];
  const viewport={get clientWidth(){return 1062-inset;},get clientHeight(){return 1000-top;},getBoundingClientRect:()=>({width:1062-inset,height:1000-top})};
  const page={},canvas={style:{}},size={style:{}},zoomLabel={};
  const nodes={'#board-scroll':viewport,'.desk-content':page,'#board-canvas':canvas,'#canvas-size':size,'.zoom-percent':zoomLabel};
  const context={canvasLayout,undockedFitWidth,undockedFitHeight,currentScale:.9,zoom:1,drag:{id:'held-paper'},storedDrag:null,state:{items:[]},canvasBounds:{},window:{innerWidth:1280},
    $:selector=>nodes[selector],paperEffects:{cancelAll(){}},getComputedStyle:element=>element===page?{paddingLeft:'20px',paddingRight:`${20+inset}px`,paddingTop:`${20+top}px`,paddingBottom:'20px'}:{borderLeftWidth:'0px',borderRightWidth:'0px',borderTopWidth:'0px',borderBottomWidth:'0px'},
    cancelDrag(){cancellations.push('board');},cancelStoredDrag(){cancellations.push('tray');},
  };
  vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function resizeBoard('),source.indexOf('function drawerTravel(')),context);
  for(const width of [44,100,200,350,500,350,100,44]){
    inset=width;top=width>200?144:30;context.resizeBoard();assert.equal(context.currentScale,.9);assert.equal(canvas.style.transform,'scale(0.9)');
  }
  context.drag=null;context.storedDrag={id:'stored-paper'};inset=500;context.resizeBoard();
  assert.deepEqual(cancellations,[]);
});
