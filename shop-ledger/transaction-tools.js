// Applied values remain separate from the filter sheet's draft until Apply is pressed.
export function setupTransactionTools({getRows,onChange}){
 const $=id=>document.getElementById(id),type=$('filter-type'),category=$('filter-category'),search=$('filter-search');
 const dialog=$('record-filter-dialog'),filterButton=$('record-filter-toggle'),searchButton=$('record-search-toggle');
 let draftType='all';
 function renderCategories(selected=''){
  const names=[...new Set(getRows().filter(row=>draftType==='all'||row.type===draftType).map(row=>row.category))].sort();
  $('record-filter-category').replaceChildren(new Option('全部分類',''),...names.map(name=>new Option(name,name,false,name===selected)));
  if(!names.includes(selected))$('record-filter-category').value='';
  $('record-filter-types').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.recordFilterType===draftType)));
 }
 function render(){
  const count=Number(type.value!=='all')+Number(Boolean(category.value));
  $('record-filter-count').hidden=!count;$('record-filter-count').textContent=count;
  filterButton.setAttribute('aria-label',count?'篩選明細，已套用 '+count+' 項條件':'篩選明細');
  const chips=[];
  if(type.value!=='all')chips.push({key:'type',text:type.value==='income'?'收入':'支出'});
  if(category.value)chips.push({key:'category',text:category.value});
  if(search.value.trim()&&$('record-search-panel').hidden)chips.push({key:'search',text:'搜尋：'+search.value.trim()});
  $('record-filter-chips').replaceChildren(...chips.map(({key,text})=>{
   const button=document.createElement('button');button.type='button';button.dataset.removeFilter=key;
   button.textContent=text+' ×';button.setAttribute('aria-label','移除'+text+'條件');return button;
  }));
  $('record-filter-chips').hidden=!chips.length;$('clear-filters').hidden=!chips.length;
  $('record-active-filters').hidden=!chips.length&&!$('record-active-filters').contains($('table-summary'));
  $('record-search-clear').hidden=!search.value;
 }
 function setSearchOpen(open,{focus=true}={}){
  $('record-search-panel').hidden=!open;searchButton.setAttribute('aria-expanded',String(open));render();
  if(open)$('record-search-panel').scrollIntoView({block:'start',behavior:'instant'});
  if(focus)(open?search:searchButton).focus({preventScroll:true});
 }
 searchButton.onclick=()=>setSearchOpen($('record-search-panel').hidden);
 $('record-search-close').onclick=()=>setSearchOpen(false);
 $('record-search-clear').onclick=()=>{search.value='';onChange();search.focus({preventScroll:true});};
 search.addEventListener('keydown',event=>{if(event.key==='Escape'||event.key==='Enter'){event.preventDefault();setSearchOpen(false);}});
 filterButton.onclick=()=>{
  draftType=type.value;renderCategories(category.value);
  dialog.showModal();filterButton.setAttribute('aria-expanded','true');
 };
 $('record-filter-types').onclick=event=>{
  const button=event.target.closest('[data-record-filter-type]');
  if(button){draftType=button.dataset.recordFilterType;renderCategories($('record-filter-category').value);}
 };
 $('record-filter-reset').onclick=()=>{draftType='all';renderCategories();};
 $('record-filter-cancel').onclick=()=>dialog.close();
 $('record-filter-apply').onclick=()=>{
  type.value=draftType;category.value=$('record-filter-category').value;dialog.close();onChange({resetScroll:true});
 };
 dialog.addEventListener('close',()=>{filterButton.setAttribute('aria-expanded','false');if(location.hash==='#transactions')filterButton.focus({preventScroll:true});});
 dialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const controls=[...dialog.querySelectorAll('button:not(:disabled),select:not(:disabled)')],first=controls[0],last=controls.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 });
 $('record-filter-chips').onclick=event=>{
  const button=event.target.closest('[data-remove-filter]');if(!button)return;
  const key=button.dataset.removeFilter;
  if(key==='type')type.value='all';else if(key==='category')category.value='';else search.value='';
  onChange();filterButton.focus({preventScroll:true});
 };
 return {render,close(){if(dialog.open)dialog.close();}};
}
