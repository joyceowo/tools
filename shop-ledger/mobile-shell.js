// Measure the actual bars, including safe areas, font size and software keyboard.
export function setupMobileShell(){
 const root=document.documentElement,header=document.querySelector('.app-header'),nav=document.querySelector('.mobile-nav'),scope=document.querySelector('#scope-panel'),reportPeriod=document.querySelector('#report-period-bar');
 let largestHeight=innerHeight;
 function update(){
  root.style.setProperty('--app-header-height',header.getBoundingClientRect().height+'px');
  root.style.setProperty('--mobile-nav-height',nav.getBoundingClientRect().height+'px');
  root.style.setProperty('--record-toolbar-height',document.body.classList.contains('transactions-page')&&innerWidth<=760?scope.getBoundingClientRect().height+'px':'0px');
  root.style.setProperty('--report-toolbar-height',document.body.classList.contains('report-detail-page')&&innerWidth<=760?reportPeriod.getBoundingClientRect().height+'px':'0px');
  const viewport=window.visualViewport,height=viewport?.height||innerHeight;
  const typing=document.activeElement?.matches('input:not([type=checkbox]),textarea,select');
  if(!typing)largestHeight=innerHeight;
  const keyboard=typing&&largestHeight-height>140;
  document.body.classList.toggle('keyboard-open',Boolean(keyboard));
  root.style.setProperty('--keyboard-inset',keyboard?Math.max(0,innerHeight-height-(viewport?.offsetTop||0))+'px':'0px');
 }
 new ResizeObserver(update).observe(header);
 new ResizeObserver(update).observe(nav);
 new ResizeObserver(update).observe(scope);
 new ResizeObserver(update).observe(reportPeriod);
 window.addEventListener('resize',update);
 window.visualViewport?.addEventListener('resize',update);
 window.visualViewport?.addEventListener('scroll',update);
 document.addEventListener('focusin',update);
 document.addEventListener('focusout',()=>requestAnimationFrame(update));
 update();
}
