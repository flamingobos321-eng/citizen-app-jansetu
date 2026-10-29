// Native platform detection. Returns true only when running inside the
// Capacitor Android/iOS shell. Used to gate mobile-only screens (Welcome,
// LoginChoice) and to hide web-only affordances like the standalone
// "Claim Voter Record" button.
export const isNativePlatform = () => {
  if (typeof window === "undefined") return false;
  const cap = window.Capacitor;
  if (!cap) return false;
  if (typeof cap.isNativePlatform === "function") return cap.isNativePlatform();
  const p = typeof cap.getPlatform === "function" ? cap.getPlatform() : null;
  return p === "android" || p === "ios";
};

export const nativePlatform = () => {
  if (typeof window === "undefined") return null;
  return window.Capacitor?.getPlatform?.() || null;
};
