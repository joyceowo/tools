import {reportStoreKeys,reportStoreLabel} from './catalog.js';

const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function createStorePicker({getCatalog,getScope,onApply}){
 const $=id=>document.getElementById(id),button=$('store-scope'),dialog=$('store-scope-dialog');
 let draft=[],useDefault=false;
 function render(){
  const keys=reportStoreKeys(getCatalog(),getScope()),label=reportStoreLabel(keys),names=keys.join('、');
  button.innerHTML='<svg class="store-scope-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10h18l-2-6H5l-2 6Z M5 10v10h14V10 M9 20v-6h6v6 M8 4l-1 6 M16 4l1 6"/></svg><span class="store-scope-label">'+esc(label)+'</span><span class="store-scope-count" aria-hidden="true">'+keys.length+'</span>';button.title=names;button.setAttribute('aria-label','查看門市：'+(names||label));
 }
 function renderDraft(){
  const stores=getCatalog()?.stores||[],ordered=[...stores.filter(s=>!s.hiddenFromReports),...stores.filter(s=>s.hiddenFromReports)];
  $('store-scope-list').innerHTML=ordered.map((store,index)=>{
   const label=store.name,notes=[store.hiddenFromReports?'預設不選取':'',store.active?'':'已停用'].filter(Boolean).join(' · ');
   return `<div class="store-picker-row"><label><input type="checkbox" data-store-choice="${index}" value="${esc(store.name)}" ${draft.includes(store.name)?'checked':''}><span>${esc(label)}${notes?'<small>'+notes+'</small>':''}</span></label><button type="button" class="store-picker-only" data-store-only="${index}" aria-label="只看${esc(label)}">只看這間</button></div>`;
  }).join('')||'<p class="report-empty">尚無門市，請先到管理新增。</p>';
  validate();
 }
 function validate(){
  $('store-scope-apply').disabled=!draft.length;
  $('store-scope-error').hidden=!!draft.length;
 }
 function apply(scope){
  if(!reportStoreKeys(getCatalog(),scope).length)return;
  onApply(scope);dialog.close();
 }
 button.onclick=()=>{
  useDefault=getScope()==='*';draft=reportStoreKeys(getCatalog(),getScope());renderDraft();
  dialog.showModal();button.setAttribute('aria-expanded','true');
 };
 $('store-scope-list').onchange=()=>{
  draft=[...$('store-scope-list').querySelectorAll('input:checked')].map(input=>input.value);useDefault=false;validate();
 };
 $('store-scope-list').onclick=event=>{
  const only=event.target.closest('[data-store-only]');
  if(only)apply([$('store-scope-list').querySelector(`[data-store-choice="${only.dataset.storeOnly}"]`).value]);
 };
 $('store-scope-all').onclick=()=>{draft=(getCatalog()?.stores||[]).map(s=>s.name);useDefault=false;renderDraft();};
 $('store-scope-default').onclick=()=>{draft=reportStoreKeys(getCatalog());useDefault=true;renderDraft();};
 $('store-scope-apply').onclick=()=>apply(useDefault?'*':draft);
 $('store-scope-cancel').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{button.setAttribute('aria-expanded','false');button.focus({preventScroll:true});});
 return {render};
}
