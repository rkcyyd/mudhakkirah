/* service worker بسيط — يعمل بلا إنترنت */
/* استراتيجية: الشبكة أولًا للملفات (حتى تصل التحديثات)، ثم التخزين المؤقت احتياطيًا. */

const CACHE = "mudhakkirah-v4";
const SHELL = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./assets/fonts/fonts.css",
  "./manifest.webmanifest",
  "./manifest-widget.webmanifest",
  "./assets/icon.svg",
  "./assets/icon.png",
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  e.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(request).then((m) => m || caches.match("./index.html")))
  );
});

/* ===================== Web Push (يعمل حتى مع إغلاق التطبيق) ===================== */

self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch {}
  const title = data.title || "مذكّرتي";
  e.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || undefined,
      icon: "./assets/icon.png",
      badge: "./assets/icon.png",
      dir: "rtl",
      lang: "ar",
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./index.html#/tasks");
    })
  );
});
