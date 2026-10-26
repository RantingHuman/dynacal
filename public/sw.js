// dynacal's service worker: shows reminder pushes and opens the app when one is tapped.
// It deliberately caches nothing, so the app is always served fresh.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Browsers only treat an app as installable when its service worker handles fetches.
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let message = { title: "dynacal", body: "A Block is starting soon.", url: "/" };
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
