import {totals,validDate,shiftDay} from './ledger.js';
import {delta} from './reports-data.js';
export const metricNames={income:'收入',expense:'支出',balance:'結餘'};
export function checkedRange(start,end,asOf){
  if(!validDate(start)||!validDate(end)||start>end)throw Error('請選擇有效日期，開始日不能晚於結束日。');
  if(start>asOf)throw Error('開始日不能晚於今天。');return {start,end:end>asOf?asOf:end};
}
export function presetRange(value,today){
  const year=today.slice(0,4),month=today.slice(0,7);return value==='lastyear'?{start:(Number(year)-1)+'-01-01',end:(Number(year)-1)+'-12-31'}:value==='today'?{start:today,end:today}:value==='week'?{start:shiftDay(today,-6),end:today}:value==='year'?{start:year+'-01-01',end:today}:{start:month+'-01',end:today};
}
export function limitedReportPeriod(range,today){
 for(const value of ['month','year','lastyear']){
  const preset=presetRange(value,today);
  if(range.start===preset.start&&range.end===preset.end)return {value,range:preset};
 }
 return {value:'month',range:presetRange('month',today)};
}
export function annualRange(year,asOf){
  if(!validDate(asOf)||!Number.isInteger(year)||year<1001||year>Number(asOf.slice(0,4)))throw Error('請選擇有效年份。');
  return checkedRange(year+'-01-01',year+'-12-31',asOf);
}
export function twoYearRange(year,asOf){
  if(!Number.isInteger(year)||year<1001||year>Number(asOf.slice(0,4)))throw Error('請選擇有效年份。');
  return checkedRange(String(year-1).padStart(4,'0')+'-01-01',year+'-12-31',asOf);
}
export function rangeRows(rows,range){return rows.filter(r=>r.date>=range.start&&r.date<=range.end);}
export function previousRange(range,mode='previous'){
  if(mode==='month'){
    const previous=d=>{const y=Number(d.slice(0,4)),m=Number(d.slice(5,7)),day=Number(d.slice(8)),last=new Date(Date.UTC(y,m-1,0)).getUTCDate();return new Date(Date.UTC(y,m-2,Math.min(day,last))).toISOString().slice(0,10);};return {start:previous(range.start),end:previous(range.end)};
  }
  if(mode==='year'){
    const previous=d=>{let n=String(Number(d.slice(0,4))-1)+d.slice(4);return validDate(n)?n:n.slice(0,8)+'28';};return {start:previous(range.start),end:previous(range.end)};
  }
  const days=Math.round((Date.parse(range.end)-Date.parse(range.start))/86400000)+1;
  return {start:shiftDay(range.start,-days),end:shiftDay(range.start,-1)};
}
export function compareRanges(rows,current,previous){
  const a=rangeRows(rows,current),b=rangeRows(rows,previous),now=totals(a),before=totals(b);
  return ['income','expense','balance'].map(metric=>({metric,current:now[metric],previous:before[metric],currentCount:metric==='balance'?a.length:now[metric+'Count'],previousCount:metric==='balance'?b.length:before[metric+'Count'],difference:a.length&&b.length?now[metric]-before[metric]:null,percent:(metric==='balance'?a.length&&b.length:now[metric+'Count']&&before[metric+'Count'])?delta(now[metric],before[metric]):null}));
}
export function groupedReport(rows,range,group='month',order='asc'){
  const selected=rangeRows(rows,range),buckets=new Map();
  const key=date=>group==='day'?date:group==='year'?date.slice(0,4):group==='week'?shiftDay(date,-((new Date(date+'T12:00:00Z').getUTCDay()+6)%7)):date.slice(0,7);
  for(let day=range.start;day<=range.end;day=shiftDay(day,1)){const k=key(day);if(!buckets.has(k))buckets.set(k,{key:k,start:day,end:day,rows:[]});buckets.get(k).end=day;}
  for(const row of selected)buckets.get(key(row.date)).rows.push(row);
  const groups=[...buckets.values()].map(({rows,...item})=>({...item,...totals(rows),hasRecords:rows.length>0}));
  return order==='desc'?groups.reverse():groups;
}
export function monthlyCashflow(rows,year,asOf){
  if(!Number.isInteger(year)||year<1000||year>9999||!validDate(asOf))throw Error('請選擇有效年份與統計日期。');
  const start=year+'-01-01',end=asOf<year+'-12-31'?asOf:year+'-12-31';
  const selected=rows.filter(r=>r.date>=start&&r.date<=end),byMonth=new Map(),priorByMonth=new Map();
  for(const row of selected){const key=row.date.slice(0,7);if(!byMonth.has(key))byMonth.set(key,[]);byMonth.get(key).push(row);}
  const priorYear=String(year-1).padStart(4,'0');
  for(const row of rows)if(row.date.startsWith(priorYear+'-')&&row.date<=asOf){const key=row.date.slice(0,7);if(!priorByMonth.has(key))priorByMonth.set(key,[]);priorByMonth.get(key).push(row);}
  const months=Array.from({length:12},(_,i)=>{
    const key=year+'-'+String(i+1).padStart(2,'0'),first=key+'-01';
    const last=new Date(first+'T12:00:00Z');last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);
    const calendarEnd=last.toISOString().slice(0,10),future=first>asOf,items=byMonth.get(key)||[];
    const partial=!future&&calendarEnd>asOf,current={month:i+1,key,start:first,end:calendarEnd>asOf?asOf:calendarEnd,...totals(items),hasRecords:items.length>0,future,partial};
    const priorKey=priorYear+key.slice(4),priorStart=priorKey+'-01',lastPrior=new Date(priorStart+'T12:00:00Z');lastPrior.setUTCMonth(lastPrior.getUTCMonth()+1);lastPrior.setUTCDate(0);
    const priorEnd=partial?priorKey+'-'+String(Math.min(Number(current.end.slice(8)),lastPrior.getUTCDate())).padStart(2,'0'):lastPrior.toISOString().slice(0,10);
    const previousRows=(priorByMonth.get(priorKey)||[]).filter(r=>r.date<=priorEnd);
    const previous={year:year-1,start:priorStart,end:priorEnd,...totals(previousRows),hasRecords:previousRows.length>0};
    const changes=['income','expense','balance'].map(metric=>{
      const reason=future?'future':!current.hasRecords?'current_missing':!previous.hasRecords?'previous_missing':previous[metric]===0?'zero_base':previous[metric]<0?'negative_base':null;
      return {metric,current:current[metric],previous:previous[metric],difference:!future&&current.hasRecords&&previous.hasRecords?current[metric]-previous[metric]:null,percent:reason===null?delta(current[metric],previous[metric]):null,reason};
    });
    return {...current,previous,changes};
  });
  return {year,start,end,months,summary:totals(selected),hasRecords:selected.length>0};
}
export function categoryReport(rows,range,type='expense'){
  const selected=rangeRows(rows,range).filter(r=>r.type===type),total=totals(selected)[type],groups=new Map();
  selected.forEach(r=>{if(!groups.has(r.category))groups.set(r.category,[]);groups.get(r.category).push(r);});
  return [...groups].map(([name,items])=>({name,value:totals(items)[type],count:items.length,share:total?totals(items)[type]/total*100:0})).sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name));
}
export function storeRangeReport(rows,range,sort='income',knownStores=[]){
  const current=rangeRows(rows,range),previous=rangeRows(rows,previousRange(range,'year'));
  return [...new Set([...knownStores,...[...current,...previous].map(r=>r.store||'')])].filter(Boolean).map(store=>{
    const selected=current.filter(r=>(r.store||'')===store),last=previous.filter(r=>(r.store||'')===store),sum=totals(selected),before=totals(last);
    return {store,...sum,hasRecords:selected.length>0,previous:before,previousCount:last.length,yoy:sum.incomeCount&&before.incomeCount?delta(sum.income,before.income):null};
  }).sort((a,b)=>b[sort]-a[sort]||a.store.localeCompare(b.store));
}
