/* Apus Iliniza Sur v31 — caché de archivos del juego para modo offline. */
const APUS_CACHE_VERSION = 'apus-iliniza-sur-v32.0.8';
const PRECACHE_URLS = [
  "./js/refugio-mapa.js?v=32.0.8",
  "./js/refugio-presencia.js?v=32.0.8",
  "./js/refugio-online-config.js?v=32.0.8",
  "./js/apus-ota-android.js",
  "./assets/intro/logo-apus-guardians.png",
  "./assets/intro/fondo-video.webp",
  "./css/apus-intro-video.css",
  "./js/apus-intro-video.js",
  "./js/apus-musica-v31_5.js",
  "./LEEME_VERSION_31.md",
  "./assets/escenarios/imagen_06cbc52a0cb825.webp",
  "./assets/escenarios/imagen_1a6279d63f8638.jpg",
  "./assets/escenarios/imagen_303c377b9750ae.webp",
  "./assets/escenarios/imagen_342787263b2de3.jpg",
  "./assets/escenarios/imagen_3b15295023bdb3.jpg",
  "./assets/escenarios/imagen_3b421faf695056.jpg",
  "./assets/escenarios/imagen_55af60aebc8ae5.webp",
  "./assets/escenarios/imagen_55e2c4e6573f42.jpg",
  "./assets/escenarios/imagen_5cf37cd5ed2748.webp",
  "./assets/escenarios/imagen_5d5dde0f24239c.webp",
  "./assets/escenarios/imagen_5faaa6d2985806.jpg",
  "./assets/escenarios/imagen_5ffc3bb9ac1e03.jpg",
  "./assets/escenarios/imagen_63b99e01bdc13d.webp",
  "./assets/escenarios/imagen_6c4162643acafe.webp",
  "./assets/escenarios/imagen_6ce08e48db7d18.webp",
  "./assets/escenarios/imagen_8574fdcee9bb98.jpg",
  "./assets/escenarios/imagen_861a5541b61ca4.jpg",
  "./assets/escenarios/imagen_890f8378532962.webp",
  "./assets/escenarios/imagen_8b71506e61db30.jpg",
  "./assets/escenarios/imagen_93d5368095f252.jpg",
  "./assets/escenarios/imagen_9b3df74e079b79.jpg",
  "./assets/escenarios/imagen_9b43dce767f49a.jpg",
  "./assets/escenarios/imagen_a7b2b16f2c4ae4.webp",
  "./assets/escenarios/imagen_b182669a1add79.webp",
  "./assets/escenarios/imagen_bc2f12ff8b5275.jpg",
  "./assets/escenarios/imagen_bf882a7a523838.jpg",
  "./assets/escenarios/imagen_c22a379f0e96c3.webp",
  "./assets/escenarios/imagen_cd1f73a401a35c.jpg",
  "./assets/escenarios/imagen_ced116ff6cb629.jpg",
  "./assets/escenarios/imagen_db531da62e8373.webp",
  "./assets/escenarios/imagen_dc00bec0cffc8d.webp",
  "./assets/escenarios/imagen_dd73c05a363059.jpg",
  "./assets/escenarios/imagen_e94972170d3aae.jpg",
  "./assets/escenarios/imagen_ee4a3458fd9fde.jpg",
  "./assets/escenarios/imagen_f23c05f8b6b5b7.webp",
  "./assets/escenarios/imagen_f2cb0e234c94fe.jpg",
  "./assets/escenarios/imagen_f4779e8be47463.jpg",
  "./assets/escenarios/imagen_fd1cff65bb1831.jpg",
  "./css/estilos.css",
  "./css/refugio-apus.css?v=32.0.8",
  "./js/refugio-apus.js?v=32.0.8",
  "./index.html",
  "./js/actualizaciones-v30.js",
  "./js/chugo-vs-jordy.js",
  "./js/cinematicas-y-bucle.js",
  "./js/conexion-y-ascenso.js",
  "./js/inicio.js",
  "./js/juego-principal.js",
  "./js/puentes-minijuegos.js",
  "./js/torneos.js",
  "./minijuegos/animacion-cumbre.html",
  "./minijuegos/animacion-descenso.html",
  "./minijuegos/apus-4x4.html",
  "./minijuegos/bingo-camping.html",
  "./minijuegos/friki-apus.html",
  "./manifest.json",
  "./"
];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APUS_CACHE_VERSION);
    // Una descarga fallida no bloquea el arranque del juego ni la activación.
    const results = await Promise.allSettled(PRECACHE_URLS.map(async path => {
      const response = await fetch(path, {cache:'reload'});
      if (!response.ok) throw new Error(path + ': HTTP ' + response.status);
      await cache.put(path, response);
    }));
    const failed = results.filter(r => r.status === 'rejected');
    if(failed.length) console.warn('APUS: algunos recursos offline no se descargaron:', failed.length);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // Conservamos el caché inmediatamente anterior: incluye vídeos y música
    // descargados cuando el usuario estaba en línea. Evita pantallas negras
    // por re-descargar todos los MP4/MP3 tras una actualización OTA.
    const gameCaches=keys.filter(k => k.startsWith('apus-iliniza-sur-'));
    const ordered=[...gameCaches.filter(k=>k!==APUS_CACHE_VERSION),APUS_CACHE_VERSION];
    const keep=new Set(ordered.slice(-2));
    await Promise.all(gameCaches.filter(k=>!keep.has(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return; // Firebase y PeerJS no se cachean.
  // Video MP4: responder a rangos (206) desde caché para reproducirlo offline.
  if (/\/assets\/intro\/(?:reto-iliniza-sur(?:-vertical)?\.mp4|musica-intro\.m4a)$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(APUS_CACHE_VERSION);
      let stored = await cache.match(url.href) || await caches.match(url.href);
      if (!stored) {
        const online = await fetch(new Request(url.href, {cache:'no-store'}));
        if (!online.ok) return online;
        await cache.put(url.href, online.clone());
        stored = online;
      }
      const range = req.headers.get('range');
      if (!range) return stored;
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) return new Response(null, {status:416});
      const data = await stored.arrayBuffer();
      const size = data.byteLength;
      let begin = match[1] ? Number(match[1]) : Math.max(0,size-Number(match[2] || 0));
      let end = match[2] && match[1] ? Math.min(size-1,Number(match[2])) : size-1;
      if (!Number.isFinite(begin) || begin >= size || begin < 0 || end < begin)
        return new Response(null, {status:416,headers:{'Content-Range':'bytes */'+size}});
      const body = data.slice(begin,end+1);
      return new Response(body,{status:206,headers:{
        'Content-Type':url.pathname.endsWith('.m4a')?'audio/mp4':'video/mp4',
        'Accept-Ranges':'bytes',
        'Content-Range':'bytes '+begin+'-'+end+'/'+size,
        'Content-Length':String(body.byteLength)
      }});
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(APUS_CACHE_VERSION);
    if (req.mode === 'navigate') {
      try {
        const response = await fetch(req);
        if (response.ok) await cache.put(req, response.clone());
        return response;
      } catch (err) {
        return (await cache.match(req)) || (await cache.match('./index.html')) || (await caches.match('./index.html')) || Response.error();
      }
    }
    const cached = await cache.match(req);
    if(cached) return cached;
    // Rescatar audio e imágenes offline del caché anterior; nunca reutilizar
    // JS/CSS viejos porque podrían romper el arranque del juego actualizado.
    if (/\.(?:mp3|mp4|m4a|png|jpg|jpeg|webp)$/i.test(url.pathname)) {
      const older = await caches.match(req);
      if (older) return older;
    }
    try {
      const response = await fetch(req);
      if(response.ok && response.type === 'basic') await cache.put(req, response.clone());
      return response;
    } catch (err) { return Response.error(); }
  })());
});
