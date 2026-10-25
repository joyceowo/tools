import {validateRow} from './ledger.js';
import {sendGoogle,assertGoogleReply,ConnectionError} from './connection.js';
import {annualWindow,assertEntryDate,assertAnnualSupport,validateWindow} from './annual-window.js';

// Older deployments ignore includeRows and only diagnose, so they never read legacy data.
export function createLedgerClient(transport=sendGoogle){
 let knownConnection=null,supported=false;
 const same=c=>knownConnection&&['api','sheet','key'].every(k=>c[k]===knownConnection[k]);
 return async function request(connection,action,extra={}){
  if(!same(connection)){knownConnection={...connection};supported=false;}
  if(['create','update'].includes(action)&&(typeof extra.record?.store!=='string'||!extra.record.store.trim()))throw Error('請選擇門市。');
  const window=annualWindow();
  let initialRead;
  if(!supported){
   const {data}=await transport(connection,'diagnose',action==='list'?{includeRows:true,annualSheets:true,windowYear:window.endYear}:{});
   assertGoogleReply(data);assertAnnualSupport(data);supported=true;
   if(action==='list'&&Object.hasOwn(data,'rows'))initialRead=data;
  }
  if(['create','update'].includes(action))assertEntryDate(extra.record.date,window,action==='update'?extra.originalYear:null);
  if(['update','delete'].includes(action)&&(!Number.isInteger(extra.originalYear)||!extra.expectedRecord))throw Error('原記錄資訊不足，請重新整理後再修改或刪除；輸入內容已保留。');
  const {data}=initialRead?{data:initialRead}:await transport(connection,action,{...extra,annualSheets:true,windowYear:window.endYear});assertGoogleReply(data);assertAnnualSupport(data);
  if(!Array.isArray(data.rows))throw new ConnectionError('INVALID_RESPONSE');
  validateWindow(data.window);
  if(data.window.endYear!==window.endYear)throw Error('年度已切換，請重新整理帳本；輸入內容已保留。');
  const ids=new Set(),next=data.rows.map(row=>{
   const r=validateRow(row);assertEntryDate(r.date,data.window);
   if(ids.has(r.id))throw Error('年度分頁有重複記錄 ID，請檢查試算表。');ids.add(r.id);return r;
  });
  return {data,rows:next};
 };
}
