// Cache only a generic offline screen, never a ledger, credential, API reply or app bundle.
// The default worker lifecycle keeps existing pages running until they are closed.
const scope = new URL(self.registration.scope);
const prefix = `jelly-ledger-offline-${encodeURIComponent(scope.pathname)}-`;
const cacheName = `${prefix}v1`;
const offlineUrl = new URL('offline.html', scope).href;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.add(offlineUrl)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(prefix) && key !== cacheName).map(key => caches.delete(key))
  )));
});
self.addEventListener('fetch', event => {
  const {request} = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || request.mode !== 'navigate' || url.origin !== scope.origin ||
      ![scope.pathname, `${scope.pathname}index.html`].includes(url.pathname)) return;
  event.respondWith(fetch(request).catch(async () => {
    const cache = await caches.open(cacheName);
    return await cache.match(offlineUrl) || Response.error();
  }));
});
