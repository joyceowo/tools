import {presetRange,previousRange} from './reporting.js';

const same=(a,b)=>a.start===b.start&&a.end===b.end;
export function periodLabel(range,today){
 for(const [key,label] of [['month','本月'],['year','今年'],['today','今日'],['week','近 7 天']])if(same(range,presetRange(key,today)))return label;
 const year=range.start.slice(0,4),month=range.start.slice(0,7);
 const last=new Date(month+'-01T12:00:00Z');last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);
 if(range.start===year+'-01-01'&&range.end===year+'-12-31')return year+' 年';
 if(range.start===month+'-01'&&range.end===last.toISOString().slice(0,10))return year+' 年 '+Number(month.slice(5))+' 月';
 if(range.start===range.end)return range.start.replaceAll('-','/');
 return range.start.replaceAll('-','/')+'–'+(year===range.end.slice(0,4)?range.end.slice(5).replace('-','/'):range.end.replaceAll('-','/'));
}

export function comparisonPeriodLabel(range,previous,mode,today){
 const label=periodLabel(range,today),standard=['本月','今年','今日','近 7 天'].includes(label);
 const days=r=>Math.round((Date.parse(r.end)-Date.parse(r.start))/86400000)+1;
 if(mode!=='custom'&&standard&&same(previous,previousRange(range,mode))&&days(range)===days(previous))return '';
 return '本期 '+label+'\n對照 '+periodLabel(previous,today);
}
