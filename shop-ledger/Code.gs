/** 日日果凍 Google 試算表連接程式 v5（年度分頁，僅讀近三年）.
 * 部署 → 新增部署 → 網頁應用程式 → 執行身分：我；存取：所有人。
 * 帳目使用「收支明細_YYYY」，不讀取或搬移舊的「收支明細」。管理設定另存「日日果凍設定」。
 * 修改程式後請在「管理部署」選擇新版本。
 */
const LEDGER_SHEET_ID = '__SHEET_ID__';
const LEDGER_ACCESS_KEY = '__ACCESS_KEY__';
const LEDGER_HEADERS = ['記錄ID', '日期', '類型', '分類', '金額', '備註', '更新時間', '門市'];
const LEDGER_CATEGORIES = {income:['銷售收入','其他收入'],expense:['原料','包材','租金','水電','設備','其他']};

function doGet() {
  return ledgerReply_({ok:true,service:'jelly-ledger',version:5,message:'部署網址可存取。此頁不顯示帳本；請回日日果凍網站按「檢查連線」。'});
}
function doPost(e) {
  let lock;
  try {
    if (!e || !e.postData || e.postData.contents.length > 60000) throw new Error('請求無效。');
    const body = JSON.parse(e.postData.contents);
    if (LEDGER_SHEET_ID.startsWith('__') || LEDGER_ACCESS_KEY.startsWith('__') || !/^[\w-]{24,128}$/.test(LEDGER_ACCESS_KEY)) throw ledgerError_('NOT_CONFIGURED','請先設定試算表 ID 與連接密碼。');
    if (body.key !== LEDGER_ACCESS_KEY) throw ledgerError_('KEY_MISMATCH','連接密碼與已部署程式不同。');
    if (body.sheet !== LEDGER_SHEET_ID) throw ledgerError_('SHEET_MISMATCH','試算表 ID 與已部署程式不同。');
    if (['diagnose','list','create','update','delete','catalog'].indexOf(body.action) < 0) throw new Error('不支援的操作。');
    lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) throw new Error('帳本正忙碌，請稍後重試。');
    let book;
    try {book = SpreadsheetApp.openById(LEDGER_SHEET_ID);} catch(e) {throw ledgerError_('SHEET_ACCESS_DENIED','程式無法開啟指定試算表，請確認檔案 ID、部署帳號權限與授權。');}
    const settings=ledgerCatalogRead_(book);
    if(body.action==='catalog'){
      // Older clients omit this field; keep the saved visibility on unrelated edits.
      if(settings.catalog&&body.catalog&&Array.isArray(body.catalog.stores))body.catalog.stores.forEach(function(item){
        if(item&&item.hiddenFromReports===undefined){const old=settings.catalog.stores.find(function(s){return s.id===item.id;});if(old)item.hiddenFromReports=old.hiddenFromReports;}
      });
      const next=ledgerCatalogValidate_(body.catalog),text=JSON.stringify(next);
      if(settings.catalog&&JSON.stringify(settings.catalog)===text)return ledgerReply_({ok:true,catalog:settings.catalog,catalogRevision:settings.revision});
      if(body.expectedRevision!==settings.revision)throw ledgerError_('CATALOG_CONFLICT','門市或分類已在其他裝置更新，請重新整理後再修改。');
      if(settings.catalog)ledgerCatalogPreserve_(settings.catalog,next);
      let configSheet=book.getSheetByName('日日果凍設定');if(!configSheet)configSheet=book.insertSheet('日日果凍設定');
      configSheet.getRange(1,1,1,2).setValues([['版本','設定JSON']]);configSheet.getRange(2,1,1,2).setValues([[settings.revision+1,text]]);SpreadsheetApp.flush();
      return ledgerReply_({ok:true,catalog:next,catalogRevision:settings.revision+1});
    }
    const year=Number(Utilities.formatDate(new Date(),'Asia/Taipei','yyyy'));
    // Opt-in startup read: old v5 deployments ignore includeRows and stay read-only.
    // Plain diagnose remains read-only for the connection troubleshooting button.
    if(body.action==='diagnose'&&body.includeRows===true){
      if(body.annualSheets!==true||body.windowYear!==year)throw ledgerError_('YEAR_WINDOW_CHANGED','年度已切換，請重新整理帳本。');
      body.action='list';
    }
    const years=[year,year-1,year-2];
    const tabs=years.map(function(y){
      const name='收支明細_'+y,sheet=book.getSheetByName(name);
      let width=8,values;
      try {
        if(sheet&&sheet.getLastRow()>0){
          // Read header and records together; reuse the snapshot for schema and row checks.
          if(body.action!=='diagnose')values=sheet.getRange(1,1,sheet.getLastRow(),Math.min(8,sheet.getMaxColumns())).getValues();
          width=ledgerSchema_(sheet,values);
        }
      } catch(e){throw ledgerError_(e.code||'SCHEMA_MISMATCH',name+'：'+e.message);}
      return {year:y,name:name,sheet:sheet,width:width,values:values,rows:[]};
    });
    const coverage=function(){return {startYear:year-2,endYear:year,years:tabs.map(function(t){return {year:t.year,status:!t.sheet?'missing':t.sheet.getLastRow()<=1?'empty':'ready'};})};};
    if(body.action === 'diagnose') {
      return ledgerReply_({ok:true,service:'jelly-ledger',window:coverage(),diagnostic:{credentials:true,spreadsheet:true,stores:true,catalog:true,schema:'annual'}});
    }
    // Never accept writes from a client which has not confirmed annual-sheet support.
    if(body.action!=='list'&&(body.annualSheets!==true||body.windowYear!==year))throw ledgerError_('YEAR_WINDOW_CHANGED','請重新整理帳本以確認近三年範圍，並使用 Code.gs v5 年度分頁版 APP。輸入內容已保留。');
    const ids=Object.create(null);
    tabs.forEach(function(t){
      if(t.values&&t.values.length>1)t.rows=ledgerRows_(t.values.slice(1),t.year,t.name);
      t.rows.forEach(function(r){if(ids[r.id])throw ledgerError_('DUPLICATE_ID',t.name+'：記錄 ID '+r.id+' 與 '+ids[r.id]+' 重複。');ids[r.id]=t.name;});
    });
    if(body.action==='list'){
      // Missing years are normal empty ledgers. Initialize only after validating existing data.
      let initialized=false;
      tabs.forEach(function(t){if(ledgerInitialize_(book,t))initialized=true;});
      if(initialized)SpreadsheetApp.flush();
    }
    if (body.action !== 'list') {
      const r = body.record;
      if (!r || typeof r.id !== 'string' || !/^[\w-]{1,100}$/.test(r.id)) throw new Error('記錄 ID 無效。');
      const targetYear=body.action==='create'?Number(String(r.date).slice(0,4)):body.originalYear;
      const tab=tabs.find(function(t){return t.year===targetYear;});
      if(!tab)throw ledgerError_('YEAR_OUT_OF_RANGE','只能操作 '+(year-2)+'～'+year+' 年帳目。');
      const before=tab.rows;
      let sheet=tab.sheet;
      const width=tab.width;
      const index = before.findIndex(function(row) {return row.id === r.id;});
      if(index<0&&ids[r.id]&&body.action!=='create')throw ledgerError_('RECORD_YEAR_MISMATCH','記錄不在指定原年度，請重新整理後再操作。');
      if(body.action==='update'&&Number(String(r.date).slice(0,4))!==targetYear)throw ledgerError_('CROSS_YEAR_EDIT','修改日期只能在原年度 '+targetYear+' 年內，不可跨年。');
      if(r.store===undefined&&index>=0)r.store=before[index].store||'';
      if (body.action === 'create' || body.action === 'update') {
        ledgerValidate_(r);
        if(!r.store||!r.store.trim())throw new Error('請選擇門市。');
        r.store=r.store.trim();
      }
      if (body.action === 'create') {
        if (index < 0) {
          if(ids[r.id])throw ledgerError_('DUPLICATE_ID','這個記錄 ID 已存在於其他年度，請重新整理。');
          ledgerInitialize_(book,tab);sheet=tab.sheet;
          const stamp=new Date().toISOString();ledgerStoreColumn_(sheet,width);sheet.appendRow(ledgerValues_(r,stamp));
          before.push(ledgerRecord_(ledgerValues_(r,stamp)));
        }
        else if (!ledgerSame_(r,before[index])) throw new Error('這筆記錄已存在但內容不同，請重新整理後再修改。');
      } else if (body.action === 'update') {
        if (index < 0) throw new Error('這筆記錄已被刪除，請重新整理。');
        // Same-payload retry succeeds even if the first response was lost.
        if (!ledgerSame_(r,before[index])) {
          ledgerExpected_(body,before[index]);
          const stamp=new Date().toISOString();ledgerStoreColumn_(sheet,width);sheet.getRange(index+2,1,1,8).setValues([ledgerValues_(r,stamp)]);
          before[index]=ledgerRecord_(ledgerValues_(r,stamp));
        }
      } else if (body.action === 'delete' && index >= 0) {
        ledgerExpected_(body,before[index]);
        sheet.deleteRow(index+2);before.splice(index,1);
      }
      SpreadsheetApp.flush();
    }
    return ledgerReply_({ok:true,window:coverage(),rows:[].concat.apply([],tabs.map(function(t){return t.rows;})),catalog:settings.catalog,catalogRevision:settings.revision});
  } catch (error) {
    const message=String(error.message || error);
    return ledgerReply_({ok:false,code:error.code || 'SCRIPT_ERROR',error:message.indexOf('permission') >= 0 || message.indexOf('權限') >= 0 ? '程式沒有試算表權限，請由表格擁有者重新授權及部署。' : message});
  } finally {if(lock && lock.hasLock())lock.releaseLock();}
}
function ledgerReply_(payload) {if(payload.ok){payload.version=5;payload.annualSheets=true;payload.reportVisibility=true;}return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);}
function ledgerInitialize_(book,tab){
  if(!tab.sheet)tab.sheet=book.insertSheet(tab.name);
  const sheet=tab.sheet;
  if(sheet.getLastRow()>0)return false;
  ledgerEnsureWidth_(sheet);sheet.getRange(1,1,1,8).setValues([LEDGER_HEADERS]);sheet.setFrozenRows(1);
  sheet.getRange('A:D').setNumberFormat('@');sheet.getRange('F:H').setNumberFormat('@');sheet.getRange('E:E').setNumberFormat('#,##0.00');
  tab.width=8;return true;
}
function ledgerExpected_(body,current){
  if(body.expectedUpdatedAt!==current.updatedAt||!body.expectedRecord||body.expectedRecord.id!==current.id||!ledgerSame_(body.expectedRecord,current))throw ledgerError_('RECORD_CONFLICT','這筆資料已在其他裝置或試算表修改，請重新整理確認後再編輯。輸入內容已保留。');
}
function ledgerError_(code,message) {const error=new Error(message);error.code=code;return error;}
function ledgerRows_(values,year,name) {
  const ids=Object.create(null);
  return values.map(function(v,index){
    try {
    const date=v[1] instanceof Date ? Utilities.formatDate(v[1],'Asia/Taipei','yyyy-MM-dd') : String(v[1]);
    const stamp=v[6] instanceof Date ? v[6].toISOString() : String(v[6]);
    const r={id:String(v[0]),date:date,type:String(v[2]),category:String(v[3]),amount:Number(v[4]),note:String(v[5]),updatedAt:stamp,store:v[7]===undefined?'':String(v[7]).trim()};
    ledgerValidate_(r);
    if(Number(r.date.slice(0,4))!==year)throw new Error('日期年度不符，請放在「收支明細_'+r.date.slice(0,4)+'」。');
    if(!isFinite(Date.parse(stamp)))throw new Error('資料更新時間格式有誤，請檢查試算表。');
    if(ids[r.id])throw new Error('試算表出現重複記錄 ID，請修正後再連接。');ids[r.id]=true;
    return r;
    } catch(e){throw ledgerError_(e.code||'INVALID_ROW',name+' 第 '+(index+2)+' 列：'+e.message);}
  });
}
function ledgerValidate_(r) {
  if (!r || typeof r.id !== 'string' || !/^[\w-]{1,100}$/.test(r.id)) throw new Error('記錄 ID 格式不正確。');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !isFinite(Date.parse(r.date)) || new Date(r.date+'T12:00:00Z').toISOString().slice(0,10) !== r.date) throw new Error('日期格式不正確。');
  if (!Object.prototype.hasOwnProperty.call(LEDGER_CATEGORIES,r.type) || typeof r.category!=='string'||!r.category.trim()||r.category.length>40||/[\u0000-\u001f]/.test(r.category)) throw new Error('收支類型或分類不正確。');
  if (typeof r.amount !== 'number' || !isFinite(r.amount) || r.amount<=0 || r.amount>999999999 || Math.abs(r.amount*100-Math.round(r.amount*100))>0.0001) throw new Error('金額需為正數且最多兩位小數。');
  if(r.store!==undefined&&(typeof r.store!=='string'||r.store.trim().length>40||/[\u0000-\u001f]/.test(r.store)||r.store.trim()==='*'))throw new Error('門市名稱最多 40 字，且不得包含控制字元或使用 *。');
  if (typeof r.note !== 'string' || r.note.length>300) throw new Error('備註最多 300 字。');
}
function ledgerText_(value) {const text=String(value);return /^[=+\-@\t\r']/.test(text) ? "'"+text : text;}
function ledgerValues_(r,stamp) {return [r.id,r.date,r.type,ledgerText_(r.category),r.amount,ledgerText_(r.note),stamp,ledgerText_(r.store||'')];}
function ledgerSame_(a,b) {return a.date===b.date && a.type===b.type && a.category===b.category && a.amount===b.amount && a.note===b.note && (a.store||'')===(b.store||'');}

function ledgerSchema_(sheet,values){
 const width=Math.min(8,sheet.getMaxColumns()),first=values?values[0]:sheet.getRange(1,1,1,width).getValues()[0];
 if(first.slice(0,7).join('|')!==LEDGER_HEADERS.slice(0,7).join('|'))throw ledgerError_('SCHEMA_MISMATCH','前七欄不符；原資料未覆蓋。請依年度分頁八欄格式填寫。');
 if(width<8)return 7;
 const eighth=first[7];
 if(eighth==='門市')return 8;
 if(eighth!==''&&eighth!==undefined)throw ledgerError_('SCHEMA_MISMATCH','第八欄已有其他資料，請先保留並移開該欄，程式不會覆蓋。');
 const length=sheet.getLastRow()-1;
 if(length>0&&(values?values.slice(1).map(function(v){return [v[7]];}):sheet.getRange(2,8,length,1).getValues()).some(function(v){return v[0]!==''&&v[0]!==undefined;}))throw ledgerError_('SCHEMA_MISMATCH','第八欄已有資料，無法加入門市欄；原資料未覆蓋。');
 return 7;
}
function ledgerStoreColumn_(sheet,width){
 if((width||ledgerSchema_(sheet))===7){ledgerEnsureWidth_(sheet);sheet.getRange(1,8,1,1).setValues([['門市']]);sheet.getRange('H:H').setNumberFormat('@');}
}
// Return logical values, before the apostrophe escaping used for sheet cells.
function ledgerRecord_(values){return {id:values[0],date:values[1],type:values[2],category:ledgerUnescape_(values[3]),amount:values[4],note:ledgerUnescape_(values[5]),updatedAt:values[6],store:ledgerUnescape_(values[7])};}
function ledgerUnescape_(value){return value.charAt(0)==="'"?value.slice(1):value;}
function ledgerEnsureWidth_(sheet){const width=sheet.getMaxColumns();if(width<8)sheet.insertColumnsAfter(width,8-width);}

function ledgerCatalogRead_(book){
 const sheet=book.getSheetByName('日日果凍設定');if(!sheet||sheet.getLastRow()===0)return {catalog:null,revision:0};
 if(sheet.getLastRow()!==2||sheet.getRange(1,1,1,2).getValues()[0].join('|')!=='版本|設定JSON')throw ledgerError_('CATALOG_SCHEMA','「日日果凍設定」欄位不同，原資料未覆蓋。');
 const values=sheet.getRange(2,1,1,2).getValues()[0];
 if(!Number.isInteger(values[0])||values[0]<1)throw ledgerError_('CATALOG_SCHEMA','管理設定版本無效，請檢查設定工作表。');
 let catalog;try{catalog=ledgerCatalogValidate_(JSON.parse(values[1]));}catch(e){throw ledgerError_('CATALOG_SCHEMA','管理設定格式無效，原資料未覆蓋。');}
 return {catalog:catalog,revision:values[0]};
}
function ledgerCatalogValidate_(input){
 if(!input||!Array.isArray(input.stores)||!Array.isArray(input.categories)||input.stores.length>80||input.categories.length>120)throw new Error('管理清單格式不正確。');
 const ids={},names={};
 const name=function(value,store){if(typeof value!=='string'||!value.trim()||value.trim().length>40||/[\u0000-\u001f]/.test(value)||store&&value.trim()==='*')throw new Error('名稱需為 1–40 字。');return value.trim();};
 const clean=function(item,kind){
  if(!item||typeof item.id!=='string'||! /^[\w-]{1,100}$/.test(item.id)||ids['$'+item.id]||typeof item.active!=='boolean'||!Array.isArray(item.aliases)||item.aliases.length>30)throw new Error('管理項目格式不正確。');
  ids['$'+item.id]=true;const type=kind==='store'?'store':item.type;if(['store','income','expense'].indexOf(type)<0||kind==='category'&&type==='store')throw new Error('分類類型不正確。');
  const current=name(item.name,kind==='store'),aliases=[...new Set(item.aliases.map(function(v){return name(v,kind==='store');}))].filter(function(v){return v!==current;});
  [current].concat(aliases).forEach(function(n){const key='$'+type+'|'+n;if(names[key])throw new Error('名稱包含歷史名稱不得重複。');names[key]=true;});
  if(kind==='store'&&item.hiddenFromReports!==undefined&&typeof item.hiddenFromReports!=='boolean')throw new Error('門市報表隱藏設定必須為布林值。');
  const result={id:item.id,name:current,aliases:aliases,active:item.active};if(kind==='category')result.type=type;else result.hiddenFromReports=item.hiddenFromReports===true;return result;
 };
 const result={stores:input.stores.map(function(i){return clean(i,'store');}),categories:input.categories.map(function(i){return clean(i,'category');}),defaultStore:input.defaultStore||''};
 if(result.defaultStore&&!result.stores.some(function(s){return s.id===result.defaultStore&&s.active;}))throw new Error('預設門市必須啟用。');
 if(JSON.stringify(result).length>18000)throw new Error('管理清單過大。');return result;
}
function ledgerCatalogPreserve_(before,next){
 ['stores','categories'].forEach(function(kind){before[kind].forEach(function(old){
  const item=next[kind].find(function(x){return x.id===old.id;});
  if(!item||item.type!==old.type||[old.name].concat(old.aliases).some(function(n){return n!==item.name&&item.aliases.indexOf(n)<0;}))throw new Error('歷史管理項目不能刪除或移除歷史名稱，請改用停用。');
 });});
}
