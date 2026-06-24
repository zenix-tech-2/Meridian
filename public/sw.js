// Meridian Operations Suite - Service Worker v2.4.1
const CACHE = 'meridian-ops-v241';
const CORE = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const {request} = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(request).then(cached => {
      const net = fetch(request).then(res=>{
        if(res.ok && res.status===200){
          const clone=res.clone();
          caches.open(CACHE).then(cache=>cache.put(request, clone));
        }
        return res;
      }).catch(()=> cached);
      return cached || net;
    })
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'Meridian', body: 'Operations update.', tag: 'meridian-ops', url: '/' };
  try { if(event.data) data = { ...data, ...event.data.json() }; } catch(e){}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag,
      data: { url: data.url || '/' },
      actions: [
        { action: 'open', title: 'Open workspace' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      requireInteraction: false,
      silent: false
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if(event.action === 'dismiss') return;
  const target = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for(const client of clientList){
        if('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if(self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

self.addEventListener('sync', (event)=>{
  if(event.tag === 'meridian-queue-sync'){
    event.waitUntil(
      self.registration.showNotification('Meridian Queue', {
        body: 'Background processing synchronized.',
        icon: '/icon-192.png',
        tag: 'sync-complete'
      })
    );
  }
});

self.addEventListener('message', (event)=>{
  if(event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
