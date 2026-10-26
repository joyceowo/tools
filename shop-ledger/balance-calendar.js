import {annualWindow,yearAvailability} from './annual-window.js';
import {festivalCalendar} from './analytics.js';
import {balanceCalendarDays,calendarDayValue,shiftCalendarMonth,calendarCompactAmount} from './calendar-data.js';
import {comparisonTone} from './chart-design.js';

const $=id=>document.getElementById(id);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(v);
const money=v=>'NT$ '+number(v/100);

export function createBalanceCalendar({today}){
 let coverage=annualWindow(today);
 let rows=[],month=today.slice(0,7),mode='calendar',selected=null;
 function render(input={}){
  today=input.today??today;coverage=input.coverage??coverage;rows=input.rows??rows;
  if(month<coverage.startYear+'-01'||month>today.slice(0,7)){month=today.slice(0,7);selected=null;}
  const currentStatus=yearAvailability(coverage,Number(month.slice(0,4))),previousStatus=yearAvailability(coverage,Number(month.slice(0,4))-1);
  const last=new Date(month+'-01T12:00:00Z');last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);
  const range={start:month+'-01',end:last.toISOString().slice(0,10)};
  $('calendar-month').textContent=month.slice(0,4)+' 年 '+Number(month.slice(5))+' 月';
  $('calendar-prev').disabled=month<=coverage.startYear+'-01';$('calendar-next').disabled=month>=today.slice(0,7);
  $('calendar-today').hidden=month===today.slice(0,7);
  const comparing=mode==='comparison',events=festivalCalendar(Number(month.slice(0,4))).events,days=balanceCalendarDays(rows,month,range,today);
  $('calendar-title').textContent='每日結餘';
  $('calendar-availability').textContent=[currentStatus?month.slice(0,4)+' 年：'+currentStatus:'',mode==='comparison'&&previousStatus?(Number(month.slice(0,4))-1)+' 年：'+previousStatus:''].filter(Boolean).join('；');$('calendar-availability').hidden=!$('calendar-availability').textContent;
  const offset=(new Date(month+'-01T12:00:00Z').getUTCDay()+6)%7;
  const eventOn=date=>events.filter(e=>e.date===date).map(e=>e.name).join('、');
  $('revenue-calendar').innerHTML='<span aria-hidden="true"></span>'.repeat(offset)+days.map(d=>{
   const event=eventOn(d.date),display=calendarDayValue(d,mode);
   if(currentStatus&&!d.future||comparing&&previousStatus){display.text='—';display.label='';}
   const tone=comparing?'balance-comparison':currentStatus||d.future||d.outside||!d.has?'balance-missing':d.balance===0?'balance-zero':(d.balance>0?'balance-positive':'balance-negative');
   const amountTone=comparing&&!d.future?'comparison-change '+comparisonTone('balance',display.value):comparing&&display.value<0?'negative-amount':'';
   const accessibleValue=display.text||(comparing&&!d.previous.date?'無對應日':comparing&&!d.previous.has?'去年無記錄':!d.has?'無記錄':'');
   const compact=Number.isFinite(display.value)&&display.text!=='—'?(comparing&&!d.future&&display.value>0?'+':'')+calendarCompactAmount(display.value):display.text;
   return `<button type="button" class="revenue-day ${tone}${selected===d.date?' selected':''}" data-date="${d.date}" aria-pressed="${selected===d.date}" aria-label="${d.date} ${comparing?(d.future?'去年結餘':'結餘比去年'):'結餘'} ${accessibleValue}${d.future?'，尚未到日期':''}${event?'，'+esc(event):''}"><span>${Number(d.date.slice(8))}</span>${display.label?'<small class="calendar-prior-label">'+display.label+'</small>':''}<strong class="day-balance-amount ${amountTone}"><span class="calendar-amount-full">${display.text}</span><span class="calendar-amount-compact" aria-hidden="true">${compact}</span></strong>${event?'<i aria-hidden="true">·</i>':''}</button>`;
  }).join('');
  const day=days.find(d=>d.date===selected),event=eventOn(selected);
  let detail='';
  if(day){
   detail=`<strong>${day.date}</strong>`;
   if(comparing){
    const value=(item,key)=>item.has?number(item[key]/100):'—';
    detail+=`<table class="calendar-day-comparison"><caption class="sr-only">同月同日收支，金額單位為元</caption><thead><tr><th scope="col">元</th><th scope="col">${month.slice(0,4)}</th><th scope="col">${Number(month.slice(0,4))-1}</th></tr></thead><tbody>${[['income','收入'],['expense','支出'],['balance','結餘']].map(([key,label])=>`<tr><th scope="row">${label}</th><td class="${day.has&&day[key]<0?'negative-amount':''}">${day.future?'—':day.outside?'期間外':(currentStatus||value(day,key))}</td><td class="${day.previous.has&&day.previous[key]<0?'negative-amount':''}">${day.previous.date?(previousStatus||value(day.previous,key)):'無對應日'}</td></tr>`).join('')}</tbody></table>`;
   }else if(day.has)detail+=`<dl class="day-balance-breakdown"><div><dt>結餘</dt><dd>${money(day.balance)}</dd></div><div><dt>收入</dt><dd>${money(day.income)}</dd></div><div><dt>支出</dt><dd>${money(day.expense)}</dd></div></dl>`;
   else detail+='<span>'+(currentStatus||calendarDayValue(day,mode).text)+'</span>';
   if(event)detail+='<span>日期註記：'+esc(event)+'</span>';
  }
  $('revenue-day-detail').innerHTML=detail;$('revenue-day-detail').hidden=!day;
  $('calendar-balance-legend').hidden=comparing;$('calendar-comparison-legend').hidden=!comparing;
  $('calendar-view').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.calendar===mode)));
 }
 function changeMonth(next){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(next)||next<coverage.startYear+'-01'||next>today.slice(0,7)){render();return;}
  month=next;selected=null;render();
 }
 $('calendar-prev').onclick=()=>changeMonth(shiftCalendarMonth(month,-1));
 $('calendar-next').onclick=()=>changeMonth(shiftCalendarMonth(month,1));
 $('calendar-today').onclick=()=>changeMonth(today.slice(0,7));
 $('calendar-view').onclick=e=>{const b=e.target.closest('[data-calendar]');if(b){mode=b.dataset.calendar;render();}};
 $('revenue-calendar').onclick=e=>{const b=e.target.closest('[data-date]');if(b){selected=b.dataset.date;render();$('revenue-calendar').querySelector(`[data-date="${selected}"]`)?.focus({preventScroll:true});}};
 return {render};
}
