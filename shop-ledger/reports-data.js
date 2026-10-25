import {totals,cents,shiftDay,validDate,storeKey,storeLabel,forStore} from './ledger.js';
import {annualReport} from './analytics.js';

export const delta=(value,previous)=>previous>0?(value-previous)/previous*100:null;
export function cutoffFor(year,asOf,mode='same'){
  let end=String(year).padStart(4,'0')+(mode==='full'?'-12-31':asOf.slice(4));
  if(!validDate(end)&&end.endsWith('-02-29'))end=String(year).padStart(4,'0')+'-02-28';
  return end>asOf?asOf:end;
}
export function yearRows(rows,year,end){return rows.filter(r=>Number(r.date.slice(0,4))===year&&r.date<=end);}
export function nearestChartMonth(x,left,width){return Math.max(1,Math.min(12,Math.round((x-left)/width*11)+1));}
export function yearMonthDetails(reports,month,metric='income'){
  return reports.map(report=>{
    const item=report.months[month-1],key=report.year+'-'+String(month).padStart(2,'0');
    const start=key+'-01',last=new Date(start+'T12:00:00Z');last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);
    const calendarEnd=last.toISOString().slice(0,10),end=report.end<calendarEnd?report.end:calendarEnd;
    const hasMetric=item.included&&(metric==='balance'?item.hasRecords:item[metric+'Count']>0);
    const previous=item.previous;
    const partial=item.included&&end<calendarEnd;
    const comparable=previous&&(metric==='balance'?previous.hasRecords:previous[metric+'Count']>0);
    return {...item,year:report.year,key,start,end,partial,hasMetric,
      status:!item.included?'期間外':!item.hasRecords?'無收支記錄':hasMetric?'recorded':'無'+(metric==='income'?'營收':'支出')+'記錄',
      value:hasMetric?item[metric]:null,previousValue:comparable?previous[metric]:null,yoy:hasMetric&&comparable?delta(item[metric],previous[metric]):null};
  });
}
export function yearsReport(rows,endYear,asOf,mode='same'){
  return Array.from({length:3},(_,i)=>{
    const year=endYear-2+i,end=cutoffFor(year,asOf,mode),selected=yearRows(rows,year,end),summary=totals(selected);
    const previousEnd=cutoffFor(year-1,end,'same'),previousRows=yearRows(rows,year-1,previousEnd);
    const previous={year:year-1,start:(year-1)+'-01-01',end:previousEnd,...totals(previousRows),hasRecords:previousRows.length>0};
    return {year,end,summary,previous,hasRecords:selected.length>0,days:new Set(selected.filter(r=>r.type==='income').map(r=>r.date)).size,
      yoy:summary.incomeCount&&previous.incomeCount?delta(summary.income,previous.income):null,
      changes:Object.fromEntries(['income','expense','balance'].map(key=>{const comparable=key==='balance'?selected.length&&previous.hasRecords:summary[key+'Count']&&previous[key+'Count'];return [key,comparable?delta(summary[key],previous[key]):null];})),
      months:Array.from({length:12},(_,m)=>{
        const key=year+'-'+String(m+1).padStart(2,'0'),monthRows=selected.filter(r=>r.date.startsWith(key));
        const calendarEnd=new Date(Date.UTC(year,m+1,0)).toISOString().slice(0,10),included=key<=end.slice(0,7);
        const partial=included&&end<calendarEnd,previousStart=(year-1)+key.slice(4)+'-01';
        const previousEnd=partial?previousStart.slice(0,8)+String(Math.min(Number(end.slice(8)),new Date(Date.UTC(year-1,m+1,0)).getUTCDate())).padStart(2,'0'):new Date(Date.UTC(year-1,m+1,0)).toISOString().slice(0,10);
        const previousRows=included?rows.filter(r=>r.date>=previousStart&&r.date<=previousEnd):[];
        return {month:m+1,...totals(monthRows),hasRecords:monthRows.length>0,included,previous:{year:year-1,start:previousStart,end:previousEnd,...totals(previousRows),hasRecords:previousRows.length>0}};
      })};
  });
}
export function rhythmReport(rows,year,month,asOf){
  const report=annualReport(rows,year,asOf),days=new Map();
  rows.filter(r=>r.date.startsWith(year+'-')&&r.date<=asOf).forEach(r=>{
    if(!days.has(r.date))days.set(r.date,{income:0,expense:0,balance:0,incomeCount:0,expenseCount:0});
    const day=days.get(r.date);day[r.type]+=cents(r.amount);day[r.type+'Count']++;day.balance=day.income-day.expense;
  });
  const ranked=[...days].filter(([,day])=>day.incomeCount>0).map(([date,day])=>({date,income:day.income})).sort((a,b)=>b.income-a.income||a.date.localeCompare(b.date));
  const key=year+'-'+String(month).padStart(2,'0');
  const calendar=[];for(let date=key+'-01';date.startsWith(key);date=shiftDay(date,1)){
    const day=days.get(date);
    calendar.push({date,income:day?.income??null,expense:day?.expense??null,balance:day?.balance??null,incomeCount:day?.incomeCount||0,expenseCount:day?.expenseCount||0,future:date>asOf});
  }
  return {...report,topDays:ranked.slice(0,5),calendar};
}
export function storesReport(rows,year,asOf){
  const end=cutoffFor(year,asOf,'full'),previousEnd=String(year-1)+end.slice(4);
  const correctedPrevious=validDate(previousEnd)?previousEnd:String(year-1)+'-02-28';
  const current=yearRows(rows,year,end).filter(r=>r.store),previous=yearRows(rows,year-1,correctedPrevious).filter(r=>r.store);
  const totalIncome=totals(current).income;
  return [...new Set([...current,...previous].map(storeKey))].map(store=>{
    const selected=forStore(current,store),summary=totals(selected),last=totals(forStore(previous,store));
    const dates=selected.filter(r=>r.type==='income').map(r=>r.date).sort();
    const days=new Set(dates).size;
    return {store,label:storeLabel(store),...summary,days,first:dates[0],share:totalIncome?summary.income/totalIncome*100:null,
      average:days?summary.income/days:null,yoy:summary.incomeCount&&last.incomeCount?delta(summary.income,last.income):null};
  }).sort((a,b)=>b.income-a.income||a.label.localeCompare(b.label));
}
