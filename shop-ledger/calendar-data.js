import {totals,shiftDay,validDate} from './ledger.js';

export function shiftCalendarMonth(month,step){
 const date=new Date(month+'-01T12:00:00Z');
 date.setUTCMonth(date.getUTCMonth()+step);
 return date.toISOString().slice(0,7);
}

// Keep calendar dates aligned; February 29 has no counterpart in a non-leap year.
export function balanceCalendarDays(rows,month,range,today){
 const byDay=new Map();
 for(const row of rows){
  if(row.date>today)continue;
  if(!byDay.has(row.date))byDay.set(row.date,[]);
  byDay.get(row.date).push(row);
 }
 const days=[];
 for(let date=month+'-01';date.startsWith(month);date=shiftDay(date,1)){
  const previousDate=String(Number(date.slice(0,4))-1).padStart(4,'0')+date.slice(4);
  const future=date>today,outside=date<range.start||date>range.end;
  const currentRows=!future&&!outside?byDay.get(date)||[]:[];
  const previousRows=validDate(previousDate)?byDay.get(previousDate)||[]:[];
  const current={has:currentRows.length>0,...totals(currentRows)};
  const previous={date:validDate(previousDate)?previousDate:null,has:previousRows.length>0,...totals(previousRows)};
  days.push({date,...current,previous,future,outside,isToday:date===today,difference:current.has&&previous.has?current.balance-previous.balance:null});
 }
 return days;
}

export function calendarDayValue(day,mode){
 const number=v=>new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(v/100);
 if(mode==='comparison'){
  if(day.future)return {text:day.previous.has?number(day.previous.balance):'',label:day.previous.has?'去年':'',value:day.previous.has?day.previous.balance:null};
  if(day.outside)return {text:'期間外',value:null};
  if(!day.previous.date||!day.has||!day.previous.has)return {text:'',value:null};
  return {text:(day.difference>0?'+':'')+number(day.difference),value:day.difference};
 }
 return {text:day.future?'':day.outside?'期間外':!day.has?'':number(day.balance),value:!day.future&&!day.outside&&day.has?day.balance:null};
}
