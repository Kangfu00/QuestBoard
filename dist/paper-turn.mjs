/** Temporary curved paper strips. No quest data or permanent transforms owned here. */
export function createPaperTurn({document=globalThis.document,reducedMotion=()=>false,onCue=()=>{}}={}){
  let active=null;
  const cue=(name,signal,delay)=>{try{Promise.resolve(onCue(name,{signal,delay})).catch(()=>{});}catch{}};
  function cancel(){active?.finish(false);}
  function turn(scene,front,back,{from='front',to='back',onCommit=()=>{}}={}){
    cancel();
    if(from===to)return Promise.resolve(true);
    if(reducedMotion()||typeof scene?.animate!=='function'){try{onCommit(to);}catch{return Promise.resolve(false);}cue('paperSlide',undefined,0);return Promise.resolve(true);}
    return new Promise(resolve=>{
      const controller=new AbortController(),animations=[];let ghost,settled=false;
      const current={finish(completed){
        if(settled)return;settled=true;
        if(!completed)controller.abort();
        for(const animation of animations){try{animation.cancel();}catch{}}
        ghost?.remove();scene.classList.remove('paper-is-turning');
        if(active===current)active=null;
        let committed=completed;
        if(completed)try{onCommit(to);}catch{committed=false;}
        resolve(committed);
      }};
      active=current;
      try{
        ghost=document.createElement('div');ghost.className='paper-turn-ghost';ghost.inert=true;ghost.setAttribute('aria-hidden','true');
        const copy=source=>{
          const clone=source.cloneNode(true),originals=[source,...source.querySelectorAll('*')],copies=[clone,...clone.querySelectorAll('*')];
          copies.forEach((node,index)=>{
            for(const {name} of [...node.attributes])if(name==='id'||name==='name'||name==='autofocus'||name.startsWith('data-'))node.removeAttribute(name);
            if('value' in originals[index])node.value=originals[index].value;
            if('checked' in originals[index])node.checked=originals[index].checked;
          });
          // Scroll positions only take effect after attaching the visual copy.
          return {clone,restore(){originals.forEach((node,index)=>{copies[index].scrollTop=node.scrollTop;copies[index].scrollLeft=node.scrollLeft;});}};
        };
        const restorers=[];
        for(let index=0;index<5;index++){
          const strip=document.createElement('div');strip.className='paper-turn-strip';
          strip.style.transformOrigin=`${10+index*20}% 50%`;
          for(const source of [front,back]){
            const copied=copy(source),left=Math.max(0,index*20-.2),right=Math.max(0,80-index*20-.2);
            copied.clone.style.clipPath=source===front?`inset(-3px ${right}% -3px ${left}%)`:`inset(-3px ${left}% -3px ${right}%)`;
            strip.append(copied.clone);restorers.push(copied.restore);
          }
          ghost.append(strip);
        }
        scene.append(ghost);restorers.forEach(restore=>restore());scene.classList.add('paper-is-turning');
        const start=from==='front'?0:-180,end=to==='back'?-180:0,direction=to==='back'?-1:1;
        const animation=ghost.animate([
          {transform:`translateY(0) rotateZ(0deg) rotateY(${start}deg)`},
          {transform:`translateY(-15px) rotateZ(${direction*.9}deg) rotateY(${start+direction*18}deg)`,offset:.18},
          {transform:`translateY(-24px) rotateZ(${direction*.5}deg) rotateY(${start+direction*91}deg)`,offset:.52},
          {transform:`translateY(-6px) rotateZ(${-direction*.3}deg) rotateY(${end-direction*14}deg)`,offset:.86},
          {transform:`translateY(0) rotateZ(0deg) rotateY(${end}deg)`},
        ],{duration:780,easing:'cubic-bezier(.32,.05,.24,1)',fill:'both'});
        animations.push(animation);
        [...ghost.children].forEach((strip,index)=>{
          const bend=(index-2)*direction;
          animations.push(strip.animate([
            {transform:'translateZ(0) rotateY(0) skewY(0)'},
            {transform:`translateZ(${(4-Math.abs(index-2))*5}px) rotateY(${bend*2.4}deg) skewY(${bend*.45}deg)`,offset:.48},
            {transform:'translateZ(0) rotateY(0) skewY(0)'},
          ],{duration:780,easing:'ease-in-out',fill:'both'}));
        });
        cue('paperUnfold',controller.signal,0);cue('paperDrop',controller.signal,650);
        Promise.resolve(animation.finished).then(()=>current.finish(true),()=>current.finish(false));
      }catch{current.finish(true);}
    });
  }
  return {turn,cancel,get busy(){return !!active;}};
}
