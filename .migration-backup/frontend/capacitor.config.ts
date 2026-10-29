import type { CapacitorConfig } from '@capacitor/cli';

// JanSetu Android app (Capacitor 7.x wrap around the React web build).
//
// Build steps (run on a developer workstation with Android Studio + JDK 21):
//   1.  yarn build                    # builds the React web app into ./build
//   2.  npx cap sync android          # copies build/ into android/app/src/main/assets/public
//   3.  npx cap open android          # opens Android Studio for signing + APK/AAB
//
// The web app talks to REACT_APP_BACKEND_URL for all API calls (unchanged);
// there is no separate mobile-only API surface.
const config: CapacitorConfig = {
  appId: 'in.jansetu.app',
  appName: 'JanSetu',
  webDir: 'build',
  bundledWebRuntime: false,
  server: {
    // Production: leave `url` unset so the app serves the bundled build/.
    // For live-reload during dev, uncomment and point to your backend URL:
    // url: 'https://yourdomain.com',
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    PushNotifications: {
      // FCM is the delivery channel; server pushes via firebase-admin.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0A1128',
    },
  },
};

export default config;
