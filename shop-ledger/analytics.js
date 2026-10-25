import {totals, shiftDay, validDate} from './ledger.js';

function yearEnd(year, suffix) {
  let date=String(year).padStart(4,'0')+suffix;
  if(!validDate(date)&&suffix==='-02-29')date=String(year).padStart(4,'0')+'-02-28';
  return date;
}
const percent=(current,previous)=>previous>0?(current-previous)/previous*100:null;

export function annualReport(rows,year,asOf) {
  const prefix=String(year).padStart(4,'0');
  const end=asOf.slice(0,4)===prefix?asOf:prefix+'-12-31';
  const cutoff=end<asOf?end:asOf;
  const previousEnd=yearEnd(year-1,end.slice(4));
  const current=rows.filter(r=>r.date.startsWith(prefix+'-')&&r.date<=cutoff);
  const previous=rows.filter(r=>r.date.startsWith(String(year-1).padStart(4,'0')+'-')&&r.date<=previousEnd&&r.date<=asOf);
  const summary=totals(current),previousSummary=totals(previous);
  const months=Array.from({length:12},(_,index)=>{
    const key=prefix+'-'+String(index+1).padStart(2,'0');
    const previousKey=String(year-1).padStart(4,'0')+key.slice(4);
    const monthRows=current.filter(r=>r.date.startsWith(key));
    const lastRows=previous.filter(r=>r.date.startsWith(previousKey));
    const sum=totals(monthRows),last=totals(lastRows);
    return {key,month:index+1,...sum,hasRecords:monthRows.length>0,
      state:key>asOf.slice(0,7)?'future':key===asOf.slice(0,7)?'partial':'complete',
      previous:last,yoy:sum.incomeCount&&last.incomeCount?percent(sum.income,last.income):null};
  });
  const recorded=months.filter(m=>m.incomeCount>0);
  const peak=Math.max(0,...recorded.map(m=>m.income));
  return {year,end:cutoff,summary,previous:previousSummary,months,
    recordedMonths:recorded.length,peakMonths:recorded.filter(m=>m.income===peak).map(m=>m.month),
    yoy:summary.incomeCount&&previousSummary.incomeCount?percent(summary.income,previousSummary.income):null};
}

const festivalCache=new Map();
export function festivalCalendar(year) {
  if(festivalCache.has(year))return festivalCache.get(year);
  const prefix=String(year).padStart(4,'0');
  const fixed=[['new-year','元旦','01-01'],['valentine','情人節','02-14'],['children','兒童節','04-04'],['father','父親節','08-08'],['christmas','聖誕節','12-25']];
  const events=fixed.map(([id,name,date])=>({id,name,date:prefix+'-'+date}));
  const firstMay=new Date(prefix+'-05-01T12:00:00Z').getUTCDay();
  events.push({id:'mother',name:'母親節',date:prefix+'-05-'+String(8+(7-firstMay)%7).padStart(2,'0')});
  let lunarAvailable=false;
  try {
    const format=new Intl.DateTimeFormat('en-u-ca-chinese',{month:'numeric',day:'numeric',timeZone:'Asia/Taipei'});
    if(format.resolvedOptions().calendar==='chinese'){
      const lunar=new Map([['1/1',['spring','春節']],['5/5',['dragon','端午節']],['7/7',['qixi','七夕']],['8/15',['moon','中秋節']]]);
      for(let date=prefix+'-01-01';date.startsWith(prefix+'-');date=shiftDay(date,1)){
        const parts=format.formatToParts(new Date(date+'T04:00:00Z'));
        // Exact string matching skips intercalary months such as "6bis".
        const key=parts.find(p=>p.type==='month')?.value+'/'+parts.find(p=>p.type==='day')?.value;
        if(lunar.has(key)){const [id,name]=lunar.get(key);events.push({id,name,date});}
      }
      lunarAvailable=true;
    }
  }catch{}
  const result={events:events.sort((a,b)=>a.date.localeCompare(b.date)),lunarAvailable};
  festivalCache.set(year,result);
  return result;
}

export function nearbyFestivals(date,radius=3){
  const firstYear=Number(shiftDay(date,-radius).slice(0,4)),lastYear=Number(shiftDay(date,radius).slice(0,4));
  const nearby=[];
  for(let year=firstYear;year<=lastYear;year++){
    for(const event of festivalCalendar(year).events){
      const offset=Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(event.date+'T00:00:00Z'))/86400000);
      if(Math.abs(offset)<=radius)nearby.push({...event,offset,label:event.name+(offset===0?'當天':offset>0?'後 '+offset+' 天':'前 '+Math.abs(offset)+' 天')});
    }
  }
  return nearby.sort((a,b)=>Math.abs(a.offset)-Math.abs(b.offset)||a.date.localeCompare(b.date));
}

export function festivalPerformance(rows,event,asOf) {
  const start=shiftDay(event.date,-3),end=shiftDay(event.date,3);
  const baselineStart=shiftDay(start,-28),baselineEnd=shiftDay(start,-1);
  const income=rows.filter(r=>r.type==='income'&&r.date<=asOf);
  const selected=income.filter(r=>r.date>=start&&r.date<=end);
  const baseline=income.filter(r=>r.date>=baselineStart&&r.date<=baselineEnd);
  const days=new Set(selected.map(r=>r.date)).size,baselineDays=new Set(baseline.map(r=>r.date)).size;
  const revenue=totals(selected).income,baselineRevenue=totals(baseline).income;
  const average=days?revenue/days:null,baselineAverage=baselineDays?baselineRevenue/baselineDays:null;
  const state=start>asOf?'future':end>=asOf?'active':'complete';
  return {...event,start,end,baselineStart,baselineEnd,state,revenue,days,baselineDays,average,baselineAverage,
    uplift:state==='complete'&&days>=2&&baselineDays>=7?percent(average,baselineAverage):null};
}
