import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  apiRequest,
  registerPushToken,
  unregisterPushToken,
  updateNotificationPreferences,
  type NotificationCategory,
  type NotificationPreferences,
} from '@/lib/api';

function tokenStorageKey(userId: string) {
  return `jansetu_push_token_${userId}`;
}

export function getSavedPushToken(userId: string) {
  return AsyncStorage.getItem(tokenStorageKey(userId));
}

async function registerCurrentDevice(authToken: string) {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    throw new Error('Push alerts can be enabled in the JanSetu mobile app.');
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('jansetu_default', {
      name: 'JanSetu alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error(
      permission.canAskAgain
        ? 'Notification permission was not granted. You can try enabling alerts again.'
        : 'Notification permission is off for JanSetu. Enable it in your device settings.',
    );
  }

  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;
  let expoToken: Notifications.ExpoPushToken;
  try {
    expoToken = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('No "projectId" found')) {
      throw new Error(
        'Push alerts are not configured for this app build yet. Try again after its Expo push setup is complete.',
      );
    }
    throw error;
  }

  await registerPushToken(expoToken.data, Platform.OS, authToken);
  return expoToken.data;
}

export async function setPushNotificationPreference(
  userId: string,
  authToken: string,
  category: NotificationCategory,
  enabled: boolean,
) {
  const savedToken = await getSavedPushToken(userId);
  let pushToken = savedToken;
  let registeredDuringUpdate = false;

  if (enabled) {
    if (pushToken) {
      await registerPushToken(pushToken, Platform.OS as 'android' | 'ios', authToken);
    } else {
      pushToken = await registerCurrentDevice(authToken);
      registeredDuringUpdate = true;
    }
  }

  try {
    await updateNotificationPreferences({ [category]: enabled }, authToken);
    if (enabled && pushToken) await AsyncStorage.setItem(tokenStorageKey(userId), pushToken);
  } catch (error) {
    if (registeredDuringUpdate && pushToken) {
      await unregisterPushToken(pushToken, authToken).catch(() => undefined);
    }
    throw error;
  }

  if (!enabled) {
    const preferences = await apiRequest<NotificationPreferences>('/me/notification-prefs', {
      token: authToken,
    });
    if (!Object.values(preferences).some(Boolean) && savedToken) {
      try {
        await unregisterPushToken(savedToken, authToken);
        await AsyncStorage.removeItem(tokenStorageKey(userId));
      } catch (error) {
        console.warn('Could not unregister the JanSetu push token after all alert types were disabled.', error);
      }
    }
  }
}

export async function enableIssuePushNotifications(userId: string, authToken: string) {
  return setPushNotificationPreference(userId, authToken, 'issue_updates', true);
}

export async function disableIssuePushNotifications(userId: string, authToken: string) {
  return setPushNotificationPreference(userId, authToken, 'issue_updates', false);
}

export async function unregisterPushTokenOnSignOut(
  userId: string,
  authToken: string,
) {
  const savedToken = await getSavedPushToken(userId);
  if (!savedToken) return;
  try {
    await unregisterPushToken(savedToken, authToken);
    await AsyncStorage.removeItem(tokenStorageKey(userId));
  } catch (error) {
    // Keep the saved token so the same user can retry cleanup after signing in.
    console.warn('Could not unregister the JanSetu push token before sign-out.', error);
  }
}
