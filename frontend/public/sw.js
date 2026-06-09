/**
 * StudyForge Service Worker
 *
 * Handles incoming push notifications while the app is in background/inactive,
 * and handles notification clicks to navigate the user to the correct page.
 */

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    console.log("[ServiceWorker] Received push payload:", payload);

    const title = payload.title || "StudyForge Alert";
    const options = {
      body: payload.body || "You have a new study update.",
      icon: payload.icon || "/favicon.ico",
      badge: payload.badge || "/favicon.ico",
      data: payload.data || { url: "/" },
      vibrate: [100, 50, 100],
      actions: [
        { action: "open", title: "View Details" },
        { action: "close", title: "Dismiss" },
      ],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (error) {
    console.error("[ServiceWorker] Error displaying push notification:", error);
    
    // Fallback if payload isn't JSON
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification("StudyForge Notification", {
        body: text,
        icon: "/favicon.ico",
      })
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Retrieve the url from notification data
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If there's an open window, focus it and redirect it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus().then((focusedClient) => {
            if ("navigate" in focusedClient) {
              return focusedClient.navigate(targetUrl);
            }
          });
        }
      }
      // If no window open, open a new tab/window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
