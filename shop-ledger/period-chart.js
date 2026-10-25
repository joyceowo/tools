import {niceChartScale,comparisonTone} from './chart-design.js';
const names={income:'收入',expense:'支出',balance:'結餘'};
const amount=value=>value===null?'無記錄':new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(value/100).replace(/(\.\d+)$/,'<wbr><span class="amount-fraction">$1</span>');
const growth=value=>value===null?'—':(value>0?'+':'')+new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(value)+'%';
export function periodComparisonData(rows){
 const series=rows.map(row=>({metric:row.metric,label:names[row.metric],current:row.currentCount?row.current:null,previous:row.previousCount?row.previous:null,percent:row.currentCount&&row.previousCount?row.percent??null:null}));
 return {series,...niceChartScale(series.flatMap(row=>[row.current,row.previous]))};
}
export function periodComparisonMarkup(rows,availableWidth=320,labels={current:'本期',previous:'去年同期'}){
 const data=periodComparisonData(rows);
 const unavailable=[labels.currentStatus?labels.current+' 年：'+labels.currentStatus:'',labels.previousStatus?labels.previous+' 年：'+labels.previousStatus:''].filter(Boolean);
 const notice=unavailable.length?'<p class="period-custom-notice">'+unavailable.join('；')+'。</p>':'';
 if(!labels.currentStatus&&!labels.previousStatus&&data.series.every(row=>row.current===null&&row.previous===null))return '<p class="period-chart-empty">本期與對照期皆無記錄。</p>';
 return `${notice}<table class="period-values-table period-table-only"><caption class="sr-only">本期與對照期收支比較，金額單位為元；無記錄不補成零。</caption><thead><tr><th scope="col">項目</th><th scope="col">${labels.current}</th><th scope="col">${labels.previous}</th><th scope="col">年增減</th></tr></thead><tbody>${data.series.map(row=>`<tr data-period-metric="${row.metric}"><th scope="row">${row.label}</th><td class="${row.current!==null&&row.current<0?'negative-amount':''}">${labels.currentStatus?'—':amount(row.current)}</td><td class="${row.previous!==null&&row.previous<0?'negative-amount':''}">${labels.previousStatus?'—':amount(row.previous)}</td><td class="comparison-change ${comparisonTone(row.metric,row.percent)}">${growth(row.percent)}</td></tr>`).join('')}</tbody></table>`;
}
