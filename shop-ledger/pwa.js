export function isStandalone(win = window, nav = navigator) {
  return win.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

// Only resume a saved ledger in the installed app. Explicit shared links always win.
export function launchConnectionUrl(href, standalone, savedSheet) {
  const url = new URL(href);
  if (standalone && savedSheet && !url.searchParams.has('sheet') && !url.searchParams.has('id')) {
    url.searchParams.set('sheet', savedSheet);
  }
  return url.href;
}

export function setupPwa(win = window, nav = navigator, doc = document) {
  const get = id => doc.getElementById(id);
  const button = get('pwa-install');
  const status = get('pwa-status');
  const dialog = get('pwa-dialog');
  const display = win.matchMedia('(display-mode: standalone)');
  const ios = /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  const safari = /Version\/[\d.]+.*Safari\//.test(nav.userAgent) && !/Android|Chrome|Chromium|CriOS|FxiOS|Edg|OPiOS|Line\/|FBAN|FBAV|Instagram|MicroMessenger/i.test(nav.userAgent);
  let pending = null, installing = false, installed = false;
  function instructions() {
    if (ios) return safari ? '點 Safari 的「分享」→「加入主畫面」→「加入」。若有「作為網頁 App 開啟」，請保持開啟。' : '請先用 Safari 開啟這個網站，再點「加入手機主畫面」。';
    if (safari) return '在 Safari 的「檔案」選單選擇「加入 Dock」。';
    if (/Android/i.test(nav.userAgent)) return '開啟瀏覽器選單，選「安裝應用程式」或「加入主畫面」。若沒有此選項，請改用 Chrome 開啟。';
    return '請從瀏覽器選單選擇「安裝應用程式」。若沒有此選項，請改用 Chrome 或 Edge 開啟。';
  }
  function explain(message) {
    status.textContent = message;
    if (!dialog.open) dialog.showModal();
  }
  function render() {
    button.hidden = installed || isStandalone(win, nav);
    button.disabled = installing;
    button.textContent = installing ? '正在開啟安裝…' : '加入手機主畫面';
    if (button.hidden && dialog.open) dialog.close();
  }
  win.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    pending = event;
    render();
  });
  win.addEventListener('appinstalled', () => {
    pending = null;
    installed = true;
    render();
  });
  display.addEventListener?.('change', render);
  button.addEventListener('click', async () => {
    if (installing || installed || isStandalone(win, nav)) return;
    if (!win.isSecureContext) { explain('請使用這個網站的 HTTPS 網址，再加入主畫面。'); return; }
    if (!pending) { explain(instructions()); return; }
    const prompt = pending;
    pending = null;
    installing = true;
    render();
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      explain(instructions());
    } finally {
      installing = false;
      render();
    }
  });
  render();
  if (win.isSecureContext && 'serviceWorker' in nav) {
    // Resolve against the module, never the domain root: works on /repo/ and custom domains.
    nav.serviceWorker.register(new URL('./sw.js', import.meta.url), {updateViaCache: 'none'}).catch(() => {});
  }
}
