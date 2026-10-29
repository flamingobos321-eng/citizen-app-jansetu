/**
 * Firebase Cloud Messaging — Web Push registration.
 *
 * When `REACT_APP_FIREBASE_*` env vars are set the browser prompts the user
 * for notification permission, obtains an FCM token, and POSTs it to the
 * backend at /api/push/register.  Without the env vars the module quietly
 * no-ops so the app continues to work in development.
 *
 * Required env (Vercel / Netlify / .env.local):
 *   REACT_APP_FIREBASE_API_KEY
 *   REACT_APP_FIREBASE_AUTH_DOMAIN
 *   REACT_APP_FIREBASE_PROJECT_ID
 *   REACT_APP_FIREBASE_MESSAGING_SENDER_ID
 *   REACT_APP_FIREBASE_APP_ID
 *   REACT_APP_FIREBASE_VAPID_KEY   (Cloud Messaging > Web Push certificates)
 */
import { api } from "./api";

const cfg = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const VAPID_KEY = process.env.REACT_APP_FIREBASE_VAPID_KEY;

let _messaging = null;
let _tokenPromise = null;

const isConfigured = () => Boolean(cfg.apiKey && cfg.projectId && cfg.appId && VAPID_KEY);

async function _initMessaging() {
  if (_messaging) return _messaging;
  const { initializeApp, getApps } = await import("firebase/app");
  const { getMessaging, isSupported } = await import("firebase/messaging");
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;
  const app = getApps()[0] || initializeApp(cfg);
  _messaging = getMessaging(app);
  return _messaging;
}

/**
 * Ask permission and register a token with the backend.
 * Called AFTER the user has explicitly opted in (e.g. clicked "Enable notifications").
 * Returns { registered: bool, reason?: string }.
 */
export async function registerForWebPush() {
  if (!isConfigured()) {
    return { registered: false, reason: "firebase-not-configured" };
  }
  if (typeof window === "undefined" || !("Notification" in window)) {
    return { registered: false, reason: "notifications-unsupported" };
  }
  if (Notification.permission === "denied") {
    return { registered: false, reason: "permission-denied" };
  }
  if (Notification.permission !== "granted") {
    const p = await Notification.requestPermission();
    if (p !== "granted") return { registered: false, reason: "permission-refused" };
  }

  const messaging = await _initMessaging();
  if (!messaging) return { registered: false, reason: "messaging-unsupported" };

  // Register the service worker that handles background push.
  const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

  const { getToken, onMessage } = await import("firebase/messaging");
  _tokenPromise = getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
  const token = await _tokenPromise;
  if (!token) return { registered: false, reason: "no-token-returned" };

  await api.post("/push/register", {
    token,
    platform: "web",
    device_info: navigator.userAgent.slice(0, 200),
  });

  // Foreground messages — surface as a toast.
  onMessage(messaging, (msg) => {
    const { title, body } = msg.notification || {};
    try {
      // Lazy-import sonner so tests without a DOM don't crash.
      import("sonner").then(({ toast }) => {
        toast(title || "New notification", { description: body });
      });
    } catch (_) { /* ignore */ }
  });

  return { registered: true, token };
}

/** Unregister the currently-stored token (best-effort). */
export async function unregisterWebPush() {
  try {
    const token = await _tokenPromise;
    if (token) {
      await api.delete(`/push/register?token=${encodeURIComponent(token)}`);
    }
  } catch (_) { /* ignore */ }
}

export const pushConfigured = isConfigured;
