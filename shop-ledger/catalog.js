import {categories,storeName} from './ledger.js';
export const defaultCategories={income:[...categories.income],expense:[...categories.expense,'人事','運費','平台費']};
export function categoryName(value){if(typeof value!=='string'||!value.trim()||value.trim().length>40||/[\u0000-\u001f]/.test(value))throw Error('分類名稱需為 1–40 字。');return value.trim();}
export function validateCatalog(input){
  if(!input||!Array.isArray(input.stores)||!Array.isArray(input.categories)||input.stores.length>80||input.categories.length>120)throw Error('管理清單格式不正確或數量過多。');
  const ids=new Set(),names=new Set();
  const clean=(item,kind)=>{
    if(!item||typeof item.id!=='string'||! /^[\w-]{1,100}$/.test(item.id)||ids.has(item.id)||typeof item.active!=='boolean'||!Array.isArray(item.aliases)||item.aliases.length>30)throw Error('管理項目格式不正確。');
    ids.add(item.id);const type=kind==='store'?'store':item.type;if(!['store','income','expense'].includes(type)||kind==='category'&&type==='store')throw Error('分類類型不正確。');
    const check=kind==='store'?value=>{const n=storeName(value);if(!n)throw Error('請填寫門市名稱。');return n;}:categoryName;
    const name=check(item.name),aliases=[...new Set(item.aliases.map(check))].filter(n=>n!==name);
    for(const n of [name,...aliases]){const key=type+'\0'+n;if(names.has(key))throw Error('名稱已被使用，包含歷史名稱，請使用其他名稱。');names.add(key);}
    if(kind==='store'&&item.hiddenFromReports!==undefined&&typeof item.hiddenFromReports!=='boolean')throw Error('門市報表隱藏設定必須為布林值。');
    return {id:item.id,name,aliases,active:item.active,...(kind==='category'?{type}:{hiddenFromReports:item.hiddenFromReports??false})};
  };
  const result={stores:input.stores.map(x=>clean(x,'store')),categories:input.categories.map(x=>clean(x,'category')),defaultStore:input.defaultStore||''};
  if(result.defaultStore&&!result.stores.some(s=>s.id===result.defaultStore&&s.active))throw Error('預設門市必須為啟用中的門市。');
  if(JSON.stringify(result).length>18000)throw Error('管理清單過大，請減少項目。');return result;
}
export function resolveName(catalog,kind,name,type){return (catalog?.[kind]||[]).find(x=>(kind!=='categories'||x.type===type)&&(x.name===name||x.aliases.includes(name)))?.name||name;}
export function normalizeRows(rows,catalog){return rows.map(r=>({...r,store:resolveName(catalog,'stores',r.store||''),category:resolveName(catalog,'categories',r.category,r.type)}));}
// '*' follows the shared default; an array is a temporary, explicit selection.
export function reportStoreKeys(catalog,scope='*'){
  const stores=catalog?.stores||[];
  if(scope==='*')return stores.filter(s=>!s.hiddenFromReports).map(s=>s.name);
  return [...new Set((Array.isArray(scope)?scope:[scope]).map(name=>resolveName(catalog,'stores',name)))].filter(name=>name&&stores.some(s=>s.name===name));
}
export function reportStoreLabel(keys){
  if(!keys.length)return '未選擇門市';
  if(keys.length===1)return keys[0];
  return keys.length+' 間門市';
}
// Filter before any period, comparison or store grouping; keep raw records intact.
export function reportScope(rows,catalog,store='*'){
  const stores=catalog?.stores||[];
  if(store!=='*'){
    const keys=reportStoreKeys(catalog,store),selected=new Set(keys),selectedStores=stores.filter(s=>selected.has(s.name));
    const names=new Set([...keys,...selectedStores.flatMap(s=>s.aliases)]);
    return {rows:rows.filter(r=>names.has(r.store||'')),stores:selectedStores,excludedCount:Array.isArray(store)?stores.length-selectedStores.length:0,keys};
  }
  const excluded=stores.filter(s=>s.hiddenFromReports);
  const names=new Set(excluded.flatMap(s=>[s.name,...s.aliases]));
  return {rows:rows.filter(r=>r.store&&!names.has(r.store)),stores:stores.filter(s=>!s.hiddenFromReports),excludedCount:excluded.length,keys:reportStoreKeys(catalog)};
}
export function ensureCatalog(raw,rows=[],id=()=>crypto.randomUUID()){
  const catalog=raw?validateCatalog(raw):{stores:[],categories:[],defaultStore:''};
  for(const [type,names] of Object.entries(defaultCategories))for(const name of names)if(!catalog.categories.some(x=>x.type===type&&(x.name===name||x.aliases.includes(name))))catalog.categories.push({id:id(),name,type,aliases:[],active:true});
  for(const row of rows){
    if(row.store&&!catalog.stores.some(x=>x.name===row.store||x.aliases.includes(row.store)))catalog.stores.push({id:id(),name:row.store,aliases:[],active:true});
    if(!catalog.categories.some(x=>x.type===row.type&&(x.name===row.category||x.aliases.includes(row.category))))catalog.categories.push({id:id(),name:row.category,type:row.type,aliases:[],active:true});
  }
  return validateCatalog(catalog);
}
export function editCatalog(catalog,{kind,id,name,active,makeDefault,hiddenFromReports}){
  const next=structuredClone(catalog),list=next[kind];if(!list)throw Error('項目類型不正確。');
  const item=list.find(x=>x.id===id);if(!item)throw Error('找不到項目。');
  if(name!==undefined&&name.trim()!==item.name){const old=item.name;item.name=name.trim();item.aliases=[...new Set([...item.aliases,old])].filter(x=>x!==item.name);}
  if(active!==undefined)item.active=active;
  if(kind==='stores'&&hiddenFromReports!==undefined)item.hiddenFromReports=hiddenFromReports;
  if(kind==='stores'){if(makeDefault)next.defaultStore=id;if(!item.active&&next.defaultStore===id)next.defaultStore='';}
  return validateCatalog(next);
}
