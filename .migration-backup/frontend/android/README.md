# JanSetu Android App

The Android app is a [Capacitor](https://capacitorjs.com/) 7 wrap around the
production React web build. There is **no separate mobile-only code path** —
the same React frontend runs inside a native Android WebView, with a small
bridge for push notifications, status bar, and app lifecycle events.

## Prerequisites

- Node.js 20+
- Android Studio (Iguana or newer)
- JDK 21
- A Firebase project (for push notifications — optional but recommended)

## First-time setup

```bash
cd frontend
yarn install
yarn build                       # builds the React web app into ./build
npx cap sync android             # copies build/ into android/app/src/main/assets/public
```

## Enabling push notifications (FCM)

1. Create a Firebase project at https://console.firebase.google.com.
2. Add an **Android app** with package name `in.jansetu.app`.
3. Download `google-services.json` and place it at `frontend/android/app/google-services.json`.
4. In Firebase Console → Cloud Messaging → Web Push certificates, generate a **VAPID key**.
5. Firebase Console → Project settings → Service accounts → generate a new private key. Save the JSON to a secure location and set on the **backend**:
   ```
   FCM_SERVICE_ACCOUNT_JSON=/path/to/firebase-service-account.json
   ```
   (or paste the raw JSON directly into the env var).
6. Frontend env vars (`frontend/.env.local`):
   ```
   REACT_APP_FIREBASE_API_KEY=...
   REACT_APP_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=<project>
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
   REACT_APP_FIREBASE_APP_ID=...
   REACT_APP_FIREBASE_VAPID_KEY=...
   ```
7. Copy the same web config values into `frontend/public/firebase-messaging-sw.js`
   (replace the `REPLACE_ME` placeholders — service workers cannot read
   `process.env` at runtime).

Without these, the app still builds and runs; push notifications simply fall
back to DEV mode (backend logs the notification, no delivery).

## Build the APK

```bash
cd frontend
yarn build
npx cap sync android
npx cap open android           # opens Android Studio
```

In Android Studio:
1. Wait for Gradle to sync.
2. Menu → Build → Generate Signed Bundle / APK.
3. Follow the wizard (create keystore on first run; keep it safe — required for all future updates).

For a debug build without signing:
```bash
cd frontend/android
./gradlew assembleDebug
# APK is at android/app/build/outputs/apk/debug/app-debug.apk
```

## Live-reload during development

Uncomment the `server.url` line in `capacitor.config.ts` and point it at your
preview URL:
```ts
server: { url: 'https://family-bonds-23.preview.emergentagent.com', androidScheme: 'https' }
```
Then `npx cap sync android` and rebuild. The Android WebView will load your
live web app instead of the bundled build — useful for iterating without
rebuilding the APK for every change.

## App identity

- Package: `in.jansetu.app`
- Display name: `JanSetu`
- Status bar: dark on brand navy (`#0A1128`)

## Common commands

| What                     | Command                          |
| ------------------------ | -------------------------------- |
| Sync web assets → Android| `npx cap sync android`           |
| Open in Android Studio   | `npx cap open android`           |
| Run on connected device  | `npx cap run android`            |
| List installed plugins   | `npx cap ls`                     |
