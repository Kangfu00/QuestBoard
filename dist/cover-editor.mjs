import {bindLeatherColorPicker,paintLeatherDye} from './leather-colors.mjs';

export function renderCoverEditorFields(fields,cover,{width,height}){
  return `<div class="cover-editor-grid">
    <div class="cover-editor-fields">${fields}</div>
    <figure class="cover-editor-preview">
      <figcaption>ตัวอย่างปก</figcaption>
      <div class="cover-editor-stage" style="--cover-width:${width}px;--cover-height:${height}px" inert aria-hidden="true">${cover}</div>
    </figure>
  </div>`;
}

export function bindCoverEditor(form){
  const cover=form.querySelector('.cover-editor-stage').firstElementChild;
  const isFolder=cover.classList.contains('board-folder');
  const name=isFolder?form.elements.name:form.elements.title;
  const headings=cover.querySelectorAll('.folder-title,.folder-tab > span,.daily-book-title');
  const prefix=isFolder?'folder':'book';
  let colorClass=`${prefix}-${form.querySelector('[data-leather-color]').value}`;

  for(const node of [cover,...cover.querySelectorAll('*')]){
    for(const {name} of [...node.attributes]){
      if(name==='id'||(name.startsWith('data-')&&name!=='data-leather-tone'))node.removeAttribute(name);
    }
  }
  for(const button of cover.querySelectorAll('button'))button.type='button';
  Object.assign(cover.style,{left:'0px',top:'0px',zIndex:'auto'});
  cover.style.setProperty('--rotation','0deg');

  function updateName(){
    const value=name.value.trim()||(isFolder?'แฟ้มหนัง':'สมุด');
    for(const heading of headings)heading.textContent=value;
  }
  name.addEventListener('input',updateName);
  updateName();

  bindLeatherColorPicker(form,color=>{
    cover.classList.remove(colorClass);
    colorClass=`${prefix}-${color}`;
    cover.classList.add(colorClass);
    paintLeatherDye(cover,color);
  });
}
