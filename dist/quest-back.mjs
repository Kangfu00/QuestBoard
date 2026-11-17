import {normalizeQuestBack,uid} from './model.mjs';

/** An isolated editor draft. A rejected save remains dirty and can be retried. */
export function createBackEditor({quest,onSave,onStatus=()=>{},setTimeout=globalThis.setTimeout,clearTimeout=globalThis.clearTimeout}){
  let draft=normalizeQuestBack(quest),dirty=false,timer=null,disposed=false;
  const snapshot=()=>({notes:draft.notes,subquests:draft.subquests.map(task=>({...task}))});
  const status=(mode,error)=>{try{onStatus({mode,error});}catch{}};
  function flush(){
    if(timer!==null)clearTimeout(timer);timer=null;
    if(!dirty)return true;
    try{onSave(snapshot());dirty=false;status('saved');return true;}
    catch(error){status('error',error.message);return false;}
  }
  function change(next,immediate=false){
    if(disposed)return false;
    draft=normalizeQuestBack(next);dirty=true;status('pending');
    if(timer!==null)clearTimeout(timer);timer=null;
    if(immediate)return flush();
    timer=setTimeout(flush,220);return true;
  }
  return {
    snapshot,flush,
    notes(value){return change({...draft,notes:value});},
    add(text){const task={id:uid(),text,done:false};change({...draft,subquests:[...draft.subquests,task]},true);return task.id;},
    task(id,patch){if(!draft.subquests.some(task=>task.id===id))throw Error('ไม่พบเควสย่อย');return change({...draft,subquests:draft.subquests.map(task=>task.id===id?{...task,...patch,id}:task)});},
    remove(id){return change({...draft,subquests:draft.subquests.filter(task=>task.id!==id)},true);},
    dispose(){if(!flush())return false;disposed=true;return true;},
    get dirty(){return dirty;},
  };
}
