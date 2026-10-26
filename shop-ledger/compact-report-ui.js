import {storeRangeReport,metricNames} from './reporting.js';
import {niceChartScale,moneyAxisLabel,metricBarStyles,chartMarker} from './chart-design.js';
const number=v=>new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(v);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function appStatusMessage({demo,ready,syncFailed}){return demo?'':syncFailed?'更新失敗，資料可能非最新':ready?'':'請至管理連接試算表';}
export function reportTotalsMarkup(sum){
 return ['income','expense','balance'].map(k=>`<div class="report-total ${k}"><span>${metricNames[k]}${k==='income'?'(元)':''}</span><strong class="${sum[k]<0?'negative-amount':''}">${sum.incomeCount+sum.expenseCount?number(sum[k]/100):'無記錄'}</strong></div>`).join('');
}
export function categoryRowsMarkup(groups,type,limit=5){
 if(!groups.length)return '<p class="report-empty">此期間無記錄。</p>';
 const validShares=groups.every(g=>Number.isFinite(g.value)&&g.value>=0&&Number.isFinite(g.share)&&g.share>=0&&g.share<=100)&&groups.some(g=>g.value>0);
 const listed=groups.slice(0,limit),remaining=groups.slice(limit);
 const row=g=>`<button type="button" class="compact-category-row" data-category="${esc(g.name)}" data-category-type="${type}"><span>${esc(g.name)}</span><strong class="${g.value<0?'negative-amount':''}">${number(g.value/100)}</strong><small>${validShares?number(g.share)+'%':'—'}</small>${validShares?`<i aria-hidden="true"><b style="width:${g.share}%"></b></i>`:''}</button>`;
 return `<div class="category-share-list"><div class="compact-category-head"><span>分類</span><span>金額（元）</span><span>占比</span></div>${listed.map(row).join('')}${remaining.length?`<details class="report-extra"><summary>其他 ${remaining.length} 類</summary>${remaining.map(row).join('')}</details>`:''}</div>`;

}
export function currentStoresData(rows,range,metric,knownStores,page=0){
 const all=storeRangeReport(rows,range,metric,knownStores).sort((a,b)=>Number(b.hasRecords)-Number(a.hasRecords)||b[metric]-a[metric]||a.store.localeCompare(b.store));
 const count=Math.max(1,Math.ceil(all.length/3)),selected=Math.max(0,Math.min(page,count-1));
 return {all,items:all.slice(selected*3,selected*3+3),page:selected,pageCount:count,...niceChartScale(all.flatMap(s=>s.hasRecords?['income','expense','balance'].map(k=>s[k]):[]))};
}
export function currentStoresMarkup(data,availableWidth){
 const width=Math.max(220,availableWidth||320),x=v=>8+(v-data.min)/(data.max-data.min)*(width-16),zero=x(0),ticks=[];
 for(const value of [0,data.min,data.max,...data.ticks])if(!ticks.some(v=>Math.abs(x(v)-x(value))<48))ticks.push(value);
 const recorded=(s,k)=>s.hasRecords&&(k==='balance'||s[k+'Count']>0);
 const bars=s=>`<svg class="current-store-bars" viewBox="0 0 ${width} 44" aria-hidden="true"><line x1="${zero}" x2="${zero}" y1="0" y2="44" class="comparison-zero"/>${['income','expense','balance'].map((k,i)=>{
  if(!recorded(s,k))return '';
  const style=metricBarStyles[k],center=8+i*14;
  return (s[k]===0?'':`<rect data-store-bar="${k}" x="${Math.min(zero,x(s[k]))}" y="${center-4}" width="${Math.abs(x(s[k])-zero)}" height="8" rx="1" fill="${style.color}"/>`)+chartMarker(style,x(s[k]),center,3.2,`data-store-marker="${k}"`);
 }).join('')}</svg>`;
 return `<svg class="comparison-money-axis" viewBox="0 0 ${width} 22" aria-hidden="true">${ticks.map(v=>`<text x="${x(v)}" y="15" text-anchor="${v===data.min?'start':v===data.max?'end':'middle'}">${moneyAxisLabel(v)}</text>`).join('')}</svg><p class="current-store-unit">元</p>${data.items.map(s=>`<article class="current-store-row"><button type="button" data-current-store="${esc(s.store)}" ${s.hasRecords?'':'disabled'} aria-label="${esc(s.store)}，查看收支明細"><strong>${esc(s.store)}</strong><span aria-hidden="true">›</span></button><div class="current-store-values">${['income','expense','balance'].map(k=>`<div><span class="current-store-label"><i class="${k}-key" aria-hidden="true">${metricBarStyles[k].shape==='circle'?'●':k==='expense'?'■':'◆'}</i>${metricNames[k]}</span><span class="${s[k]<0?'negative-amount':''}">${recorded(s,k)?number(s[k]/100):'—'}</span></div>`).join('')}</div>${s.hasRecords?bars(s):'<p class="report-empty">此期間無記錄</p>'}</article>`).join('')||'<p class="report-empty">此期間無門市。</p>'}${data.pageCount>1?`<div class="store-period-pages"><button data-current-page="-1" aria-label="上一頁門市" ${data.page===0?'disabled':''}>←</button><span>${data.page+1} / ${data.pageCount}</span><button data-current-page="1" aria-label="下一頁門市" ${data.page===data.pageCount-1?'disabled':''}>→</button></div>`:''}`;
}
