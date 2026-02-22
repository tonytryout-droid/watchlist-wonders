// Firebase Cloud Messaging background service worker
// ⚠️ Service workers cannot read Vite env vars — the Firebase config below
//    must be kept in sync with your .env manually.
//    Leave the values blank during development; fill them in production.

importScripts(
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js",
);

// IMPORTANT: Replace with your actual Firebase config values before deploying.
// DO NOT commit real credentials — use a build step or placeholder swap.
firebase.initializeApp({
  apiKey: self.__FIREBASE_API_KEY__ || "",
  authDomain: self.__FIREBASE_AUTH_DOMAIN__ || "",
  projectId: self.__FIREBASE_PROJECT_ID__ || "",
  storageBucket: self.__FIREBASE_STORAGE_BUCKET__ || "",
  messagingSenderId: self.__FIREBASE_MESSAGING_SENDER_ID__ || "",
  appId: self.__FIREBASE_APP_ID__ || "",
});

const messaging = firebase.messaging();

// Handle background push messages — display a notification
messaging.onBackgroundMessage((payload) => {
  const { title = "Watchlist Wonders", body = "", icon = "/favicon.ico" } =
    payload.notification ?? {};

  self.registration.showNotification(title, {
    body,
    icon,
    data: payload.data,
  });
});

// Handle notification click — open the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  const absoluteUrl = new URL(url, self.location.origin).href;
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === absoluteUrl && "focus" in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow(absoluteUrl);
      }),
  );
});
