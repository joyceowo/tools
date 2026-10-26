import {sheetId,apiUrl} from './ledger.js';

// Shared links store only the deployment ID; requests use the validated full URL.
export function deploymentUrl(value){
  const text=String(value||'').trim();
  return apiUrl(/^[\w-]+$/.test(text)?`https://script.google.com/macros/s/${text}/exec`:text);
}

export function createShareLink(value,base){
  const sheet=sheetId(value?.sheet),api=deploymentUrl(value?.api),key=value?.key;
  if(typeof key!=='string'||!/^[\w-]{24,128}$/.test(key))throw new Error('請先確認連接密碼。');
  const url=new URL(base);
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('請使用記帳網站的 HTTP 或 HTTPS 網址。');
  url.search='';url.searchParams.set('sheet',sheet);url.searchParams.set('api',new URL(api).pathname.split('/')[3]);
  url.hash=key!==sheet?new URLSearchParams({key}).toString():'';
  return url.href;
}

export function readConnectionLink(href,lookup=()=>null){
  const url=new URL(href),fragment=new URLSearchParams(url.hash.slice(1));
  if(fragment.has('c'))throw new Error('加密分享連結功能已移除，請向分享者重新取得記帳分享連結。');
  const input=url.searchParams.get('sheet')||url.searchParams.get('id');
  if(!input)return null;
  const sheet=sheetId(input),sharedApi=fragment.get('api')||url.searchParams.get('api'),sharedKey=fragment.get('key');
  const saved=sharedApi?null:lookup(sheet),api=sharedApi||saved?.api||'';
  // A shared endpoint with no key means key === sheet, even if this device
  // previously saved a different password. Sheet-only bookmarks use saved settings.
  return {sheet,api:api?deploymentUrl(api):'',key:sharedKey??(sharedApi?sheet:saved?.key||'')};
}

// Remove sharing credentials before making any network request.
export function cleanConnectionUrl(href){
  const url=new URL(href),fragment=new URLSearchParams(url.hash.slice(1));
  if(fragment.has('c')||fragment.has('key')||fragment.has('api'))url.hash='';
  url.searchParams.delete('api');
  return url.href;
}

export function isLocalShareLink(href){
  const host=new URL(href).hostname;
  return host==='localhost'||host.endsWith('.localhost')||host==='[::1]'||/^127\./.test(host)||host==='0.0.0.0';
}

// Call directly from the click handler so native sharing keeps user activation.
export async function shareLedgerLink(url,nav=globalThis.navigator){
  const data={title:'日日果凍 · 收支帳本',url};
  if(typeof nav?.share==='function'){
    try{
      if(typeof nav.canShare!=='function'||nav.canShare(data)){
        await nav.share(data);
        return 'shared';
      }
    }catch(error){if(error?.name==='AbortError')return 'cancelled';}
  }
  try{await nav.clipboard.writeText(url);return 'copied';}
  catch{return 'manual';}
}
