const CACHE_NAME = "kodo-pace-handwriting-prototype-v1";
const ASSETS = [
  "./index.html",
  "./app.js",
  "./style.css",
  "./manifest.json",
  "./icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

// オフラインでも解答プロトタイプが起動できるか(PWA化の検証)を確かめるための
// cache-first 戦略。実運用では採点結果等の同期方法を別途設計する必要がある。
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
