import {categoryReport,previousRange} from './reporting.js';
import {delta} from './reports-data.js';
import {niceChartScale,comparisonTone} from './chart-design.js';
const number=v=>new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(v);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const amount=v=>v===null?'—':number(v/100).replace(/(\.\d+)$/,'<wbr><span class="amount-fraction">$1</span>');
export function categoryComparisonData(rows,range,type){
 const current=categoryReport(rows,range,type),previous=categoryReport(rows,previousRange(range,'year'),type),now=new Map(current.map(g=>[g.name,g])),before=new Map(previous.map(g=>[g.name,g]));
 const all=[...new Set([...now.keys(),...before.keys()])].map(name=>{
  const current=now.get(name)?.value??null,previous=before.get(name)?.value??null;
  return {name,type,current,previous,percent:current!==null&&previous!==null?delta(current,previous):null};
 }).sort((a,b)=>Number(b.current!==null)-Number(a.current!==null)||(b.current??b.previous)-(a.current??a.previous)||a.name.localeCompare(b.name));
 return {all,...niceChartScale(all.flatMap(g=>[g.current,g.previous]))};
}
export function categoryComparisonMarkup(data,range,availableWidth=320){
 if(!data.all.length)return '<p class="report-empty">本期與去年同期皆無記錄。</p>';
 const year=Number(range.start.slice(0,4));
 const key=(name,period)=>'data-category="'+esc(name)+'" data-category-type="'+data.all[0].type+'" data-category-period="'+period+'"';
 const row=g=>{
  const preferred=g.current!==null?'current':'previous';
  const values=['current','previous'].map(period=>'<button type="button" '+key(g.name,period)+' aria-label="'+esc(g.name)+'，查看 '+(period==='current'?year:year-1)+' 年明細" '+(g[period]===null?'disabled':'')+' class="'+(g[period]<0?'negative-amount':'')+'">'+amount(g[period])+'</button>').join('');
  return '<article class="category-comparison-row"><button type="button" class="category-comparison-name" '+key(g.name,preferred)+'><strong>'+esc(g.name)+'</strong><span aria-hidden="true">›</span></button><div class="category-comparison-values">'+values+'<span class="comparison-change '+comparisonTone(g.type,g.percent)+'">'+(g.percent===null?'—':(g.percent>0?'+':'')+number(g.percent)+'%')+'</span></div></article>';
 };
 return '<div class="category-comparison-unit">元</div><div class="category-comparison-head"><span>分類</span><span>'+year+'</span><span>'+(year-1)+'</span><span>增減</span></div>'+data.all.slice(0,3).map(row).join('')+(data.all.length>3?'<details class="report-extra"><summary>其他 '+(data.all.length-3)+' 類</summary>'+data.all.slice(3).map(row).join('')+'</details>':'');
}
