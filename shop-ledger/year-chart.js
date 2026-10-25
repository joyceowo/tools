import {nearestChartMonth,yearMonthDetails,delta} from './reports-data.js';
import {yearSeriesStyles,chartMarker,niceChartScale,moneyAxisLabel,comparisonTone,chartColors} from './chart-design.js';

const names={income:'收入',expense:'支出',balance:'結餘'};
const number=value=>new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(value);
const money=value=>'NT$ '+new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(value/100);
const change=value=>value===null?'無可比較資料':(value>0?'+':'')+number(value)+'%';

export function yearValuesMarkup(details){
 const current=details.at(-1);if(!current)return '';
 const previous=current.previous,has=(item,key)=>item.hasRecords&&(key==='balance'||item[key+'Count']>0);
 const value=(item,key,included=true)=>included&&has(item,key)?'<td class="'+(item===current?'year-current ':'')+(item[key]<0?'negative-amount':'')+'">'+number(item[key]/100).split('.').map((part,i)=>'<span>'+(i?'.':'')+part+'</span>').join('')+'</td>':'<td class="missing-amount" aria-label="'+(included?'無記錄':'期間外')+'">—</td>';
 const heading=(item,start,end,key)=>'<button type="button" data-chart-records="'+key+'" data-chart-start="'+start+'" data-chart-end="'+end+'" '+(!item.hasRecords?'disabled':'')+' aria-label="查看 '+item.year+' 年所選月份明細">'+item.year+' 年</button>';
 const rows=Object.entries(names).map(([key,label])=>{
  const rate=current.included&&has(current,key)&&has(previous,key)?delta(current[key],previous[key]):null;
  return '<tr><th scope="row">'+label+'</th>'+value(current,key,current.included)+value(previous,key)+'<td class="comparison-change '+comparisonTone(key,rate)+'">'+(rate===null?'—':change(rate))+'</td></tr>';
 }).join('');
 return '<table class="chart-values-table year-two-values"><caption class="sr-only">所選月份收支比較，金額單位為元；本期 '+current.start+' 至 '+current.end+'，去年同期 '+previous.start+' 至 '+previous.end+'</caption><thead><tr><th scope="col">項目</th><th scope="col">'+heading(current,current.start,current.end,current.key)+'</th><th scope="col">'+heading(previous,previous.start,previous.end,previous.start.slice(0,7))+'</th><th scope="col">年增減</th></tr></thead><tbody>'+rows+'</tbody></table>';
}

export function createYearChart(container,onMonth){
  let reports=[],metric='income',month=null,geometry=null,dragging=null;
  function render(input){
    reports=input.reports;metric=input.metric;
    if(month===null){const recorded=Array.from({length:12},(_,i)=>i+1).filter(m=>yearMonthDetails(reports,m,metric).at(-1)?.hasMetric);month=recorded.at(-1)||1;}
    const mobile=window.matchMedia('(max-width:760px)').matches,width=Math.max(220,container.clientWidth),height=mobile?(width<290?156:184):300,left=46,right=42,top=16,bottom=30,plotWidth=width-left-right,step=plotWidth/12;
    const byMonth=Array.from({length:12},(_,i)=>yearMonthDetails(reports,i+1,metric));
    const scale=niceChartScale(byMonth.flat().filter(d=>d.hasMetric).map(d=>d.value));
    const x=index=>left+(index+.5)*step,y=value=>top+(scale.max-value)/(scale.max-scale.min)*(height-top-bottom);
    geometry={width,height,left,right,top,bottom,step,x,y};
    let svg=`<svg viewBox="0 0 ${width} ${height}" role="slider" tabindex="0" aria-label="近三年每月${names[metric]}，共用金額刻度，選擇月份" aria-valuemin="1" aria-valuemax="12" aria-valuenow="${month}" aria-describedby="year-chart-instructions" class="interactive-year-chart"><title>近三年每月${names[metric]}</title><rect data-chart-band y="${top}" width="${step}" height="${height-top-bottom}" fill="${chartColors.selectionBand}" pointer-events="none"/>`;
    for(const value of scale.ticks){const yy=y(value);svg+=`<line x1="${left}" x2="${width-right}" y1="${yy}" y2="${yy}" stroke="${value===0?chartColors.zero:chartColors.grid}" ${value===0?'':'stroke-dasharray="2 4"'} pointer-events="none"/><text x="${left-4}" y="${yy+4}" text-anchor="end" font-size="11" fill="${chartColors.secondary}" pointer-events="none" aria-hidden="true">${moneyAxisLabel(value)}</text>`;}
    svg+=`<line data-chart-crosshair y1="${top}" y2="${height-bottom}" stroke="${chartColors.zero}" stroke-dasharray="3 3" pointer-events="none"/>`;
    const endLabels=[];
    reports.forEach((report,index)=>{
      const style=yearSeriesStyles[index];let segment=[];const flush=()=>{if(segment.length>1)svg+=`<polyline data-year-series="${report.year}" points="${segment.join(' ')}" fill="none" stroke="${style.color}" stroke-width="${index===reports.length-1?2.8:2.2}" stroke-linecap="round" stroke-linejoin="round" ${style.dash?'stroke-dasharray="'+style.dash+'"':''} pointer-events="none"/>`;segment=[];};
      for(let m=1;m<=12;m++){
        const detail=byMonth[m-1][index];if(!detail.hasMetric){flush();continue;}
        const xx=x(m-1),yy=y(detail.value);segment.push(xx+','+yy);svg+=chartMarker(style,xx,yy,2.6);
      }
      flush();svg+=chartMarker(style,0,0,4.6,`data-chart-marker="${index}"`,true);
      const last=byMonth.findLastIndex(details=>details[index].hasMetric);
      if(last>=0)endLabels.push({year:report.year,style,x:x(last),y:y(byMonth[last][index].value)});
    });
    endLabels.sort((a,b)=>a.y-b.y);
    endLabels.forEach((label,i)=>label.labelY=Math.max(top+6,label.y,i?endLabels[i-1].labelY+19:0));
    for(let i=endLabels.length-1;i>=0;i--)endLabels[i].labelY=Math.min(endLabels[i].labelY,height-bottom-4-(endLabels.length-1-i)*19);
    for(const label of endLabels)svg+=`<path d="M ${label.x+4} ${label.y} L ${width-39} ${label.labelY}" fill="none" stroke="${label.style.color}" stroke-width="1" pointer-events="none"/><text x="${width-36}" y="${label.labelY+4}" fill="${label.style.textColor||label.style.color}" font-size="12" font-weight="600" pointer-events="none">${label.year}</text>`;
    for(let m=1;m<=12;m++){
      if(width>=290||[1,3,5,7,9,12].includes(m))svg+=`<text data-year-month-label="${m}" x="${x(m-1)}" y="${height-8}" text-anchor="middle" font-size="12" fill="${chartColors.secondary}" pointer-events="none" aria-hidden="true">${m}</text>`;
      svg+=`<rect data-year-month-target="${m}" x="${left+(m-1)*step}" y="0" width="${step}" height="${height}" fill="transparent" aria-hidden="true"/>`;
    }
    container.innerHTML=`<h3 class="year-metric-title">每月結餘</h3><p id="year-chart-instructions" class="sr-only">點月份或左右滑動看金額。三年共用金額刻度，無記錄月份留白；鍵盤可用左右鍵、Home 及 End。</p>${svg}</svg><div class="year-chart-readout"><div class="year-chart-month-nav"><button type="button" data-chart-step="-1" aria-label="上一個月">←</button><strong data-chart-heading></strong><button type="button" data-chart-step="1" aria-label="下一個月">→</button></div><div data-chart-values class="year-chart-values" aria-live="polite"></div></div>`;
    selectMonth(month);
  }
  function selectMonth(value){
    month=Math.max(1,Math.min(12,value));
    const details=yearMonthDetails(reports,month,metric),{left,step,x,y}=geometry,xx=x(month-1);
    const svg=container.querySelector('svg');
    svg.setAttribute('aria-valuenow',month);
    svg.setAttribute('aria-valuetext',month+' 月，'+details.map(d=>d.year+' 年 '+(d.hasMetric?money(d.value):d.status)).join('；'));
    const crosshair=container.querySelector('[data-chart-crosshair]');crosshair.setAttribute('x1',xx);crosshair.setAttribute('x2',xx);
    container.querySelector('[data-chart-band]').setAttribute('x',left+(month-1)*step);
    container.querySelector('[data-chart-heading]').textContent=month+' 月';
    container.querySelector('[data-chart-values]').innerHTML=yearValuesMarkup(details);
    details.forEach((d,i)=>{const marker=container.querySelector(`[data-chart-marker="${i}"]`);marker.style.display=d.hasMetric?'':'none';if(d.hasMetric)marker.setAttribute('transform',`translate(${xx} ${y(d.value)})`);});
    for(const label of container.querySelectorAll('[data-year-month-label]'))label.setAttribute('font-weight',Number(label.dataset.yearMonthLabel)===month?'700':'400');
    container.querySelector('[data-chart-step="-1"]').disabled=month===1;
    container.querySelector('[data-chart-step="1"]').disabled=month===12;
  }
  function selectFromPointer(event){
    const svg=event.target.closest?.('svg');if(!svg||!geometry)return;
    const matrix=svg.getScreenCTM();if(!matrix)return;
    const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
    const local=point.matrixTransform(matrix.inverse());
    const next=nearestChartMonth(local.x,geometry.left+geometry.step/2,geometry.width-geometry.left-geometry.right-geometry.step);
    if(next!==month)selectMonth(next);
  }
  container.addEventListener('pointerdown',event=>{const svg=event.target.closest?.('svg');if(!svg||event.button!==0)return;dragging=event.pointerId;svg.setPointerCapture(event.pointerId);svg.focus({preventScroll:true});selectFromPointer(event);});
  container.addEventListener('pointermove',event=>{if(dragging===event.pointerId)selectFromPointer(event);});
  container.addEventListener('pointerup',()=>{dragging=null;});
  container.addEventListener('pointercancel',()=>{dragging=null;});
  container.addEventListener('click',event=>{const step=event.target.closest('[data-chart-step]'),records=event.target.closest('[data-chart-records]');if(step)selectMonth(month+Number(step.dataset.chartStep));else if(records)onMonth(records.dataset.chartRecords,{start:records.dataset.chartStart,end:records.dataset.chartEnd});else selectFromPointer(event);});
  container.addEventListener('keydown',event=>{if(!event.target.matches('svg'))return;const keys={ArrowLeft:month-1,ArrowRight:month+1,Home:1,End:12};if(keys[event.key]!==undefined){event.preventDefault();selectMonth(keys[event.key]);}});
  return {render};
}
