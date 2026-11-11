// Offline shell only: static UI assets. /api/panel/* is never cached — the panel
// honestly shows "Нет связи" instead of stale snapshots.
const VERSION='3.3.3';
// Deterministic small hash so the cache name changes whenever the version changes.
const CACHE='home-panel-v'+[...VERSION].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,7).toString(36);
const PRECACHE=['index.html','style.css','app.js'];
// Versioned chunks/models and fonts/images: cache-first (immutable once built).
const IMMUTABLE=/(?:^|\/)(?:assets\/|[^/]*\.(?:webp|woff2|ttf|png|jpg|jpeg|svg)$)/;
// Entry files: network-first with cache fallback, so updates arrive when online.
const SHELL=/(?:^|\/)(?:index\.html|app\.js|style\.css|chunk-[A-Za-z0-9_-]+\.js|model-[A-Za-z0-9_-]+\.js)$/;
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
function put(request,response){
 if(response&&response.ok)caches.open(CACHE).then(cache=>cache.put(request,response));
 return response;
}
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==location.origin)return;
 const path=url.pathname;
 if(path.startsWith('/api/'))return; // API responses are never cached.
 if(IMMUTABLE.test(path)){
  event.respondWith(caches.match(request).then(hit=>hit||fetch(request).then(r=>put(request,r.clone()))));
  return;
 }
 if(SHELL.test(path)){
  event.respondWith(fetch(request).then(r=>put(request,r.clone())).catch(()=>caches.match(request)));
 }
});