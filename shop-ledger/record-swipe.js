// A swipe exposes the existing delete action; deletion still requires confirmation.
export function setupRecordSwipe(body, mobile) {
  let start = null;
  let openRow = null;
  let ignoreClickUntil = 0;
  const rowAt = target => target.closest?.('tr[data-record-id]');
  const close = () => {
    openRow?.classList.remove('swipe-open');
    openRow = null;
  };

  body.addEventListener('pointerdown', event => {
    if (!mobile.matches || event.pointerType !== 'touch' || !event.isPrimary) return;
    const row = rowAt(event.target);
    start = row ? {row, id: event.pointerId, x: event.clientX, y: event.clientY} : null;
  });
  body.addEventListener('pointerup', event => {
    if (!start || event.pointerId !== start.id) return;
    const {row, x, y} = start;
    start = null;
    const dx = event.clientX - x, dy = event.clientY - y;
    if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy) * 1.3) return;
    if (dx < 0) {
      if (openRow !== row) close();
      row.classList.add('swipe-open');
      openRow = row;
    } else if (openRow === row) close();
    else return;
    // Touch browsers may synthesize a click on release; it must not open the editor.
    ignoreClickUntil = performance.now() + 150;
    event.preventDefault();
  });
  body.addEventListener('pointercancel', () => { start = null; });
  body.addEventListener('click', event => {
    if (performance.now() < ignoreClickUntil) {
      ignoreClickUntil = 0;
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (!openRow) return;
    if (event.target.closest?.('[data-delete]')) { close(); return; }
    if (rowAt(event.target) === openRow) {
      close();
      event.preventDefault();
      event.stopImmediatePropagation();
    } else close();
  }, true);
  mobile.addEventListener('change', close);
  window.addEventListener('scroll', close, {passive: true});
}
