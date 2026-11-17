const MAX_PREREQUISITES=499;

export function normalizePrerequisiteIds(value){
  if(value===undefined)return undefined;
  if(!Array.isArray(value)||value.length>MAX_PREREQUISITES)throw new Error(`เงื่อนไขภารกิจต้องเป็นรายการรหัสไม่เกิน ${MAX_PREREQUISITES} ภารกิจ`);
  const seen=new Set();
  return Array.from(value,raw=>{
    if(typeof raw!=='string')throw new Error('รหัสภารกิจเงื่อนไขต้องเป็นข้อความ');
    const id=raw.trim();
    if(!id||id.length>100||!/^[a-zA-Z0-9_-]+$/.test(id))throw new Error('รหัสภารกิจเงื่อนไขต้องมี 1–100 ตัวอักษรภาษาอังกฤษ ตัวเลข ขีดกลาง หรือขีดล่าง');
    if(seen.has(id))throw new Error('รหัสภารกิจเงื่อนไขซ้ำกัน');
    seen.add(id);return id;
  });
}

export function wouldCreateDependencyCycle(items,questId,prerequisiteId){
  if(questId===prerequisiteId)return true;
  const quests=new Map(items.filter(item=>item.type==='quest').map(item=>[item.id,item]));
  const visited=new Set(),remaining=[prerequisiteId];
  while(remaining.length){
    const id=remaining.pop();
    if(id===questId)return true;
    if(visited.has(id))continue;
    visited.add(id);
    remaining.push(...(quests.get(id)?.prerequisiteIds??[]));
  }
  return false;
}

export function validateDependencies(items){
  if(!Array.isArray(items))throw new Error('รายการภารกิจเงื่อนไขไม่ถูกต้อง');
  const all=new Map(items.map(item=>[item.id,item]));
  const edges=new Map();
  for(const quest of items){
    if(quest.type!=='quest')continue;
    const prerequisiteIds=normalizePrerequisiteIds(quest.prerequisiteIds)??[];
    for(const id of prerequisiteIds){
      if(id===quest.id)throw new Error(`ภารกิจ “${quest.title??quest.id}” ไม่สามารถรอภารกิจตัวเอง`);
      if(all.get(id)?.type!=='quest')throw new Error(`ไม่พบภารกิจเงื่อนไขที่อ้างถึง: ${id}`);
    }
    edges.set(quest.id,prerequisiteIds);
  }
  const active=new Set(),done=new Set();
  function visit(id){
    if(active.has(id))throw new Error('เงื่อนไขภารกิจเป็นวงจร กรุณาเลือกภารกิจที่ไม่รอกันวนไปมา');
    if(done.has(id))return;
    active.add(id);
    for(const prerequisiteId of edges.get(id)??[])visit(prerequisiteId);
    active.delete(id);done.add(id);
  }
  for(const id of edges.keys())visit(id);
  return items;
}

export function dependencyInfo(items,questOrId){
  const quest=typeof questOrId==='string'?items.find(item=>item.id===questOrId):questOrId;
  if(quest?.type!=='quest')return {prerequisites:[],pending:[],locked:false};
  const byId=new Map(items.filter(item=>item.type==='quest').map(item=>[item.id,item]));
  const prerequisites=(normalizePrerequisiteIds(quest.prerequisiteIds)??[]).map(id=>byId.get(id)).filter(Boolean);
  const pending=prerequisites.filter(prerequisite=>prerequisite.status!=='done');
  return {prerequisites,pending,locked:quest.status!=='done'&&pending.length>0};
}

export function newlyUnlockedQuestIds(beforeItems,afterItems){
  const before=new Map(beforeItems.filter(item=>item.type==='quest').map(item=>[item.id,item]));
  return afterItems.filter(quest=>quest.type==='quest'&&quest.status!=='done'&&before.has(quest.id)
    &&dependencyInfo(beforeItems,before.get(quest.id)).locked
    &&!dependencyInfo(afterItems,quest).locked).map(quest=>quest.id);
}
