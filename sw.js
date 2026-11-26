// Service Worker do Diário de Obra — SAGIS
// Rede primeiro (sempre pega a versão mais nova quando há internet) e guarda uma cópia
// para o app abrir mesmo sem sinal na obra.
const CACHE = 'dob-offline-v1';
const BASE = self.registration.scope;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // já deixa a página e os ícones guardados para a primeira vez offline
  event.waitUntil(caches.open(CACHE).then(c => c.addAll([BASE, BASE + 'manifest.webmanifest', BASE + 'icon-192.png']).catch(() => {})));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== CACHE && k.indexOf('dob-offline-') === 0).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

const guardar = async (chave, resp) => {
  try{ if(resp && (resp.status === 200 || resp.type === 'opaque')){ const c = await caches.open(CACHE); await c.put(chave, resp.clone()); } }catch(e){ /* sem espaço: segue */ }
  return resp;
};

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  // não mexe no tráfego do banco/login (o Firestore tem o próprio cache offline)
  if(/firestore\.googleapis\.com|identitytoolkit|securetoken|googleapis\.com\/(upload|drive)|accounts\.google/.test(url.host + url.pathname)) return;

  // abrir o app / recarregar: busca a versão mais nova; sem sinal, abre a última guardada
  if(req.mode === 'navigate'){
    event.respondWith((async () => {
      try{
        const r = await fetch(req, { cache: 'no-store' });
        guardar(BASE, r.clone());
        return r;
      }catch(e){
        return (await caches.match(BASE)) || (await caches.match(req, { ignoreSearch: true })) || Response.error();
      }
    })());
    return;
  }
  // demais arquivos (dados do cronograma, ícones, scripts do Firebase…): rede primeiro, cópia como reserva
  event.respondWith((async () => {
    try{
      const r = await fetch(req);
      guardar(req.url, r.clone());
      return r;
    }catch(e){
      const c = await caches.match(req.url, { ignoreSearch: false }) || await caches.match(req, { ignoreSearch: true });
      return c || Response.error();
    }
  })());
});
