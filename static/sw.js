const CACHE_NAME = "fieldseal-documentation-v42";
const APP_SHELL = [
  "/static/index.html",
  "/static/app.css?v=33",
  "/static/i18n.js?v=23",
  "/static/tooltips.js?v=2",
  "/static/app.js?v=40",
  "/static/manifest.webmanifest",
  "/static/midnight-demo.en.html",
  "/static/midnight-demo.css?v=4",
  "/static/midnight-demo.locales.js?v=3",
  "/static/midnight-demo.en.js?v=4",
  "/static/midnight-logo-dark.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/static/index.html")));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
