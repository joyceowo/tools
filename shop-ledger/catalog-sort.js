// Keep the real row as a drop slot; a noninteractive copy follows the pointer.
export function setupCatalogSort({list,isLocked,onMove,onCancel,onError}){
 let drag=null,frame=0,settling=null;
 const rows=()=>[...list.querySelectorAll('[data-sort-id]')];
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 function preview(){if(drag?.ghost)drag.ghost.style.top=(drag.y-drag.offset)+'px';}
 function place(y){
  if(!drag?.started)return;
  const group=rows().filter(row=>row.dataset.sortGroup===drag.row.dataset.sortGroup);
  const before=group.find(row=>row!==drag.row&&y<list.getBoundingClientRect().top+row.offsetTop+row.offsetHeight/2)||group.at(-1).nextElementSibling;
  if(before===drag.row){preview();return;}
  if(drag.row.nextElementSibling!==(before||null)){
   const positions=new Map(rows().map(row=>[row,row.getBoundingClientRect().top]));
   list.insertBefore(drag.row,before||null);
   drag.handle.setPointerCapture(drag.pointer);drag.handle.focus({preventScroll:true});
   for(const row of rows()){
    row.getAnimations().forEach(animation=>animation.cancel());
    const delta=positions.get(row)-row.getBoundingClientRect().top;
    if(row!==drag.row&&delta&&!reduced())row.animate([{transform:`translateY(${delta}px)`},{transform:'translateY(0)'}],{duration:180,easing:'ease-out'});
   }
  }
  preview();
 }
 function scroll(){
  if(!drag?.started)return;
  const top=document.querySelector('.app-header')?.getBoundingClientRect().bottom||0;
  const nav=document.querySelector('.mobile-nav')?.getBoundingClientRect();
  const bottom=nav?.height?nav.top:innerHeight,edge=56;
  const speed=drag.y<top+edge?-Math.min(12,(top+edge-drag.y)/4):drag.y>bottom-edge?Math.min(12,(drag.y-bottom+edge)/4):0;
  if(speed){window.scrollBy(0,speed);place(drag.y);}
  frame=requestAnimationFrame(scroll);
 }
 function clear(){
  const previous=drag;drag=null;cancelAnimationFrame(frame);
  if(previous?.handle.hasPointerCapture(previous.pointer))previous.handle.releasePointerCapture(previous.pointer);
  return previous;
 }
 function cleanup(previous){
  previous?.ghost?.remove();previous?.row.classList.remove('catalog-dragging');
  rows().forEach(row=>row.getAnimations().forEach(animation=>animation.cancel()));
 }
 async function move(id,index){
  try{await onMove(id,index);}
  catch(error){onCancel();onError(error);}
  list.querySelector(`[data-sort-handle="${id}"]`)?.focus({preventScroll:true});
 }
 async function finish(previous){
  settling=previous;
  const index=rows().indexOf(previous.row),target=previous.row.getBoundingClientRect();
  if(!reduced()){
   const animation=previous.ghost.animate([{top:previous.ghost.style.top},{top:target.top+'px'}],{duration:150,easing:'ease-out',fill:'forwards'});
   await animation.finished.catch(()=>{});
  }
  if(settling!==previous)return;
  settling=null;cleanup(previous);
  if(index!==previous.index)void move(previous.row.dataset.sortId,index);
 }
 const cancel=()=>{
  const previous=clear()||settling;settling=null;
  if(previous){previous.ghost?.getAnimations().forEach(animation=>animation.cancel());cleanup(previous);if(previous.started)onCancel();}
 };
 list.addEventListener('pointerdown',event=>{
  const handle=event.target.closest('[data-sort-handle]');
  if(!handle||event.button!==0||!event.isPrimary||isLocked()||drag||settling)return;
  event.preventDefault();handle.focus({preventScroll:true});
  const row=handle.closest('[data-sort-id]'),rect=row.getBoundingClientRect();
  drag={handle,row,pointer:event.pointerId,startY:event.clientY,y:event.clientY,offset:event.clientY-rect.top,index:rows().indexOf(row),started:false};
  handle.setPointerCapture(event.pointerId);
 });
 list.addEventListener('pointermove',event=>{
  if(!drag||drag.pointer!==event.pointerId)return;
  drag.y=event.clientY;
  if(!drag.started&&Math.abs(drag.y-drag.startY)>6){
   drag.started=true;
   const rect=drag.row.getBoundingClientRect(),ghost=drag.row.cloneNode(true);
   ghost.removeAttribute('data-sort-id');
   ghost.querySelectorAll('[data-sort-handle],[data-catalog-edit]').forEach(node=>{node.removeAttribute('data-sort-handle');node.removeAttribute('data-catalog-edit');});
   ghost.classList.add('catalog-drag-preview');ghost.inert=true;ghost.setAttribute('aria-hidden','true');
   Object.assign(ghost.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px'});
   document.body.append(ghost);drag.ghost=ghost;
   drag.row.classList.add('catalog-dragging');frame=requestAnimationFrame(scroll);
  }
  place(drag.y);
 });
 list.addEventListener('pointerup',event=>{
  if(!drag||drag.pointer!==event.pointerId)return;
  const previous=clear();if(previous.started)void finish(previous);
 });
 list.addEventListener('pointercancel',cancel);
 list.addEventListener('lostpointercapture',()=>{if(drag&&!drag.handle.hasPointerCapture(drag.pointer))cancel();});
 list.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&(drag||settling)){event.preventDefault();cancel();return;}
  const handle=event.target.closest('[data-sort-handle]');
  if(!handle||!['ArrowUp','ArrowDown'].includes(event.key)||isLocked()||drag||settling)return;
  event.preventDefault();
  const index=rows().indexOf(handle.closest('[data-sort-id]'))+(event.key==='ArrowUp'?-1:1);
  if(index>=0&&index<rows().length&&rows()[index].dataset.sortGroup===handle.closest('[data-sort-id]').dataset.sortGroup)void move(handle.dataset.sortHandle,index);
 });
 window.addEventListener('blur',cancel);
 window.addEventListener('resize',cancel);
 // The captured handle is hidden inside the slot; Escape must still work without focus.
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&(drag||settling)){event.preventDefault();cancel();}},true);
 return {cancel};
}
