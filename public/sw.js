// dynacal's service worker: shows reminder pushes, opens the app when one is tapped, and keeps the app usable
// offline. It saves the last home page it loaded and the static files, always trying the network first, so
// online the app is served fresh. Offline, the saved home page shows (it says it's offline and refuses to change
// data), and any other page shows the offline page.

// Bump to drop everything saved by an older version.
const CACHE = "dynacal-v1";
// The page shown for a page that can't be fetched and has no saved copy; it needs no session.
const OFFLINE_PAGE = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_PAGE))
      .catch(() => {}) // Offline support is a nicety: never fail to install over it.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/** Static files: the app's scripts, styles and fonts, and the icons and manifest. */
function isStatic(url) {
  return url.pathname.startsWith("/_next/static/") || /\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname);
}

/** Fetches and saves under `key`; if the network fails, answers with what was saved, or `fallback`. */
async function networkFirst(request, key, fallback) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    // Only a real page is worth keeping: not an error, and not a redirect to sign-in.
    if (key && response.ok && !response.redirected) await cache.put(key, response.clone());
    return response;
  } catch (error) {
    const saved = (key && (await cache.match(key))) || (fallback && (await cache.match(fallback)));
    if (saved) return saved;
    throw error;
  }
}

// Only reading goes through here: server actions (POSTs) and the rest pass straight to the network.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Signing out forgets the saved week, so it can't be read offline afterwards.
  if (request.method === "POST" && url.pathname === "/api/auth/sign-out") {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.delete("/")));
    return;
  }
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    // The home page is saved whatever its query (a reminder adds ?block=); other pages aren't saved.
    const key = url.pathname === "/" ? "/" : null;
    event.respondWith(networkFirst(request, key, OFFLINE_PAGE));
  } else if (isStatic(url)) {
    event.respondWith(networkFirst(request, request, null));
  }
});

self.addEventListener("push", (event) => {
  // Worded like `reminderMessage` in src/core/reminders.ts, without the Task, time or length it would give.
  let message = { title: "dynacal", body: "A Task starts soon", url: "/" };
  try {
    message = { ...message, ...event.data.json() };
  } catch {
    // Show the generic reminder rather than nothing.
  }
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: message.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin));
      return open ? open.focus().then((w) => w.navigate(url)) : self.clients.openWindow(url);
    }),
  );
});
