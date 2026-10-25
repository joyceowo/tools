import {metricSeriesStyles,chartSeriesKey,chartMarker,niceChartScale,moneyAxisLabel,chartColors} from './chart-design.js';
import {overviewWindowLabel,shiftOverviewRange} from './overview-window.js';
const names={income:'收入',expense:'支出',balance:'結餘'};
const amount=value=>new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(value/100);
const day=value=>value.slice(5).replace('-','/');
export function createOverviewChart(container,onRange,{today,onWindowChange}){
 let input=null,index=0,geometry=null,dragging=null;
 function render(next){
  const changed=!input||input.start!==next.start||input.end!==next.end||input.group!==next.group;input=next;
  if(changed){const recorded=input.points.findLastIndex(p=>p.hasRecords);index=recorded<0?input.points.length-1:recorded;}index=Math.min(index,input.points.length-1);
  const width=Math.max(220,container.clientWidth),height=window.matchMedia('(max-width:760px)').matches?224:280,left=8,right=48,top=16,bottom=30,plotWidth=width-left-right,step=plotWidth/Math.max(1,input.points.length);
  const scale=niceChartScale(input.points.filter(p=>p.hasRecords).flatMap(p=>Object.keys(names).map(k=>p[k]))),x=i=>left+(i+.5)*step,y=value=>top+(scale.max-value)/(scale.max-scale.min)*(height-top-bottom);
  geometry={left,step,x,y,plotWidth};
  let svg=`<svg viewBox="0 0 ${width} ${height}" class="overview-interactive-chart" role="slider" tabindex="0" aria-label="${input.start} 至 ${input.end}，${input.label}，選擇期間" aria-valuemin="1" aria-valuemax="${input.points.length}" aria-describedby="overview-chart-help"><title>${input.label}，三項共用金額刻度</title><rect data-overview-band y="${top}" width="${step}" height="${height-top-bottom}" fill="${chartColors.selectionBand}" pointer-events="none"/>`;
  for(const value of scale.ticks){const yy=y(value);svg+=`<line x1="${left}" x2="${width-right}" y1="${yy}" y2="${yy}" stroke="${value===0?chartColors.zero:chartColors.grid}" ${value===0?'':'stroke-dasharray="2 4"'} pointer-events="none"/><text x="${width-right+6}" y="${yy+4}" font-size="11" fill="${chartColors.secondary}" pointer-events="none" aria-hidden="true">${moneyAxisLabel(value)}</text>`;}
  svg+=`<line data-overview-guide y1="${top}" y2="${height-bottom}" stroke="${chartColors.zero}" stroke-dasharray="3 3" pointer-events="none"/>`;
  for(const key of Object.keys(names)){
   const style=metricSeriesStyles[key];let segment=[];const flush=()=>{if(segment.length>1)svg+=`<polyline points="${segment.join(' ')}" fill="none" stroke="${style.color}" stroke-width="${key==='balance'?2.8:2.2}" stroke-linecap="round" stroke-linejoin="round" ${style.dash?'stroke-dasharray="'+style.dash+'"':''} pointer-events="none"/>`;segment=[];};
   input.points.forEach((p,i)=>{if(!p.hasRecords){flush();return;}segment.push(x(i)+','+y(p[key]));if(input.points.length<=32)svg+=chartMarker(style,x(i),y(p[key]),2.3);});flush();svg+=chartMarker(style,0,0,4.6,`data-overview-marker="${key}"`,true);
  }
  input.points.forEach((p,i)=>{if(i===0||i===input.points.length-1||i%Math.max(1,Math.ceil(input.points.length/4))===0)svg+=`<text x="${x(i)}" y="${height-8}" text-anchor="${i===0?'start':i===input.points.length-1?'end':'middle'}" font-size="12" fill="${chartColors.secondary}" aria-hidden="true" pointer-events="none">${input.group==='month'?p.key.slice(2).replace('-','/'):day(p.start)}</text>`;svg+=`<rect data-overview-target="${i}" x="${left+i*step}" y="0" width="${step}" height="${height}" fill="transparent" aria-hidden="true"/>`;});
  container.innerHTML=`<div class="chart-title-row overview-chart-heading"><h2>${input.label}</h2></div><div class="overview-window-nav" role="group" aria-label="切換日期區間"><button type="button" data-overview-window="-1" aria-label="前一個區間" ${input.start==='1000-01-01'?'disabled':''}>‹</button><strong class="overview-window-label">${overviewWindowLabel(input,today)}</strong><button type="button" data-overview-window="1" aria-label="後一個區間" ${input.end>=today?'disabled':''}>›</button></div><div class="overview-unit"><small class="chart-unit">元</small></div><p id="overview-chart-help" class="sr-only">點選或滑動查看每日金額，方向鍵可選擇日期，前後按鈕切換同樣天數的區間。無記錄處留白。</p>${svg}</svg><section class="overview-chart-readout" aria-label="所選日期收支"><strong class="overview-selected-date" data-overview-heading></strong><div data-overview-values aria-live="polite"></div></section>`;
  select(index);
 }
 function select(value){
  index=Math.max(0,Math.min(input.points.length-1,value));const p=input.points[index];if(!p)return;
  const svg=container.querySelector('svg'),xx=geometry.x(index);
  svg.setAttribute('aria-valuenow',index+1);svg.setAttribute('aria-valuetext',p.start+' 至 '+p.end+'，'+(p.hasRecords?Object.keys(names).map(k=>names[k]+' '+amount(p[k])+' 元').join('，'):'無收支記錄'));
  container.querySelector('[data-overview-band]').setAttribute('x',geometry.left+index*geometry.step);
  for(const attr of ['x1','x2'])container.querySelector('[data-overview-guide]').setAttribute(attr,xx);
  for(const key of Object.keys(names)){const mark=container.querySelector(`[data-overview-marker="${key}"]`);mark.style.display=p.hasRecords?'':'none';if(p.hasRecords)mark.setAttribute('transform',`translate(${xx} ${geometry.y(p[key])})`);}
  container.querySelector('[data-overview-heading]').textContent=input.group==='month'?p.key.replace('-',' / '):p.start===p.end?p.start.replaceAll('-','/'):p.start.replaceAll('-','/')+'–'+day(p.end);
  container.querySelector('[data-overview-values]').innerHTML=`<dl class="overview-selected-values">${Object.keys(names).map(k=>`<div><dt>${chartSeriesKey(metricSeriesStyles[k])}${names[k]}</dt><dd class="${p.hasRecords&&p[k]<0?'negative-amount':''}">${p.hasRecords?amount(p[k]):'—'}</dd></div>`).join('')}</dl>${p.hasRecords?'<button type="button" class="text-button" data-overview-records>查看收支明細 →</button>':'<p class="chart-interaction-hint">此期間沒有收支記錄。</p>'}`;
 }
 function fromPointer(event){const svg=event.target.closest?.('svg');if(!svg||!geometry)return;const matrix=svg.getScreenCTM();if(!matrix)return;const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const local=point.matrixTransform(matrix.inverse());select(Math.floor((local.x-geometry.left)/geometry.step));}
 container.addEventListener('pointerdown',event=>{const svg=event.target.closest?.('svg');if(!svg||event.button!==0)return;dragging=event.pointerId;svg.setPointerCapture(event.pointerId);svg.focus({preventScroll:true});fromPointer(event);});
 container.addEventListener('pointermove',event=>{if(dragging===event.pointerId)fromPointer(event);});
 container.addEventListener('pointerup',()=>{dragging=null;});container.addEventListener('pointercancel',()=>{dragging=null;});
 container.addEventListener('click',event=>{
  const step=event.target.closest('[data-overview-window]');
  if(step){
   if(step.disabled)return;
   onWindowChange(shiftOverviewRange(input,Number(step.dataset.overviewWindow),today));
   const next=container.querySelector(`[data-overview-window="${step.dataset.overviewWindow}"]`);
   (next?.disabled?container.querySelector('[data-overview-window="-1"]'):next)?.focus({preventScroll:true});return;
  }
  if(event.target.closest('[data-overview-records]')){const p=input.points[index];onRange({start:p.start,end:p.end});}else fromPointer(event);
 });
 container.addEventListener('keydown',event=>{if(!event.target.matches('svg'))return;const value={ArrowLeft:index-1,ArrowRight:index+1,Home:0,End:input.points.length-1}[event.key];if(value!==undefined){event.preventDefault();select(value);}});
 return {render};
}
