import {annualWindow,yearAvailability} from './annual-window.js';
import {categoryComparisonData,categoryComparisonMarkup} from './category-comparison.js';
import {categoryRowsMarkup,currentStoresData,currentStoresMarkup} from './compact-report-ui.js';
import {storeSamePeriodData,storeSamePeriodMarkup} from './summary-comparison.js';
import {periodComparisonMarkup} from './period-chart.js';
import {createMonthlyChart} from './monthly-chart.js';
import {setupReportPeriod} from './report-period.js';
import {annualRange,categoryReport,compareRanges,previousRange,metricNames,monthlyCashflow} from './reporting.js';
const $=id=>document.getElementById(id);
export function createReports({today,onStore,onContextChange,onLimitedPeriod,onPeriod,getPeriod,onRange,onMonth,onCategory,onNavigate=()=>{},onBack}){
 let coverage=annualWindow(today);
 let source=[],knownStores=[],allStoreLabel='全部門市',scope='*',range={start:today.slice(0,7)+'-01',end:today},demo=true,view='rhythm',menu=true,monthlyYear=Number(today.slice(0,4)),monthlyReady=false;
 let categoryComparison='current',storeComparison='current',storeYoyPage=0,storeYoyContext='',currentStorePage=0,currentStoreContext='',monthlyMode='amount';
 let currentStoreVisible=5,storeYoyVisible=5;
 const mobileStores=()=>window.matchMedia('(max-width:760px)').matches;
 const monthlyChart=createMonthlyChart($('monthly-chart'));
 const periodControls=setupReportPeriod({onYear:next=>{monthlyYear=next;monthlyReady=true;renderTotal();},onPeriod});
 const titles={rhythm:'收支統計',categories:'分類分析',stores:'門市比較'};
 function context(text){
  $('report-context').textContent=text+(demo?' · 模擬資料':'');
  $('report-filter-label').textContent=['categories','stores'].includes(view)?text.replace(range.start+' ～ '+range.end,range.start.replaceAll('-','/')+'–'+(range.start.slice(0,4)===range.end.slice(0,4)?range.end.slice(5).replace('-','/'):range.end.replaceAll('-','/'))):text;
 }
 function render(input={}){
  today=input.today??today;coverage=input.coverage??coverage;
  monthlyYear=Math.max(coverage.endYear-1,Math.min(coverage.endYear,monthlyYear));
  if(input.rows&&input.rows!==source){storeYoyContext='';currentStoreContext='';}
  allStoreLabel=input.allStoreLabel??allStoreLabel;source=input.rows??source;knownStores=input.stores??knownStores;scope=input.store??scope;demo=input.demo??demo;range=input.range??range;
  $('report-menu').hidden=!menu;$('report-workspace').hidden=menu;
  $('report-workspace').classList.remove('compact-reports');
  $('report-workspace').classList.toggle('compact-status-ok',demo||!$('app-status').textContent);
  $('report-title').textContent=titles[view];
  for(const id of Object.keys(titles))$('report-'+id).hidden=view!==id;
  $('report-years').hidden=view!=='rhythm';
  context((scope==='*'?allStoreLabel:scope)+' · '+range.start+' ～ '+range.end);
  if(menu)return;
  if(view==='rhythm')renderTotal();if(view==='categories')renderCategories();if(view==='stores')renderStores();renderPeriod();
 }
 function renderPeriod(){periodControls.render({monthly:view==='rhythm',selectedYear:monthlyYear,availableYears:coverage.years.map(item=>item.year),today,range,period:getPeriod()});}
 function scoped(){return scope==='*'?source:source.filter(r=>(r.store||'')===scope);}
 function renderTotal(){
  $('total-view').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.chartMode===monthlyMode)));
  renderMonthly();renderComparison();renderPeriod();
 }
 function renderMonthly(){
  const years=coverage.years.slice(0,2).map(item=>item.year);
  if(!monthlyReady&&source.length){monthlyYear=years.find(y=>source.some(r=>r.date.startsWith(y+'-')&&r.date<=today))||years[0];monthlyReady=true;}
  const data=monthlyCashflow(scoped(),monthlyYear,today);
  context((scope==='*'?allStoreLabel:scope)+' · '+monthlyYear+' 年');
  const partial=data.months.find(m=>m.partial);
  $('monthly-period-note').textContent=data.end.endsWith('-12-31')?'1–12 月完整年度。':'截至 '+data.end.slice(5).replace('-','/')+(partial?'，'+partial.month+' 月尚未完整。':'。');
  monthlyChart.setMode(monthlyMode);monthlyChart.render({...data,history:monthlyCashflow(scoped(),monthlyYear-2,today),coverage});
 }
 function renderComparison(){
  context((scope==='*'?allStoreLabel:scope)+' · '+range.start+' ～ '+range.end);
  const current=annualRange(monthlyYear,today),previous=previousRange(current,'year');
  context((scope==='*'?allStoreLabel:scope)+' · '+monthlyYear+' 年');
  const comparisonRows=compareRanges(scoped(),current,previous);
  $('period-chart').innerHTML=periodComparisonMarkup(comparisonRows,$('period-chart').clientWidth,{current:String(monthlyYear),previous:String(monthlyYear-1),currentStatus:yearAvailability(coverage,monthlyYear),previousStatus:yearAvailability(coverage,monthlyYear-1)});
  const dayCount=r=>Math.round((Date.parse(r.end)-Date.parse(r.start))/86400000)+1,currentDays=dayCount(current),previousDays=dayCount(previous);
  $('period-custom-notice').hidden=currentDays===previousDays;
  $('period-custom-notice').textContent='本期 '+currentDays+' 天／對照 '+previousDays+' 天，比較期間總額。';
 }
 function renderCategories(){
  $('category-view').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.categoryView===categoryComparison)));
  const models=['expense','income'].map(type=>categoryComparisonData(scoped(),range,type));
  const previous=previousRange(range,'year'),days=r=>Math.round((Date.parse(r.end)-Date.parse(r.start))/86400000)+1;
  $('category-comparison-notice').hidden=categoryComparison!=='yoy'||days(range)===days(previous);
  $('category-comparison-notice').textContent='本期 '+days(range)+' 天／去年 '+days(previous)+' 天。';
  $('category-overview').innerHTML=['expense','income'].map((type,index)=>{
   const content=categoryComparison==='yoy'?categoryComparisonMarkup(models[index],range):categoryRowsMarkup(categoryReport(scoped(),range,type),type,3);
   return '<section class="category-share-section" aria-labelledby="category-'+type+'-title"><h3 id="category-'+type+'-title">'+metricNames[type]+'分類</h3>'+content+'</section>';
  }).join('');
 }
 function renderStoreYoy(){
  const key=range.start+'|'+range.end;
  if(key!==storeYoyContext){storeYoyContext=key;storeYoyPage=0;storeYoyVisible=5;}
  const data=storeSamePeriodData(source,range,knownStores,storeYoyPage,mobileStores()?storeYoyVisible:null);storeYoyPage=data.page;
  $('store-period-comparison').innerHTML=storeSamePeriodMarkup(data,range,$('store-period-comparison').clientWidth,today);
 }
 function renderStores(){
  const yoy=storeComparison==='yoy';$('store-period-comparison').hidden=!yoy;$('store-comparison').hidden=yoy;
  $('store-view').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.storeView===storeComparison)));
  if(yoy){renderStoreYoy();return;}

  const key=range.start+'|'+range.end;
  if(key!==currentStoreContext){currentStoreContext=key;currentStorePage=0;currentStoreVisible=5;}
  const data=currentStoresData(source,range,'income',knownStores,currentStorePage,mobileStores()?currentStoreVisible:null);currentStorePage=data.page;
  $('store-ranking').innerHTML=currentStoresMarkup(data,$('store-ranking').clientWidth);

 }
 function showMoreStores(kind){
  if(!mobileStores())return;
  const yoy=kind==='yoy',container=$(yoy?'store-period-comparison':'store-ranking');
  const selector=yoy?'[data-store-yoy]':'[data-current-store]',shown=container.querySelectorAll(selector).length;
  const top=window.scrollY;
  if(yoy){storeYoyVisible+=5;renderStoreYoy();}else{currentStoreVisible+=5;renderStores();}
  container.querySelectorAll(selector)[shown]?.focus({preventScroll:true});
  window.scrollTo({top,behavior:'instant'});
 }
 function chooseView(next){
  if(!Object.hasOwn(titles,next))return;onNavigate(next);view=next;menu=false;$('report-filters').open=false;if(['categories','stores'].includes(view))onLimitedPeriod();render();onContextChange();
  window.scrollTo({top:0,behavior:'instant'});$('report-title').focus({preventScroll:true});
 }
 function showMenu(focus=true){menu=true;$('report-filters').open=false;render();onContextChange();if(focus){window.scrollTo({top:0,behavior:'instant'});$('report-menu-title').focus({preventScroll:true});}}
 $('report-picker').onclick=e=>{const b=e.target.closest('[data-report-view]');if(b)chooseView(b.dataset.reportView);};
 $('report-back').onclick=()=>{if(onBack&&history.state?.reportView)onBack();else showMenu();};
 $('total-view').onclick=e=>{const b=e.target.closest('[data-chart-mode]');if(b){monthlyMode=b.dataset.chartMode;renderTotal();onContextChange();}};
 $('category-overview').onclick=e=>{const b=e.target.closest('[data-category]');if(b&&!b.disabled)onCategory(b.dataset.category,b.dataset.categoryType,b.dataset.categoryPeriod==='previous'?previousRange(range,'year'):range);};
 $('category-view').onclick=e=>{const b=e.target.closest('[data-category-view]');if(b){categoryComparison=b.dataset.categoryView;renderCategories();}};
 $('store-view').onclick=e=>{const b=e.target.closest('[data-store-view]');if(b){storeComparison=b.dataset.storeView;renderStores();onContextChange();}};
 $('store-period-comparison').onclick=e=>{
  const more=e.target.closest('[data-store-more]');if(more){showMoreStores(more.dataset.storeMore);return;}
  const page=e.target.closest('[data-store-yoy-page]'),record=e.target.closest('[data-store-yoy]');
  if(page&&!page.disabled){storeYoyPage+=Number(page.dataset.storeYoyPage);renderStoreYoy();}
  if(record&&!record.disabled){onStore(record.dataset.storeYoy,{comparison:false});onRange(range);}
 };
 $('store-comparison').onclick=e=>{const more=e.target.closest('[data-store-more]');if(more){showMoreStores(more.dataset.storeMore);return;}const page=e.target.closest('[data-current-page]'),record=e.target.closest('[data-current-store]');if(page&&!page.disabled){currentStorePage+=Number(page.dataset.currentPage);renderStores();}if(record&&!record.disabled){onStore(record.dataset.currentStore,{comparison:false});onRange(range);}};
 function restoreView(next){menu=!Object.hasOwn(titles,next);if(!menu)view=next;}
 return {render,showMenu,restoreView,isHome:()=>menu,getTitle:()=>titles[view],getView:()=>view,getMonthlyMode:()=>!menu&&view==='rhythm',getStoreComparisonMode:()=>storeComparison==='yoy',hasLimitedPeriod:()=>!menu&&['categories','stores'].includes(view)};
}
