/* ================================================================
   Random Learning Vault — Service Worker
   Estrategia:
   - Precache del app shell (index, manifest, íconos) en install.
   - Navegaciones y assets locales: cache-first con revalidación en
     segundo plano (stale-while-revalidate simplificado).
   - API de Gemini: SIEMPRE pasa a la red (nunca se cachea la clave
     ni las respuestas); si falla, deja que la app lo gestione.
   - Limpieza de versiones antiguas en activate + skipWaiting.
   NOTA: si cambias archivos estáticos, incrementa CACHE_VERSION.
================================================================ */

// GitHub Pages sirve la app bajo subruta (p.ej. /usuario/repo/); todas las
// rutas del shell son relativas ('./'), así que funcionan tanto en la raíz
// de un sitio de usuario como en subcarpetas de proyecto.
// Si cambias archivos estáticos, incrementa CACHE_VERSION.
const CACHE_VERSION = 'rlv-v1.2.0';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg'
];

const GEMINI_HOST = 'generativelanguage.googleapis.com';

/* ---------------- INSTALL: precache del shell ---------------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

/* ---------------- ACTIVATE: limpiar cachés viejas ---------------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(CACHE_VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ---------------- FETCH: enrutamiento ---------------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Solo GET; POST (API de Gemini) pasa directo a red sin interceptar.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Peticiones externas (Gemini, etc.): network-only, sin cachear.
  if (url.origin !== self.location.origin) {
    if (url.hostname === GEMINI_HOST) return; // dejar pasar sin tocar
    return;
  }

  // Navegación (recargar / abrir la app): shell desde caché, fallback offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Revalidar el shell si hubo red
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() =>
          caches.match('./index.html').then((hit) => hit || caches.match('./'))
        )
    );
    return;
  }

  // Assets locales: cache-first + revalidación silenciosa.
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
