import {validateRow} from './ledger.js';
import {assertEntryDate,validateWindow} from './annual-window.js';
import {validateCatalog} from './catalog.js';

// Keep each endpoint/sheet/credential combination separate without storing credentials here.
export async function cacheIdentity(connection,crypto=globalThis.crypto){
 if(!connection?.api||!connection.sheet||!connection.key)throw Error('Incomplete connection');
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([connection.api,connection.sheet,connection.key])));
 return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
}
export function validateSnapshot(snapshot,window){
 if(snapshot?.version!==1||!Array.isArray(snapshot.rows))throw Error('Invalid cache');
 const checked=validateWindow(snapshot.window),coverage={startYear:checked.startYear,endYear:checked.endYear,years:checked.years.map(({year,status})=>({year,status}))};
 if(coverage.endYear!==window.endYear)throw Error('Expired annual window');
 if(!Number.isInteger(snapshot.catalogRevision)||snapshot.catalogRevision<0||typeof snapshot.catalogSupported!=='boolean'||typeof snapshot.reportVisibilitySupported!=='boolean')throw Error('Invalid cache settings');
 const ids=new Set(),rows=snapshot.rows.map(value=>{
  const row=validateRow(value);assertEntryDate(row.date,coverage);
  if(ids.has(row.id))throw Error('Duplicate cached ID');ids.add(row.id);return row;
 });
 return {version:1,rows,window:coverage,catalog:validateCatalog(snapshot.catalog),catalogRevision:snapshot.catalogRevision,catalogSupported:snapshot.catalogSupported,reportVisibilitySupported:snapshot.reportVisibilitySupported};
}
export function createLedgerCache({indexedDB=globalThis.indexedDB,crypto=globalThis.crypto}={}){
 let database;
 const open=()=>database??=(new Promise((resolve,reject)=>{
  const request=indexedDB.open('jelly-ledger-cache',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('snapshots');
  request.onsuccess=()=>{
   const db=request.result;db.onversionchange=()=>{db.close();database=null;};resolve(db);
  };
  request.onerror=request.onblocked=()=>reject(Error('Cache unavailable'));
 }));
 async function transact(mode,key,value){
  const db=await open();
  return new Promise((resolve,reject)=>{
   const transaction=db.transaction('snapshots',mode),store=transaction.objectStore('snapshots');
   const request=mode==='readonly'?store.get(key):store.put(value,key);
   transaction.oncomplete=()=>resolve(request.result);
   transaction.onerror=transaction.onabort=()=>reject(transaction.error||Error('Cache transaction failed'));
  });
 }
 return {
  async read(connection,window){
   try{return validateSnapshot(await transact('readonly',await cacheIdentity(connection,crypto)),window);}catch{return null;}
  },
  async write(connection,snapshot){
   try{
    const clean=validateSnapshot({version:1,...snapshot},snapshot.window);
    await transact('readwrite',await cacheIdentity(connection,crypto),clean);return true;
   }catch{return false;}
  }
 };
}
