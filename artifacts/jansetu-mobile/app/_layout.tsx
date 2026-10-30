import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  useFonts,
} from '@expo-google-fonts/manrope';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';
import { Stack } from 'expo-router';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/lib/auth';
import { useAuth } from '@/lib/auth';
import { Platform } from 'react-native';

// Prevent the splash screen from auto-hiding before asset loading is complete.
void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const pendingIssueId = React.useRef<string | null>(null);

  const handleNotificationResponse = React.useCallback((response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data ?? {};
    const rawIssueId = data.issue_id ?? data.issueId;
    const clickAction =
      typeof data.click_action === 'string'
        ? data.click_action
        : typeof data.clickAction === 'string'
          ? data.clickAction
          : '';
    const routeMatch = clickAction.match(/\/issues\/([^/?#]+)/);
    const issueId =
      typeof rawIssueId === 'string' && rawIssueId.trim()
        ? rawIssueId
        : routeMatch?.[1];
    if (issueId) {
      try {
        pendingIssueId.current = decodeURIComponent(issueId);
      } catch {
        pendingIssueId.current = issueId;
      }
    }
    void Notifications.clearLastNotificationResponseAsync();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const subscription = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse,
    );
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleNotificationResponse(response);
    });
    return () => subscription.remove();
  }, [handleNotificationResponse]);

  useEffect(() => {
    if (!loading && user && pendingIssueId.current) {
      const issueId = pendingIssueId.current;
      pendingIssueId.current = null;
      router.push(`/issues/${encodeURIComponent(issueId)}`);
    }
  }, [loading, user]);

  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="office" options={{ headerShown: false }} />
      <Stack.Screen name="visits" options={{ headerShown: false }} />
      <Stack.Screen name="devworks" options={{ headerShown: false }} />
      <Stack.Screen name="households" options={{ headerShown: false }} />
      <Stack.Screen name="households/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="my-household" options={{ headerShown: false }} />
      <Stack.Screen name="persons/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="campaigns" options={{ headerShown: false }} />
      <Stack.Screen name="campaigns/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="reports" options={{ headerShown: false }} />
      <Stack.Screen name="issues/new" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="issues/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <StatusBar style="dark" />
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
