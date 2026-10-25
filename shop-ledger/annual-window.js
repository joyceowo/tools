import {taipeiDay,validDate} from './ledger.js';

export function annualWindow(today=taipeiDay()){
 const endYear=Number(today.slice(0,4));
 return {startYear:endYear-2,endYear,years:Array.from({length:3},(_,i)=>({year:endYear-i,status:'ready'}))};
}
export function yearAvailability(window,year){
 if(year<window.startYear||year>window.endYear)return '超出資料範圍';
 return '';
}
export function assertEntryDate(date,window,originalYear=null){
 if(!validDate(date))throw Error('請填寫有效日期。');
 const year=Number(date.slice(0,4));
 if(originalYear!==null&&year!==originalYear)throw Error('修改日期只能在原年度 '+originalYear+' 年內，不可跨年。');
 if(year<window.startYear||year>window.endYear)throw Error('只能操作 '+window.startYear+'～'+window.endYear+' 年帳目，請重新整理帳本。');
}
export function assertAnnualSupport(data){
 if(data.annualSheets!==true||!Number.isInteger(data.version)||data.version<5)throw Error('年度分頁需要 Code.gs v5。請保留原 ID 與密碼，下載最新連接程式並部署新版本；舊帳須自行填入「收支明細_YYYY」，APP 不會搬移資料。');
}
export function validateWindow(window){
 if(!window||!Number.isInteger(window.endYear)||window.startYear!==window.endYear-2||!Array.isArray(window.years)||window.years.length!==3)throw Error('年度範圍回覆不完整，請更新連接程式。');
 for(let i=0;i<3;i++)if(window.years[i]?.year!==window.endYear-i||!['missing','empty','ready'].includes(window.years[i].status))throw Error('年度分頁狀態回覆無效。');
 return window;
}
