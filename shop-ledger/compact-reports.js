const number=new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2});
const tenThousands=new Intl.NumberFormat('zh-TW',{maximumFractionDigits:1});

// Keep small and negative amounts exact; only abbreviate values of at least NT$10,000.
export function compactAmount(cents){
  return Math.abs(cents)>=1000000?tenThousands.format(cents/1000000)+'萬':number.format(cents/100);
}

// Preserve cents whenever the full amount fits the donut at a readable size.
// Longer totals use an explicitly approximate unit instead of shrinking text.
export function donutAmount(cents){
  const exact=number.format(cents/100);
  if(exact.length<=12)return exact;
  const inHundredMillions=Math.abs(cents)>=10000000000||Math.round(Math.abs(cents)/1000000*10)/10>=10000;
  return '約'+tenThousands.format(cents/(inHundredMillions?10000000000:1000000))+(inHundredMillions?'億':'萬');
}

export function categoryOverview(groups){
  const total=groups.reduce((sum,g)=>sum+g.value,0);
  const items=groups.map((g,index)=>({...g,index}));
  const remaining=items.length>5?items.slice(4):[];
  const slices=remaining.length?[
    ...items.slice(0,4),
    {name:`其他（${remaining.length}類）`,index:-1,value:remaining.reduce((sum,g)=>sum+g.value,0),count:remaining.reduce((sum,g)=>sum+g.count,0)}
  ]:items;
  return {total,remaining,slices:slices.map(g=>({...g,share:total?g.value/total*100:0}))};
}

export function storeComparisonPage(stores,page=0){
  const recorded=stores.filter(s=>s.hasRecords),ordered=[...recorded,...stores.filter(s=>!s.hasRecords)];
  const pageCount=Math.max(1,Math.ceil(ordered.length/5));
  const currentPage=Math.max(0,Math.min(page,pageCount-1));
  return {items:ordered.slice(currentPage*5,currentPage*5+5),page:currentPage,pageCount,recordedCount:recorded.length,
    // One scale across both measures and every page, including shared costs.
    max:recorded.reduce((max,s)=>Math.max(max,s.income,s.expense),0)};
}

// Income contribution has its own denominator; expense-only and missing stores
// stay in the operating comparison and never become artificial donut sectors.
export function storeIncomeOverview(stores){
  return categoryOverview(stores.map((s,storeIndex)=>({...s,storeIndex}))
    .filter(s=>s.store&&s.hasRecords&&s.income>0).sort((a,b)=>b.income-a.income||a.store.localeCompare(b.store))
    .map(s=>({name:s.store,value:s.income,count:s.incomeCount,storeIndex:s.storeIndex})));
}
