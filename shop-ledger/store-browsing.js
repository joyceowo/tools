// Desktop keeps three-store pages; phones reveal five more stores at a time.
export function storeBrowsingData(all,page=0,visibleCount=null){
 const pageCount=Math.max(1,Math.ceil(all.length/3)),selected=Math.max(0,Math.min(page,pageCount-1));
 return {items:visibleCount===null?all.slice(selected*3,selected*3+3):all.slice(0,Math.max(5,visibleCount)),page:selected,pageCount,totalCount:all.length,mobile:visibleCount!==null};
}
export function storeBrowsingMarkup(data,kind){
 if(data.mobile){
  if(!data.totalCount)return '';
  const shown=data.items.length,complete=shown>=data.totalCount;
  return `<div class="store-period-more"><p role="status" aria-live="polite">${complete?'已顯示全部 '+data.totalCount+' 間門市':'已顯示 '+shown+'／'+data.totalCount+' 間門市'}</p>${complete?'':`<button type="button" data-store-more="${kind}">顯示更多門市</button>`}</div>`;
 }
 const attribute=kind==='current'?'data-current-page':'data-store-yoy-page';
 return data.pageCount>1?`<div class="store-period-pages"><button type="button" ${attribute}="-1" aria-label="上一頁門市" ${data.page===0?'disabled':''}>←</button><span>${data.page+1} / ${data.pageCount}</span><button type="button" ${attribute}="1" aria-label="下一頁門市" ${data.page===data.pageCount-1?'disabled':''}>→</button></div>`:'';
}
