import {yearAvailability} from './annual-window.js';
import {niceChartScale} from './chart-design.js';
// All series use cents and one shared money axis, including all three years.
export function monthlyTrendData(report,mode='amount',metric='income'){
 const metrics=['income','expense','balance'];
 if(!metrics.includes(metric))metric='income';
 const series=mode==='yoy'?['current','previous','oldest'].map((key,index)=>({key,metric,year:report.year-index,points:report.months.map(m=>({
  month:m.month,value:key==='oldest'?(report.history?.months[m.month-1]?.hasRecords?report.history.months[m.month-1][metric]:null):key==='previous'?(m.previous.hasRecords?m.previous[metric]:null):(!m.future&&m.hasRecords?m[metric]:null),partial:m.partial
 }))})):metrics.map(metric=>({key:metric,metric,year:report.year,points:report.months.map(m=>({month:m.month,value:!m.future&&m.hasRecords?(metric==='expense'&&m[metric]!==0?-m[metric]:m[metric]):null,partial:m.partial}))}));
 if(mode==='yoy'&&report.coverage)for(const s of series){s.unavailable=yearAvailability(report.coverage,s.year);if(s.unavailable)for(const p of s.points)p.value=null;}
 const values=series.flatMap(s=>s.points.map(p=>p.value)).filter(v=>v!==null);
 return {series,...niceChartScale(values),hasValues:values.length>0};
}
