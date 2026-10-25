import {shiftDay} from './ledger.js';
import {festivalCalendar} from './analytics.js';

export const demoStores=['台北中山店','台中西區店','高雄左營店'];
export function createDemoRows(asOf){
  const currentYear=Number(asOf.slice(0,4)),startYear=currentYear-3;
  const rows=[],calendars=new Map();
  for(let y=startYear;y<=currentYear;y++)calendars.set(y,festivalCalendar(y).events);
  const season=[[.83,1.12,.9,.96,1.19,1.1,1.17,1.25,1.13,.97,.91,1.24],[.8,1.16,.92,1.02,1.15,1.2,1.36,1.3,1.16,.94,.86,1.1],[.87,1.05,.99,1.08,1.13,1.28,1.47,1.38,1.18,1.01,.93,1.12]];
  for(let date=startYear+'-01-01';date<=asOf;date=shiftDay(date,1)){
    const year=Number(date.slice(0,4)),month=Number(date.slice(5,7)),day=Number(date.slice(8));
    const weekday=new Date(date+'T12:00:00Z').getUTCDay();
    const nearFestival=calendars.get(year).some(e=>Math.abs((Date.parse(e.date)-Date.parse(date))/86400000)<=2);
    demoStores.forEach((store,index)=>{
      const add=(type,amount,category,note,suffix='')=>rows.push({id:`demo-v3-${date}-${index}-${type}${suffix}`,date,type,category,amount,store,note,updatedAt:date+'T09:00:00.000Z'});
      if(weekday!==index+1){
        const noise=.9+((year*13+month*19+day*31+index*7)%23)/100;
        const growth=[.86,.94,1.04,1.13][year-startYear];
        const income=Math.round((5100+index*740)*season[index][month-1]*growth*noise*(weekday===6?1.48:weekday===0?1.31:1)*(nearFestival?1.42:1));
        add('income',income,'銷售收入','示範：每日門市營收');
        add('expense',Math.round(income*(.31+index*.025)),'原料','示範：每日食材與備料');
      }
      if(day===1){add('expense',[28500,24000,22000][index],'租金','示範：每月店租','-rent');add('expense',[48000,52000,54000][index],'人事','示範：每月人事支出','-staff');}
    });
  }
  return rows;
}
