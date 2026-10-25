import {shiftDay,validDate} from './ledger.js';

const earliestEnd='1000-01-07';
export function sevenDayRange(end,today){
 if(!validDate(end)||!validDate(today)||end>today||end<earliestEnd)throw Error('請選擇有效的七天區間。');
 return {start:shiftDay(end,-6),end};
}
export function shiftSevenDayWindow(end,step,today){
 sevenDayRange(end,today);
 const next=shiftDay(end,step*7);
 return next>today?today:next<earliestEnd?earliestEnd:next;
}
export function overviewWindowLabel(range,today){
 if(range.end===today&&range.start===shiftDay(today,-6))return '近 7 天';
 const sameYear=range.start.slice(0,4)===range.end.slice(0,4),currentYear=range.end.slice(0,4)===today.slice(0,4);
 const date=(value,full)=>value.slice(full?0:5).replaceAll('-','/');
 return date(range.start,!currentYear||!sameYear)+'–'+date(range.end,!sameYear);
}

export function shiftOverviewRange(range,step,today){
 if(!validDate(range.start)||!validDate(range.end)||range.start>range.end||range.end>today)throw Error('請選擇有效的日期區間。');
 const days=Math.round((Date.parse(range.end)-Date.parse(range.start))/86400000)+1;
 const latestStart=shiftDay(today,1-days),earliest='1000-01-01';
 const start=shiftDay(range.start,step*days);
 const bounded=start>latestStart?latestStart:start<earliest?earliest:start;
 return {start:bounded,end:shiftDay(bounded,days-1)};
}
