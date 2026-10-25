export const connectionErrors = {
  GOOGLE_LOGIN_REQUIRED: 'Google 要求登入，尚未進入帳本程式。請到 Apps Script「部署 → 管理部署 → 編輯」，確認執行身分為「我」，誰可以存取為「所有人」。',
  GOOGLE_FORBIDDEN: 'Google 拒絕匿名存取（HTTP 403）。請檢查部署權限、擁有者授權及公司／學校帳號的管理政策。',
  DEPLOYMENT_NOT_FOUND: '找不到這個部署（HTTP 404／410）。請從 Apps Script 部署視窗重新複製「網頁應用程式網址」，不要使用指令碼 ID 或已刪除的部署。',
  GOOGLE_HTML_RESPONSE: 'Google 回傳網頁而非帳本資料。可能是部署權限、網址或 Google 暫時錯誤；請用「開啟部署測試頁」查看 Google 顯示的訊息。',
  APPS_SCRIPT_RUNTIME: 'Google 回傳 Apps Script 執行錯誤。請依下方 Google 訊息的檔名、行號檢查程式；修正後需部署新版本。',
  SCRIPT_ENTRY_MISSING: '已部署的程式缺少 doGet 或 doPost。請確認貼入完整 Code.gs，再到「部署 → 管理部署 → 編輯 → 版本：新版本 → 部署」。',
  GOOGLE_HTTP_ERROR: 'Google 回傳異常 HTTP 狀態，請稍後重試並檢查 Apps Script「執行項目」。',
  GOOGLE_NETWORK: '本機伺服器無法連上 Google。請檢查網路、VPN、防火牆或 DNS；尚未取得 Google 回覆，不能判定為密碼錯誤。',
  GOOGLE_TIMEOUT: '等待 Google 回覆逾時。若剛才在儲存，請保留原內容重試，或先重新整理確認是否已寫入。',
  BROWSER_BLOCKED: '瀏覽器未提供 Google 回覆。可能是跨來源（CORS）、網路或擴充功能阻擋，無法由此判定密碼或權限是否正確。請按「檢查連線」；本機測試請重新啟動 npm start 後再試。',
  LOCAL_RELAY_UNAVAILABLE: '本機連線服務沒有回應。請確認 npm start 仍在執行，更新程式後需要先 Ctrl+C 再重新啟動。',
  SHEET_MISMATCH: '試算表 ID 不一致。網站的試算表 ID 必須與已部署程式的 LEDGER_SHEET_ID 相同。修改程式後還要部署新版本。',
  KEY_MISMATCH: '連接密碼不一致。請使用已部署程式中 LEDGER_ACCESS_KEY 的值；不要另外產生新密碼，除非也同步更新及重新部署程式。',
  NOT_CONFIGURED: '已連到帳本程式，但程式仍使用預留的 ID 或密碼。請從網站下載已填入設定的 Code.gs，貼入 Apps Script，再部署新版本。',
  SHEET_ACCESS_DENIED: '程式無法開啟試算表。請確認 ID 正確、檔案未刪除，且部署所用帳號有編輯權限並已完成授權。',
  SCHEMA_MISMATCH: '「收支明細」的欄位不符合帳本格式。請先將原工作表改名保存，再重新連接；程式不會覆蓋原資料。',
  WRONG_SCRIPT: '網址有回覆，但不是預期的日日果凍連接程式。請確認貼上完整 Code.gs，並更新這個部署的版本。',
  INVALID_RESPONSE: '收到的回覆不是有效帳本資料。請確認使用正確部署網址，並更新連接程式的部署版本。',
  REDIRECT_BLOCKED: 'Google 回覆了未預期的轉址，已停止連線。請從 Apps Script 部署視窗重新複製 /exec 網址。',
};
export class ConnectionError extends Error {
  constructor(code, detail = '', httpStatus = null, googleMessage = '') {
    const safeMessage=redactGoogleMessage(googleMessage);
    super(`[${code}] ${connectionErrors[code] || detail || '試算表操作失敗。'}${safeMessage ? `\nGoogle 訊息：${safeMessage}` : ''}${httpStatus ? `\nHTTP 狀態：${httpStatus}` : ''}`);
    this.name = 'ConnectionError'; this.code = code; this.httpStatus = httpStatus; this.googleMessage=safeMessage;
  }
}
export function redactGoogleMessage(text, sensitiveValues = []) {
  text=String(text || '');
  for(const value of sensitiveValues)if(typeof value==='string'&&value)text=text.replaceAll(value,'[已隱藏]');
  return text.replace(/https?:\/\/[^\s<>"']+/gi,'[網址已隱藏]').replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[電子郵件已隱藏]').slice(0,700);
}
export function googleHtmlMessage(html, sensitiveValues = []) {
  const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
  const text=String(html).slice(0,200000)
    .replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<(script|style|head|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
    .replace(/<[^>]*>/g,' ')
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(full,entity)=>{
      if(entity[0]!=='#')return entities[entity.toLowerCase()]||full;
      const number=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);
      return number>0&&number<=0x10ffff?String.fromCodePoint(number):' ';
    }).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
  const marker=text.search(/(?:SyntaxError|ReferenceError|TypeError|RangeError|Exception|Error)\s*:|Script function not found|找不到(?:以下)?指令碼函式|指令碼函式不存在/i);
  const message=redactGoogleMessage(marker>=0?text.slice(marker):text,sensitiveValues);
  return /^(?:error|google|google apps script)?$/i.test(message)?'':message;
}
export function classifyReply({status, text, location = '', sensitiveValues = []}) {
  if (/^https:\/\/accounts\.google\.com(?:\/|$)/.test(location) || status === 401) throw new ConnectionError('GOOGLE_LOGIN_REQUIRED','',status);
  if (status === 403) throw new ConnectionError('GOOGLE_FORBIDDEN','',status);
  if (status === 404 || status === 410) throw new ConnectionError('DEPLOYMENT_NOT_FOUND','',status);
  if (status < 200 || status >= 300) throw new ConnectionError('GOOGLE_HTTP_ERROR','',status);
  let data;
  try { data = JSON.parse(text); } catch {
    if (/<(?:!doctype|html|head|body)\b/i.test(text)) {
      const message=googleHtmlMessage(text,sensitiveValues);
      const code=/Script function not found|找不到(?:以下)?指令碼函式|指令碼函式不存在/i.test(message)?'SCRIPT_ENTRY_MISSING':/(?:SyntaxError|ReferenceError|TypeError|RangeError|Exception|Error)\s*:/i.test(message)?'APPS_SCRIPT_RUNTIME':'GOOGLE_HTML_RESPONSE';
      throw new ConnectionError(code,'',status,message);
    }
    throw new ConnectionError('INVALID_RESPONSE','',status);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ConnectionError('INVALID_RESPONSE','',status);
  return data;
}
export function assertGoogleReply(data) {
  if (data.ok !== true) {
    const legacy = data.error === '試算表 ID 或連接密碼不正確。';
    if (legacy) throw new ConnectionError('LEGACY_CREDENTIAL_MISMATCH','舊版程式回報：試算表 ID 或連接密碼不正確。更新 Code.gs 並部署新版本後，可分別檢查這兩項。');
    throw new ConnectionError(data.code || 'SCRIPT_ERROR',data.error || 'Google 程式未回傳成功狀態。',data.httpStatus,data.googleMessage);
  }
  return data;
}
export async function requireStoreSupport(connection,record,transport=sendGoogle){
  if(!record?.store)return;
  const {data}=await transport(connection,'diagnose');
  assertGoogleReply(data);
  if(!Number.isInteger(data.version)||data.version<3||data.diagnostic?.stores!==true)throw new Error('目前的連接程式尚不支援門市。請在試算表設定重新下載 Code.gs v3 並部署新版本，門市與輸入內容已保留。');
}
let relayPromise;
export async function localRelayAvailable() {
  if (!['127.0.0.1','localhost','[::1]'].includes(location.hostname)) return false;
  if (!relayPromise) relayPromise = (async()=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),1500);
    try { const r=await fetch('/api/health',{cache:'no-store',signal:controller.signal});return r.ok&&(await r.json()).service==='jelly-local-relay'; }
    catch {return false;} finally {clearTimeout(timer);}
  })();
  return relayPromise;
}
export async function sendGoogle(connection, action, extra = {}) {
  const local=await localRelayAvailable();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
  try {
    let response;
    try {
      response=await fetch(local?'/api/google':connection.api,{
        method:local||action!=='health'?'POST':'GET',credentials:'omit',redirect:'follow',cache:'no-store',signal:controller.signal,
        ...(local?{headers:{'Content-Type':'application/json'},body:JSON.stringify({api:connection.api,sheet:connection.sheet,key:connection.key,action,...extra})}:action!=='health'?{headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({sheet:connection.sheet,key:connection.key,action,...extra})}:{})
      });
    } catch(e) {
      if(e.name==='AbortError')throw new ConnectionError('GOOGLE_TIMEOUT');
      throw new ConnectionError(local?'LOCAL_RELAY_UNAVAILABLE':'BROWSER_BLOCKED');
    }
    const data=classifyReply({status:response.status,text:await response.text(),sensitiveValues:[connection.key,connection.sheet,connection.api]});
    return {data,route:local?'local':'browser'};
  } catch(e) {
    if(e.name==='AbortError')throw new ConnectionError('GOOGLE_TIMEOUT');
    throw e;
  } finally {clearTimeout(timer);}
}
