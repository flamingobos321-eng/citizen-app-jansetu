/**
 * Push notification registration bootstrap.
 *
 * Chooses the correct registration path at runtime:
 *   • Web (browser) → `lib/push.js` (Firebase Web SDK).
 *   • Native (Capacitor Android / iOS) → `@capacitor/push-notifications`.
 *
 * The chooser is safe to call even when Firebase / Capacitor isn't configured
 * — it will simply return { registered: false, reason: "..." }.
 */
import { registerForWebPush } from "./push";

const isCapacitor = () =>
  typeof window !== "undefined" &&
  (window.Capacitor?.isNativePlatform?.() ||
   window.Capacitor?.getPlatform?.() === "android" ||
   window.Capacitor?.getPlatform?.() === "ios");

export async function enablePushNotifications() {
  if (isCapacitor()) {
    return registerForNativePush();
  }
  return registerForWebPush();
}

async function registerForNativePush() {
  try {
    // Dynamic import so this doesn't fail in web-only builds.
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") {
      return { registered: false, reason: "permission-refused" };
    }
    await PushNotifications.register();
    return new Promise((resolve) => {
      const removeReg = PushNotifications.addListener("registration", async (t) => {
        try {
          const { api } = await import("./api");
          await api.post("/push/register", {
            token: t.value,
            platform: "android",
            device_info: navigator.userAgent.slice(0, 200),
          });
          removeReg.remove?.();
          resolve({ registered: true, token: t.value });
        } catch (e) {
          resolve({ registered: false, reason: e.message });
        }
      });
      PushNotifications.addListener("registrationError", (err) => {
        resolve({ registered: false, reason: err.error });
      });
    });
  } catch (e) {
    return { registered: false, reason: e.message };
  }
}
