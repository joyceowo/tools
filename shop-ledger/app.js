import {setupCatalogSort} from './catalog-sort.js';
import {setupMobileShell} from './mobile-shell.js';
import {setupDiscardConfirmation} from './discard-confirmation.js';
import {setupRecordSwipe} from './record-swipe.js';
import {setupTransactionTools} from './transaction-tools.js';
import {setupTransactionPeriod} from './transaction-period.js';
import {annualWindow,assertEntryDate,assertAnnualSupport,yearAvailability} from './annual-window.js';
import {isStandalone,launchConnectionUrl,setupPwa} from './pwa.js';
import {comparisonTone} from './chart-design.js';
import {appStatusMessage} from './compact-report-ui.js';
import {periodLabel} from './period-display.js';
import { categories, sheetId, validDate, cents, validateRow, totals, shiftDay, taipeiDay, storeName, storeKey, storeLabel } from './ledger.js';
import { sendGoogle, assertGoogleReply, localRelayAvailable } from './connection.js';
import {createLedgerClient} from './ledger-client.js';
import {createLedgerCache} from './ledger-cache.js';
import {createShareLink,readConnectionLink,cleanConnectionUrl,isLocalShareLink,deploymentUrl,shareLedgerLink} from './share-link.js';
import {createReports} from './reports.js';
import {createBalanceCalendar} from './balance-calendar.js';
import {createDemoRows} from './demo.js';
import {createStorePicker} from './store-picker.js';
import {ensureCatalog,validateCatalog,editCatalog,catalogItems,moveCatalogItem,normalizeRows,resolveName,reportScope,reportStoreLabel} from './catalog.js';
import {checkedRange,presetRange,limitedReportPeriod,annualRange,rangeRows,previousRange,compareRanges} from './reporting.js';
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => new Intl.NumberFormat('zh-TW', {maximumFractionDigits:2}).format(value);
const overviewPercent = new Intl.NumberFormat('zh-TW', {maximumFractionDigits:0,signDisplay:'exceptZero'});
let today = taipeiDay();
const storage = { get(key, fallback = null) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }, set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { toast('此瀏覽器無法保存設定，關閉分頁前請保留連接連結。'); } }, remove(key) { try {localStorage.removeItem(key);} catch {} } };
let config = null, demo = true, rows = [], ready = true, page = 1, entryType = 'expense', editing = null, pendingDelete = null, busy = false, lastSync = null, syncFailed = false;
let pendingId = null, toastTimer, refreshBusy = false;
let shareConnection=null;
let catalogSnapshot='', catalogReturn=false, catalogScroll=0, pendingCatalog=null;
let activeDestination=null,activeScrollKey=null;
const pageScroll=new Map();
history.scrollRestoration='manual';
setupMobileShell();
const confirmDiscard = setupDiscardConfirmation();
const recordsMedia=window.matchMedia('(max-width:760px)');
setupRecordSwipe($('records-body'), recordsMedia);
let recordLimit=20;
let recordViewportAnchor=null,recordLayoutMobile=recordsMedia.matches,recordScrollFrame=null;
function rememberRecordAnchor(){
 if(activeDestination!=='transactions'||recordsMedia.matches!==recordLayoutMobile)return;
 const edge=Math.max(0,$('scope-panel').getBoundingClientRect().bottom);
 const node=[...$('records-body').querySelectorAll('[data-record-id]')].find(n=>n.getBoundingClientRect().bottom>edge);
 if(node)recordViewportAnchor={id:node.dataset.recordId,top:node.getBoundingClientRect().top};
}
window.addEventListener('scroll',()=>{
 if(recordScrollFrame!==null)return;
 recordScrollFrame=requestAnimationFrame(()=>{recordScrollFrame=null;rememberRecordAnchor();});
},{passive:true});
const restoreCatalogScroll=()=>requestAnimationFrame(()=>window.scrollTo({top:catalogScroll,behavior:'instant'}));
let storeScope='*',range=presetRange('month',today),catalog=null,catalogRevision=0,catalogSupported=false,catalogBusy=false,managementKind='stores',catalogEditing=null;
let normalizedSource=null,normalizedCatalog=null,normalizedRows=[],catalogSource=null,catalogInput=null,pickerCatalog=null,pickerRows=null;
let reportVisibilitySupported=false,reportSource=null,reportCatalog=null,reportStore=null,reportSelection=null;
let tableSource=null,tableContext='',tableRows=[];
const displayRows=()=>{
 if(normalizedSource!==rows||normalizedCatalog!==catalog){normalizedRows=normalizeRows(rows,catalog);normalizedSource=rows;normalizedCatalog=catalog;}
 return normalizedRows;
};
const reportData=()=>{
 const source=displayRows();
 if(reportSource!==source||reportCatalog!==catalog||reportStore!==storeScope){reportSelection=reportScope(source,catalog,storeScope);reportSource=source;reportCatalog=catalog;reportStore=storeScope;}
 return reportSelection;
};
const requestLedger=createLedgerClient();
const ledgerCache=createLedgerCache();
let annualCoverage=annualWindow(today);
const catalogKey=()=>demo?'jelly-catalog-demo-v1':'jelly-catalog-'+config?.sheet;
const pageTitles={overview:'總覽',transactions:'收支明細','entry-panel':'記一筆',annual:'經營報表',management:'管理'};
function navigate(hash,{resetScroll=false,state={}}={}){
 if(activeDestination==='entry-panel'&&hash!=='#entry-panel'&&!discardEntryEdit(()=>navigate(hash,{resetScroll,state})))return;
 const reportView=hash==='#annual'&&!reports.isHome()?reports.getView():null;
 if(location.hash!==hash)history.pushState({...state,reportView},'',hash);
 activateDestination(hash,{resetScroll});
}
function applyRange(next,preset='custom'){if(next.start<annualCoverage.startYear+'-01-01')throw Error('只能查詢 '+annualCoverage.startYear+'～'+annualCoverage.endYear+' 年資料。');range=checkedRange(next.start,next.end,today);$('range-preset').value=preset;$('range-start').value=range.start;$('range-end').value=range.end;showError('range-error','');render();}
function openRecords(next,category='',type='all'){applyRange(next);$('filter-type').value=type;$('filter-category').value=category;$('filter-search').value='';page=1;renderTable();navigate('#transactions',{resetScroll:true});}
function monthRange(month){const last=new Date(month+'-01T12:00:00Z');last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);return checkedRange(month+'-01',last.toISOString().slice(0,10),today);}
const scopedRows=()=>reportData().rows;
function selectStore(scope){storeScope=scope==='*'?'*':Array.isArray(scope)?[...scope]:[scope];render();}
const storePicker=createStorePicker({getCatalog:()=>catalog,getScope:()=>storeScope,onApply:selectStore});
function rememberReport(view){
 if(activeScrollKey)pageScroll.set(activeScrollKey,window.scrollY);
 activeScrollKey='annual:'+view;
 history.pushState({reportView:view,reportParent:true},'','#annual');
}
function returnToReportMenu(){
 if(history.state?.reportParent){history.back();return;}
 // A tab return can have another main page behind it; the header still leads to reports.
 history.replaceState({reportView:null},'','#annual');
 activateDestination('#annual',{fromHistory:true});
}
const reports=createReports({today,onNavigate:rememberReport,onBack:returnToReportMenu,onStore:selectStore,onContextChange:syncScope,getPeriod:()=>$('range-preset').value,onPeriod:value=>applyRange(presetRange(value,today),value),onLimitedPeriod:()=>{const next=limitedReportPeriod(range,today,$('range-preset').value);applyRange(next.range,next.value);},onRange:next=>openRecords(next),onMonth:month=>{try{openRecords(monthRange(month));}catch(e){toast(e.message);}},onCategory:(name,type,categoryRange=range)=>openRecords(categoryRange,name,type)});
const balanceCalendar=createBalanceCalendar({today});
const transactionTools=setupTransactionTools({getRows:displayRows,onChange:({resetScroll=false}={})=>{page=1;renderTable();if(resetScroll)window.scrollTo({top:0,behavior:'instant'});}});
const transactionPeriod=setupTransactionPeriod({getRange:()=>range,getToday:()=>today,getWindow:()=>annualCoverage,onApply:applyRange});
function renderStorePicker(currentStore=$('entry-store').value){
 const stores=catalog?.stores||[];
 const orderedStores=[...stores.filter(s=>!s.hiddenFromReports),...stores.filter(s=>s.hiddenFromReports)];
 const optionLabel=s=>(s.hiddenFromReports?'（隱藏）':'')+s.name+(s.active?'':'（已停用）');
 const current=resolveName(catalog,'stores',currentStore);
 const available=orderedStores.filter(s=>s.active||s.name===current);
 const placeholder=new Option(available.length?'請選擇門市':'請先新增或啟用門市','',false,!available.some(s=>s.name===current));placeholder.disabled=true;
 $('entry-store').replaceChildren(placeholder,...available.map(s=>new Option(optionLabel(s),s.name,false,s.name===current)));
 const selectedCategory=resolveName(catalog,'categories',$('entry-category').value,entryType);updateCategoryOptions(selectedCategory);
 const filter=$('filter-category').value,names=[...new Set(displayRows().map(r=>r.category))].sort();
 $('filter-category').replaceChildren(new Option('全部分類',''),...names.map(n=>new Option(n,n,false,n===filter)));
}
function updateCategoryOptions(selected=''){
 const options=(catalog?.categories||[]).filter(c=>c.type===entryType&&(c.active||c.name===selected));
 $('entry-category').replaceChildren(...options.map(c=>new Option(c.name+(c.active?'':'（已停用）'),c.name,false,c.name===selected)));
}
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 4500); }
function showError(id, message) { $(id).textContent = message; $(id).hidden = !message; }
function loadDemo(){
 const saved=storage.get('jelly-demo-records-v3');
 try{rows=saved?saved.map(validateRow):createDemoRows(today);rows=rows.map(r=>r.id.startsWith('demo-v3-')&&r.id.endsWith('-staff')?{...r,category:'人事'}:r);}
 catch{rows=createDemoRows(today);}
 rows=rows.filter(r=>Number(r.date.slice(0,4))>=annualCoverage.startYear&&Number(r.date.slice(0,4))<=annualCoverage.endYear);
 if(!saved){const previous=storage.get('jelly-demo-records-v1',[]);if(Array.isArray(previous))for(const candidate of previous)try{const row=validateRow(candidate);if(!row.id.startsWith('sample-')&&Number(row.date.slice(0,4))>=annualCoverage.startYear&&Number(row.date.slice(0,4))<=annualCoverage.endYear)rows.push(row);}catch{}}
}
async function request(connection, action, extra = {}) {
  const {data,rows:next}=await requestLedger(connection,action,extra);
  if(action==='list'||Number(data.version)>=4){catalog=ensureCatalog(data.catalog||null,next);catalogRevision=data.catalogRevision||0;catalogSupported=Number(data.version)>=4;reportVisibilitySupported=data.reportVisibility===true;}
  annualCoverage=data.window;
  await ledgerCache.write(connection,{rows:next,window:annualCoverage,catalog,catalogRevision,catalogSupported,reportVisibilitySupported});
  return next;
}
function draftKey() { return 'jelly-draft-v1-' + (demo ? 'demo' : config?.sheet); }
function getDraft() { return {date:$('entry-date').value,type:entryType,category:$('entry-category').value,amount:$('entry-amount').value,note:$('entry-note').value,store:$('entry-store').value,id:pendingId,editing}; }
function entryValues(){const {id,editing,...values}=getDraft();return values;}
function entryHasChanges(){
 if(!editing)return false;
 const original=editing.expectedRecord;
 const initial=editing.initialValues||(original?{date:original.date,type:original.type,category:resolveName(catalog,'categories',original.category,original.type),amount:String(original.amount),note:original.note||'',store:resolveName(catalog,'stores',original.store||'')}:null);
 return !initial||JSON.stringify(entryValues())!==JSON.stringify(initial);
}
function discardEntryEdit(onDiscard){
 if(!editing)return true;
 if(busy||refreshBusy)return false;
 if(entryHasChanges()){
  confirmDiscard('記錄',()=>{storage.remove(draftKey());resetEntry();onDiscard();});return false;
 }
 storage.remove(draftKey());resetEntry();return true;
}
function returnFromEntry(){
 const hasParent=history.state?.recordEdit;
 const leave=()=>{if(hasParent)history.back();else navigate('#transactions');};
 if(discardEntryEdit(leave))leave();
}
function storeDraft() { pendingId = pendingId || crypto.randomUUID(); storage.set(draftKey(), getDraft()); }
function setType(type) {
  const category=type===entryType?$('entry-category').value:'';
  entryType = type;
  document.querySelectorAll('[data-type]').forEach(b=>{b.classList.toggle('selected',b.dataset.type === type);b.setAttribute('aria-pressed',String(b.dataset.type === type));});
  updateCategoryOptions(category);updateEntryAction();
}
function resetEntry(restore = false) {
  const previousStore=$('entry-store').value,previousDate=$('entry-date').value,previousType=entryType,previousCategory=$('entry-category').value;
  $('entry-form').reset();setType(restore?'expense':previousType);$('entry-date').value=restore?today:(previousDate||today);renderStorePicker();
  $('entry-store').value=restore?(catalog?.stores.find(s=>s.id===catalog.defaultStore&&s.active)?.name||''):(previousStore||'');if(!restore)updateCategoryOptions(previousCategory);editing=null;pendingId=null;
  $('cancel-edit').hidden=true;$('entry-delete').hidden=true; showError('save-error','');
  if (restore) {
    const draft = storage.get(draftKey());
    if (draft && Object.hasOwn(categories,draft.type) && validDate(draft.date)) {
      setType(draft.type);const draftCategory=resolveName(catalog,'categories',draft.category,draft.type);updateCategoryOptions(draftCategory); $('entry-date').value=draft.date; $('entry-category').value=draftCategory; $('entry-amount').value=draft.amount; $('entry-note').value=draft.note || ''; if(Object.hasOwn(draft,'store'))renderStorePicker(draft.store||''); pendingId=draft.id; editing=draft.editing || null;
      try{assertEntryDate(draft.date,annualCoverage,editing?.originalYear??null);}catch(e){showError('save-error',e.message+' 草稿已保留。');}
      if(editing) { if(!Number.isInteger(editing.originalYear))showError('save-error','舊草稿缺少原年度資訊，請返回明細並重新開啟記錄。');$('entry-delete').hidden=false; }
    }
  }
  setBusy(false);
}
function updateDateBounds(){
 const field=$('entry-date'),year=Number.isInteger(editing?.originalYear)?editing.originalYear:null;field.min=(year??annualCoverage.startYear)+'-01-01';field.max=(year??annualCoverage.endYear)+'-12-31';
 $('entry-date-note').hidden=!editing;$('entry-date-note').textContent=editing?(year===null?'請重新開啟明細，確認原年度。':'日期限原年度 '+year+' 年內修改。'):'';
 for(const id of ['range-start','range-end']){$(id).min=annualCoverage.startYear+'-01-01';$(id).max=today;}
}
function updateEntryAction(){$('save-button').textContent=busy?'正在確認儲存…':editing?'✓ 儲存修改':entryType==='income'?'儲存收入':'儲存支出';}
function setBusy(value) { updateDateBounds();busy=value; $('entry-form').querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=value || (!demo&&(!ready||refreshBusy))); $('cancel-edit').disabled=value||refreshBusy;updateEntryAction();syncEntryHeading(); }
function syncEntryHeading(){
 const inEntry=location.hash==='#entry-panel';
 $('cancel-edit').hidden=!(inEntry&&editing);
 if(inEntry)$('page-title').textContent=editing?'修改記錄':pageTitles['entry-panel'];
}
function renderSyncState(){
  $('mode-badge').textContent=demo?'示範帳本':refreshBusy?'同步中':syncFailed?'同步失敗':ready?'已連接':'尚未連接';
  $('app-status').textContent=appStatusMessage({demo,ready,syncFailed:syncFailed&&!refreshBusy});$('app-status').hidden=!$('app-status').textContent;
  $('sync-label').textContent=demo?'示範帳本僅保存在此裝置':refreshBusy?'同步中':syncFailed?'上次更新失敗':lastSync?'已同步':'尚未同步';
}
function render() {
  updateDateBounds();
  if(catalogSource!==rows||catalogInput!==catalog){catalog=ensureCatalog(catalog,rows);catalogSource=rows;catalogInput=catalog;}
  if(pickerCatalog!==catalog||pickerRows!==rows){renderStorePicker();pickerCatalog=catalog;pickerRows=rows;}
  storePicker.render();
  const destination=pageTitles[location.hash.slice(1)]?location.hash:'#overview';
  renderSyncState();
  $('save-hint').textContent=demo?'示範資料僅存此裝置':'';$('save-hint').hidden=!demo;
  $('connected-tools').hidden=demo||!ready;
  $('ledger-share').hidden=!demo&&(!ready||!config?.api||!config?.key);
  if(shareConnection!==config){
    shareConnection=config;$('ledger-share-manual').hidden=true;$('ledger-share-url').value='';
  }
  $('range-start').value=range.start;$('range-end').value=range.end;$('range-context').textContent=periodLabel(range,today);
  syncScope();
  if(destination==='#overview'){
   const selected=scopedRows(),current=annualRange(Number(today.slice(0,4)),today),summary=totals(rangeRows(selected,current));
   const comparisons=compareRanges(selected,current,previousRange(current,'year'));
   for(const row of comparisons){
    const change=$(row.metric+'-change'),percent=row.percent;
    change.textContent=percent===null?'—':overviewPercent.format(percent)+'%';
    change.className='comparison-change '+comparisonTone(row.metric,percent);
    const reason=yearAvailability(annualCoverage,Number(today.slice(0,4)))||yearAvailability(annualCoverage,Number(today.slice(0,4))-1)||(!row.currentCount?'今年無記錄':!row.previousCount?'去年同期無記錄':row.previous===0?'去年同期為零，不計比例':row.previous<0?'去年同期為負值，不計比例':'');
    change.setAttribute('aria-label','較去年同期增減：'+(percent===null?reason:change.textContent));
   }
   $('overview-year-title').textContent=today.slice(0,4)+' 年累計';
   for(const key of ['income','expense','balance'])$(key+'-value').innerHTML=yearAvailability(annualCoverage,Number(today.slice(0,4)))?'—':money(summary[key]/100).split('.').map((part,i)=>'<span>'+(i?'.':'')+part+'</span>').join('');
   $('balance-value').classList.toggle('negative-amount',summary.balance<0);

   balanceCalendar.render({rows:selected,today,coverage:annualCoverage});
  }else if(destination==='#transactions')renderTable();
  else if(destination==='#annual')renderReports();
  else if(destination==='#management')renderManagement();
}
function renderReports(){
 const selection=reportData();reports.render({rows:selection.rows,store:'*',stores:selection.stores.map(s=>s.name),allStoreLabel:reportStoreLabel(selection.keys),range,demo,today,coverage:annualCoverage});
}
function syncScope(){
 syncEntryHeading();
 document.body.classList.toggle('transactions-page',location.hash==='#transactions');
 const inOverview=location.hash==='#overview'||!pageTitles[location.hash.slice(1)],inReports=location.hash==='#annual',home=inReports&&reports.isHome(),detail=inReports&&!home,view=reports.getView(),allStores=detail&&view==='stores',monthly=detail&&reports.getMonthlyMode();
 if(inReports)$('page-title').textContent=home?'經營報表':reports.getTitle();
 document.body.classList.toggle('annual-comparison-page',detail);
 document.body.classList.toggle('report-detail-page',detail);

 document.body.classList.toggle('category-report-page',detail&&view==='categories');
 document.body.classList.toggle('store-yoy-page',allStores&&reports.getStoreComparisonMode());
 const back=$('report-back'),heading=$('page-title'),backHome=document.querySelector('.report-detail-header');
 if(detail){if(back.parentElement!==heading.parentElement)heading.before(back);}else if(back.parentElement!==backHome)backHome.prepend(back);
 const storeSlot=$('header-store-slot');
 storeSlot.hidden=!(inOverview||inReports||location.hash==='#transactions');
 const panel=$('scope-panel'),filterHome=$('report-filters');
 const destination=$('report-filter-slot');
 if(inReports){if(panel.parentElement!==destination)destination.append(panel);}else if(panel.previousElementSibling!==$('scope-anchor'))$('scope-anchor').after(panel);
 filterHome.hidden=true;
 panel.hidden=inOverview||inReports||['#entry-panel','#management'].includes(location.hash);
 panel.classList.toggle('store-comparison-scope',allStores);
 panel.classList.toggle('overview-scope',inOverview);
 const limited=detail&&reports.hasLimitedPeriod(),preset=$('range-preset'),oldPreset=preset.value;
 const choices=limited?[['month','本月'],['year','今年'],['lastyear','去年']]:[['today','今日'],['week','近 7 天'],['month','本月'],['year','今年'],['lastyear','去年'],['custom','自訂日期']];
 if([...preset.options].map(o=>o.value).join('|')!==choices.map(c=>c[0]).join('|'))preset.replaceChildren(...choices.map(([value,label])=>new Option(label,value,false,value===oldPreset)));
 const matches=value=>{if(value==='custom')return true;if(!choices.some(c=>c[0]===value))return false;const candidate=presetRange(value,today);return candidate.start===range.start&&candidate.end===range.end;};
 if(limited)preset.value=limitedReportPeriod(range,today,$('range-preset').value).value;
 else preset.value=matches(oldPreset)?oldPreset:'custom';
 const inTransactions=location.hash==='#transactions';
 transactionPeriod.render(inTransactions);
 $('range-preset').closest('label').hidden=inOverview||monthly||inTransactions;
 const custom=$('range-preset').value==='custom'&&!inOverview&&!monthly;
 $('range-details').hidden=!custom||inTransactions;$('range-details').toggleAttribute('data-custom',custom);
 $('scope-period-context').hidden=true;
 $('scope-period-context').textContent='';
 if($('compact-range-context'))$('compact-range-context').hidden=true;
 $('report-store-note').hidden=true;$('range-context').textContent=periodLabel(range,today);
}

function renderTable({append=false}={}) {
  const summary=$('table-summary');
  const expanded=new Set([...$('records-body').querySelectorAll('tr[data-record-id]:has(details[open])')].map(n=>n.dataset.recordId));
  const type=$('filter-type').value,category=$('filter-category').value,search=$('filter-search').value.trim().toLowerCase();
  const source=reportData().rows,context=JSON.stringify([storeScope,range.start,range.end,type,category,search]);
  if(tableContext!==context){
   page=1;recordLimit=20;recordViewportAnchor=null;pageScroll.set('transactions',0);append=false;
   if(activeDestination==='transactions')window.scrollTo({top:0,behavior:'instant'});
  }
  if(tableSource!==source||tableContext!==context){
   tableRows=rangeRows(source,range).filter(r=>(type==='all'||r.type===type)&&(!category||r.category===category)&&(!search||(r.category+' '+r.note+' '+storeLabel(storeKey(r))).toLowerCase().includes(search))).sort((a,b)=>b.date.localeCompare(a.date)||b.updatedAt.localeCompare(a.updatedAt));
   tableSource=source;tableContext=context;
  }
  const filtered=tableRows;
  const pages=Math.max(1,Math.ceil(filtered.length/20));page=Math.min(page,pages);
  $('row-count').textContent=filtered.length;
  const mobile=recordsMedia.matches,start=mobile?0:(page-1)*20,end=Math.min(filtered.length,mobile?recordLimit:page*20);
  summary.textContent=(mobile?'查詢共 ':'共 ')+filtered.length+' 筆';
  $('page-label').textContent=page+' / '+pages;$('prev-page').disabled=page<=1;$('next-page').disabled=page>=pages;
  $('records-pagination').hidden=mobile||!filtered.length;
  $('records-page-range').textContent='第 '+(start+1)+'–'+end+' 筆';
  $('records-more').hidden=!mobile||!filtered.length;
  $('records-progress').textContent=end<filtered.length?'已顯示 '+end+'／'+filtered.length+' 筆':'已顯示全部 '+filtered.length+' 筆';
  $('records-load-more').hidden=end>=filtered.length;
  const existing=append?$('records-body').querySelectorAll('[data-record-id]').length:0;
  let previousDate=existing?filtered[existing-1]?.date:null;
  const markup=filtered.slice(append?existing:start,end).map(r=>{
    const store=storeLabel(storeKey(r)),label=escapeHtml(r.date+' '+store+' '+r.category);
    const storeMarkup=`<span class="record-store">${escapeHtml(store)}</span>`;
    const note=r.note?`<details class="record-note"><summary class="category-note" aria-label="${label}，完整備註">${mobile?storeMarkup+'<span class="record-meta-separator" aria-hidden="true">·</span>':''}<span class="record-note-preview">${escapeHtml(r.note)}</span>${mobile?'<span class="record-note-toggle" aria-hidden="true">⌄</span>':''}</summary><p class="record-full-note">${escapeHtml(r.note)}</p></details>`:'';
    const heading=r.date!==previousDate?`<tr class="record-date-heading"><th colspan="5"><time datetime="${escapeHtml(r.date)}">${escapeHtml(r.date.replaceAll('-','/'))}</time></th></tr>`:'';previousDate=r.date;
    return heading+`<tr data-record-id="${escapeHtml(r.id)}"><td class="record-meta"><time datetime="${escapeHtml(r.date)}">${escapeHtml(r.date)}</time>${mobile?(note||storeMarkup):storeMarkup}</td>
      <td><div class="category-cell"><div class="category-name"><button type="button" class="record-category" data-open-record="${escapeHtml(r.id)}" aria-label="查看或修改 ${label}">${escapeHtml(r.category)}</button>${mobile?'':note}</div></div></td>
      <td class="record-type"><span class="type-tag ${r.type==='expense'?'expense-tag':''}">${r.type==='income'?'收入':'支出'}</span></td>
      <td class="amount-cell ${r.type}-amount">${r.type==='income'?'+':'−'} ${money(r.amount)}</td>
      <td><div class="record-actions"><button type="button" class="row-action" data-edit="${escapeHtml(r.id)}" aria-label="修改 ${label}">修改</button><button type="button" class="row-action" data-delete="${escapeHtml(r.id)}" aria-label="刪除 ${label}">刪除</button></div></td></tr>`;
  }).join('');
  // Keep the single live count node when replacing a date heading that contains it.
  if(!append)$('record-active-filters').append(summary);
  if(append)$('records-body').insertAdjacentHTML('beforeend',markup);
  else $('records-body').innerHTML=filtered.length?markup:'<tr><td class="empty-cell" colspan="5">'+(!demo&&!ready?'連接試算表後，就能看到你的帳本。':'本期間沒有符合條件的記錄。<br><button type="button" id="records-adjust-period" class="text-button">調整期間</button>')+'</td></tr>';
  if(mobile&&filtered.length)$('records-body').querySelector('.record-date-heading th').append(summary);
  transactionTools.render();
  if(!append)for(const node of $('records-body').querySelectorAll('tr[data-record-id]'))if(expanded.has(node.dataset.recordId)&&node.querySelector('details'))node.querySelector('details').open=true;
  requestAnimationFrame(rememberRecordAnchor);
}
// Yield a paint so even local saves show feedback without an artificial delay.
const feedbackPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
async function refresh({background=false}={}) {
  if(busy||refreshBusy||catalogBusy)return;
  const nextDay=taipeiDay();
  if(nextDay.slice(0,4)!==today.slice(0,4)){
    today=nextDay;annualCoverage=annualWindow(today);rows=demo?rows.filter(r=>Number(r.date.slice(0,4))>=annualCoverage.startYear&&Number(r.date.slice(0,4))<=annualCoverage.endYear):[];
    if(!demo)ready=false;range=presetRange('month',today);
    if(editing||$('entry-amount').value)try{assertEntryDate($('entry-date').value,annualCoverage,editing?.originalYear??null);}catch(e){showError('save-error',e.message+' 草稿已保留。');}
  }else today=nextDay;
  if(!demo&&!config?.api){openSettings();return;}
  refreshBusy=true;
  const button=$('refresh-button'),label=button.textContent;
  button.disabled=true;button.textContent='整理中…';showError('refresh-error','');
  const finishLoading=background?()=>{}:window.appLoading.start('正在重新整理帳本…');
  renderSyncState();setBusy(false);renderManagement();
  try {
    await feedbackPaint();
    if(!demo){rows=await request(config,'list');ready=true;syncFailed=false;lastSync=Date.now();}
    render();if(!background)toast(demo?'示範帳本已重新整理':'帳本已更新');
  }catch(e){
    if(!demo)syncFailed=true;
    render();showError('refresh-error','更新失敗：'+e.message);if(!background)toast('更新失敗，保留原有資料。');
  }finally{
    refreshBusy=false;button.disabled=false;button.textContent=label;renderSyncState();setBusy(false);renderManagement();finishLoading();
  }
}
function openSettings() {
  if(busy||refreshBusy){toast('請稍候，目前正在與試算表同步。');return;}
  const draft=storage.get('jelly-connection-draft-v1');
  const values=config?.api?config:(draft&&(!config?.sheet||draft.sheet===config.sheet)?draft:config);
  $('settings-share-link').value='';$('settings-sheet').value=values?.sheet||'';$('settings-api').value=values?.api||'';$('settings-key').value=values?.key||'';showError('settings-error','');$('share-result').hidden=true;$('share-url').value='';$('share-local-note').hidden=!isLocalShareLink(location.href);updateProbeLink();$('settings-dialog').showModal();
}
async function mutate(action, record, expectedUpdatedAt, originalYear, expectedRecord) {
  if(demo){
    const stamp=new Date().toISOString();
    if(action==='create'){if(!rows.some(r=>r.id===record.id))rows.push({...record,updatedAt:stamp});}
    if(action==='update')rows=rows.map(r=>r.id===record.id?{...record,updatedAt:stamp}:r);
    if(action==='delete')rows=rows.filter(r=>r.id!==record.id);
    rows=rows.slice();storage.set('jelly-demo-records-v3',rows);
  }else{rows=await request(config,action,{record,expectedUpdatedAt,originalYear,expectedRecord});lastSync=Date.now();syncFailed=false;}
  render();
}
document.querySelectorAll('.settings-trigger').forEach(b=>b.addEventListener('click',openSettings));
$('close-settings').onclick=()=>$('settings-dialog').close();
$('settings-import-link').onclick=()=>{
  if(busy||refreshBusy)return;
  try{
    const href=new URL($('settings-share-link').value.trim());
    if(new URL('./',href).href!==new URL('./',location.href).href)throw Error('請貼上這個記帳網站產生的分享連結。');
    const value=readConnectionLink(href.href);
    if(!value?.api||!value?.key)throw Error('請貼上完整的記帳分享連結，需包含部署 ID 與連接設定。');
    $('settings-sheet').value=value.sheet;$('settings-api').value=value.api;$('settings-key').value=value.key;
    $('settings-share-link').value='';rememberConnectionDraft();updateProbeLink();showError('settings-error','');
    $('connect-button').focus();toast('已帶入連接設定，請按「連接並載入帳本」。');
  }catch(e){showError('settings-error',e.message);}
};
$('toggle-key').onclick=()=>{const hide=$('settings-key').type==='password';$('settings-key').type=hide?'text':'password';$('toggle-key').textContent=hide?'隱藏':'顯示';};
document.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>{setType(b.dataset.type);pendingId=null;storeDraft();});
function activateDestination(hash,{fromHistory=false,resetScroll=false}={}){
 const id=hash.slice(1),destination=pageTitles[id]?id:'overview';
 if(activeScrollKey)pageScroll.set(activeScrollKey,window.scrollY);
 catalogSorter.cancel();transactionTools.close();transactionPeriod.close();
 $('transaction-tools').hidden=destination!=='transactions';
 if(destination==='annual'&&fromHistory)reports.restoreView(history.state?.reportView||null);
 activeDestination=destination;
 activeScrollKey=destination==='annual'?'annual:'+(reports.isHome()?'menu':reports.getView()):destination;
 document.querySelectorAll('[data-page]').forEach(el=>el.hidden=el.id!==destination);
 document.querySelectorAll('nav a').forEach(a=>{const active=a.hash==='#'+destination;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 if(destination==='annual'&&reports.hasLimitedPeriod()){
  const next=limitedReportPeriod(range,today,$('range-preset').value);
  if(next.range.start!==range.start||next.range.end!==range.end){range=next.range;$('range-preset').value=next.value;$('range-start').value=range.start;$('range-end').value=range.end;}
 }
 $('page-title').textContent=pageTitles[destination];$('scope-panel').hidden=['entry-panel','management'].includes(destination);
 render();window.scrollTo({top:resetScroll?0:(pageScroll.get(activeScrollKey)||0),behavior:'instant'});
 if(fromHistory)$('page-title').focus({preventScroll:true});
}
window.addEventListener('hashchange',()=>{if(activeDestination!==location.hash.slice(1))activateDestination(location.hash,{fromHistory:true});});
window.addEventListener('popstate',()=>{
 if(catalogReturn){catalogReturn=false;restoreCatalogScroll();return;}
 if($('catalog-dialog').open){
  if(!closeCatalogEditor())history.pushState({...history.state,catalogEditor:true},'',location.href);
  return;
 }
 if(activeDestination==='entry-panel'&&editing&&location.hash!=='#entry-panel'&&!discardEntryEdit(()=>history.back())){
  // Keep the edit entry and its parent while the discard decision is pending.
  history.pushState({recordEdit:true},'','#entry-panel');return;
 }
 activateDestination(location.hash,{fromHistory:true});
});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&activeDestination==='entry-panel'&&editing&&!document.querySelector('dialog[open]')){event.preventDefault();returnFromEntry();}
});
window.addEventListener('beforeunload',event=>{if(activeDestination==='entry-panel'&&entryHasChanges()){event.preventDefault();event.returnValue='';}});
document.addEventListener('click',event=>{const link=event.target.closest('a[href^="#"]');if(link&&Object.hasOwn(pageTitles,link.hash.slice(1))){event.preventDefault();navigate(link.hash);}});
window.addEventListener('load',()=>window.scrollTo({top:0,behavior:'instant'}));
window.addEventListener('resize',()=>{if(location.hash==='#annual')renderReports();});
$('range-preset').onchange=()=>{const preset=$('range-preset').value;if(preset==='custom'){$('range-details').open=true;syncScope();}else{$('range-details').open=false;applyRange(presetRange(preset,today),preset);}};
$('range-apply').onclick=()=>{try{applyRange({start:$('range-start').value,end:$('range-end').value});$('range-details').open=true;}catch(e){showError('range-error',e.message);}};
['filter-type','filter-category','filter-search'].forEach(id=>$(id).addEventListener('input',()=>{page=1;renderTable();}));
$('clear-filters').onclick=()=>{$('filter-category').value='';$('filter-type').value='all';$('filter-search').value='';page=1;renderTable();};
function turnRecordsPage(step){page+=step;renderTable();$('records-start').scrollIntoView({block:'start',behavior:'instant'});$('records-body').querySelector('[data-open-record]')?.focus({preventScroll:true});}
$('prev-page').onclick=()=>turnRecordsPage(-1);$('next-page').onclick=()=>turnRecordsPage(1);$('refresh-button').onclick=refresh;
$('records-load-more').onclick=()=>{
 const top=window.scrollY,previous=$('records-body').querySelectorAll('[data-record-id]').length;
 recordLimit+=20;renderTable({append:true});window.scrollTo({top,behavior:'instant'});
 $('records-body').querySelectorAll('[data-open-record]')[previous]?.focus({preventScroll:true});
};
recordsMedia.addEventListener('change',()=>{
 if(location.hash!=='#transactions'){
  const index=tableRows.findIndex(r=>r.id===recordViewportAnchor?.id);
  if(recordsMedia.matches)recordLimit=Math.max(recordLimit,page*20);else if(index>=0)page=Math.floor(index/20)+1;
  recordLayoutMobile=recordsMedia.matches;return;
 }
 const nodes=[...$('records-body').querySelectorAll('[data-record-id]')],saved=recordViewportAnchor,anchor=nodes.find(n=>n.dataset.recordId===saved?.id)||nodes.find(n=>n.getBoundingClientRect().bottom>Math.max(0,$('scope-panel').getBoundingClientRect().bottom))||nodes[0];
 const index=tableRows.findIndex(r=>r.id===anchor?.dataset.recordId),top=saved?.id===anchor?.dataset.recordId?saved.top:anchor?.getBoundingClientRect().top;
 if(recordsMedia.matches)recordLimit=Math.max(recordLimit,page*20);else if(index>=0)page=Math.floor(index/20)+1;
 recordLayoutMobile=recordsMedia.matches;
 renderTable();const next=[...$('records-body').querySelectorAll('[data-record-id]')].find(n=>n.dataset.recordId===anchor?.dataset.recordId);
 if(next&&top!==undefined)window.scrollBy({top:next.getBoundingClientRect().top-top,behavior:'instant'});
});
$('entry-form').addEventListener('input',()=>{pendingId=null;storeDraft();});
$('entry-form').addEventListener('submit',async e=>{
  e.preventDefault();if(busy||refreshBusy||(!demo&&!ready))return;
  let finishLoading=()=>{},saving=false;
  try{
    if(taipeiDay().slice(0,4)!==today.slice(0,4))throw Error('年度已切換，請先重新整理帳本；輸入內容已保留。');
    assertEntryDate($('entry-date').value,annualCoverage,editing?.originalYear??null);
    if(editing&&!editing.expectedRecord)throw Error('舊草稿缺少原記錄資訊，請返回明細並重新開啟記錄。');
    const record={id:editing?.id||pendingId||crypto.randomUUID(),date:$('entry-date').value,type:entryType,category:$('entry-category').value,amount:cents($('entry-amount').value)/100,note:$('entry-note').value.trim(),store:storeName($('entry-store').value)};
    if(!record.store)throw Error('請選擇門市；尚無啟用門市時，請先到管理新增或啟用。');
    if(!editing&&(!catalog.stores.some(x=>x.name===record.store&&x.active)||!catalog.categories.some(x=>x.name===record.category&&x.type===record.type&&x.active)))throw Error('請選擇啟用中的門市與分類。');
    pendingId=record.id;storeDraft();showError('save-error','');setBusy(true);saving=true;
    finishLoading=window.appLoading.start('正在儲存記錄…');
    await feedbackPaint();
    await mutate(editing?'update':'create',record,editing?.updatedAt,editing?.originalYear,editing?.expectedRecord);
    const returnToRecords=Boolean(editing);
    storage.remove(draftKey());resetEntry();if(returnToRecords)returnFromEntry();toast(demo?'已儲存（示範帳本）':'記錄已儲存');
  }catch(err){showError('save-error',(saving?'儲存未完成：':'')+err.message);if(saving)toast('儲存未完成，輸入內容已保留。');}finally{setBusy(false);finishLoading();}
});
$('cancel-edit').onclick=returnFromEntry;
$('records-body').addEventListener('click',e=>{
 if(e.target.closest('#records-adjust-period')){$('record-period-toggle').click();return;}
  if(busy||refreshBusy)return;
  const del=e.target.closest('[data-delete]');
  const edit=e.target.closest('[data-edit],[data-open-record]')||(!e.target.closest('button,a,summary,details')&&e.target.closest('[data-record-id]'));
  if(!del&&!edit)return;
  const editId=edit?.dataset?.edit||edit?.dataset?.openRecord||edit?.dataset?.recordId;
  if(edit){
    const r=displayRows().find(r=>r.id===editId);if(!r)return;
    editing={id:r.id,updatedAt:r.updatedAt,originalYear:Number(r.date.slice(0,4)),expectedRecord:{...rows.find(raw=>raw.id===r.id)}};pendingId=r.id;setType(r.type);updateCategoryOptions(r.category);$('entry-date').value=r.date;$('entry-category').value=r.category;$('entry-amount').value=r.amount;$('entry-note').value=r.note;renderStorePicker(r.store||'');
    editing.initialValues=entryValues();$('entry-delete').hidden=false;updateEntryAction();showError('save-error','');updateDateBounds();storeDraft();navigate('#entry-panel',{resetScroll:true,state:{recordEdit:true}});$('page-title').focus({preventScroll:true});
  }
  if(del)openDelete(del.dataset.delete);
});
function openDelete(id){
 pendingDelete=rows.find(r=>r.id===id);if(!pendingDelete)return;
 $('delete-description').textContent=pendingDelete.date+' · '+pendingDelete.category+' · NT$ '+money(pendingDelete.amount);showError('delete-error','');$('delete-dialog').showModal();
}
$('entry-delete').onclick=()=>{if(editing&&!busy&&!refreshBusy)openDelete(editing.id);};
$('cancel-delete').onclick=()=>$('delete-dialog').close();
$('confirm-delete').onclick=async()=>{
  if(busy||!pendingDelete)return;setBusy(true);$('confirm-delete').disabled=true;$('cancel-delete').disabled=true;
  const preventClose=e=>e.preventDefault();$('delete-dialog').addEventListener('cancel',preventClose);
  try{await mutate('delete',{id:pendingDelete.id},pendingDelete.updatedAt,Number(pendingDelete.date.slice(0,4)),pendingDelete);if(editing?.id===pendingDelete.id){storage.remove(draftKey());resetEntry();}$('delete-dialog').close();if(location.hash==='#entry-panel')navigate('#transactions');toast(demo?'已刪除示範記錄':'Google 試算表已確認刪除');}catch(e){showError('delete-error',e.message);}finally{setBusy(false);$('confirm-delete').disabled=false;$('cancel-delete').disabled=false;$('delete-dialog').removeEventListener('cancel',preventClose);}
};
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const diagnosticsPanel=document.createElement('section');
diagnosticsPanel.className='connection-diagnostics';
diagnosticsPanel.innerHTML=`<div class="diagnostic-actions"><button type="button" id="diagnose-button" class="button secondary small">檢查連線（不寫入資料）</button><a id="probe-link" class="text-button" target="_blank" rel="noopener noreferrer" hidden>開啟部署測試頁 ↗</a></div><p class="muted">先檢查部署網址，再核對 ID、密碼與表格權限。檢查不會新增或刪除帳目。</p><ol id="diagnostic-results" aria-live="polite" hidden></ol><button type="button" id="copy-diagnostic" class="text-button" hidden>複製診斷結果（隱藏 ID 與密碼）</button><details class="diagnostic-help"><summary>如何判讀部署測試頁？</summary><p>請用無痕視窗開啟部署網址。新版程式應顯示 service: jelly-ledger 與 version: 5；舊版會顯示「請由日日果凍網站連接」，兩者都表示網址有回覆。若要求 Google 登入，請檢查是否部署為「我／所有人」。</p><p>更新程式後：Apps Script「部署 → 管理部署 → 編輯（鉛筆）→ 版本：新版本 → 部署」。只按儲存不會更新 /exec。</p></details>`;
$('settings-error').before(diagnosticsPanel);
function rememberConnectionDraft(){storage.set('jelly-connection-draft-v1',{sheet:$('settings-sheet').value.trim(),api:$('settings-api').value.trim(),key:$('settings-key').value.trim()});}
function updateProbeLink(){try{$('probe-link').href=deploymentUrl($('settings-api').value);$('probe-link').hidden=false;}catch{$('probe-link').hidden=true;$('probe-link').removeAttribute('href');}}
function settingsConnection(){
  const candidate={sheet:sheetId($('settings-sheet').value),api:deploymentUrl($('settings-api').value),key:$('settings-key').value.trim()};
  if(!/^[\w-]{24,128}$/.test(candidate.key))throw new Error('連接密碼至少需要 24 個英數字元。請填入已部署程式 LEDGER_ACCESS_KEY 的值。');
  return candidate;
}
let diagnosticLines=[];
function diagnosticLine(message,kind='pending'){
  const item=document.createElement('li');item.dataset.kind=kind;item.textContent=message;$('diagnostic-results').append(item);$('diagnostic-results').hidden=false;
  diagnosticLines.push(message);$('copy-diagnostic').hidden=false;
}
function safeDiagnostic(text){
  let id='';try{id=sheetId($('settings-sheet').value);}catch{}
  for(const value of [$('settings-key').value.trim(),$('settings-api').value.trim(),$('settings-sheet').value.trim(),id])if(value)text=text.replaceAll(value,'[已隱藏]');
  return text.replace(/https?:\/\/[^\s<>"']+/g,'[網址已隱藏]');
}
['settings-sheet','settings-api','settings-key'].forEach(id=>$(id).addEventListener('input',()=>{rememberConnectionDraft();updateProbeLink();$('diagnostic-results').hidden=true;$('copy-diagnostic').hidden=true;}));
$('diagnose-button').onclick=async()=>{
  if(busy||refreshBusy)return;
  diagnosticLines=[];$('diagnostic-results').replaceChildren();$('copy-diagnostic').hidden=true;showError('settings-error','');
  let candidate;
  try{candidate=settingsConnection();}catch(e){diagnosticLine(e.message,'error');return;}
  rememberConnectionDraft();updateProbeLink();refreshBusy=true;$('diagnose-button').disabled=true;$('connect-button').disabled=true;$('demo-button').disabled=true;$('download-script').disabled=true;
  ['settings-sheet','settings-api','settings-key'].forEach(id=>$(id).disabled=true);
  try{
    diagnosticLine('網址、ID 與密碼格式：通過。','ok');
    diagnosticLine(await localRelayAvailable()?'連線方式：使用本機伺服器，可取得 Google 的 HTTP 狀態。':'連線方式：瀏覽器直連；Google 若阻擋跨來源存取，瀏覽器可能隱藏真正原因。','info');
    const health=await sendGoogle(candidate,'health');
    const legacy=health.data.error==='請由日日果凍網站連接；此網址不直接顯示帳本。';
    if(!legacy&&health.data.ok!==true)assertGoogleReply(health.data);
    if(!legacy&&!(health.data.service==='jelly-ledger'&&health.data.ok===true))throw new ConnectionError('WRONG_SCRIPT');
    diagnosticLine(legacy?'部署網址：可存取，連接程式為舊版 v1。':'部署網址：可存取，已收到日日果凍程式回覆（v'+health.data.version+'）。','ok');
    const {data}=await sendGoogle(candidate,'diagnose');
    if(legacy&&data.ok===false&&data.error==='不支援的操作。'){
      diagnosticLine('舊版程式已接受 ID 與密碼，但不支援完整診斷。請保留相同密碼，重新下載 Code.gs 並部署新版本，以檢查表格權限與欄位。','info');
    }else{
      assertGoogleReply(data);
      if(data.service!=='jelly-ledger'||!data.diagnostic)throw new ConnectionError('WRONG_SCRIPT');
      diagnosticLine('試算表 ID 與連接密碼：通過。','ok');
      diagnosticLine('部署帳號可開啟試算表：通過。','ok');
      assertAnnualSupport(data);
      for(const item of data.window.years)diagnosticLine(item.year+' 年：'+(item.status==='ready'?'連線正常。':'尚無記錄。'),'ok');
      diagnosticLine(Number(data.version)>=3&&data.diagnostic.stores===true?'多門市記帳：支援 v3 門市欄。':'目前為舊版連接程式，可讀取既有帳本；帶門市記帳前請下載 Code.gs v4 並部署新版本。',Number(data.version)>=3?'ok':'info');
      diagnosticLine(Number(data.version)>=4?'門市／分類管理：支援 v4 同步。':'門市與分類管理需更新至 Code.gs v4。',Number(data.version)>=4?'ok':'info');
      diagnosticLine('年度分頁 v5：僅讀近三年；舊帳由使用者手動整理，本次檢查未寫入。','ok');
      diagnosticLine('檢查完成，可以按「連接並載入帳本」。','ok');
    }
  }catch(e){diagnosticLine(safeDiagnostic(e.message),'error');}
  finally{refreshBusy=false;$('diagnose-button').disabled=false;$('connect-button').disabled=false;$('demo-button').disabled=false;$('download-script').disabled=false;['settings-sheet','settings-api','settings-key'].forEach(id=>$(id).disabled=false);}
};
$('copy-diagnostic').onclick=async()=>{try{await navigator.clipboard.writeText(safeDiagnostic('日日果凍連線診斷\n'+diagnosticLines.join('\n')));toast('已複製診斷結果，不包含網址、ID 或連接密碼。');}catch{toast('無法使用剪貼簿，請直接複製畫面上的錯誤代碼。');}};
$('download-script').onclick=async()=>{
  try{
    const id=sheetId($('settings-sheet').value);let key=$('settings-key').value.trim();if(!/^[\w-]{24,128}$/.test(key))key=crypto.randomUUID()+crypto.randomUUID().slice(0,8);$('settings-key').value=key;
    const response=await fetch('Code.gs');if(!response.ok)throw new Error('無法下載連接程式，請重新整理後再試。');
    download((await response.text()).replaceAll('__SHEET_ID__',id).replaceAll('__ACCESS_KEY__',key),'Code.gs','text/plain;charset=utf-8');rememberConnectionDraft();showError('settings-error','');toast('連接程式已下載，連接密碼已保存在此裝置。');
  }catch(e){showError('settings-error',e.message);}
};
$('settings-form').onsubmit=async e=>{
  e.preventDefault();if(busy||refreshBusy)return;
  const button=$('connect-button');button.disabled=true;button.textContent='正在確認連接…';
  refreshBusy=true;$('close-settings').disabled=true;$('demo-button').disabled=true;$('diagnose-button').disabled=true;
  const preventClose=event=>event.preventDefault();$('settings-dialog').addEventListener('cancel',preventClose);
  let candidate;
  try{
    candidate=settingsConnection();rememberConnectionDraft();
    const nextRows=await request(candidate,'list');
    config=candidate;demo=false;ready=true;storeScope='*';rows=nextRows;lastSync=Date.now();syncFailed=false;page=1;recordLimit=20;tableContext='';
    storage.set('jelly-connection-'+config.sheet,config);storage.set('jelly-pwa-sheet',config.sheet);const url=new URL(location.href);url.searchParams.set('sheet',config.sheet);url.searchParams.delete('api');url.hash='overview';history.replaceState(null,'',url);resetEntry(true);activateDestination('#overview');$('settings-dialog').close();toast('已連接 Google 試算表，可以開始記帳！');
  }catch(err){showError('settings-error',err.message+'\n輸入內容已保留，可按「檢查連線」取得逐項結果。');}finally{refreshBusy=false;button.disabled=false;button.textContent='連接並載入帳本 →';$('close-settings').disabled=false;$('demo-button').disabled=false;$('diagnose-button').disabled=false;$('settings-dialog').removeEventListener('cancel',preventClose);}
};
$('demo-button').onclick=()=>{
  if(busy||refreshBusy)return;storage.remove('jelly-pwa-sheet');annualCoverage=annualWindow(today);demo=true;ready=true;config=null;storeScope='*';reportVisibilitySupported=false;page=1;recordLimit=20;tableContext='';lastSync=null;syncFailed=false;loadDemo();catalog=ensureCatalog(storage.get('jelly-catalog-demo-v1'),rows);catalogSupported=true;const url=new URL(location.href);url.search='';url.hash='overview';history.replaceState(null,'',url);resetEntry(true);activateDestination('#overview');$('settings-dialog').close();toast('已開啟示範帳本，記錄僅保存在此裝置。');
};
$('copy-link').onclick=async()=>{
  if(!config?.api)return;
  const button=$('copy-link');button.disabled=true;showError('settings-error','');
  try{
    const url=createShareLink(config,location.href),local=isLocalShareLink(url);
    $('share-url').value=url;$('share-result').hidden=false;
    try{await navigator.clipboard.writeText(url);$('share-status').textContent=local?'已複製本機測試連結；跨裝置請從公開網站產生。':'已複製，可貼給要共用帳本的人。';toast($('share-status').textContent);}
    catch{$('share-status').textContent='連結已產生，請選取下方網址手動複製。';$('share-url').focus();$('share-url').select();}
  }catch(e){showError('settings-error',e.message);}finally{button.disabled=false;}
};
$('share-url').onclick=()=>$('share-url').select();
$('share-ledger').onclick=async()=>{
  if(!demo&&(!ready||!config?.api||!config?.key))return;
  const button=$('share-ledger'),connection=config,sharingDemo=demo;
  if(button.disabled)return;
  if(isLocalShareLink(location.href)){toast('目前是本機網址，請在正式網站開啟帳本後再分享。');return;}
  button.disabled=true;$('ledger-share-manual').hidden=true;$('ledger-share-url').value='';
  try{
    const demoUrl=new URL(location.href);demoUrl.search='';demoUrl.hash='';
    const url=sharingDemo?demoUrl.href:createShareLink(connection,location.href),result=await shareLedgerLink(url);
    if(config!==connection||demo!==sharingDemo)return;
    if(result==='copied')toast(sharingDemo?'已複製示範帳本連結，可貼給對方。':'已複製帳本連結，可貼給對方。');
    if(result==='manual'){
      $('ledger-share-url').value=url;$('ledger-share-manual').hidden=false;
      $('ledger-share-url').focus();$('ledger-share-url').select();
    }
  }catch{toast('無法產生分享連結，請檢查帳本連接設定。');}
  finally{button.disabled=false;}
};
$('ledger-share-url').onclick=()=>$('ledger-share-url').select();
async function init(){
  $('year').textContent=today.slice(0,4);
  const originalUrl=location.href,cleanUrl=cleanConnectionUrl(originalUrl);let initialError='';
  if(cleanUrl!==originalUrl)history.replaceState(null,'',cleanUrl);
  try{
    config=readConnectionLink(launchConnectionUrl(originalUrl,isStandalone(),storage.get('jelly-pwa-sheet')),id=>storage.get('jelly-connection-'+id));
    if(config){demo=false;ready=false;const url=new URL(location.href);url.searchParams.set('sheet',config.sheet);history.replaceState(null,'',url);}
  }catch(e){initialError=e.message;config=null;}
  const cached=!demo&&config?.api&&config.key?await ledgerCache.read(config,annualCoverage):null;
  if(cached){
   rows=cached.rows;annualCoverage=cached.window;catalog=cached.catalog;catalogRevision=cached.catalogRevision;catalogSupported=cached.catalogSupported;reportVisibilitySupported=cached.reportVisibilitySupported;ready=true;
  }else if(demo){loadDemo();catalog=ensureCatalog(storage.get('jelly-catalog-demo-v1'),rows);catalogSupported=true;}
  else catalog=ensureCatalog(null,[]);
  resetEntry(true);render();
  activateDestination(location.hash,{fromHistory:true});
  if(initialError){openSettings();showError('settings-error',initialError);}
  else if(!demo){
   if(config.api&&config.key){
    const synchronize=async()=>{
     await refresh({background:!!cached});
     if(ready){storage.set('jelly-connection-'+config.sheet,config);storage.set('jelly-pwa-sheet',config.sheet);if(!cached)resetEntry(true);render();}else openSettings();
    };
    if(cached)void synchronize();else await synchronize();
   }else openSettings();
  }
}

function renderManagement(){
 const locked=catalogBusy||busy||refreshBusy;
 $('catalog-status').textContent=!demo&&!catalogSupported?'管理門市與分類前，請先更新連接程式。':'';$('catalog-status').hidden=!$('catalog-status').textContent;
 $('catalog-add-button').textContent=managementKind==='stores'?'＋ 新增門市':'＋ 新增分類';
 $('management-tabs').querySelectorAll('button').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.manage===managementKind));b.disabled=locked;});
 $('catalog-list').setAttribute('aria-busy',String(catalogBusy));
 $('catalog-list').innerHTML=catalogItems(pendingCatalog||catalog,managementKind).map(item=>`<article class="catalog-row" data-sort-id="${item.id}" data-sort-group="${managementKind==='categories'?item.type:'stores'}"><button type="button" class="catalog-item" data-catalog-edit="${item.id}" aria-label="編輯${escapeHtml(item.name)}"><span class="catalog-identity">${managementKind==='categories'?`<span class="type-tag ${item.type==='expense'?'expense-tag':''}">${item.type==='income'?'收入':'支出'}</span>`:''}<strong>${escapeHtml(item.name)}</strong><small>${!item.active?'已停用':catalog.defaultStore===item.id?'預設記帳':'啟用中'}${item.hiddenFromReports?' · 報表預設排除':''}</small></span><span class="catalog-chevron" aria-hidden="true">›</span></button><button type="button" class="catalog-sort-handle" data-sort-handle="${item.id}" aria-label="拖拉排序${escapeHtml(item.name)}，亦可使用上下方向鍵"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg></button></article>`).join('')||`<p class="report-empty">尚無${managementKind==='stores'?'門市':'分類'}，點上方新增。</p>`;
 $('catalog-add-button').disabled=locked;
 $('catalog-list').querySelectorAll('button').forEach(el=>el.disabled=locked);
 if($('catalog-dialog').open){
  $('catalog-edit-form').querySelectorAll('input,select,button').forEach(el=>el.disabled=locked);
  $('catalog-edit-type').disabled=locked||!!catalogEditing?.id;
  $('catalog-edit-default').disabled=locked||!$('catalog-edit-active').checked;
 }
}
const catalogSorter=setupCatalogSort({
 list:$('catalog-list'),isLocked:()=>catalogBusy||busy||refreshBusy,
 onCancel:renderManagement,onError:error=>showError('catalog-error','排序未儲存，已恢復原順序。'+error.message),
 onMove:async(id,position)=>{
  const list=catalogItems(catalog,managementKind),index=list.findIndex(item=>item.id===id);
  if(index<0||position===index)return;
  const item=list[index],next=moveCatalogItem(catalog,managementKind,id,position);
  showError('catalog-error','');
  await saveCatalog(next,{optimistic:true,message:item.name+'已移至第 '+(position+1)+' 位'});
 }
});
async function saveCatalog(next,{optimistic=false,message='管理設定已儲存，歷史帳目保留。'}={}){
 if(busy||refreshBusy||catalogBusy)throw Error('帳本正在同步，請稍候。');
 const clean=validateCatalog(next);pendingCatalog=optimistic?clean:null;catalogBusy=true;setBusy(true);
 $('catalog-sort-status').textContent=optimistic?'正在儲存順序…':'';$('catalog-sort-status').hidden=!optimistic;renderManagement();
 try{
  if(demo){storage.set(catalogKey(),clean);catalog=clean;}
  else{
   const visibilityChanged=clean.stores.some(s=>s.hiddenFromReports!==Boolean(catalog.stores.find(old=>old.id===s.id)?.hiddenFromReports));
   if(visibilityChanged&&!reportVisibilitySupported){const {data}=await sendGoogle(config,'diagnose');assertGoogleReply(data);if(data.reportVisibility!==true)throw Error('門市報表隱藏需要更新連接程式。請到「試算表連接設定」保留原 ID 與密碼，下載最新 Code.gs 並部署新版本，再重新整理帳本。');reportVisibilitySupported=true;}
   if(!catalogSupported){const {data}=await sendGoogle(config,'diagnose');assertGoogleReply(data);if(Number(data.version)<4)throw Error('門市與分類管理需要 Code.gs v4。請到「試算表連接設定」保留原 ID 與密碼，重新下載並部署新版本。');}
   const {data}=await sendGoogle(config,'catalog',{catalog:clean,expectedRevision:catalogRevision});assertGoogleReply(data);
   const confirmed=validateCatalog(data.catalog);
   if(['stores','categories'].some(kind=>clean[kind].map(item=>item.id).join(',')!==confirmed[kind].map(item=>item.id).join(',')))throw Error('連接程式未確認管理排序，請重新整理帳本後再試。');
   if(clean.stores.some(s=>confirmed.stores.find(next=>next.id===s.id)?.hiddenFromReports!==s.hiddenFromReports))throw Error('連接程式未確認門市報表隱藏設定，請更新 Code.gs 並重新整理帳本。');
   catalog=confirmed;catalogRevision=data.catalogRevision;catalogSupported=true;lastSync=Date.now();storage.set(catalogKey(),catalog);
   await ledgerCache.write(config,{rows,window:annualCoverage,catalog,catalogRevision,catalogSupported,reportVisibilitySupported});
  }
  render();toast(message);
 }finally{pendingCatalog=null;catalogBusy=false;$('catalog-sort-status').hidden=true;setBusy(false);renderManagement();}
}
$('management-tabs').onclick=e=>{const b=e.target.closest('[data-manage]');if(b&&!catalogBusy&&!busy&&!refreshBusy){catalogSorter.cancel();managementKind=b.dataset.manage;showError('catalog-error','');renderManagement();}};
function catalogEditorValues(){return {name:$('catalog-edit-name').value,type:$('catalog-edit-type').value,active:$('catalog-edit-active').checked,makeDefault:$('catalog-edit-default').checked,hiddenFromReports:$('catalog-edit-hidden').checked};}
function openCatalogEditor(id=null){
 if(busy||refreshBusy||catalogBusy)return;
 const item=id?catalog[managementKind].find(item=>item.id===id):null;
 catalogEditing={kind:managementKind,id};
 $('catalog-editor-title').textContent=(id?'':'新增')+(managementKind==='stores'?'門市':'分類')+(id?'設定':'');
 $('catalog-edit-name').value=item?.name||'';
 $('catalog-edit-name').placeholder=managementKind==='stores'?'例如：台南店':'例如：人事';
 $('catalog-edit-type-field').hidden=managementKind!=='categories';
 $('catalog-edit-type').value=item?.type||'expense';
 $('catalog-edit-active').checked=item?.active??true;
 $('catalog-edit-default').checked=!!id&&catalog.defaultStore===id;
 $('catalog-edit-hidden').checked=item?.hiddenFromReports??false;
 $('catalog-store-settings').hidden=managementKind!=='stores';
 showError('catalog-edit-error','');
 catalogSnapshot=JSON.stringify(catalogEditorValues());catalogScroll=window.scrollY;
 history.pushState({...history.state,catalogEditor:true},'',location.href);
 $('catalog-dialog').showModal();renderManagement();
 // Avoid opening the software keyboard until the name field is explicitly selected.
 $('catalog-edit-cancel').focus({preventScroll:true});
}
function closeCatalogEditor(){
 if(catalogBusy||busy||refreshBusy)return false;
 if(JSON.stringify(catalogEditorValues())!==catalogSnapshot){
  confirmDiscard('設定',()=>$('catalog-dialog').close());return false;
 }
 $('catalog-dialog').close();return true;
}
$('catalog-add-button').onclick=()=>openCatalogEditor();
$('catalog-list').onclick=e=>{const button=e.target.closest('[data-catalog-edit]');if(button&&!button.disabled)openCatalogEditor(button.dataset.catalogEdit);};
$('catalog-edit-active').onchange=()=>{if(!$('catalog-edit-active').checked)$('catalog-edit-default').checked=false;$('catalog-edit-default').disabled=!$('catalog-edit-active').checked;};
$('catalog-edit-cancel').onclick=closeCatalogEditor;
$('catalog-dialog').addEventListener('cancel',e=>{e.preventDefault();closeCatalogEditor();});
$('catalog-dialog').addEventListener('close',()=>{
 restoreCatalogScroll();
 if(history.state?.catalogEditor){catalogReturn=true;history.back();}
 const selector=catalogEditing?.id?'[data-catalog-edit="'+catalogEditing.id+'"]':null;
 (selector?$('catalog-list').querySelector(selector):$('catalog-add-button'))?.focus({preventScroll:true});
});
$('catalog-edit-form').onsubmit=async e=>{
 e.preventDefault();if(catalogBusy||busy||refreshBusy)return;
 const values=catalogEditorValues(),{kind,id}=catalogEditing;
 try{
  let next;
  if(id){
   next=editCatalog(catalog,{kind,id,name:values.name,active:values.active,makeDefault:values.makeDefault,hiddenFromReports:values.hiddenFromReports});
   if(kind==='stores'&&!values.makeDefault&&next.defaultStore===id)next.defaultStore='';
  }else{
   next=structuredClone(catalog);const newId=crypto.randomUUID();
   next[kind].push({id:newId,name:values.name.trim(),aliases:[],active:values.active,...(kind==='categories'?{type:values.type}:{hiddenFromReports:values.hiddenFromReports})});
   if(kind==='stores'&&values.makeDefault&&values.active)next.defaultStore=newId;
  }
  await saveCatalog(next);catalogSnapshot=JSON.stringify(catalogEditorValues());$('catalog-dialog').close();
 }catch(err){showError('catalog-edit-error',err.message);}
};
// A validated local snapshot lets init finish while its Google refresh runs in the background.
new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  .then(init)
  .then(() => window.appLoading.ready(), () => window.appLoading.fail());
setupPwa();

// Reconfirm the active years when a long-lived PWA crosses New Year; drafts stay in storage.
function checkAnnualClock(){if(!busy&&!refreshBusy&&taipeiDay().slice(0,4)!==today.slice(0,4))refresh();}
window.addEventListener('focus',checkAnnualClock);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkAnnualClock();});
setInterval(checkAnnualClock,60000);
