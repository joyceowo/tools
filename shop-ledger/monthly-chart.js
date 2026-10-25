import {yearAvailability} from './annual-window.js';
import {nearestChartMonth} from './reports-data.js';
import {monthlyTrendData} from './monthly-trends.js';
import {metricSeriesStyles as styles,metricBarStyles as barStyles,chartMarker,moneyAxisLabel as short,comparisonTone,yearSeriesStyles,chartSeriesKey,chartColors} from './chart-design.js';

const labels={income:'收入',expense:'支出',balance:'結餘'};
const number=value=>new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(value);
const money=value=>'NT$ '+number(value/100);
const status=m=>m.future?'尚未到來':!m.hasRecords?'無收支記錄':m.partial?'月份尚未完整':'完整月份';
const signed=value=>(value>0?'+':'')+number(value);

function seriesStyle(series){return ['current','previous','oldest'].includes(series.key)?yearSeriesStyles[2-['current','previous','oldest'].indexOf(series.key)]:series.metric==='balance'?styles.balance:barStyles[series.metric];}
function marker(series,x,y,size,selected=false){
 return chartMarker(seriesStyle(series),x,y,size,selected?'data-selected-point="'+series.key+'"':'',selected);
}

export function createMonthlyChart(container){
 let report=null,month=null,geometry=null,dragging=null,chartMode='amount',chartMetric='income';
 function render(next){
  if(report?.year!==next.year){month=null;}report=next;
  if(month===null)month=report.months.filter(m=>m.hasRecords).at(-1)?.month||report.months.find(m=>m.partial)?.month||1;
  const width=Math.max(220,container.clientWidth),mobile=window.matchMedia('(max-width:760px)').matches;
  const comparison=chartMode==='yoy';
  const height=mobile?(comparison?(width<290?156:184):(width<290?184:220)):300,left=8,right=48,top=16,bottom=30,plotWidth=width-left-right,plotHeight=height-top-bottom,step=plotWidth/12;
  const data=monthlyTrendData(report,chartMode,chartMetric),x=index=>left+(index+.5)*step;
  const y=value=>top+(data.max-value)/(data.max-data.min)*plotHeight;
  geometry={left,right,top,bottom,width,height,plotWidth,step,x,y,series:data.series};
  let svg=`<svg viewBox="0 0 ${width} ${height}" role="slider" tabindex="0" aria-label="${report.year} 年每月收入、支出與結餘，${comparison?labels[chartMetric]+'，近三年 '+(report.year-2)+'、'+(report.year-1)+'、'+report.year+' 年，共用金額刻度':'收入向上長條、支出向下長條與結餘折線，共用金額刻度'}，選擇月份" aria-valuemin="1" aria-valuemax="12" aria-describedby="monthly-chart-help" class="monthly-interactive-chart"><title>${report.year} 年每月收入、支出與結餘${comparison?'，'+labels[chartMetric]+'，近三年金額比較':''}</title><rect data-month-band y="${top}" width="${step}" height="${plotHeight}" fill="${chartColors.selectionBand}" pointer-events="none"/>`;
  for(const value of data.ticks){
   const yy=y(value);
   svg+=`<line data-axis-tick="${value}" x1="${left}" x2="${width-right}" y1="${yy}" y2="${yy}" stroke="${value===0?chartColors.zero:chartColors.grid}" stroke-width="${value===0?1.5:1}" ${value===0?'':'stroke-dasharray="2 4"'} pointer-events="none"/><text x="${width-right+6}" y="${yy+4}" fill="${chartColors.secondary}" font-size="11" pointer-events="none" aria-hidden="true">${short(value)}</text>`;
  }
  svg+=`<line data-month-crosshair y1="${top}" y2="${height-bottom}" stroke="${chartColors.zero}" stroke-dasharray="3 3" pointer-events="none"/>`;
  for(const s of (comparison?[...data.series].reverse():data.series)){
   const style=seriesStyle(s);
   if(!comparison&&s.metric!=='balance'){
    const barWidth=Math.max(4,Math.min(24,step*.58)),zero=y(0);
    for(const p of s.points)if(p.value!==null){
     if(p.value===0)svg+=marker(s,x(p.month-1),zero,2.6);
     else svg+=`<rect class="monthly-amount-bar" data-month-bar="${s.metric}" data-bar-month="${p.month}" x="${x(p.month-1)-barWidth/2}" y="${Math.min(zero,y(p.value))}" width="${barWidth}" height="${Math.abs(y(p.value)-zero)}" rx="1" fill="${style.color}" pointer-events="none"/>`;
    }
    svg+=marker(s,0,0,4.6,true);continue;
   }
   let segment=[];const segments=[];
   for(const p of s.points){if(p.value!==null)segment.push(`${x(p.month-1)},${y(p.value)}`);else if(segment.length){segments.push(segment);segment=[];}}
   if(segment.length)segments.push(segment);
   for(const points of segments)if(points.length>1){
    const balanceOverBars=!comparison&&s.metric==='balance';
    if(balanceOverBars)svg+=`<polyline data-balance-halo points="${points.join(' ')}" fill="none" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" pointer-events="none" aria-hidden="true"/>`;
    svg+=`<polyline data-trend-line="${s.key}" points="${points.join(' ')}" fill="none" stroke="${style.color}" stroke-width="${balanceOverBars?3:s.metric==='balance'?2.8:2.4}" stroke-linecap="round" stroke-linejoin="round" ${style.dash?'stroke-dasharray="'+style.dash+'"':''} pointer-events="none"/>`;
   }
   for(const p of s.points)if(p.value!==null)svg+=marker(s,x(p.month-1),y(p.value),2.6);
   svg+=marker(s,0,0,4.6,true);
  }
  for(const m of report.months){
   if(width>=290||[1,3,5,7,9,12].includes(m.month))svg+=`<text data-month-label="${m.month}" x="${x(m.month-1)}" y="${height-8}" text-anchor="middle" fill="${m.future?chartColors.secondary:chartColors.ink}" font-size="12" pointer-events="none" aria-hidden="true">${m.month}</text>`;
   svg+=`<rect data-month-target="${m.month}" x="${left+(m.month-1)*step}" y="0" width="${step}" height="${height}" fill="transparent" aria-hidden="true"/>`;
  }
  svg+='</svg>';
  const availability=report.coverage?[report.year,report.year-1,...(comparison?[report.year-2]:[])].map(year=>({year,label:yearAvailability(report.coverage,year)})).filter(item=>item.label):[];
  const empty=availability.length?'':comparison?(!data.hasValues?'近三年沒有此項目的收支記錄，可調整年份或門市。':!report.hasRecords?'本年無收支記錄，圖中顯示歷年已記錄的金額。':!report.months.some(m=>m.previous.hasRecords)?'去年無收支記錄，該年度保留斷點。':''):(!report.hasRecords?'這一年沒有收支記錄，可調整年份或門市。':'');
  container.innerHTML=`${availability.length?'<p class="monthly-comparison-notice">'+availability.map(item=>item.year+' 年：'+item.label).join('；')+'。</p>':''}${empty?'<p class="monthly-empty" role="status">'+empty+'</p>':''}
   <div class="monthly-chart-tools ${comparison?'comparison-tools':''}">${comparison?`<div class="segmented monthly-metric-choices" role="group" aria-label="比較指標">${Object.entries(labels).map(([key,label])=>`<button type="button" data-month-metric-choice="${key}" aria-pressed="${chartMetric===key}">${label}</button>`).join('')}</div>`:''}<small class="chart-unit">元</small></div>
   <p id="monthly-chart-help" class="sr-only">${comparison?'折線圖':'收入向上、支出向下的長條與結餘折線組合圖'}：橫軸是一至十二月，縱軸為金額，${comparison?'近三年共用刻度，本年紫色菱形，去年藍色虛線方點，前年赭色點線空心圓。下方兩年表格的未完整月份比較至去年同日':'三項共用刻度，支出以流出方向繪於零線下方，下方表格維持原支出金額'}；零線以下為負值，無記錄保留斷點，已記錄的零值仍顯示。點任一月份或左右拖曳，同步查看三項金額與去年同期增減比例。鍵盤可用左右鍵選月份，Home 與 End 跳到年初及年底。詳細金額與年增減顯示於下方比較表。</p>
   ${comparison?`<div class="monthly-year-legend">${data.series.map(s=>`<span>${chartSeriesKey(seriesStyle(s))}${s.year}${s.unavailable?'（—）':''}</span>`).join('')}</div>`:''}<div class="monthly-plot-panel">${svg}</div><section class="monthly-readout" aria-label="選定月份收支比較"><div class="monthly-nav"><button type="button" data-month-step="-1" aria-label="上一個月">←</button><h3 data-month-title></h3><button type="button" data-month-step="1" aria-label="下一個月">→</button></div><div data-month-detail aria-live="polite"></div></section>`;
  selectMonth(month);

 }
 function selectMonth(value){
  month=Math.max(1,Math.min(12,value));const m=report.months[month-1],xx=geometry.x(month-1),svg=container.querySelector('svg.monthly-interactive-chart');
  const currentStatus=report.coverage?yearAvailability(report.coverage,report.year):'',previousStatus=report.coverage?yearAvailability(report.coverage,report.year-1):'';
  svg.setAttribute('aria-valuenow',month);
  svg.setAttribute('aria-valuetext',`${month} 月，${Object.keys(labels).map(key=>labels[key]+' '+(currentStatus||(m.hasRecords?money(m[key]):status(m)))+'，去年 '+(previousStatus||(m.previous.hasRecords?money(m.previous[key]):'無記錄'))+'，增減 '+(m.changes.find(c=>c.metric===key).percent===null?'不計比例':signed(m.changes.find(c=>c.metric===key).percent)+'%')).join('；')}`);
  container.querySelector('[data-month-band]').setAttribute('x',geometry.left+(month-1)*geometry.step);
  for(const attr of ['x1','x2'])container.querySelector('[data-month-crosshair]').setAttribute(attr,xx);
  for(const s of geometry.series){
   const point=container.querySelector(`[data-selected-point="${s.key}"]`),value=s.points[month-1].value;
   point.style.display=value===null?'none':'';if(value!==null)point.setAttribute('transform',`translate(${xx} ${geometry.y(value)})`);
  }
  for(const label of container.querySelectorAll('[data-month-label]')){const selected=Number(label.dataset.monthLabel)===month;label.setAttribute('font-weight',selected?'700':'400');label.setAttribute('fill',selected?chartColors.selection:chartColors.secondary);}
  container.querySelector('[data-month-title]').textContent=month+' 月';
  const reasonText={future:'此月份尚未到來，暫不比較。',current_missing:'本月無記錄，暫不比較。',previous_missing:'去年同月無記錄，暫不計比例。',zero_base:'去年為零，不計比例。',negative_base:'去年為負，不計比例。'};
  const notes=[...new Set(m.changes.filter(c=>c.reason&&!(previousStatus&&c.reason==='previous_missing')&&!(currentStatus&&c.reason==='current_missing')).map(c=>['zero_base','negative_base'].includes(c.reason)?labels[c.metric]+'：'+reasonText[c.reason]:reasonText[c.reason]))];
  const rows=m.changes.map(c=>{
   const direction=comparisonTone(c.metric,c.percent);
   return `<tr data-month-metric="${c.metric}" class="${chartMode==='yoy'&&chartMetric===c.metric?'monthly-selected-metric':''}"><th scope="row">${chartMode==='amount'?(c.metric==='balance'?chartSeriesKey(styles.balance):`<svg class="report-series-key" viewBox="0 0 24 14" aria-hidden="true"><rect x="8" y="${c.metric==='expense'?7:1}" width="8" height="6" rx="1" fill="${barStyles[c.metric].color}"/><line x1="2" x2="22" y1="7" y2="7" stroke="currentColor" stroke-width=".6"/></svg>`):''}${labels[c.metric]}</th><td class="monthly-current${m.hasRecords&&m[c.metric]<0?' negative-amount':''}">${m.hasRecords?number(m[c.metric]/100):'—'}</td><td class="${m.previous.hasRecords&&m.previous[c.metric]<0?'negative-amount':''}">${m.previous.hasRecords?number(m.previous[c.metric]/100):'—'}</td><td class="monthly-growth comparison-change ${direction}">${c.percent===null?'—':signed(c.percent)+'%'}</td></tr>`;
  }).join('');
  const period=currentStatus?'':m.future?status(m):m.hasRecords?'':'無記錄';
  container.querySelector('[data-month-detail]').innerHTML=`${period?`<p class="monthly-status">${period}</p>`:''}<table class="monthly-comparison"><caption class="sr-only">${report.year} 年 ${month} 月與去年同月收支比較，金額單位為元，增減為相對去年同月百分比</caption><colgroup><col class="metric-col"><col class="amount-col"><col class="amount-col"><col class="growth-col"></colgroup><thead><tr><th scope="col">項目</th><th scope="col">${chartMode==='yoy'?chartSeriesKey(yearSeriesStyles[2]):''}${report.year} 年</th><th scope="col">${chartMode==='yoy'?chartSeriesKey(yearSeriesStyles[1]):''}${report.year-1} 年</th><th scope="col">年增減</th></tr></thead><tbody>${rows}</tbody></table>${notes.length?'<p class="monthly-comparison-notice">'+notes.join(' ')+'</p>':''}`;
  container.querySelector('[data-month-step="-1"]').disabled=month===1;container.querySelector('[data-month-step="1"]').disabled=month===12;
 }
 function selectFromPointer(event){
  const svg=event.target.closest?.('svg.monthly-interactive-chart');if(!svg||!geometry)return;
  const matrix=svg.getScreenCTM();if(!matrix)return;
  const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
  const local=point.matrixTransform(matrix.inverse()),next=nearestChartMonth(local.x,geometry.left+geometry.step/2,geometry.plotWidth-geometry.step);
  if(next!==month)selectMonth(next);
 }
 container.addEventListener('pointerdown',event=>{const svg=event.target.closest?.('svg.monthly-interactive-chart');if(!svg||event.button!==0)return;dragging=event.pointerId;svg.setPointerCapture(event.pointerId);svg.focus({preventScroll:true});selectFromPointer(event);});
 container.addEventListener('pointermove',event=>{if(dragging===event.pointerId)selectFromPointer(event);});
 container.addEventListener('pointerup',()=>{dragging=null;});container.addEventListener('pointercancel',()=>{dragging=null;});
 container.addEventListener('click',event=>{
  const mode=event.target.closest('[data-month-chart-mode]');
  if(mode){if(chartMode!==mode.dataset.monthChartMode){chartMode=mode.dataset.monthChartMode;render(report);container.querySelector(`[data-month-chart-mode="${chartMode}"]`).focus({preventScroll:true});}return;}
  const metric=event.target.closest('[data-month-metric-choice]');
  if(metric){if(chartMetric!==metric.dataset.monthMetricChoice){chartMetric=metric.dataset.monthMetricChoice;render(report);container.querySelector(`[data-month-metric-choice="${chartMetric}"]`).focus({preventScroll:true});}return;}
  const step=event.target.closest('[data-month-step]');
  if(step)selectMonth(month+Number(step.dataset.monthStep));else selectFromPointer(event);
 });
 container.addEventListener('keydown',event=>{if(!event.target.matches('svg.monthly-interactive-chart'))return;const next={ArrowLeft:month-1,ArrowRight:month+1,Home:1,End:12,Enter:month,' ':month}[event.key];if(next!==undefined){event.preventDefault();selectMonth(next);}});
 return {render,setMode(next){const mode=next==='yoy'?'yoy':'amount';if(chartMode!==mode){chartMode=mode;}}};
}
