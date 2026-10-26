// Keep the existing synchronous navigation guards; resume only after an explicit choice.
export function setupDiscardConfirmation(doc = document) {
  const dialog = doc.getElementById('discard-dialog');
  const message = doc.getElementById('discard-message');
  let pending = null;
  doc.getElementById('discard-keep').onclick = () => {
    pending = null;
    dialog.close();
  };
  doc.getElementById('discard-accept').onclick = () => {
    const action = pending;
    pending = null;
    dialog.close();
    action?.();
  };
  dialog.addEventListener('cancel', () => { pending = null; });
  dialog.addEventListener('close', () => { if (!dialog.open) pending = null; });
  return (subject, onDiscard) => {
    if (dialog.open) return;
    message.textContent = `尚未儲存的${subject}修改將不會保留。`;
    pending = onDiscard;
    dialog.showModal();
  };
}
