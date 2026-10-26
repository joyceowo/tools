import {limitedReportPeriod} from './reporting.js';

// One location for report queries; comparison tabs continue to control presentation.
export function setupReportPeriod({onYear,onPeriod}){
 const $=id=>document.getElementById(id);
 let years=[];
 function render({monthly,selectedYear,availableYears,today,range,period}){
  years=availableYears.slice(0,2);
  $('report-year-controls').hidden=!monthly;$('report-period-options').hidden=monthly;
  $('report-period-bar').setAttribute('aria-label',monthly?'統計年份':'統計期間');
  const controls=$('report-year-controls');
  if([...controls.children].map(b=>Number(b.dataset.reportYear)).join('|')!==years.join('|')){
   controls.replaceChildren(...years.map(year=>{
    const button=document.createElement('button');button.type='button';button.dataset.reportYear=year;button.textContent=year;button.setAttribute('aria-label','統計年份：'+year+' 年');return button;
   }));
  }
  controls.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.reportYear)===selectedYear)));
  const selected=limitedReportPeriod(range,today,period).value;
  $('report-period-options').querySelectorAll('button').forEach(b=>{
   const value=b.dataset.reportPeriod,label=value==='month'?'本月':value==='year'?'今年':'去年';
   const date=value==='month'?today.slice(0,4)+' 年 '+Number(today.slice(5,7))+' 月':Number(today.slice(0,4))-(value==='lastyear'?1:0)+' 年';
   b.setAttribute('aria-pressed',String(value===selected));b.setAttribute('aria-label',label+'，'+date);
  });
 }
 $('report-year-controls').onclick=e=>{
  const b=e.target.closest('[data-report-year]');if(b&&years.includes(Number(b.dataset.reportYear))&&b.getAttribute('aria-pressed')!=='true')onYear(Number(b.dataset.reportYear));
 };
 $('report-period-options').onclick=e=>{
  const b=e.target.closest('[data-report-period]');if(b&&b.getAttribute('aria-pressed')!=='true')onPeriod(b.dataset.reportPeriod);
 };
 return {render};
}
