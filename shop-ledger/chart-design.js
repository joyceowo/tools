export const metricSeriesStyles={income:{color:'#14664e',shape:'circle',dash:''},expense:{color:'#a44029',shape:'square',dash:'6 4'},balance:{color:'#593696',shape:'diamond',dash:''}};
// Filled bars have their own palette; line series and semantic text keep their depth.
export const metricBarStyles={income:{...metricSeriesStyles.income,color:'#609e8b'},expense:{...metricSeriesStyles.expense,color:'#c6816c'},balance:{...metricSeriesStyles.balance,color:'#9680b6'}};
// Keep existing year-label text colors independent from the lighter chart marks.
export const yearSeriesStyles=[{color:'#b0824f',textColor:'#b37d3c',shape:'circle',dash:'2 5',hollow:true},{color:'#5d86ae',textColor:'#4e79a7',shape:'square',dash:'8 4'},{color:'#593696',shape:'diamond',dash:''}];
// Neutral chart furniture stays consistent across report types.
export const chartColors={ink:'#282433',secondary:'#655f70',grid:'#e1dce7',zero:'#94839f',selection:'#593696',selectionBand:'#f3f1f8'};
const number=new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2});
export function moneyAxisLabel(cents){
 const value=cents===0?0:cents/100;
 return Math.abs(value)>=100000000?number.format(value/100000000)+'億':Math.abs(value)>=10000?number.format(value/10000)+'萬':number.format(value);
}
export function percentAxisLabel(value){if(value===0)value=0;return (value>0?'+':'')+(Math.abs(value)>=100000000?number.format(value/100000000)+'億':Math.abs(value)>=10000?number.format(value/10000)+'萬':number.format(value))+'%';}
export function niceChartScale(values,{percent=false}={}){
 const valid=values.filter(v=>v!==null&&Number.isFinite(v));
 let low=Math.min(0,...valid),high=Math.max(0,...valid);
 if(percent&&low===high){low=-10;high=10;}
 const raw=((high-low)||40000)/(low<0&&high>0?5:4),magnitude=10**Math.floor(Math.log10(raw)),fraction=raw/magnitude;
 const step=Math.max(percent?0.01:1,(fraction<=1?1:fraction<=2?2:fraction<=2.5?2.5:fraction<=5?5:10)*magnitude);
 const min=Math.floor(low/step)*step,max=high===low?min+step*4:Math.max(min+step,Math.ceil(high/step)*step);
 return {min,max,ticks:Array.from({length:Math.round((max-min)/step)+1},(_,i)=>min+i*step)};
}
export function chartMarker(style,x,y,size,attributes='',selected=false){
 const attrs=`fill="${style.hollow?'white':style.color}" stroke="${style.hollow?style.color:'white'}" stroke-width="${selected?1.8:1}"`;
 const shape=style.shape==='circle'?`<circle r="${size}" ${attrs}/>`:style.shape==='square'?`<rect x="${-size}" y="${-size}" width="${size*2}" height="${size*2}" rx=".6" ${attrs}/>`:`<path d="M 0 ${-size-1} L ${size+1} 0 L 0 ${size+1} L ${-size-1} 0 Z" ${attrs}/>`;
 return `<g ${attributes} transform="translate(${x} ${y})" pointer-events="none">${shape}</g>`;
}

// Rates and absolute differences share direction; an expense increase is unfavorable.
export function comparisonTone(metric,change){
 if(!Number.isFinite(change)||change===0)return 'neutral';
 return (metric==='expense'?change<0:change>0)?'favorable':'unfavorable';
}
export function comparisonDifferenceMarkup(metric,cents){
 const value=Number.isFinite(cents)?(cents>0?'+':'')+number.format(cents===0?0:cents/100)+' 元':'—';
 return `<span class="comparison-change ${comparisonTone(metric,cents)}">${value}</span>`;
}

export const periodSeriesStyles={current:{color:'#593696',shape:'circle',dash:''},previous:{color:'#5d86ae',shape:'square',dash:'6 4',hollow:true}};
export function chartSeriesKey(style){
 return `<svg class="report-series-key" viewBox="0 0 24 14" aria-hidden="true"><line x1="0" x2="24" y1="7" y2="7" stroke="${style.color}" stroke-width="2" ${style.dash?'stroke-dasharray="'+style.dash+'"':''}/>${chartMarker(style,12,7,2.6)}</svg>`;
}
