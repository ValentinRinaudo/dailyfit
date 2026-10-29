/* Daily Fit service worker: app shell offline, fonts cached on first use, weather always live. */
const VERSION = "dailyfit-v6.0.0";
const SHELL = ["./", "index.html", "styles.css", "app.js", "ai.js", "data.js", "color.js", "art.js", "manifest.webmanifest",
  "icon-192.png", "icon-512.png", "maskable-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== "fonts" && k !== "libs").map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.hostname.endsWith("open-meteo.com")) return;              // live data, handled by the app
  const lib = url.hostname === "cdn.jsdelivr.net";
  if (lib || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(lib ? "libs" : "fonts").then(async c => {
      const hit = await c.match(e.request);
      const net = fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(e.request, {ignoreSearch: true}).then(hit => hit || fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match("index.html"))));
  }
});
