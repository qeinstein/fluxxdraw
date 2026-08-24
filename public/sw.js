/**
 * Minimal service worker.
 *
 * Its job is not caching cleverness — it exists because a PWA must control a
 * page to be installable, and installation is what lets the OS associate
 * `.fluxx` files with FluxxDraw. Beyond that it serves the app shell offline,
 * which suits a tool whose documents live on the user's own disk.
 */

const CACHE = "fluxxdraw-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  // Navigations: network first, falling back to the cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("/index.html", copy));
          return response;
        })
        .catch(() => caches.match("/index.html").then((r) => r ?? Response.error())),
    );
    return;
  }

  // Analytics is Vercel's own endpoint: never cache it, or it goes stale and
  // keeps reporting through an old script.
  if (new URL(request.url).pathname.startsWith("/_vercel/")) return;

  // Static assets are content-hashed, so cache-first is safe and fast.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
