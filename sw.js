/* Daily Fit service worker.
   App files: always the latest from the network when online (so an update shows up on the next open),
   with the saved copy used only when offline or the network is very slow. Libraries and fonts: saved once. */
const VERSION = "dailyfit-v7.2.0";
const SHELL = ["./", "index.html", "styles.css", "app.js", "ai.js", "ai-worker.js", "config.js", "data.js", "color.js", "art.js", "manifest.webmanifest",
  "icon-192.png", "icon-512.png", "maskable-512.png"];

self.addEventListener("install", e => {
  /* "reload" skips the browser's HTTP cache, so a half-published update can't be saved as the new version */
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => fetch(new Request(u, { cache: "reload" }))
    .then(r => r.ok ? c.put(u, r) : null).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== "fonts" && k !== "libs").map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), ms))]);
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.hostname.endsWith("supabase.co")) return;                  // your account data: always live
  if (url.hostname.endsWith("open-meteo.com")) return;              // weather: always live
  if (url.pathname.includes("/data/")) return;                       // daily trend data: always live
  const lib = url.hostname === "cdn.jsdelivr.net";
  if (lib || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(lib ? "libs" : "fonts").then(async c => {
      const hit = await c.match(e.request);
      const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  const image = /\.(png|jpe?g|webp|svg)$/i.test(url.pathname);
  if (image) {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
    return;
  }
  /* network first, saved copy as fallback */
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    try {
      const r = await timeout(fetch(e.request, { cache: "no-cache" }), 6000);
      if (r.ok) c.put(e.request.mode === "navigate" ? "index.html" : e.request, r.clone());
      return r;
    } catch {
      return (await c.match(e.request, { ignoreSearch: true })) || (await c.match("index.html")) || Response.error();
    }
  })());
});
