export const categories = { income: ['銷售收入', '其他收入'], expense: ['原料', '包材', '租金', '水電', '設備', '其他'] };
export function sheetId(value) {
  const text = String(value || '').trim();
  const id = text.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([\w-]+)(?:\/|\?|#|$)/)?.[1] || text;
  if (!/^[\w-]{20,150}$/.test(id)) throw new Error('請貼上完整的 Google 試算表網址，或 /d/ 與 /edit 之間的試算表 ID。');
  return id;
}
export function apiUrl(value) {
  let url;try{url = new URL(String(value).trim());}catch{throw new Error('請填入 Apps Script 部署網址，格式為 https://script.google.com/macros/s/…/exec。');}
  if (url.origin !== 'https://script.google.com' || url.username || url.password || !/^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname) || url.search || url.hash) throw new Error('請使用 https://script.google.com/macros/s/…/exec 部署網址。');
  return url.href;
}
export function validDate(date) { return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date)) && new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) === date; }
export function cents(value) {
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('金額請填寫正數，最多兩位小數。');
  const result = Math.round(Number(text) * 100);
  if (!Number.isSafeInteger(result) || result <= 0 || result > 99999999900) throw new Error('金額需介於 0.01 與 999,999,999 元。');
  return result;
}
export function validateRow(row) {
  if (!row || typeof row.id !== 'string' || !/^[\w-]{1,100}$/.test(row.id) || !validDate(row.date) || !Object.hasOwn(categories,row.type) || typeof row.category!=='string'||!row.category.trim()||row.category.length>40||/[\u0000-\u001f]/.test(row.category) || typeof row.note !== 'string' || row.note.length > 300 || typeof row.updatedAt !== 'string' || !Number.isFinite(Date.parse(row.updatedAt))) throw new Error('試算表資料格式不符，請檢查日期、類型、分類及欄位設定。');
  const result={ id: row.id, date: row.date, type: row.type, category: row.category, amount: cents(row.amount) / 100, note: row.note, updatedAt: row.updatedAt };
  if(row.store!==undefined)result.store=storeName(row.store);
  return result;
}
export function storeName(value='') {
  if(typeof value!=='string'||value.trim().length>40||/[\u0000-\u001f]/.test(value)||value.trim()==='*')throw new Error('門市名稱最多 40 字，不能包含控制字元或使用 *。');
  return value.trim();
}
export function storeKey(row){return row.store||'';}
export function storeLabel(value){return value||'—';}
export function forStore(rows,scope='*'){return scope==='*'?rows:rows.filter(r=>storeKey(r)===scope);}
export function totals(rows) {
  return rows.reduce((sum, row) => { sum[row.type] += cents(row.amount); sum[row.type + 'Count']++; sum.balance = sum.income - sum.expense; return sum; }, { income: 0, expense: 0, balance: 0, incomeCount: 0, expenseCount: 0 });
}
export function shiftDay(day, offset) { const date = new Date(day + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10); }
export function taipeiDay() { const p = new Intl.DateTimeFormat('en', {timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date()); return ['year','month','day'].map(type => p.find(x=>x.type === type).value).join('-'); }
