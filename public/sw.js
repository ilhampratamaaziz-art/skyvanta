const SHELL_CACHE = "skyvanta-shell-v1";
const API_CACHE = "skyvanta-api-v1";

const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/aurora-redesign.css",
  "/i18n.js?v=1.0",
  "/locationCodes.js?v=5.0",
  "/iconMapper.js?v=5.0",
  "/app.js?v=5.0",
  "/aurora-router.js?v=5.0",
  "/overview-motion.js?v=1.0",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/hero-sky.jpg",
  "/vendor/leaflet/leaflet.css",
  "/vendor/leaflet/leaflet.js",
  "/icons/berawan.svg",
  "/icons/cerah-berawan.svg",
  "/icons/cerah.svg",
  "/icons/hujan-ringan.svg",
  "/icons/hujan-sedang.svg",
  "/icons/hujan-lebat.svg",
  "/icons/kabut.svg",
  "/icons/petir.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.allSettled(
        SHELL_ASSETS.map((asset) =>
          cache.add(new Request(asset, { cache: "reload" })).catch(() => null)
        )
      )
    )
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
            .filter((k) => k !== SHELL_CACHE && k !== API_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function handleApiGet(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const headers = new Headers(networkResponse.headers);
      headers.set("X-Skyvanta-Cached-At", new Date().toISOString());
      const body = await networkResponse.clone().arrayBuffer();
      const cachedResponse = new Response(body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers
      });
      await cache.put(request, cachedResponse);
    }
    return networkResponse;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set("X-Skyvanta-Offline", "1");
      if (!headers.get("X-Skyvanta-Cached-At")) {
        headers.set("X-Skyvanta-Cached-At", new Date().toISOString());
      }
      const body = await cached.arrayBuffer();
      return new Response(body, {
        status: cached.status,
        statusText: cached.statusText,
        headers
      });
    }
    return new Response(
      JSON.stringify({
        success: false,
        offline: true,
        message: "Offline and no cached BMKG response available."
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "X-Skyvanta-Offline": "1"
        }
      }
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js") return;

  if (url.pathname.startsWith("/api/") || url.pathname === "/wilayah.json") {
    event.respondWith(handleApiGet(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (res) => {
          if (res && res.ok) {
            const cache = await caches.open(SHELL_CACHE);
            cache.put("/index.html", res.clone()).catch(() => null);
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(SHELL_CACHE);
          return (
            (await cache.match("/index.html")) ||
            (await cache.match("/")) ||
            Response.error()
          );
        })
    );
    return;
  }

  event.respondWith(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const cached =
        (await cache.match(request)) ||
        (await cache.match(request, { ignoreSearch: true }));
      const networkFetch = fetch(request)
        .then((res) => {
          if (res && res.ok) {
            cache.put(request, res.clone()).catch(() => null);
          }
          return res;
        })
        .catch(() => null);
      return cached || (await networkFetch) || Response.error();
    })
  );
});
