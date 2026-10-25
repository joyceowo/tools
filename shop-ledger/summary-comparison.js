import {periodLabel} from './period-display.js';
import {niceChartScale,moneyAxisLabel,comparisonTone,periodSeriesStyles} from './chart-design.js';
import {storeRangeReport,previousRange,metricNames} from './reporting.js';
import {delta} from './reports-data.js';
const number=value=>new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(value);
const money=value=>value===null?'無記錄':number(value/100).replace(/(\.\d+)$/,'<wbr><span class="amount-fraction">$1</span>');
const growth=value=>value===null?'—':(value>0?'+':'')+number(value)+'%';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const coordinates=(data,width)=>value=>8+(value-data.min)/(data.max-data.min)*(width-16);
function axis(data,width){
 const x=coordinates(data,width),labels=[];
 for(const value of [0,data.min,data.max,...data.ticks])if(!labels.some(v=>Math.abs(x(v)-x(value))<48))labels.push(value);
 return `<svg class="comparison-money-axis" viewBox="0 0 ${width} 22" aria-hidden="true">${labels.map(value=>`<text x="${x(value)}" y="15" text-anchor="${value===data.min?'start':value===data.max?'end':'middle'}">${moneyAxisLabel(value)}</text>`).join('')}</svg>`;
}
export function annualTotalsData(reports,metric){
 const items=reports.map((r,index)=>{const recorded=metric==='balance'?r.hasRecords:r.summary[metric+'Count']>0;return {year:r.year,end:r.end,value:recorded?r.summary[metric]:null,change:recorded?r.changes[metric]:null,previous:r.previous,partial:!r.end.endsWith('-12-31'),color:index===reports.length-1?periodSeriesStyles.current.color:periodSeriesStyles.previous.color};});
 return {items,...niceChartScale(items.map(r=>r.value))};
}
export function annualTotalsMarkup(reports,metric,availableWidth){
 const data=annualTotalsData(reports,metric),width=Math.max(220,availableWidth||320),x=coordinates(data,width),zero=x(0),hasValues=data.items.some(r=>r.value!==null);
 return `<div class="total-comparison-head"><span>年份</span><span>${metricNames[metric]}（元）</span><span>年增減</span></div><div class="annual-total-items" role="list" aria-label="三年累計${metricNames[metric]}比較">${[...data.items].reverse().map(r=>`<div class="annual-total-item" role="listitem"><div class="total-comparison-values"><strong>${r.year}</strong><b class="${r.value<0?'negative-amount':''}">${money(r.value)}</b><span class="comparison-change ${comparisonTone(metric,r.change)}">${growth(r.change)}</span></div>${r.partial&&r.previous?.hasRecords?`<p class="annual-total-baseline" aria-label="${r.previous.start} 至 ${r.previous.end}，${metricNames[metric]} ${number(r.previous[metric]/100)} 元">去年同期${metricNames[metric]} <span class="${r.previous[metric]<0?'negative-amount':''}">${money(r.previous[metric])}</span></p>`:''}${r.value===null?'':`<svg class="annual-total-bar" viewBox="0 0 ${width} 20" aria-hidden="true"><line x1="${zero}" x2="${zero}" y1="0" y2="20" class="comparison-zero"/>${r.value===0?`<circle cx="${zero}" cy="10" r="3" fill="${r.color}"/>`:`<rect x="${Math.min(zero,x(r.value))}" y="6" width="${Math.abs(x(r.value)-zero)}" height="8" rx="2" fill="${r.color}"/>`}</svg>`}</div>`).join('')}</div>${hasValues?axis(data,width):''}`;
}
export function storeSamePeriodData(rows,range,knownStores=[],page=0){
 const items=storeRangeReport(rows,range,'income',knownStores).map(s=>({
  store:s.store,hasRecords:s.hasRecords,metrics:Object.keys(metricNames).map(metric=>{
   const current=(metric==='balance'?s.hasRecords:s[metric+'Count']>0)?s[metric]:null;
   const previous=(metric==='balance'?s.previousCount>0:s.previous[metric+'Count']>0)?s.previous[metric]:null;
   return {metric,label:metricNames[metric],current,previous,change:current!==null&&previous!==null?delta(current,previous):null};
  })
 })).sort((a,b)=>Number(b.hasRecords)-Number(a.hasRecords)||(b.metrics[0].current??0)-(a.metrics[0].current??0)||a.store.localeCompare(b.store));
 const pageCount=Math.max(1,Math.ceil(items.length/3)),currentPage=Math.max(0,Math.min(page,pageCount-1));
 return {items:items.slice(currentPage*3,currentPage*3+3),allItems:items,page:currentPage,pageCount,previousRange:previousRange(range,'year'),...niceChartScale(items.flatMap(s=>s.metrics.flatMap(m=>[m.current,m.previous])))};
}
const dateRange=r=>r.start.replaceAll('-','/')+'–'+(r.start.slice(0,4)===r.end.slice(0,4)?r.end.slice(5).replace('-','/'):r.end.replaceAll('-','/'));
export function storeSamePeriodMarkup(data,range,availableWidth,today){
 const sharedDates=range.start.slice(0,4)===range.end.slice(0,4)&&data.previousRange.start.slice(0,4)===data.previousRange.end.slice(0,4)&&range.start.slice(5)===data.previousRange.start.slice(5)&&range.end.slice(5)===data.previousRange.end.slice(5);
 const standard=today&&['本月','今年','今日','近 7 天'].includes(periodLabel(range,today));
 const periodText=sharedDates?(standard?'':range.start.slice(5).replace('-','/')+'–'+range.end.slice(5).replace('-','/')):'本期 '+dateRange(range)+'<br>去年 '+dateRange(data.previousRange);
 const days=r=>Math.round((Date.parse(r.end)-Date.parse(r.start))/86400000)+1,different=days(range)!==days(data.previousRange);
 const table=`<table class="store-period-table"><caption class="sr-only">各門市收入、支出與結餘同期比較，金額單位為元</caption><colgroup><col class="metric-col"><col class="amount-col"><col class="amount-col"><col class="growth-col"></colgroup><thead><tr><th scope="col">元</th><th scope="col">${sharedDates?range.start.slice(0,4)+' 年':'本期'}</th><th scope="col">${sharedDates?data.previousRange.start.slice(0,4)+' 年':'去年同期'}</th><th scope="col">增減</th></tr></thead>${data.items.map(s=>`<tbody class="store-period-item"><tr class="store-period-store"><th scope="rowgroup" colspan="4"><button type="button" data-store-yoy="${esc(s.store)}" class="store-period-records" ${s.hasRecords?'':'disabled'} aria-label="${esc(s.store)}，查看本期收支明細"><strong>${esc(s.store)}</strong><span aria-hidden="true">›</span></button></th></tr>${s.metrics.map(m=>`<tr class="store-period-metric" data-store-metric="${m.metric}"><th scope="row">${m.label}</th><td class="${m.current===null?'missing-amount':m.current<0?'negative-amount':''}">${money(m.current)}</td><td class="${m.previous===null?'missing-amount':m.previous<0?'negative-amount':''}">${money(m.previous)}</td><td class="comparison-change ${comparisonTone(m.metric,m.change)}">${growth(m.change)}</td></tr>`).join('')}</tbody>`).join('')}</table>`;
 return `${periodText?`<p class="same-period-dates">${periodText}</p>`:''}${different?`<p class="same-period-duration">本期 ${days(range)} 天／去年 ${days(data.previousRange)} 天，以下比較總額。</p>`:''}${data.items.length?table:'<p class="report-empty">此期間無門市記錄。</p>'}${data.pageCount>1?`<div class="store-period-pages"><button type="button" data-store-yoy-page="-1" aria-label="上一頁門市" ${data.page===0?'disabled':''}>←</button><span>${data.page+1} / ${data.pageCount}</span><button type="button" data-store-yoy-page="1" aria-label="下一頁門市" ${data.page===data.pageCount-1?'disabled':''}>→</button></div>`:''}`;
}
