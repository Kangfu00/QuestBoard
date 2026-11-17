import {dependencyInfo,wouldCreateDependencyCycle} from './quest-dependencies.mjs';

const esc=(value='')=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusLabels={active:'กำลังทำ',done:'สำเร็จแล้ว',paused:'พักไว้ก่อน',failed:'ไม่สำเร็จ'};
let nextPickerId=0;

/** A quiet ink caption; the model remains the authority on completion. */
export function dependencyMarkup(quest,items){
  if(!quest?.prerequisiteIds?.length)return '';
  const {prerequisites,pending,locked}=dependencyInfo(items,quest);
  const historical=quest.status==='done'&&pending.length>0;
  const label=historical?'บันทึกสำเร็จแล้ว':locked?`รอ ${pending.length} เควส`:quest.status==='done'?'เงื่อนไขครบ':'พร้อมเริ่ม';
  const waiting=pending.map(item=>item.title).join(' · ');
  const summary=historical?`บันทึกสำเร็จแล้ว · คงประวัติความสำเร็จไว้ · เงื่อนไขที่กลับมารอ: ${waiting}`:locked?`ต้องสำเร็จก่อน: ${waiting} · รอ ${pending.length} จาก ${prerequisites.length} เควส`:`ต้องสำเร็จก่อน: สำเร็จครบ ${prerequisites.length} เควส`;
  const shackle=locked?'<path d="M3.5 5V3.8a2.5 2.5 0 0 1 5 0V5"/>':'<path d="M3.5 5V3.8a2.5 2.5 0 0 1 4.7-1.2"/>';
  return `<span class="quest-dependency-badge ${locked?'is-locked':'is-ready'}" role="img" title="${esc(summary)}" aria-label="${esc(summary)}"><svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">${shackle}<rect x="2.5" y="5" width="7" height="5.5" rx="1"/><path d="M6 7v1.5"/></svg><span class="quest-dependency-label">${esc(label)}</span></span>`;
}

/** Search and selection belong to this editor; items are a read-only snapshot. */
export function createPrerequisitePicker({container,items,questId,selectedIds=[]}){
  const document=container.ownerDocument??globalThis.document;
  const scope=`quest-prerequisites-${++nextPickerId}`;
  const quests=items.filter(item=>item.type==='quest'&&item.id!==questId);
  const folders=new Map(items.filter(item=>item.type==='folder').map(item=>[item.id,item.name]));
  const cycles=new Set(quests.filter(item=>questId&&wouldCreateDependencyCycle(items,questId,item.id)).map(item=>item.id));
  const available=new Set(quests.filter(item=>!cycles.has(item.id)).map(item=>item.id));
  const selected=new Set(selectedIds.filter(id=>available.has(id)));
  let destroyed=false;
  const make=(tag,className,text)=>{
    const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;
  };
  const fieldset=make('fieldset','quest-prerequisite-picker');
  const legend=make('legend','quest-prerequisite-legend','ต้องสำเร็จก่อน');
  const helper=make('p','quest-prerequisite-help','เลือกได้หลายเควส · ทุกเควสที่เลือกต้องสำเร็จ จึงเริ่มเควสนี้ได้');
  helper.id=`${scope}-help`;fieldset.setAttribute('aria-describedby',helper.id);
  const searchLabel=make('label','quest-prerequisite-search-label','ค้นหาเควส');
  const search=make('input','quest-prerequisite-search');
  search.type='search';search.placeholder='ค้นหาชื่อหรือรายละเอียด…';search.autocomplete='off';
  searchLabel.append(search);
  const count=make('p','quest-prerequisite-count');
  count.setAttribute('aria-live','polite');count.setAttribute('aria-atomic','true');
  const list=make('div','quest-prerequisite-list');
  fieldset.append(legend,helper,searchLabel,count,list);container.append(fieldset);

  function updateCount(){count.textContent=selected.size?`เลือกแล้ว ${selected.size} เควส · ต้องสำเร็จทั้งหมด`:'ไม่เลือกเงื่อนไข · เริ่มเควสได้ทันที';}
  function render(){
    const query=search.value.trim().toLocaleLowerCase();
    const matches=quests.filter(item=>`${item.title??''}\n${item.description??''}`.toLocaleLowerCase().includes(query));
    list.replaceChildren();
    if(!matches.length){list.append(make('p','quest-prerequisite-empty',query?'ไม่พบเควสที่ค้นหา':'ยังไม่มีเควสอื่นให้เลือก'));return;}
    for(const item of matches){
      const blocked=cycles.has(item.id),row=make('label',`quest-prerequisite-option${blocked?' is-disabled':''}`);
      const input=make('input','quest-prerequisite-checkbox');input.type='checkbox';input.value=item.id;input.checked=selected.has(item.id);input.disabled=blocked;
      const copy=make('span','quest-prerequisite-copy');
      copy.append(make('span','quest-prerequisite-title',item.title));
      const location=item.folderId?`แฟ้ม: ${folders.get(item.folderId)??'แฟ้มเควส'}`:item.archived?'ลิ้นชัก':'';
      const details=[statusLabels[item.status]??item.status,location,item.archived&&item.folderId?'ลิ้นชัก':''].filter(Boolean).join(' · ');
      copy.append(make('small','quest-prerequisite-detail',details));
      if(blocked){
        const reason=make('small','quest-prerequisite-reason','เลือกไม่ได้ · จะทำให้เควสรอกันเป็นวง');
        reason.id=`${scope}-cycle-${quests.indexOf(item)}`;input.setAttribute('aria-describedby',reason.id);copy.append(reason);
      }
      row.append(input,copy);list.append(row);
    }
  }
  const change=event=>{
    const input=event.target;
    if(input.type!=='checkbox'||!available.has(input.value)||input.disabled)return;
    if(input.checked)selected.add(input.value);else selected.delete(input.value);
    updateCount();
  };
  search.addEventListener('input',render);list.addEventListener('change',change);updateCount();render();
  return {
    getSelectedIds:()=>[...selected],
    destroy(){
      if(destroyed)return;destroyed=true;
      search.removeEventListener('input',render);list.removeEventListener('change',change);fieldset.remove();
    }
  };
}
