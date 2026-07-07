/* Firebase Cloud Messaging service worker.
 *
 * Serves background push notifications for the JanSetu web app.
 * NOTE: service workers can't read from `process.env`, so the Firebase config
 * is inlined here at build time.  Replace the placeholders below with your
 * project's config OR let the build pipeline replace them.
 *
 * If Firebase isn't configured this file still needs to exist to avoid 404s;
 * it will simply no-op.
 */
/* eslint-disable */
try {
  importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js");

  // ---- REPLACE-ME: paste your Firebase web app config below ----
  const firebaseConfig = {
    apiKey: "REPLACE_ME",
    authDomain: "REPLACE_ME.firebaseapp.com",
    projectId: "REPLACE_ME",
    messagingSenderId: "REPLACE_ME",
    appId: "REPLACE_ME",
  };
  if (firebaseConfig.apiKey !== "REPLACE_ME") {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const { title, body } = payload.notification || {};
      self.registration.showNotification(title || "JanSetu", {
        body: body || "",
        icon: "/logo192.png",
        badge: "/logo192.png",
        data: payload.data || {},
      });
    });
  }
} catch (e) {
  // Firebase not configured — service worker is a no-op.
  // (Do not throw — a throwing SW would fail install and repeatedly 404 clients.)
}
