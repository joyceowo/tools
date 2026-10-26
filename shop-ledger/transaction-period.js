import {checkedRange,presetRange} from './reporting.js';
import {periodLabel} from './period-display.js';

export function monthRange(month,today,startYear){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||month<String(startYear)+'-01'||month>today.slice(0,7))throw Error('請選擇可查詢範圍內的月份。');
 const last=new Date(month+'-01T12:00:00Z');last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);
 return checkedRange(month+'-01',last.toISOString().slice(0,10),today);
}
export function rangeMonth(range,today,startYear){
 try{const month=range.start.slice(0,7),candidate=monthRange(month,today,startYear);return candidate.start===range.start&&candidate.end===range.end?month:null;}catch{return null;}
}
export function shiftMonth(month,step){
 const date=new Date(month+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+step);return date.toISOString().slice(0,7);
}

export function setupTransactionPeriod({getRange,getToday,getWindow,onApply}){
 const $=id=>document.getElementById(id),dialog=$('record-period-dialog'),toggle=$('record-period-toggle');
 let draft='month';
 const selectedMonth=()=>['today','week','year','lastyear'].includes($('range-preset').value)?null:rangeMonth(getRange(),getToday(),getWindow().startYear);
 function selectDraft(value){
  draft=value;
  $('record-period-options').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.period===value)));
  $('record-month-field').hidden=value!=='month';$('record-custom-fields').hidden=value!=='custom';
  $('record-period-error').hidden=true;
 }
 function render(active){
  $('record-period-controls').hidden=!active;
  const range=getRange(),today=getToday(),{startYear}=getWindow(),month=selectedMonth(),preset=$('range-preset').value;
  const label=month?month.slice(0,4)+'年'+Number(month.slice(5))+'月':preset==='today'?'今日':preset==='week'?'近7天':['year','lastyear'].includes(preset)?range.start.slice(0,4)+'年':periodLabel(range,today);
  $('record-period-label').textContent=label;$('record-period-compact').textContent=month?month.replace('-','/'):label;
  toggle.dataset.rangeKind=month?'month':preset==='custom'?'custom':'preset';
  toggle.setAttribute('aria-label','統計期間：'+label+'，選擇期間');toggle.title=range.start+' ～ '+range.end;
  for(const [id,step] of [['record-month-prev',-1],['record-month-next',1]]){
   $(id).hidden=!month;$(id).disabled=!month||shiftMonth(month,step)<startYear+'-01'||shiftMonth(month,step)>today.slice(0,7);
  }
 }
 toggle.onclick=()=>{
  const range=getRange(),today=getToday(),{startYear}=getWindow();
  const month=selectedMonth(),preset=$('range-preset').value;
  $('record-period-month').min=startYear+'-01';$('record-period-month').max=today.slice(0,7);$('record-period-month').value=range.start.slice(0,7);
  for(const [id,value] of [['record-period-start',range.start],['record-period-end',range.end]]){$(id).min=startYear+'-01-01';$(id).max=today;$(id).value=value;}
  selectDraft(month?'month':preset||'custom');dialog.showModal();toggle.setAttribute('aria-expanded','true');
 };
 $('record-period-options').onclick=e=>{const b=e.target.closest('[data-period]');if(b)selectDraft(b.dataset.period);};
 $('record-period-cancel').onclick=()=>dialog.close();
 $('record-period-form').onsubmit=e=>{
  e.preventDefault();
  try{
   const today=getToday(),{startYear}=getWindow();
   if(draft==='custom'&&($('record-period-start').value>today||$('record-period-end').value>today))throw Error('查詢日期不能晚於今天。');
   const range=draft==='month'?monthRange($('record-period-month').value,today,startYear):draft==='custom'?checkedRange($('record-period-start').value,$('record-period-end').value,today):presetRange(draft,today);
   if(range.start<startYear+'-01-01')throw Error('只能查詢 '+startYear+' 年起的資料。');
   onApply(range,draft==='month'?'custom':draft);dialog.close();
  }catch(error){$('record-period-error').textContent=error.message;$('record-period-error').hidden=false;}
 };
 for(const [id,step] of [['record-month-prev',-1],['record-month-next',1]])$(id).onclick=()=>{
  const month=selectedMonth();if(month&&!$(id).disabled)onApply(monthRange(shiftMonth(month,step),getToday(),getWindow().startYear),'custom');
 };
 dialog.addEventListener('close',()=>{toggle.setAttribute('aria-expanded','false');if(location.hash==='#transactions')toggle.focus({preventScroll:true});});
 dialog.addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;
  const controls=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(n=>n.getClientRects().length),first=controls[0],last=controls.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 });
 return {render,close(){if(dialog.open)dialog.close();}};
}
